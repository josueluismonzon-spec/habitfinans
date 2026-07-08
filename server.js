const express = require('express');
const cors = require('cors');
const path = require('path');
const crypto = require('crypto');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
let pool = null;
let dbReady = false;

// Inicializar conexión a BD de forma no-bloqueante
if (process.env.DATABASE_URL) {
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  pool.query(`
    CREATE TABLE IF NOT EXISTS habitfinans_users (
      username TEXT PRIMARY KEY,
      secret TEXT NOT NULL,
      data JSONB,
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `).then(() => {
    dbReady = true;
    console.log('Base de datos lista');
  }).catch(err => {
    console.error('Error conectando a BD:', err.message);
    dbReady = false;
  });
}

app.use(cors());
app.use(express.json({ limit: '25mb' }));
app.use(express.static(__dirname));

function hashSecret(s) {
  return crypto.createHash('sha256').update(String(s)).digest('hex');
}

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'HabitFinans.html'));
});

// Subir datos: crea el usuario la primera vez; luego exige el mismo secret
app.post('/api/sync', async (req, res) => {
  if (!dbReady || !pool) {
    return res.status(503).json({ error: 'Base de datos no disponible. Usa localStorage.' });
  }

  try {
    const { username, secret, data } = req.body;
    if (!username || !secret || !data) {
      return res.status(400).json({ error: 'Faltan datos.' });
    }
    const u = String(username).toLowerCase().trim();
    const h = hashSecret(secret);
    const existing = await pool.query('SELECT secret FROM habitfinans_users WHERE username = $1', [u]);
    if (existing.rows.length && existing.rows[0].secret !== h) {
      return res.status(403).json({ error: 'Contraseña incorrecta para este usuario.' });
    }
    await pool.query(
      `INSERT INTO habitfinans_users (username, secret, data, updated_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (username) DO UPDATE SET data = $3, updated_at = NOW()`,
      [u, h, JSON.stringify(data)]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Descargar datos: exige usuario + secret correctos
app.post('/api/fetch', async (req, res) => {
  if (!dbReady || !pool) {
    return res.status(503).json({ error: 'Base de datos no disponible. Usa localStorage.' });
  }

  try {
    const { username, secret } = req.body;
    if (!username || !secret) {
      return res.status(400).json({ error: 'Faltan datos.' });
    }
    const u = String(username).toLowerCase().trim();
    const result = await pool.query('SELECT secret, data FROM habitfinans_users WHERE username = $1', [u]);
    if (!result.rows.length) {
      return res.status(404).json({ error: 'No hay datos guardados para este usuario.' });
    }
    if (result.rows[0].secret !== hashSecret(secret)) {
      return res.status(403).json({ error: 'Contraseña incorrecta.' });
    }
    res.json({ data: result.rows[0].data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`HabitFinans corriendo en puerto ${PORT}`);
});
