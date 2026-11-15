const pool = require('../db');

// Mỗi tài khoản (kể cả admin) chỉ thấy hội thoại của chính mình trong màn Trò chuyện.
// Admin xem hội thoại của người khác qua /api/admin/conversations.
exports.listByUser = async (user) => {
  const [r] = await pool.query('SELECT * FROM conversations WHERE user_id=? ORDER BY updated_at DESC', [user.id]);
  return r;
};

exports.get = async (id, user) => {
  const [r] = await pool.query('SELECT * FROM conversations WHERE id=?', [id]);
  const c = r[0];
  if (!c) return null;
  if (user.role !== 'admin' && c.user_id !== user.id) return null;
  return c;
};

exports.create = async (userId, title) => {
  const [r] = await pool.query('INSERT INTO conversations(user_id,title) VALUES (?,?)', [
    userId,
    title || 'Cuộc trò chuyện mới',
  ]);
  return r.insertId;
};

exports.update = async (id, fields) => {
  const keys = Object.keys(fields);
  if (!keys.length) return;
  const set = keys.map((k) => `${k}=?`).join(',');
  await pool.query(`UPDATE conversations SET ${set} WHERE id=?`, [...keys.map((k) => fields[k]), id]);
};

exports.remove = (id) => pool.query('DELETE FROM conversations WHERE id=?', [id]);

exports.addMessage = async (conversationId, role, content) => {
  const [r] = await pool.query('INSERT INTO messages(conversation_id,role,content) VALUES (?,?,?)', [
    conversationId,
    role,
    content,
  ]);
  return r.insertId;
};

exports.messages = async (conversationId) => {
  const [r] = await pool.query(
    'SELECT id,role,content,created_at FROM messages WHERE conversation_id=? ORDER BY id',
    [conversationId]
  );
  return r;
};

// Chỉ lấy N tin gần nhất để gửi LLM (không gửi cả lịch sử)
exports.lastMessages = async (conversationId, n = 8) => {
  const [r] = await pool.query(
    'SELECT role,content FROM messages WHERE conversation_id=? ORDER BY id DESC LIMIT ?',
    [conversationId, n]
  );
  return r.reverse();
};