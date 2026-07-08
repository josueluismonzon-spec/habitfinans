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
const diarioRoutes = require('./routes/diario');
const { initializeCronJobs, stopAllCronJobs } = require('./services/cronService');
const { verifyEmailConfig } = require('./services/emailService');

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
app.use('/api/diario', diarioRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'HabitFinans API funcionando correctamente' });
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
    // Intentar inicializar BD
    await initializeDatabase();
  } catch (error) {
    console.warn('⚠️ BD no disponible. Servidor funcionará con localStorage.');
    console.warn('💡 Para desarrollo local, configura PostgreSQL.');
  }

  // Verificar configuración de email
  await verifyEmailConfig();

  // Inicializar cron jobs (si BD está disponible)
  try {
    initializeCronJobs();
  } catch (error) {
    console.warn('⚠️ Cron jobs deshabilitados (requiere BD)');
  }

  // Iniciar servidor (funciona con o sin BD)
  app.listen(PORT, () => {
    console.log(`
╔══════════════════════════════════════╗
║   💳 HABITFINANS v2.0 - API         ║
║   Puerto: ${PORT}                     ║
║   Entorno: ${process.env.NODE_ENV || 'development'}      ║
║   Frontend: http://localhost:${PORT}  ║
║   Status: ✅ LISTO                  ║
╚══════════════════════════════════════╝
    `);
  });

  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n🛑 Deteniendo servidor...');
    stopAllCronJobs();
    process.exit(0);
  });
}

start();

module.exports = app;
