// Bảo vệ route /internal: chỉ AI service (có INTERNAL_TOKEN) được gọi
const { fail } = require('../utils/response');

module.exports = (req, res, next) => {
  const expected = process.env.INTERNAL_TOKEN || 'dev-internal';
  if (req.headers['x-internal-token'] !== expected) return fail(res, 'Forbidden', 403);
  next();
};
