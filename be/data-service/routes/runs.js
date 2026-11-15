// Lịch sử generate, tiến trình, danh sách + nội dung file
const router = require('express').Router();
const fs = require('fs');
const path = require('path');
const runs = require('../models/runModel');
const conv = require('../models/conversationModel');
const preview = require('../services/previewManager');
const { ok, fail, wrap } = require('../utils/response');

router.get('/', wrap(async (req, res) => ok(res, await runs.listForUser(req.user))));

async function load(req, res) {
  const r = await runs.get(req.params.id);
  if (!r) return fail(res, 'Không tìm thấy run', 404), null;
  if (!(await conv.get(r.conversation_id, req.user))) return fail(res, 'Không có quyền', 403), null;
  return r;
}

router.get('/:id', wrap(async (req, res) => {
  const r = await load(req, res);
  if (!r) return;
  // DB ghi "running" nhưng container thật đã tắt (vd sau khi tắt/bật máy) -> sửa lại cho đúng để UI hiện nút "Bật lại web"
  if (r.status === 'running' && r.port && !(await preview.isRunning(r.id))) {
    await runs.update(r.id, { status: 'stopped', port: null });
    r.status = 'stopped';
    r.port = null;
  }
  return ok(res, { ...r, files: await runs.files(r.id) });
}));

// Đọc nội dung 1 file (chặn path traversal)
router.get('/:id/file', wrap(async (req, res) => {
  const r = await load(req, res);
  if (!r) return;
  const base = path.resolve(preview.projectDir(r.id));
  const target = path.resolve(base, req.query.path || '');
  if (!target.startsWith(base + path.sep) || !fs.existsSync(target) || !fs.statSync(target).isFile())
    return fail(res, 'File không hợp lệ', 400);
  return ok(res, { path: req.query.path, content: fs.readFileSync(target, 'utf8') });
}));

// Tải project dạng ZIP (AI service nén, data-service chuyển tiếp)
router.get('/:id/zip', wrap(async (req, res) => {
  const r = await load(req, res);
  if (!r) return;
  const axios = require('axios');
  const up = await axios.get(`${process.env.AI_URL || 'http://ai:8000'}/runs/${r.id}/zip`, { responseType: 'stream', timeout: 60000 });
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename=run_${r.id}.zip`);
  up.data.pipe(res);
}));

module.exports = router;