const pool = require('../db');

exports.findByEmail = async (email) => {
  const [r] = await pool.query('SELECT * FROM users WHERE email=?', [email]);
  return r[0] || null;
};

exports.findById = async (id) => {
  const [r] = await pool.query('SELECT id,email,name,role,created_at FROM users WHERE id=?', [id]);
  return r[0] || null;
};

exports.create = async ({ email, password_hash, name }) => {
  const [r] = await pool.query(
    "INSERT INTO users(email,password_hash,name,role) VALUES (?,?,?,'user')",
    [email, password_hash, name]
  );
  return r.insertId;
};
