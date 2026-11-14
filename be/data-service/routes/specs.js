// User sửa trực tiếp Spec / bấm Xác nhận
const router = require('express').Router();
const specs = require('../models/specModel');
const conv = require('../models/conversationModel');
const { ok, fail, wrap } = require('../utils/response');

async function guard(req, res) {
  const s = await specs.get(req.params.id);
  if (!s) return fail(res, 'Không tìm thấy spec', 404), null;
  const c = await conv.get(s.conversation_id, req.user);
  if (!c) return fail(res, 'Không có quyền', 403), null;
  return s;
}

// Sửa -> tạo version mới (edited_by_user = 1)
router.put('/:id', wrap(async (req, res) => {
  const s = await guard(req, res);
  if (!s) return;
  if (!req.body || typeof req.body.content !== 'object') return fail(res, 'content phải là object JSON');
  const v = await specs.addVersion(s.conversation_id, req.body.content, { edited: true });
  await conv.update(s.conversation_id, { status: 'spec_ready' });
  return ok(res, v, 'Đã lưu bản sửa');
}));

router.post('/:id/confirm', wrap(async (req, res) => {
  const s = await guard(req, res);
  if (!s) return;
  await specs.confirm(s.id);
  return ok(res, await specs.get(s.id), 'Đã xác nhận');
}));

router.get('/by-conversation/:cid', wrap(async (req, res) => {
  const c = await conv.get(req.params.cid, req.user);
  if (!c) return fail(res, 'Không tìm thấy', 404);
  return ok(res, await specs.list(c.id));
}));

module.exports = router;
