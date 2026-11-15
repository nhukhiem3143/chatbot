// Entry point: chờ MySQL -> tạo admin mặc định -> mở cổng 5000
const bcrypt = require('bcryptjs');
const app = require('./app');
const pool = require('./db');

async function waitDb() {
  for (let i = 0; i < 40; i++) {
    try {
      await pool.query('SELECT 1');
      return;
    } catch (e) {
      console.log('Đợi MySQL...', i + 1);
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
  throw new Error('Không kết nối được MySQL');
}

async function ensureAdmin() {
  const email = process.env.ADMIN_EMAIL || 'admin@studio.local';
  const pass = process.env.ADMIN_PASS || 'admin123';
  const [rows] = await pool.query('SELECT id FROM users WHERE email=?', [email]);
  if (rows.length) return;
  const hash = await bcrypt.hash(pass, 10);
  await pool.query(
    "INSERT INTO users(email,password_hash,name,role) VALUES (?,?,?,'admin')",
    [email, hash, 'Quản trị viên']
  );
  console.log('Đã tạo admin mặc định:', email);
}

(async () => {
  await waitDb();
  await ensureAdmin();
  app.listen(5000, '0.0.0.0', () => console.log('data-service chạy ở cổng 5000'));
  // Bật lại các web con đang ghi "running" (vd sau khi khởi động lại máy)
  require('./services/previewManager').reconcile().catch((e) => console.error('[reconcile]', e.message));
})().catch((e) => {
  console.error(e);
  process.exit(1);
});