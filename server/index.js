require('dotenv').config();
const express = require('express'); 
const cors = require('cors');
const pool = require('./db');

const app = express();
app.use(cors());
app.use(express.json());

app.get('/health', async (_req, res) => {
  try {
    const [rows] = await pool.query('SELECT NOW() AS agora');
    res.json({ ok: true, agora: rows[0].agora });
  } catch (e) {
    res.status(500).json({ ok: false, erro: e.message });
  }
});

app.listen(process.env.PORT || 3000, () => console.log('API no ar'));
