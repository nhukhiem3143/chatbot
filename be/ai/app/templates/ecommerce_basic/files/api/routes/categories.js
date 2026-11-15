// [LOCKED lõi] GET công khai; POST/PUT/DELETE chỉ admin
const router = require('express').Router();
const pool = require('../db');
const auth = require('../middlewares/auth');
const role = require('../middlewares/role');
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

router.get('/', wrap(async (req, res) => {
  const [r] = await pool.query('SELECT * FROM categories ORDER BY id');
  res.json(r);
}));
router.post('/', auth, role('admin'), wrap(async (req, res) => {
  const { name } = req.body || {};
  if (!name) return res.status(400).json({ message: 'Thiếu tên' });
  const [r] = await pool.query('INSERT INTO categories(name) VALUES (?)', [name]);
  res.status(201).json({ id: r.insertId, name });
}));
router.put('/:id', auth, role('admin'), wrap(async (req, res) => {
  await pool.query('UPDATE categories SET name=? WHERE id=?', [req.body.name, req.params.id]);
  res.json({ ok: true });
}));
router.delete('/:id', auth, role('admin'), wrap(async (req, res) => {
  await pool.query('DELETE FROM categories WHERE id=?', [req.params.id]);
  res.json({ ok: true });
}));

module.exports = router;
