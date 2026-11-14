// Phân quyền: requireRole('admin')
const { fail } = require('../utils/response');

module.exports = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) return fail(res, 'Không đủ quyền', 403);
  next();
};
