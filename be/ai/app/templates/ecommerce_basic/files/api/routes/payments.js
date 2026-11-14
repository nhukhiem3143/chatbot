// [LOCKED lõi] Thanh toán MÔ PHỎNG (không kết nối cổng thanh toán thật)
//  - cod: để pending, admin xác nhận khi giao hàng
//  - transfer: user bấm "Tôi đã chuyển khoản" -> đánh dấu paid
const router = require('express').Router();
const pool = require('../db');
const auth = require('../middlewares/auth');
const role = require('../middlewares/role');
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

router.use(auth);

router.get('/order/:orderId', wrap(async (req, res) => {
  const [r] = await pool.query('SELECT p.* FROM payments p JOIN orders o ON o.id=p.order_id WHERE p.order_id=? AND (o.user_id=? OR ?)',
    [req.params.orderId, req.user.id, req.user.role === 'admin']);
  res.json(r[0] || null);
}));

router.post('/order/:orderId/pay', wrap(async (req, res) => {
  const [r] = await pool.query('SELECT * FROM orders WHERE id=?', [req.params.orderId]);
  const o = r[0];
  if (!o || (o.user_id !== req.user.id && req.user.role !== 'admin')) return res.status(404).json({ message: 'Không tìm thấy đơn' });
  await pool.query("UPDATE payments SET status='paid', paid_at=NOW() WHERE order_id=?", [o.id]);
  await pool.query("UPDATE orders SET payment_status='paid' WHERE id=?", [o.id]);
  res.json({ ok: true });
}));

// Admin xác nhận đã thu tiền (COD)
router.post('/order/:orderId/confirm', role('admin'), wrap(async (req, res) => {
  await pool.query("UPDATE payments SET status='paid', paid_at=NOW() WHERE order_id=?", [req.params.orderId]);
  await pool.query("UPDATE orders SET payment_status='paid' WHERE id=?", [req.params.orderId]);
  res.json({ ok: true });
}));

module.exports = router;
