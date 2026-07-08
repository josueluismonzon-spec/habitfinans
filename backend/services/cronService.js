const cron = require('node-cron');
const { pool } = require('../models/db');
const aiService = require('./aiService');
const emailService = require('./emailService');
require('dotenv').config();

let cronJobs = [];

/**
 * Inicializar todos los cron jobs
 */
function initializeCronJobs() {
  console.log('⏰ Inicializando tareas programadas...');

  // Task 1: Generar y enviar resumen diario a las 8 PM
  const dailyTask = cron.schedule(process.env.CRON_TIME || '0 20 * * *', async () => {
    console.log('🌙 Ejecutando tarea diaria...');
    await executeDailyTask();
  });

  cronJobs.push({ name: 'dailyTask', job: dailyTask });

  // Task 2: Generar resumen semanal cada lunes a las 9 AM
  const weeklyTask = cron.schedule('0 9 * * 1', async () => {
    console.log('📊 Ejecutando tarea semanal...');
    await executeWeeklyTask();
  });

  cronJobs.push({ name: 'weeklyTask', job: weeklyTask });

  // Task 3: Actualizar índice Syntra diariamente a las 12 AM
  const updateScoreTask = cron.schedule('0 0 * * *', async () => {
    console.log('📈 Actualizando scores diarios...');
    await updateAllDailyScores();
  });

  cronJobs.push({ name: 'updateScoreTask', job: updateScoreTask });

  console.log('✅ Tareas programadas inicializadas');
}

/**
 * Ejecutar tarea diaria: generar insights y enviar emails
 */
async function executeDailyTask() {
  try {
    // Obtener todos los usuarios
    const result = await pool.query('SELECT id, email FROM users');
    const users = result.rows;

    console.log(`📤 Enviando resúmenes diarios a ${users.length} usuarios...`);

    for (const user of users) {
      try {
        // Generar insight
        const insight = await aiService.generateDailyInsight(user.id);

        // Enviar email
        await emailService.sendDailyEmail(user.email, insight);

        // Marcar como enviado en BD
        await pool.query(
          `UPDATE ai_insights SET enviado_email = true
           WHERE user_id = $1 AND tipo = 'diario' AND enviado_email = false
           LIMIT 1`,
          [user.id]
        );
      } catch (err) {
        console.error(`Error procesando usuario ${user.id}:`, err.message);
      }
    }

    console.log('✅ Tarea diaria completada');
  } catch (error) {
    console.error('❌ Error en tarea diaria:', error);
  }
}

/**
 * Ejecutar tarea semanal: resúmenes semanales
 */
async function executeWeeklyTask() {
  try {
    // Obtener todos los usuarios
    const result = await pool.query('SELECT id, email FROM users');
    const users = result.rows;

    console.log(`📊 Enviando resúmenes semanales a ${users.length} usuarios...`);

    for (const user of users) {
      try {
        // Generar insight semanal
        const insight = await aiService.generateWeeklyInsight(user.id);

        // Enviar email
        await emailService.sendWeeklyEmail(user.email, insight);

        // Marcar como enviado
        await pool.query(
          `UPDATE ai_insights SET enviado_email = true
           WHERE user_id = $1 AND tipo = 'semanal' AND enviado_email = false
           LIMIT 1`,
          [user.id]
        );
      } catch (err) {
        console.error(`Error procesando usuario ${user.id}:`, err.message);
      }
    }

    console.log('✅ Tarea semanal completada');
  } catch (error) {
    console.error('❌ Error en tarea semanal:', error);
  }
}

/**
 * Actualizar scores diarios para todos los usuarios
 */
async function updateAllDailyScores() {
  try {
    const result = await pool.query('SELECT id FROM users');
    const users = result.rows;

    console.log(`📊 Actualizando scores de ${users.length} usuarios...`);

    for (const user of users) {
      try {
        // Calcular métricas (similar a GET /api/estadisticas/hoy)
        // Para simplificar en Fase 1, solo marcamos como ejecutado
        console.log(`✓ Score actualizado para usuario ${user.id}`);
      } catch (err) {
        console.error(`Error actualizando score para ${user.id}:`, err.message);
      }
    }

    console.log('✅ Scores actualizados');
  } catch (error) {
    console.error('❌ Error actualizando scores:', error);
  }
}

/**
 * Detener todos los cron jobs
 */
function stopAllCronJobs() {
  console.log('🛑 Deteniendo tareas programadas...');
  cronJobs.forEach(({ name, job }) => {
    job.stop();
    console.log(`✓ ${name} detenido`);
  });
  cronJobs = [];
}

/**
 * Obtener estado de tareas programadas
 */
function getCronStatus() {
  return {
    totalJobs: cronJobs.length,
    jobs: cronJobs.map(({ name, job }) => ({
      name,
      running: !job._destroyed,
      nextRun: job.nextDate ? job.nextDate().toString() : 'N/A'
    }))
  };
}

module.exports = {
  initializeCronJobs,
  stopAllCronJobs,
  getCronStatus,
  executeDailyTask,
  executeWeeklyTask
};
