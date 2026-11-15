// [LOCKED lõi] Giỏ hàng của user đang đăng nhập
const router = require('express').Router();
const pool = require('../db');
const auth = require('../middlewares/auth');
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

router.use(auth);

router.get('/', wrap(async (req, res) => {
  const [r] = await pool.query(
    `SELECT ci.product_id, ci.quantity, p.name, p.price, p.image_url
     FROM cart_items ci JOIN products p ON p.id=ci.product_id WHERE ci.user_id=? ORDER BY ci.id`, [req.user.id]);
  res.json(r);
}));

router.post('/', wrap(async (req, res) => {
  const { product_id, quantity } = req.body || {};
  if (!product_id) return res.status(400).json({ message: 'Thiếu product_id' });
  await pool.query(
    `INSERT INTO cart_items(user_id,product_id,quantity) VALUES (?,?,?)
     ON DUPLICATE KEY UPDATE quantity = quantity + VALUES(quantity)`, [req.user.id, product_id, quantity || 1]);
  res.status(201).json({ ok: true });
}));

router.put('/:productId', wrap(async (req, res) => {
  const q = parseInt(req.body.quantity, 10);
  if (q <= 0) await pool.query('DELETE FROM cart_items WHERE user_id=? AND product_id=?', [req.user.id, req.params.productId]);
  else await pool.query('UPDATE cart_items SET quantity=? WHERE user_id=? AND product_id=?', [q, req.user.id, req.params.productId]);
  res.json({ ok: true });
}));

router.delete('/:productId', wrap(async (req, res) => {
  await pool.query('DELETE FROM cart_items WHERE user_id=? AND product_id=?', [req.user.id, req.params.productId]);
  res.json({ ok: true });
}));

module.exports = router;
