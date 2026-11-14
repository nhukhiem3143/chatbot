// [LOCKED lõi] Tạo đơn từ giỏ hàng, xem đơn, admin đổi trạng thái
const router = require('express').Router();
const pool = require('../db');
const auth = require('../middlewares/auth');
const role = require('../middlewares/role');
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

router.use(auth);

router.post('/', wrap(async (req, res) => {
  const { address, phone, payment_method } = req.body || {};
  if (!address || !phone) return res.status(400).json({ message: 'Thiếu địa chỉ hoặc số điện thoại' });
  const method = payment_method === 'transfer' ? 'transfer' : 'cod';
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [items] = await conn.query(
      'SELECT ci.product_id, ci.quantity, p.name, p.price FROM cart_items ci JOIN products p ON p.id=ci.product_id WHERE ci.user_id=?', [req.user.id]);
    if (!items.length) { await conn.rollback(); return res.status(400).json({ message: 'Giỏ hàng trống' }); }
    const total = items.reduce((s, i) => s + Number(i.price) * i.quantity, 0);
    const [o] = await conn.query('INSERT INTO orders(user_id,total,address,phone,payment_method) VALUES (?,?,?,?,?)', [req.user.id, total, address, phone, method]);
    for (const i of items) {
      await conn.query('INSERT INTO order_items(order_id,product_id,name,price,quantity) VALUES (?,?,?,?,?)', [o.insertId, i.product_id, i.name, i.price, i.quantity]);
    }
    await conn.query('INSERT INTO payments(order_id,method,amount) VALUES (?,?,?)', [o.insertId, method, total]);
    await conn.query('DELETE FROM cart_items WHERE user_id=?', [req.user.id]);
    await conn.commit();
    res.status(201).json({ id: o.insertId, total, payment_method: method });
  } catch (e) { await conn.rollback(); throw e; } finally { conn.release(); }
}));

router.get('/', wrap(async (req, res) => {
  const isAdmin = req.user.role === 'admin';
  const [r] = await pool.query(
    `SELECT o.*, u.email AS user_email FROM orders o JOIN users u ON u.id=o.user_id ${isAdmin ? '' : 'WHERE o.user_id=?'} ORDER BY o.id DESC`,
    isAdmin ? [] : [req.user.id]);
  res.json(r);
}));

router.get('/:id', wrap(async (req, res) => {
  const [r] = await pool.query('SELECT * FROM orders WHERE id=?', [req.params.id]);
  const o = r[0];
  if (!o || (req.user.role !== 'admin' && o.user_id !== req.user.id)) return res.status(404).json({ message: 'Không tìm thấy' });
  const [items] = await pool.query('SELECT * FROM order_items WHERE order_id=?', [o.id]);
  res.json({ ...o, items });
}));

router.put('/:id/status', role('admin'), wrap(async (req, res) => {
  const ok = ['pending', 'confirmed', 'shipping', 'done', 'cancelled'];
  if (!ok.includes(req.body.status)) return res.status(400).json({ message: 'Trạng thái không hợp lệ' });
  await pool.query('UPDATE orders SET status=? WHERE id=?', [req.body.status, req.params.id]);
  res.json({ ok: true });
}));

module.exports = router;
