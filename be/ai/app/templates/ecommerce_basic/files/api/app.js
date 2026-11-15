// [LOCKED] Mount middleware + routes lõi + TỰ ĐỘNG quét routes/custom/*.js
// File routes/custom/reviews.js (export express.Router) -> mount tại /api/reviews
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const errorHandler = require('./middlewares/errorHandler');

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));

app.get('/api/health', (req, res) => res.json({ ok: true }));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/categories', require('./routes/categories'));
app.use('/api/products', require('./routes/products'));
app.use('/api/cart', require('./routes/cart'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/payments', require('./routes/payments'));

const customDir = path.join(__dirname, 'routes', 'custom');
if (fs.existsSync(customDir)) {
  for (const f of fs.readdirSync(customDir)) {
    if (!f.endsWith('.js')) continue;
    app.use('/api/' + f.replace(/\.js$/, ''), require(path.join(customDir, f)));
  }
}

app.use(errorHandler);
module.exports = app;
