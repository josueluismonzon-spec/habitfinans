const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const { initializeDatabase } = require('./models/db');
const authRoutes = require('./routes/auth');
const finanzasRoutes = require('./routes/finanzas');
const habitosRoutes = require('./routes/habitos');
const metasRoutes = require('./routes/metas');
const estadisticasRoutes = require('./routes/estadisticas');

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '25mb' }));

// Servir frontend estático
app.use(express.static(path.join(__dirname, '../frontend')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/finanzas', finanzasRoutes);
app.use('/api/habitos', habitosRoutes);
app.use('/api/metas', metasRoutes);
app.use('/api/estadisticas', estadisticasRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'SYNTRA API funcionando' });
});

// Ruta principal
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ error: err.message });
});

// Iniciar servidor
const PORT = process.env.PORT || 5000;

async function start() {
  try {
    // Inicializar BD
    await initializeDatabase();

    // Iniciar servidor
    app.listen(PORT, () => {
      console.log(`
╔══════════════════════════════════════╗
║     🚀 SYNTRA API Iniciado          ║
║     Puerto: ${PORT}                     ║
║     Entorno: ${process.env.NODE_ENV || 'development'}      ║
╚══════════════════════════════════════╝
      `);
    });
  } catch (error) {
    console.error('❌ Error al iniciar:', error);
    process.exit(1);
  }
}

start();

module.exports = app;
