// Bắt đầu sinh web từ Spec ĐÃ XÁC NHẬN -> giao cho AI Orchestrator (chạy nền)
const router = require('express').Router();
const axios = require('axios');
const conv = require('../models/conversationModel');
const specs = require('../models/specModel');
const runs = require('../models/runModel');
const preview = require('../services/previewManager');
const { ok, fail, wrap } = require('../utils/response');

const AI_URL = process.env.AI_URL || 'http://ai:8000';

router.post('/', wrap(async (req, res) => {
  const { conversation_id, template } = req.body || {};
  const c = await conv.get(conversation_id, req.user);
  if (!c) return fail(res, 'Không tìm thấy hội thoại', 404);

  const spec = await specs.latest(c.id);
  if (!spec || spec.status !== 'confirmed') return fail(res, 'Hãy xác nhận yêu cầu (Spec) trước khi tạo web');

  const runId = await runs.create({ conversationId: c.id, specId: spec.id, template });
  await conv.update(c.id, { status: 'generating' });

  try {
    await axios.post(`${AI_URL}/generate`, { run_id: runId, spec: spec.content, template: template || 'ecommerce_basic' }, { timeout: 15000 });
  } catch (e) {
    await runs.update(runId, { status: 'failed', error: `Không gọi được AI service: ${e.message}` });
    return fail(res, 'Không gọi được AI service', 502);
  }
  return ok(res, { run_id: runId }, 'Đã bắt đầu tạo web', 202);
}));

// Tắt web đang chạy
router.post('/:runId/stop', wrap(async (req, res) => {
  await preview.stopRun(parseInt(req.params.runId, 10));
  return ok(res, null, 'Đã tắt web');
}));

module.exports = router;
