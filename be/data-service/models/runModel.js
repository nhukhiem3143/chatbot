const pool = require('../db');

const parseJson = (row) => {
  if (!row) return null;
  for (const k of ['plan', 'report']) if (typeof row[k] === 'string') row[k] = JSON.parse(row[k]);
  return row;
};

exports.create = async ({ conversationId, specId, template }) => {
  const [r] = await pool.query('INSERT INTO runs(conversation_id,spec_id,template) VALUES (?,?,?)', [
    conversationId,
    specId,
    template || 'ecommerce_basic',
  ]);
  return r.insertId;
};

exports.get = async (id) => {
  const [r] = await pool.query('SELECT * FROM runs WHERE id=?', [id]);
  return parseJson(r[0]);
};

const UPDATABLE = new Set([
  'status', 'current_agent', 'plan', 'report', 'error', 'retry_count',
  'finished_at', 'port', 'project_name', 'started_at'
]);

exports.update = async (id, fields) => {
  const keys = Object.keys(fields);
  if (keys.some((k) => !UPDATABLE.has(k))) {
    throw new Error(`Cột runs không được phép cập nhật: ${keys.filter((k) => !UPDATABLE.has(k)).join(', ')}`);
  }
  if (!keys.length) return;
  const vals = keys.map((k) =>
    // Chỉ JSON.stringify object/mảng (plan, report). KHÔNG stringify Date (finished_at) -> lỗi ER_TRUNCATED_WRONG_VALUE
    fields[k] !== null && typeof fields[k] === 'object' && !(fields[k] instanceof Date) ? JSON.stringify(fields[k]) : fields[k]
  );
  await pool.query(`UPDATE runs SET ${keys.map((k) => `${k}=?`).join(',')} WHERE id=?`, [...vals, id]);
};

exports.listForUser = async (user) => {
  const [r] = await pool.query(
    `SELECT r.id,r.conversation_id,r.template,r.status,r.current_agent,r.port,r.error,r.started_at,r.finished_at
     FROM runs r JOIN conversations c ON c.id=r.conversation_id WHERE c.user_id=? ORDER BY r.id DESC`, [user.id]);
  return r;
};

// Các run đang chạy (để tắt trước khi chạy web mới)
exports.running = async () => {
  const [r] = await pool.query("SELECT * FROM runs WHERE status IN ('running','starting')");
  return r;
};

// Phiên bản web đã tạo thành công gần nhất của hội thoại (làm nền để SỬA). Run lỗi (failed) không tính.
exports.latestWeb = async (conversationId) => {
  const [r] = await pool.query(
    "SELECT * FROM runs WHERE conversation_id=? AND plan IS NOT NULL AND status IN ('running','stopped') ORDER BY id DESC LIMIT 1",
    [conversationId]
  );
  return parseJson(r[0]);
};

// Đang có run tạo/sửa web chạy dở (bỏ qua run treo quá 30 phút)
exports.inProgress = async (conversationId) => {
  const [r] = await pool.query(
    "SELECT id FROM runs WHERE conversation_id=? AND status IN ('queued','planning','coding','testing','starting') AND started_at > (NOW() - INTERVAL 30 MINUTE) LIMIT 1",
    [conversationId]
  );
  return r.length > 0;
};

exports.usedPorts = async () => {
  const [r] = await pool.query("SELECT port FROM runs WHERE port IS NOT NULL AND status IN ('running','starting')");
  return r.map((x) => x.port);
};

exports.setFiles = async (runId, files) => {
  await pool.query('DELETE FROM run_files WHERE run_id=?', [runId]);
  for (const f of files) {
    await pool.query('INSERT INTO run_files(run_id,path,kind) VALUES (?,?,?)', [runId, f.path, f.kind || 'generated']);
  }
};

exports.files = async (runId) => {
  const [r] = await pool.query('SELECT path,kind FROM run_files WHERE run_id=? ORDER BY path', [runId]);
  return r;
};

// Chọn ứng viên làm bản gốc. failed chỉ được dùng nếu Docker xác nhận đang chạy.
exports.revisionCandidates = async (conversationId) => {
  const [rows] = await pool.query(
    "SELECT * FROM runs WHERE conversation_id=? AND plan IS NOT NULL AND status IN ('running','stopped','failed','ready') ORDER BY id DESC LIMIT 30",
    [conversationId]
  );
  return rows.map(parseJson);
};