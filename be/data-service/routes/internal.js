// Route nội bộ: AI service báo tiến trình / nhờ build+chạy web / lưu tóm tắt
const router = require('express').Router();
const runs = require('../models/runModel');
const conv = require('../models/conversationModel');
const preview = require('../services/previewManager');
const { ok, fail, wrap } = require('../utils/response');

// Cập nhật trạng thái run
router.post('/runs/:id/status', wrap(async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const allowed = ['status', 'current_agent', 'plan', 'report', 'error', 'retry_count'];
  const fields = {};
  for (const k of allowed) if (req.body[k] !== undefined) fields[k] = req.body[k];
  if (['failed', 'running'].includes(fields.status)) fields.finished_at = new Date();
  await runs.update(id, fields);

  if (fields.status === 'running' || fields.status === 'failed') {
    const r = await runs.get(id);
    await conv.update(r.conversation_id, { status: fields.status === 'running' ? 'done' : 'spec_ready' });
  }
  return ok(res);
}));

// Lưu danh sách file của run
router.post('/runs/:id/files', wrap(async (req, res) => {
  await runs.setFiles(parseInt(req.params.id, 10), req.body.files || []);
  return ok(res);
}));

// Tester gọi: build thật + chạy web, nhận báo cáo lỗi theo file
router.post('/runs/:id/build', wrap(async (req, res) => {
  const report = await preview.buildAndStart(parseInt(req.params.id, 10));
  return ok(res, report);
}));

router.post('/conversations/:id/summary', wrap(async (req, res) => {
  await conv.update(parseInt(req.params.id, 10), { summary: req.body.summary || '' });
  return ok(res);
}));

module.exports = router;
