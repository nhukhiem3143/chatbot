// Xác thực JWT: header  Authorization: Bearer <token>
const jwt = require('jsonwebtoken');
const { fail } = require('../utils/response');

module.exports = (req, res, next) => {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token) return fail(res, 'Chưa đăng nhập', 401);
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret');
    next();
  } catch (e) {
    return fail(res, 'Token không hợp lệ hoặc đã hết hạn', 401);
  }
};
