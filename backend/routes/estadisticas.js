const express = require('express');
const { pool } = require('../models/db');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

// GET /api/estadisticas/hoy - Índice Syntra + métricas de hoy
router.get('/hoy', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const hoy = new Date().toISOString().split('T')[0];

    // 1. ENERGÍA (estimada, 1-10) - basada en hábitos completados hoy
    const habitosHoyResult = await pool.query(
      `SELECT COUNT(*) as completados FROM habito_logs
       WHERE user_id = $1 AND fecha = $2 AND completado = true`,
      [userId, hoy]
    );
    const habitosHoy = parseInt(habitosHoyResult.rows[0].completados);
    const energia = Math.min(10, Math.max(1, habitosHoy));

    // 2. FINANZAS (0-100) - balance vs ingresos
    const finanzasResult = await pool.query(
      `SELECT
        COALESCE(SUM(CASE WHEN tipo = 'ingreso' THEN cantidad ELSE 0 END), 0) as ingresos,
        COALESCE(SUM(CASE WHEN tipo = 'gasto' THEN cantidad ELSE 0 END), 0) as gastos
       FROM finanzas WHERE user_id = $1`,
      [userId]
    );
    const { ingresos, gastos } = finanzasResult.rows[0];
    const balance = ingresos - gastos;
    const finanzasScore = balance > 0 ? Math.min(100, Math.round((balance / Math.max(ingresos, 1)) * 100)) : 50;

    // 3. PROGRESO DE METAS (0-100) - promedio de completamiento de metas
    const metasResult = await pool.query(
      `SELECT
        COUNT(*) as total,
        COUNT(CASE WHEN estado = 'completado' THEN 1 END) as completadas
       FROM metas WHERE user_id = $1 AND estado != 'pausado'`,
      [userId]
    );
    const metasData = metasResult.rows[0];
    const progresoMetas = metasData.total > 0 ? Math.round((metasData.completadas / metasData.total) * 100) : 0;

    // 4. RACHA DE HÁBITOS (días consecutivos)
    const rachaResult = await pool.query(
      `WITH RECURSIVE racha_dias AS (
        SELECT fecha FROM habito_logs
        WHERE user_id = $1 AND completado = true
        GROUP BY fecha
        ORDER BY fecha DESC
        LIMIT 30
      )
      SELECT COUNT(*) as racha FROM racha_dias
      WHERE fecha >= CURRENT_DATE - INTERVAL '90 days'`,
      [userId]
    );
    const racha = parseInt(rachaResult.rows[0].racha);

    // 5. OBJETIVOS ACTIVOS (count)
    const objetivosResult = await pool.query(
      `SELECT COUNT(*) as activos FROM metas WHERE user_id = $1 AND estado = 'activo'`,
      [userId]
    );
    const objetivosActivos = parseInt(objetivosResult.rows[0].activos);

    // 6. TIEMPO PRODUCTIVO (hoy, en minutos)
    const tiempoResult = await pool.query(
      `SELECT COALESCE(SUM(duracion_minutos), 0) as total FROM habito_logs
       WHERE user_id = $1 AND fecha = $2 AND completado = true`,
      [userId, hoy]
    );
    const tiempoProductivo = parseInt(tiempoResult.rows[0].total);

    // 7. SALUD (0-100) - estimada por hábitos de salud
    const saludScore = Math.min(100, Math.max(0, energia * 10 + (tiempoProductivo / 60) * 20));

    // 8. APRENDIZAJE (0-100) - hábitos de aprendizaje completados
    const aprendizajeResult = await pool.query(
      `SELECT COUNT(*) as count FROM habito_logs
       WHERE user_id = $1 AND fecha = $2 AND completado = true`,
      [userId, hoy]
    );
    const aprendizajeScore = Math.min(100, parseInt(aprendizajeResult.rows[0].count) * 20);

    // ÍNDICE SYNTRA (0-100) - promedio ponderado
    const indiceSyntra = Math.round(
      (energia * 10 + finanzasScore * 15 + progresoMetas * 20 + racha * 5 + objetivosActivos * 5 + (tiempoProductivo / 60) * 15 + saludScore * 10 + aprendizajeScore * 20) / 100
    );

    res.json({
      success: true,
      data: {
        fecha: hoy,
        indice_syntra: Math.min(100, Math.max(0, indiceSyntra)),
        metricas: {
          energia,
          finanzas: finanzasScore,
          progreso_metas: progresoMetas,
          racha_habitos: racha,
          objetivos_activos: objetivosActivos,
          tiempo_productivo: tiempoProductivo,
          salud: Math.round(saludScore),
          aprendizaje: Math.round(aprendizajeScore)
        },
        resumen: {
          balance: parseFloat(balance),
          ingresos: parseFloat(ingresos),
          gastos: parseFloat(gastos),
          habitos_hoy: habitosHoy
        }
      }
    });
  } catch (error) {
    console.error('Error en GET estadisticas/hoy:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/estadisticas/semana - Comparación últimos 7 días
router.get('/semana', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await pool.query(
      `SELECT
        DATE(fecha) as fecha,
        COUNT(DISTINCT id) as transacciones,
        SUM(CASE WHEN tipo = 'ingreso' THEN cantidad ELSE 0 END) as ingresos,
        SUM(CASE WHEN tipo = 'gasto' THEN cantidad ELSE 0 END) as gastos
       FROM finanzas
       WHERE user_id = $1 AND fecha >= CURRENT_DATE - INTERVAL '7 days'
       GROUP BY DATE(fecha)
       ORDER BY fecha ASC`,
      [userId]
    );

    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Error en GET estadisticas/semana:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/estadisticas/mes - Comparación último mes
router.get('/mes', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await pool.query(
      `SELECT
        DATE_TRUNC('week', fecha)::DATE as semana,
        COUNT(DISTINCT id) as transacciones,
        SUM(CASE WHEN tipo = 'ingreso' THEN cantidad ELSE 0 END) as ingresos,
        SUM(CASE WHEN tipo = 'gasto' THEN cantidad ELSE 0 END) as gastos
       FROM finanzas
       WHERE user_id = $1 AND fecha >= CURRENT_DATE - INTERVAL '30 days'
       GROUP BY DATE_TRUNC('week', fecha)
       ORDER BY semana ASC`,
      [userId]
    );

    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Error en GET estadisticas/mes:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/estadisticas/6m - Últimos 6 meses
router.get('/6m', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await pool.query(
      `SELECT
        DATE_TRUNC('month', fecha)::DATE as mes,
        COUNT(DISTINCT id) as transacciones,
        SUM(CASE WHEN tipo = 'ingreso' THEN cantidad ELSE 0 END) as ingresos,
        SUM(CASE WHEN tipo = 'gasto' THEN cantidad ELSE 0 END) as gastos
       FROM finanzas
       WHERE user_id = $1 AND fecha >= CURRENT_DATE - INTERVAL '6 months'
       GROUP BY DATE_TRUNC('month', fecha)
       ORDER BY mes ASC`,
      [userId]
    );

    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Error en GET estadisticas/6m:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
