// Đăng ký / đăng nhập / lấy thông tin bản thân
const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const users = require('../models/userModel');
const auth = require('../middlewares/auth');
const { ok, fail, wrap } = require('../utils/response');

const sign = (u) =>
  jwt.sign({ id: u.id, email: u.email, name: u.name, role: u.role }, process.env.JWT_SECRET || 'dev-secret', { expiresIn: '7d' });

router.post('/register', wrap(async (req, res) => {
  const { email, password, name } = req.body || {};
  if (!email || !password || password.length < 6) return fail(res, 'Email và mật khẩu (>= 6 ký tự) là bắt buộc');
  if (await users.findByEmail(email)) return fail(res, 'Email đã tồn tại', 409);
  const id = await users.create({ email, password_hash: await bcrypt.hash(password, 10), name: name || email.split('@')[0] });
  const u = await users.findById(id);
  return ok(res, { token: sign(u), user: u }, 'Đăng ký thành công', 201);
}));

router.post('/login', wrap(async (req, res) => {
  const { email, password } = req.body || {};
  const u = await users.findByEmail(email || '');
  if (!u || !(await bcrypt.compare(password || '', u.password_hash))) return fail(res, 'Sai email hoặc mật khẩu', 401);
  const safe = { id: u.id, email: u.email, name: u.name, role: u.role };
  return ok(res, { token: sign(safe), user: safe });
}));

router.get('/me', auth, wrap(async (req, res) => ok(res, await users.findById(req.user.id))));

module.exports = router;
