// Hội thoại: chưa có web -> Interviewer; đã có web -> Reviser.
const router = require('express').Router();
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const conv = require('../models/conversationModel');
const specs = require('../models/specModel');
const runs = require('../models/runModel');
const preview = require('../services/previewManager');
const { ok, fail, wrap } = require('../utils/response');

const AI_URL = (process.env.AI_URL || 'http://ai:8000').replace(/\/+$/, '');
const busyStatuses = new Set(['queued', 'planning', 'coding', 'testing', 'starting']);

function aiError(err) {
  const detail = err.response?.data?.detail;
  return typeof detail === 'string' ? detail : (err.message || 'Lỗi không xác định');
}

// Không dùng một run failed làm bản gốc, TRỪ KHI Docker chứng minh web vẫn chạy.
async function findRevisionBase(conversationId) {
  const candidates = await runs.revisionCandidates(conversationId);
  for (const run of candidates) {
    const compose = path.join(preview.projectDir(run.id), 'docker-compose.yml');
    if (!fs.existsSync(compose)) continue;
    if (run.status === 'running' || run.status === 'stopped') return run;
    if (['failed', 'ready'].includes(run.status) && await preview.isRunning(run.id)) return run;
  }
  return null;
}

async function sendRevision({ runId, base, conversationId, currentSpec, nextSpec, changeRequest, specId }) {
  try {
    const result = await axios.post(`${AI_URL}/revise`, {
      run_id: runId,
      base_run_id: base.id,
      conversation_id: conversationId,
      spec: nextSpec,
      prev_spec: currentSpec,
      change_request: changeRequest,
      template: base.template || 'ecommerce_basic',
      base_plan: base.plan || null,
      base_files: await runs.files(base.id)
    }, { timeout: 30000 });
    if (result.status !== 202 && !result.data?.accepted) {
      throw new Error('AI không xác nhận tiếp nhận tác vụ revise');
    }
    console.log(`[Run ${runId}] AI tiếp nhận revise từ run_${base.id} (HTTP ${result.status})`);
  } catch (err) {
    console.error(`[Run ${runId}] Không gửi được revise:`, aiError(err));
    const now = await runs.get(runId);
    // Request có thể đã được xử lý; tuyệt đối không ghi đè trạng thái đang chạy/đã xong.
    if (now && now.status === 'queued') {
      await runs.update(runId, {
        status: 'failed',
        error: `Không gửi được tác vụ revise: ${aiError(err)}`.slice(0, 1500),
        current_agent: null,
        finished_at: new Date()
      });
      await conv.addMessage(conversationId, 'assistant',
        `Không thể bắt đầu sửa website: ${aiError(err)}`);
      await conv.update(conversationId, { status: 'done' });
    }
  }
}

router.get('/', wrap(async (req, res) => ok(res, await conv.listByUser(req.user))));

router.post('/', wrap(async (req, res) => {
  const id = await conv.create(req.user.id, req.body && req.body.title);
  return ok(res, await conv.get(id, req.user), 'Đã tạo', 201);
}));

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

router.post('/:id/messages', wrap(async (req, res) => {
  const c = await conv.get(req.params.id, req.user);
  if (!c) return fail(res, 'Không tìm thấy', 404);
  const content = String(req.body?.content || '').trim();
  if (!content) return fail(res, 'Nội dung trống', 400);
  if (content.length > 10000) return fail(res, 'Tin nhắn quá dài', 400);
  if (await runs.inProgress(c.id)) {
    return fail(res, 'AI đang tạo hoặc sửa website. Hãy xem tiến trình hiện tại.', 409);
  }

  const originalSpec = await specs.latest(c.id);
  const base = await findRevisionBase(c.id);
  await conv.addMessage(c.id, 'user', content);
  const recent = await conv.lastMessages(c.id, 8);

  let ai;
  try {
    const endpoint = base ? '/feedback' : '/chat';
    const payload = { summary: c.summary || '', spec: originalSpec?.content || null, messages: recent };
    if (base) payload.base_plan = base.plan || null;
    ai = (await axios.post(`${AI_URL}${endpoint}`, payload, { timeout: 120000 })).data;
  } catch (err) {
    return fail(res, `AI lỗi: ${aiError(err)}`, 502);
  }

  if (!base) {
    // Pha thu thập yêu cầu tạo website mới: giữ nguyên hành vi gốc.
    await conv.addMessage(c.id, 'assistant', ai.reply);
    let spec = originalSpec;
    if (ai.spec_draft) spec = await specs.addVersion(c.id, ai.spec_draft, { status: 'draft' });
    const fields = { status: ai.ready ? 'spec_ready' : 'interviewing' };
    if (ai.summary) fields.summary = ai.summary;
    if (c.title === 'Cuộc trò chuyện mới') fields.title = content.slice(0, 60);
    await conv.update(c.id, fields);
    return ok(res, { reply: ai.reply, ready: !!ai.ready, missing: ai.missing || [], spec });
  }

  // Pha đã có website: chat thường không làm thay đổi Spec hay trạng thái website.
  if (ai.action !== 'revise') {
    const reply = ai.reply || 'Bạn cần hỗ trợ gì với website hiện tại?';
    await conv.addMessage(c.id, 'assistant', reply);
    if (ai.summary) await conv.update(c.id, { summary: ai.summary });
    return ok(res, { reply, ready: false, missing: [], spec: originalSpec, action: 'chat' });
  }

  const changeRequest = String(ai.change_request || content).trim();
  const updatedSpec = ai.spec_draft || originalSpec?.content;
  if (!updatedSpec) return fail(res, 'Không có Spec gốc để sửa website', 409);

  let specForRun = originalSpec;
  // Chỉ cập nhật Spec khi Reviser chủ động trả bản mới.
  if (ai.spec_draft) {
    specForRun = await specs.addVersion(c.id, updatedSpec, { status: 'confirmed' });
  }
  if (!specForRun) return fail(res, 'Không tìm thấy Spec cho website', 409);

  const runId = await runs.create({
    conversationId: c.id,
    specId: specForRun.id,
    template: base.template || 'ecommerce_basic'
  });
  const reply = `Đã nhận yêu cầu sửa website từ Run #${base.id}. ` +
    `Đang tạo bản sửa Run #${runId}; chỉ chỉnh sửa phần liên quan: ${changeRequest}`;
  await conv.addMessage(c.id, 'assistant', reply);
  await conv.update(c.id, {
    status: 'generating',
    ...(ai.summary ? { summary: ai.summary } : {})
  });

  // Endpoint /revise trả HTTP 202, quá trình build diễn ra ở Orchestrator.
  void sendRevision({
    runId,
    base,
    conversationId: c.id,
    currentSpec: originalSpec?.content || null,
    nextSpec: updatedSpec,
    changeRequest,
    specId: specForRun.id
  }).catch(err => console.error(`[Run ${runId}] Dispatch revise exception:`, err));

  return ok(res, {
    reply, ready: false, missing: [], spec: specForRun,
    action: 'revise', run_id: runId, revision_of: base.id
  }, 'Đã bắt đầu sửa website', 202);
}));

module.exports = router;
