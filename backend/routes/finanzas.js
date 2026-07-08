const express = require('express');
const { pool } = require('../models/db');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

// Almacenamiento en memoria (fallback cuando no hay BD)
const memoriaFinanzas = new Map(); // userId -> [transacciones]
let nextTransactionId = 1;

// ⚠️ IMPORTANTE: Rutas específicas ANTES que genéricas

// POST /api/finanzas - Agregar transacción
router.post('/', verifyToken, async (req, res) => {
  try {
    const { tipo, categoria, clasificacion, cantidad, descripcion, fecha, meta_id } = req.body;
    const userId = req.user.id;

    if (!tipo || !cantidad || !fecha) {
      return res.status(400).json({ error: 'Campos requeridos: tipo, cantidad, fecha' });
    }

    try {
      const result = await pool.query(
        `INSERT INTO finanzas (user_id, tipo, categoria, clasificacion, cantidad, descripcion, fecha, meta_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [userId, tipo, categoria, clasificacion, cantidad, descripcion, fecha, meta_id]
      );

      if (!result.rows || result.rows.length === 0) {
        throw new Error('BD no disponible');
      }

      return res.status(201).json({ success: true, data: result.rows[0] });
    } catch (dbError) {
      console.warn('⚠️ Usando almacenamiento en memoria para finanzas');

      const transaccion = {
        id: nextTransactionId++,
        user_id: userId,
        tipo,
        categoria,
        clasificacion,
        cantidad: parseFloat(cantidad),
        descripcion,
        fecha,
        meta_id,
        created_at: new Date().toISOString()
      };

      if (!memoriaFinanzas.has(userId)) {
        memoriaFinanzas.set(userId, []);
      }
      memoriaFinanzas.get(userId).push(transaccion);

      return res.status(201).json({ success: true, data: transaccion });
    }
  } catch (error) {
    console.error('Error en POST finanzas:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/finanzas/balance - Balance total (ANTES de GET /)
router.get('/balance', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;

    try {
      const result = await pool.query(
        `SELECT
          COALESCE(SUM(CASE WHEN tipo = 'ingreso' THEN cantidad ELSE 0 END), 0) as ingresos,
          COALESCE(SUM(CASE WHEN tipo = 'gasto' THEN cantidad ELSE 0 END), 0) as gastos
         FROM finanzas
         WHERE user_id = $1`,
        [userId]
      );

      if (result.rows) {
        const { ingresos, gastos } = result.rows[0];
        const balance = ingresos - gastos;

        return res.json({
          success: true,
          data: { ingresos: parseFloat(ingresos), gastos: parseFloat(gastos), balance: parseFloat(balance) }
        });
      }
      throw new Error('BD no disponible');
    } catch (dbError) {
      const datos = memoriaFinanzas.get(userId) || [];
      const ingresos = datos.filter(t => t.tipo === 'ingreso').reduce((sum, t) => sum + t.cantidad, 0);
      const gastos = datos.filter(t => t.tipo === 'gasto').reduce((sum, t) => sum + t.cantidad, 0);
      const balance = ingresos - gastos;

      return res.json({
        success: true,
        data: { ingresos, gastos, balance }
      });
    }
  } catch (error) {
    console.error('Error en GET balance:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/finanzas/patrimonio - Patrimonio neto (ANTES de GET /)
router.get('/patrimonio', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;

    try {
      const result = await pool.query(
        `SELECT
          COALESCE(SUM(CASE WHEN clasificacion IN ('inversión') THEN cantidad ELSE 0 END), 0) as activos,
          COALESCE(SUM(CASE WHEN clasificacion IN ('deuda', 'préstamo') THEN cantidad ELSE 0 END), 0) as pasivos
         FROM finanzas
         WHERE user_id = $1 AND tipo = 'gasto'`,
        [userId]
      );

      if (result.rows) {
        const { activos, pasivos } = result.rows[0];
        const patrimonio = activos - pasivos;

        return res.json({
          success: true,
          data: { activos: parseFloat(activos), pasivos: parseFloat(pasivos), patrimonio: parseFloat(patrimonio) }
        });
      }
      throw new Error('BD no disponible');
    } catch (dbError) {
      return res.json({
        success: true,
        data: { activos: 0, pasivos: 0, patrimonio: 0 }
      });
    }
  } catch (error) {
    console.error('Error en GET patrimonio:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/finanzas - Listar transacciones (DESPUÉS de las específicas)
router.get('/', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { mes, anio, tipo } = req.query;

    try {
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
      // Si tiene datos en BD, devolverlos
      if (result.rows && result.rows.length > 0) {
        return res.json({ success: true, data: result.rows });
      }
      // Si está vacío, usar memoria
      throw new Error('BD vacía o no disponible - usar memoria');
    } catch (dbError) {
      let datos = memoriaFinanzas.get(userId) || [];

      if (mes && anio) {
        datos = datos.filter(t => {
          const fecha = new Date(t.fecha);
          return fecha.getMonth() + 1 === parseInt(mes) && fecha.getFullYear() === parseInt(anio);
        });
      }

      if (tipo) {
        datos = datos.filter(t => t.tipo === tipo);
      }

      datos.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

      return res.json({ success: true, data: datos });
    }
  } catch (error) {
    console.error('Error en GET finanzas:', error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/finanzas/:id - Eliminar transacción
router.delete('/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    try {
      const result = await pool.query(
        'DELETE FROM finanzas WHERE id = $1 AND user_id = $2 RETURNING *',
        [id, userId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Transacción no encontrada' });
      }

      return res.json({ success: true, message: 'Transacción eliminada' });
    } catch (dbError) {
      const transacciones = memoriaFinanzas.get(userId) || [];
      const idx = transacciones.findIndex(t => t.id === parseInt(id));

      if (idx === -1) {
        return res.status(404).json({ error: 'Transacción no encontrada' });
      }

      transacciones.splice(idx, 1);
      return res.json({ success: true, message: 'Transacción eliminada' });
    }
  } catch (error) {
    console.error('Error en DELETE finanzas:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
