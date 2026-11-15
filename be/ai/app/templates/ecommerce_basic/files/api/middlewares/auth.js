// [LOCKED] JWT. required (mặc định) hoặc optional
const jwt = require('jsonwebtoken');
const secret = () => process.env.JWT_SECRET || 'change-me';

function parse(req) {
  const h = req.headers.authorization || '';
  if (!h.startsWith('Bearer ')) return null;
  try { return jwt.verify(h.slice(7), secret()); } catch (e) { return null; }
}

const required = (req, res, next) => {
  const u = parse(req);
  if (!u) return res.status(401).json({ message: 'Chưa đăng nhập' });
  req.user = u;
  next();
};
required.optional = (req, res, next) => { req.user = parse(req); next(); };
required.sign = (u) => jwt.sign({ id: u.id, email: u.email, name: u.name, role: u.role }, secret(), { expiresIn: '7d' });

module.exports = required;
