// Route nội bộ - phải được bảo vệ bởi INTERNAL_TOKEN tại app.js
const router = require('express').Router();
const runs = require('../models/runModel');
const conv = require('../models/conversationModel');
const preview = require('../services/previewManager');
const { ok, fail, wrap } = require('../utils/response');

const validId = value => {
  const n = Number(value);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
};

router.post('/runs/:id/status', wrap(async (req, res) => {
  const id = validId(req.params.id);
  if (!id) return fail(res, 'Run không hợp lệ', 400);
  const current = await runs.get(id);
  if (!current) return fail(res, 'Không tìm thấy run', 404);
  const allowed = ['status', 'current_agent', 'plan', 'report', 'error', 'retry_count'];
  const fields = {};
  for (const key of allowed) if (req.body?.[key] !== undefined) fields[key] = req.body[key];
  if (fields.status === 'failed' || fields.status === 'running') fields.finished_at = new Date();
  await runs.update(id, fields);
  if (fields.status === 'running' || fields.status === 'failed') {
    await conv.update(current.conversation_id, {
      status: fields.status === 'running' ? 'done' : 'spec_ready'
    });
  }
  return ok(res);
}));

router.post('/runs/:id/files', wrap(async (req, res) => {
  const id = validId(req.params.id);
  if (!id) return fail(res, 'Run không hợp lệ', 400);
  await runs.setFiles(id, Array.isArray(req.body?.files) ? req.body.files : []);
  return ok(res);
}));

router.post('/runs/:id/build', wrap(async (req, res) => {
  const id = validId(req.params.id);
  if (!id) return fail(res, 'Run không hợp lệ', 400);
  const report = await preview.buildAndStart(id);
  return ok(res, report);
}));

// Thiếu route này thì Orchestrator._say() không lưu được thông báo hoàn tất sửa.
router.post('/conversations/:id/messages', wrap(async (req, res) => {
  const id = validId(req.params.id);
  if (!id) return fail(res, 'Hội thoại không hợp lệ', 400);
  const content = String(req.body?.content || '').trim();
  if (!content) return fail(res, 'Nội dung trống', 400);
  const role = req.body?.role;
  if (role !== 'assistant') return fail(res, 'Chỉ cho phép tin nhắn assistant', 400);
  await conv.addMessage(id, role, content.slice(0, 10000));
  return ok(res);
}));

router.post('/conversations/:id/summary', wrap(async (req, res) => {
  const id = validId(req.params.id);
  if (!id) return fail(res, 'Hội thoại không hợp lệ', 400);
  await conv.update(id, { summary: String(req.body?.summary || '').slice(0, 20000) });
  return ok(res);
}));

module.exports = router;
