const express = require('express');
const { pool } = require('../models/db');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

// POST /api/diario - Guardar entrada diaria
router.post('/', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { fecha, sentimiento, notas } = req.body;

    if (!fecha) {
      return res.status(400).json({ error: 'Fecha requerida' });
    }

    const result = await pool.query(
      `INSERT INTO diario_personal (user_id, fecha, sentimiento, notas)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id, fecha) DO UPDATE
       SET sentimiento = $3, notas = $4, updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [userId, fecha, sentimiento, notas]
    );

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Error en POST diario:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/diario - Listar entradas del diario
router.get('/', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { mes, anio } = req.query;

    let query = 'SELECT * FROM diario_personal WHERE user_id = $1';
    const params = [userId];

    if (mes && anio) {
      query += ` AND EXTRACT(MONTH FROM fecha) = $${params.length + 1} AND EXTRACT(YEAR FROM fecha) = $${params.length + 2}`;
      params.push(mes, anio);
    }

    query += ' ORDER BY fecha DESC';

    const result = await pool.query(query, params);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Error en GET diario:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/diario/:fecha - Obtener entrada específica
router.get('/:fecha', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { fecha } = req.params;

    const result = await pool.query(
      `SELECT * FROM diario_personal WHERE user_id = $1 AND fecha = $2`,
      [userId, fecha]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Entrada no encontrada' });
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Error en GET diario fecha:', error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/diario/:fecha - Eliminar entrada
router.delete('/:fecha', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { fecha } = req.params;

    const result = await pool.query(
      'DELETE FROM diario_personal WHERE user_id = $1 AND fecha = $2 RETURNING *',
      [userId, fecha]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Entrada no encontrada' });
    }

    res.json({ success: true, message: 'Entrada eliminada' });
  } catch (error) {
    console.error('Error en DELETE diario:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
