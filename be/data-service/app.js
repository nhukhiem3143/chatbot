// Cấu hình Express: middleware + gắn routes
const express = require('express');
const cors = require('cors');
const auth = require('./middlewares/auth');
const internal = require('./middlewares/internal');
const errorHandler = require('./middlewares/errorHandler');

const app = express();
app.use(cors());
app.use(express.json({ limit: '5mb' }));

app.get('/health', (req, res) => res.json({ ok: true }));

// Công khai
app.use('/api/auth', require('./routes/auth'));

// Cần đăng nhập
app.use('/api/conversations', auth, require('./routes/conversations'));
app.use('/api/specs', auth, require('./routes/specs'));
app.use('/api/generate', auth, require('./routes/generate'));
app.use('/api/runs', auth, require('./routes/runs'));
app.use('/api/templates', auth, require('./routes/templates'));

// Chỉ AI service gọi vào (header x-internal-token)
app.use('/internal', internal, require('./routes/internal'));

app.use(errorHandler);

module.exports = app;
