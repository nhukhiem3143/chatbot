// [LOCKED] POST /register, POST /login, GET /me
const router = require('express').Router();
const bcrypt = require('bcryptjs');
const pool = require('../db');
const auth = require('../middlewares/auth');
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

router.post('/register', wrap(async (req, res) => {
  const { email, password, name } = req.body || {};
  if (!email || !password || password.length < 6) return res.status(400).json({ message: 'Email và mật khẩu (>= 6 ký tự) là bắt buộc' });
  const [ex] = await pool.query('SELECT id FROM users WHERE email=?', [email]);
  if (ex.length) return res.status(409).json({ message: 'Email đã tồn tại' });
  const [r] = await pool.query("INSERT INTO users(email,password_hash,name,role) VALUES (?,?,?,'customer')", [
    email, await bcrypt.hash(password, 10), name || email.split('@')[0],
  ]);
  const user = { id: r.insertId, email, name: name || email.split('@')[0], role: 'customer' };
  res.status(201).json({ token: auth.sign(user), user });
}));

router.post('/login', wrap(async (req, res) => {
  const { email, password } = req.body || {};
  const [rows] = await pool.query('SELECT * FROM users WHERE email=?', [email || '']);
  const u = rows[0];
  if (!u || !(await bcrypt.compare(password || '', u.password_hash))) return res.status(401).json({ message: 'Sai email hoặc mật khẩu' });
  const user = { id: u.id, email: u.email, name: u.name, role: u.role };
  res.json({ token: auth.sign(user), user });
}));

router.get('/me', auth, (req, res) => res.json({ user: req.user }));

module.exports = router;
