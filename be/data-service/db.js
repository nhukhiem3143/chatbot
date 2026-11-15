// Kết nối MySQL của Studio (mysql2/promise)
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'mysql',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASS || process.env.DB_ROOT_PASS || '',
  database: process.env.DB_NAME || 'studio',
  waitForConnections: true,
  connectionLimit: 10,
  charset: 'utf8mb4',
});

module.exports = pool;
