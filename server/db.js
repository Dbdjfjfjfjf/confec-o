require('dotenv').config({ quiet: true });
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

// Certificado da Aiven: variável DB_CA (útil no Render) ou arquivo server/ca.pem (Codespace).
function lerCA() {
  if (process.env.DB_CA) return process.env.DB_CA.replace(/\\n/g, '\n');
  const arquivo = path.join(__dirname, 'ca.pem');
  return fs.existsSync(arquivo) ? fs.readFileSync(arquivo, 'utf8') : undefined;
}

const ca = lerCA();

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: ca ? { ca, rejectUnauthorized: true } : undefined,
  waitForConnections: true,
  connectionLimit: 5,
  charset: 'utf8mb4',
  dateStrings: true, // DATE volta como 'AAAA-MM-DD'
  decimalNumbers: true, // DECIMAL volta como número
});

module.exports = pool;
