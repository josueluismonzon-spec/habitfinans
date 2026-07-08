const express = require('express');
const { pool } = require('../models/db');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

// POST /api/finanzas - Agregar transacción
router.post('/', verifyToken, async (req, res) => {
  try {
    const { tipo, categoria, clasificacion, cantidad, descripcion, fecha, meta_id } = req.body;
    const userId = req.user.id;

    if (!tipo || !cantidad || !fecha) {
      return res.status(400).json({ error: 'Campos requeridos: tipo, cantidad, fecha' });
    }

    const result = await pool.query(
      `INSERT INTO finanzas (user_id, tipo, categoria, clasificacion, cantidad, descripcion, fecha, meta_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [userId, tipo, categoria, clasificacion, cantidad, descripcion, fecha, meta_id]
    );

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Error en POST finanzas:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/finanzas - Listar transacciones
router.get('/', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { mes, anio, tipo } = req.query;

    let query = 'SELECT * FROM finanzas WHERE user_id = $1';
    const params = [userId];

    if (mes && anio) {
      query += ` AND EXTRACT(MONTH FROM fecha) = $${params.length + 1} AND EXTRACT(YEAR FROM fecha) = $${params.length + 2}`;
      params.push(mes, anio);
    }

    if (tipo) {
      query += ` AND tipo = $${params.length + 1}`;
      params.push(tipo);
    }

    query += ' ORDER BY fecha DESC, created_at DESC';

    const result = await pool.query(query, params);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Error en GET finanzas:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/finanzas/balance - Balance total
router.get('/balance', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await pool.query(
      `SELECT
        COALESCE(SUM(CASE WHEN tipo = 'ingreso' THEN cantidad ELSE 0 END), 0) as ingresos,
        COALESCE(SUM(CASE WHEN tipo = 'gasto' THEN cantidad ELSE 0 END), 0) as gastos
       FROM finanzas
       WHERE user_id = $1`,
      [userId]
    );

    const { ingresos, gastos } = result.rows[0];
    const balance = ingresos - gastos;

    res.json({
      success: true,
      data: { ingresos: parseFloat(ingresos), gastos: parseFloat(gastos), balance: parseFloat(balance) }
    });
  } catch (error) {
    console.error('Error en GET balance:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/finanzas/patrimonio - Patrimonio neto
router.get('/patrimonio', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;

    // Activos = ingresos + inversiones (si los modelamos como categoría)
    // Pasivos = deudas
    // Patrimonio = Activos - Pasivos

    const result = await pool.query(
      `SELECT
        COALESCE(SUM(CASE WHEN clasificacion IN ('inversión') THEN cantidad ELSE 0 END), 0) as activos,
        COALESCE(SUM(CASE WHEN clasificacion IN ('deuda', 'préstamo') THEN cantidad ELSE 0 END), 0) as pasivos
       FROM finanzas
       WHERE user_id = $1 AND tipo = 'gasto'`,
      [userId]
    );

    const { activos, pasivos } = result.rows[0];
    const patrimonio = activos - pasivos;

    res.json({
      success: true,
      data: { activos: parseFloat(activos), pasivos: parseFloat(pasivos), patrimonio: parseFloat(patrimonio) }
    });
  } catch (error) {
    console.error('Error en GET patrimonio:', error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/finanzas/:id - Eliminar transacción
router.delete('/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const result = await pool.query(
      'DELETE FROM finanzas WHERE id = $1 AND user_id = $2 RETURNING *',
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Transacción no encontrada' });
    }

    res.json({ success: true, message: 'Transacción eliminada' });
  } catch (error) {
    console.error('Error en DELETE finanzas:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
