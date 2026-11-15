const pool = require('../db');

const parse = (row) => {
  if (!row) return null;
  if (typeof row.content === 'string') row.content = JSON.parse(row.content);
  return row;
};

exports.latest = async (conversationId) => {
  const [r] = await pool.query(
    'SELECT * FROM specs WHERE conversation_id=? ORDER BY version DESC LIMIT 1',
    [conversationId]
  );
  return parse(r[0]);
};

exports.get = async (id) => {
  const [r] = await pool.query('SELECT * FROM specs WHERE id=?', [id]);
  return parse(r[0]);
};

// Mỗi lần AI cập nhật / user sửa = 1 version mới
exports.addVersion = async (conversationId, content, { edited = false, status = 'draft' } = {}) => {
  const cur = await exports.latest(conversationId);
  const version = cur ? cur.version + 1 : 1;
  const [r] = await pool.query(
    'INSERT INTO specs(conversation_id,version,content,status,edited_by_user) VALUES (?,?,?,?,?)',
    [conversationId, version, JSON.stringify(content), status, edited ? 1 : 0]
  );
  return exports.get(r.insertId);
};

exports.confirm = (id) => pool.query("UPDATE specs SET status='confirmed' WHERE id=?", [id]);

exports.list = async (conversationId) => {
  const [r] = await pool.query(
    'SELECT id,version,status,edited_by_user,created_at FROM specs WHERE conversation_id=? ORDER BY version DESC',
    [conversationId]
  );
  return r;
};
