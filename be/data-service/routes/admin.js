// Khu quản trị: chỉ role=admin. Xem người dùng, hội thoại của từng người, thống kê.
const router = require('express').Router();
const pool = require('../db');
const conv = require('../models/conversationModel');
const specs = require('../models/specModel');
const { ok, fail, wrap } = require('../utils/response');

router.use((req, res, next) => (req.user?.role === 'admin' ? next() : fail(res, 'Chỉ admin được truy cập', 403)));

router.get('/stats', wrap(async (req, res) => {
    const one = async (sql) => (await pool.query(sql))[0][0].n;
    const [perDay] = await pool.query(
        "SELECT DATE_FORMAT(started_at,'%Y-%m-%d') d, COUNT(*) c FROM runs WHERE started_at >= CURDATE() - INTERVAL 6 DAY GROUP BY d");
    const [recent] = await pool.query(
        `SELECT r.id,r.template,r.status,r.started_at,u.name user_name FROM runs r
     JOIN conversations c ON c.id=r.conversation_id JOIN users u ON u.id=c.user_id ORDER BY r.id DESC LIMIT 6`);
    return ok(res, {
        users: await one('SELECT COUNT(*) n FROM users'),
        conversations: await one('SELECT COUNT(*) n FROM conversations'),
        runs: await one('SELECT COUNT(*) n FROM runs'),
        running: await one("SELECT COUNT(*) n FROM runs WHERE status='running'"),
        failed: await one("SELECT COUNT(*) n FROM runs WHERE status='failed'"),
        per_day: perDay, recent,
    });
}));

router.get('/users', wrap(async (req, res) => {
    const [r] = await pool.query(
        `SELECT u.id,u.email,u.name,u.role,u.created_at,
       (SELECT COUNT(*) FROM conversations c WHERE c.user_id=u.id) AS conversations,
       (SELECT COUNT(*) FROM runs r JOIN conversations c ON c.id=r.conversation_id WHERE c.user_id=u.id) AS runs
     FROM users u ORDER BY u.id DESC`);
    return ok(res, r);
}));

router.put('/users/:id/role', wrap(async (req, res) => {
    const role = req.body?.role;
    if (!['admin', 'user'].includes(role)) return fail(res, 'role không hợp lệ');
    if (Number(req.params.id) === req.user.id) return fail(res, 'Không thể đổi quyền của chính mình');
    await pool.query('UPDATE users SET role=? WHERE id=?', [role, req.params.id]);
    return ok(res, null, 'Đã cập nhật quyền');
}));

// Mọi hội thoại kèm chủ sở hữu; lọc theo ?user_id=
router.get('/conversations', wrap(async (req, res) => {
    const uid = Number(req.query.user_id) || null;
    const [r] = await pool.query(
        `SELECT c.id,c.title,c.status,c.created_at,c.updated_at,
       u.id AS user_id,u.name AS user_name,u.email AS user_email,
       (SELECT COUNT(*) FROM messages m WHERE m.conversation_id=c.id) AS message_count
     FROM conversations c JOIN users u ON u.id=c.user_id
     ${uid ? 'WHERE c.user_id=?' : ''} ORDER BY c.updated_at DESC LIMIT 300`, uid ? [uid] : []);
    return ok(res, r);
}));

router.get('/conversations/:id', wrap(async (req, res) => {
    const c = await conv.get(req.params.id, req.user); // admin xem được mọi hội thoại
    if (!c) return fail(res, 'Không tìm thấy hội thoại', 404);
    const [[owner]] = await pool.query('SELECT id,name,email FROM users WHERE id=?', [c.user_id]);
    const [runs] = await pool.query(
        'SELECT id,template,status,port,error,started_at,finished_at FROM runs WHERE conversation_id=? ORDER BY id DESC', [c.id]);
    return ok(res, { conversation: c, owner, messages: await conv.messages(c.id), spec: await specs.latest(c.id), runs });
}));

module.exports = router;