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

exports.update = async (id, fields) => {
  const keys = Object.keys(fields);
  if (!keys.length) return;
  const vals = keys.map((k) => {
    const v = fields[k];
    if (v === null || v === undefined) return v;
    // Date: để driver mysql2 tự serialize (tránh JSON.stringify sinh chuỗi có dấu ")
    if (v instanceof Date) return v;
    // Defensive: nếu đâu đó đã lỡ JSON.stringify(new Date()) -> '"2026-...Z"', bỏ dấu " bao ngoài
    if (typeof v === 'string' && /^"\d{4}-\d{2}-\d{2}T[^"]*"$/.test(v)) return v.slice(1, -1);
    if (typeof v === 'object') return JSON.stringify(v);
    return v;
  });
  await pool.query(`UPDATE runs SET ${keys.map((k) => `${k}=?`).join(',')} WHERE id=?`, [...vals, id]);
};

exports.listForUser = async (user) => {
  const sql = `SELECT r.id,r.conversation_id,r.template,r.status,r.current_agent,r.port,r.error,r.started_at,r.finished_at
               FROM runs r JOIN conversations c ON c.id=r.conversation_id
               ${user.role === 'admin' ? '' : 'WHERE c.user_id=?'} ORDER BY r.id DESC`;
  const [r] = await pool.query(sql, user.role === 'admin' ? [] : [user.id]);
  return r;
};

// Các run đang chạy (để tắt trước khi chạy web mới)
exports.running = async () => {
  const [r] = await pool.query("SELECT * FROM runs WHERE status IN ('running','starting')");
  return r;
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