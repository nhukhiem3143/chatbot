// CRUD hội thoại + gửi tin (gọi AI Interviewer, lưu Spec nháp)
const router = require('express').Router();
const axios = require('axios');
const conv = require('../models/conversationModel');
const specs = require('../models/specModel');
const { ok, fail, wrap } = require('../utils/response');

const AI_URL = process.env.AI_URL || 'http://ai:8000';

router.get('/', wrap(async (req, res) => ok(res, await conv.listByUser(req.user))));

router.post('/', wrap(async (req, res) => {
  const id = await conv.create(req.user.id, req.body && req.body.title);
  return ok(res, await conv.get(id, req.user), 'Đã tạo', 201);
}));

// Lấy hội thoại + tin nhắn + spec mới nhất
router.get('/:id', wrap(async (req, res) => {
  const c = await conv.get(req.params.id, req.user);
  if (!c) return fail(res, 'Không tìm thấy', 404);
  return ok(res, { conversation: c, messages: await conv.messages(c.id), spec: await specs.latest(c.id) });
}));

router.delete('/:id', wrap(async (req, res) => {
  const c = await conv.get(req.params.id, req.user);
  if (!c) return fail(res, 'Không tìm thấy', 404);
  await conv.remove(c.id);
  return ok(res, null, 'Đã xóa');
}));

// Gửi 1 tin -> Interviewer trả lời. Chỉ gửi AI: summary + spec hiện tại + vài tin gần nhất.
router.post('/:id/messages', wrap(async (req, res) => {
  const c = await conv.get(req.params.id, req.user);
  if (!c) return fail(res, 'Không tìm thấy', 404);
  const content = ((req.body && req.body.content) || '').trim();
  if (!content) return fail(res, 'Nội dung trống');

  await conv.addMessage(c.id, 'user', content);
  const cur = await specs.latest(c.id);
  const recent = await conv.lastMessages(c.id, 8);

  let ai;
  try {
    ai = (
      await axios.post(`${AI_URL}/chat`, { summary: c.summary || '', spec: cur ? cur.content : null, messages: recent }, { timeout: 120000 })
    ).data;
  } catch (e) {
    const msg = (e.response && e.response.data && e.response.data.detail) || e.message;
    return fail(res, `AI lỗi: ${msg}`, 502);
  }

  await conv.addMessage(c.id, 'assistant', ai.reply);
  let spec = cur;
  if (ai.spec_draft) spec = await specs.addVersion(c.id, ai.spec_draft, { status: 'draft' });

  const fields = { status: ai.ready ? 'spec_ready' : 'interviewing' };
  if (ai.summary) fields.summary = ai.summary;
  if (c.title === 'Cuộc trò chuyện mới') fields.title = content.slice(0, 60);
  await conv.update(c.id, fields);

  return ok(res, { reply: ai.reply, ready: !!ai.ready, missing: ai.missing || [], spec });
}));

module.exports = router;
