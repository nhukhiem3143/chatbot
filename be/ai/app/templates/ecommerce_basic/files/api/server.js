// [LOCKED] Khởi động: chờ DB, tạo admin mặc định (admin@shop.local / admin123), mở cổng 4000
const bcrypt = require('bcryptjs');
const app = require('./app');
const pool = require('./db');

(async () => {
  for (let i = 0; i < 40; i++) {
    try { await pool.query('SELECT 1'); break; } catch (e) { await new Promise((r) => setTimeout(r, 2000)); }
  }
  const [rows] = await pool.query("SELECT id FROM users WHERE email='admin@shop.local'");
  if (!rows.length) {
    await pool.query("INSERT INTO users(email,password_hash,name,role) VALUES (?,?,?,'admin')", [
      'admin@shop.local', await bcrypt.hash('admin123', 10), 'Quản trị viên',
    ]);
  }
  app.listen(4000, '0.0.0.0', () => console.log('api :4000'));
})().catch((e) => { console.error(e); process.exit(1); });
