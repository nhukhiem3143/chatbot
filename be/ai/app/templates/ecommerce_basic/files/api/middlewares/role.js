// [LOCKED] Phân quyền: role('admin')
module.exports = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) return res.status(403).json({ message: 'Không đủ quyền' });
  next();
};
