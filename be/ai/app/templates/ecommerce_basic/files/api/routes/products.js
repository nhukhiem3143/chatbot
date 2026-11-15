// [LOCKED lõi] Sản phẩm: GET công khai (?category=&q=); thêm/sửa/xóa chỉ admin
const router = require('express').Router();
const pool = require('../db');
const auth = require('../middlewares/auth');
const role = require('../middlewares/role');
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

router.get('/', wrap(async (req, res) => {
  const where = [];
  const args = [];
  if (req.query.category) { where.push('p.category_id=?'); args.push(req.query.category); }
  if (req.query.q) { where.push('p.name LIKE ?'); args.push(`%${req.query.q}%`); }
  const [r] = await pool.query(
    `SELECT p.*, c.name AS category_name FROM products p LEFT JOIN categories c ON c.id=p.category_id
     ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY p.id DESC`, args);
  res.json(r);
}));

router.get('/:id', wrap(async (req, res) => {
  const [r] = await pool.query('SELECT p.*, c.name AS category_name FROM products p LEFT JOIN categories c ON c.id=p.category_id WHERE p.id=?', [req.params.id]);
  if (!r[0]) return res.status(404).json({ message: 'Không tìm thấy' });
  res.json(r[0]);
}));

router.post('/', auth, role('admin'), wrap(async (req, res) => {
  const { category_id, name, description, price, image_url, stock } = req.body || {};
  if (!name) return res.status(400).json({ message: 'Thiếu tên sản phẩm' });
  const [r] = await pool.query(
    'INSERT INTO products(category_id,name,description,price,image_url,stock) VALUES (?,?,?,?,?,?)',
    [category_id || null, name, description || '', price || 0, image_url || '', stock ?? 100]);
  res.status(201).json({ id: r.insertId });
}));

router.put('/:id', auth, role('admin'), wrap(async (req, res) => {
  const { category_id, name, description, price, image_url, stock } = req.body || {};
  await pool.query(
    'UPDATE products SET category_id=?, name=?, description=?, price=?, image_url=?, stock=? WHERE id=?',
    [category_id || null, name, description || '', price || 0, image_url || '', stock ?? 0, req.params.id]);
  res.json({ ok: true });
}));

router.delete('/:id', auth, role('admin'), wrap(async (req, res) => {
  await pool.query('DELETE FROM products WHERE id=?', [req.params.id]);
  res.json({ ok: true });
}));

module.exports = router;
