
/**
 * Generate Routes
 *
 * AI Orchestrator là nơi duy nhất điều phối quá trình:
 * Planner -> Developer -> Tester -> Docker build -> Preview.
 *
 * Route này chỉ:
 * - Tiếp nhận yêu cầu tạo website.
 * - Tạo Run trong database.
 * - Gửi yêu cầu sang AI.
 * - Cho phép bật/tắt website thủ công.
 *
 * KHÔNG tự build lần thứ hai sau khi AI nhận yêu cầu.
 */

const router = require('express').Router();
const axios = require('axios');

const conv = require('../models/conversationModel');
const specs = require('../models/specModel');
const runs = require('../models/runModel');
const preview = require('../services/previewManager');

const { ok, fail, wrap } = require('../utils/response');

const AI_URL = (
  process.env.AI_URL || 'http://ai:8000'
).replace(/\/+$/, '');


// -----------------------------------------------------
// Helpers
// -----------------------------------------------------

function validId(value) {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function errorText(error) {
  const data = error.response?.data;

  if (typeof data?.detail === 'string') {
    return data.detail;
  }

  if (typeof data?.message === 'string') {
    return data.message;
  }

  return error.message || 'Lỗi không xác định';
}

/**
 * Kiểm tra Run tồn tại và thuộc hội thoại được phép truy cập.
 */
async function getAuthorizedRun(req, res) {
  const id = validId(req.params.runId);

  if (!id) {
    fail(res, 'Run ID không hợp lệ', 400);
    return null;
  }

  const run = await runs.get(id);

  if (!run) {
    fail(res, 'Không tìm thấy run', 404);
    return null;
  }

  const conversation = await conv.get(
    run.conversation_id,
    req.user
  );

  if (!conversation) {
    fail(res, 'Không có quyền truy cập', 403);
    return null;
  }

  return run;
}

/**
 * Chỉ ghi failed nếu AI chưa thực sự bắt đầu xử lý.
 *
 * Tránh trường hợp HTTP request báo lỗi nhưng AI đã
 * tiếp nhận và đang generate, làm ghi đè trạng thái.
 */
async function markDispatchFailed(runId, message) {
  const current = await runs.get(runId);

  if (!current) return;

  if (current.status === 'queued') {
    await runs.update(runId, {
      status: 'failed',
      current_agent: null,
      error: message.slice(0, 1500),
      finished_at: new Date()
    });

    await conv.update(current.conversation_id, {
      status: 'spec_ready'
    });
  }
}

/**
 * Gửi công việc sang AI.
 *
 * /generate trả 202 Accepted.
 * Orchestrator tiếp tục làm việc và cập nhật trạng thái
 * thông qua /internal/runs/:id/status.
 */
async function dispatchGenerate({
  runId,
  spec,
  template
}) {
  try {
    console.log(
      `[Run ${runId}] Gửi yêu cầu generate tới AI...`
    );

    const response = await axios.post(
      `${AI_URL}/generate`,
      {
        run_id: runId,
        spec,
        template
      },
      {
        timeout: 30000,
        validateStatus: (status) =>
          status >= 200 && status < 300
      }
    );

    console.log(
      `[Run ${runId}] AI đã tiếp nhận yêu cầu ` +
      `(HTTP ${response.status}).`
    );

    // KHÔNG gọi preview.buildAndStart() ở đây.
    // AI Orchestrator -> Tester sẽ tự gọi internal build.

  } catch (error) {
    const message = `Không gửi được yêu cầu tới AI: ${errorText(error)}`;

    console.error(`[Run ${runId}] ${message}`);

    try {
      await markDispatchFailed(runId, message);
    } catch (dbError) {
      console.error(
        `[Run ${runId}] Không cập nhật được trạng thái:`,
        dbError
      );
    }
  }
}


// -----------------------------------------------------
// POST /generate
// Tạo website từ Spec đã xác nhận
// -----------------------------------------------------

router.post('/', wrap(async (req, res) => {
  const { conversation_id, template } = req.body || {};

  const conversationId = validId(conversation_id);

  if (!conversationId) {
    return fail(res, 'conversation_id không hợp lệ', 400);
  }

  const conversation = await conv.get(
    conversationId,
    req.user
  );

  if (!conversation) {
    return fail(res, 'Không tìm thấy hội thoại', 404);
  }

  // Chặn tạo nhiều Run cùng lúc cho một hội thoại.
  if (await runs.inProgress(conversation.id)) {
    return fail(
      res,
      'Hội thoại đang có một tác vụ tạo hoặc sửa website.',
      409
    );
  }

  const spec = await specs.latest(conversation.id);

  if (!spec || spec.status !== 'confirmed') {
    return fail(
      res,
      'Hãy xác nhận yêu cầu (Spec) trước khi tạo web',
      400
    );
  }

  const selectedTemplate = template || 'ecommerce_basic';

  const runId = await runs.create({
    conversationId: conversation.id,
    specId: spec.id,
    template: selectedTemplate
  });

  await conv.update(conversation.id, {
    status: 'generating'
  });

  // Trả kết quả ngay cho frontend.
  ok(res, {
    run_id: runId
  }, 'Đã bắt đầu tạo website', 202);

  // Chỉ gửi yêu cầu sang AI, KHÔNG tự build.
  void dispatchGenerate({
    runId,
    spec: spec.content,
    template: selectedTemplate
  });
}));


// -----------------------------------------------------
// POST /generate/:runId/start
// Bật lại website theo yêu cầu người dùng
// -----------------------------------------------------

router.post('/:runId/start', wrap(async (req, res) => {
  const run = await getAuthorizedRun(req, res);

  if (!run) return;

  // Không bật lại khi AI đang generate/revise.
  const busyStatuses = new Set([
    'queued',
    'planning',
    'coding',
    'testing',
    'starting'
  ]);

  if (busyStatuses.has(run.status)) {
    return fail(
      res,
      'Website đang được AI xử lý, chưa thể bật lại.',
      409
    );
  }

  console.log(`[Run ${run.id}] Yêu cầu bật lại website`);

  const report = await preview.buildAndStart(run.id);

  if (!report.ok) {
    const reason = report.errors?.map(e => e.message)
      .join('; ') || 'Không xác định được lỗi';

    await runs.update(run.id, {
      status: 'stopped',
      port: null,
      error: reason.slice(0, 1500)
    });

    return fail(
      res,
      `Không bật lại được website: ${reason}`,
      500
    );
  }

  await runs.update(run.id, {
    status: 'running',
    port: report.port,
    current_agent: null,
    error: null
  });

  return ok(
    res,
    { port: report.port },
    'Website đã chạy'
  );
}));


// -----------------------------------------------------
// POST /generate/:runId/stop
// Tắt website
// -----------------------------------------------------

router.post('/:runId/stop', wrap(async (req, res) => {
  const run = await getAuthorizedRun(req, res);

  if (!run) return;

  if ([
    'queued',
    'planning',
    'coding',
    'testing',
    'starting'
  ].includes(run.status)) {
    return fail(
      res,
      'AI đang xử lý website. Không thể tắt từ endpoint này.',
      409
    );
  }

  await preview.stopRun(run.id);

  console.log(`[Run ${run.id}] Website đã dừng`);

  return ok(res, null, 'Đã tắt website');
}));

module.exports = router;
