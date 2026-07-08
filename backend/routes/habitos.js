const express = require('express');
const { pool } = require('../models/db');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

// POST /api/habitos - Crear hábito
router.post('/', verifyToken, async (req, res) => {
  try {
    const { nombre, descripcion, frecuencia, meta_id } = req.body;
    const userId = req.user.id;

    if (!nombre) {
      return res.status(400).json({ error: 'El nombre del hábito es requerido' });
    }

    const result = await pool.query(
      `INSERT INTO habitos (user_id, nombre, descripcion, frecuencia, meta_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [userId, nombre, descripcion, frecuencia || 'diario', meta_id]
    );

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Error en POST habitos:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/habitos - Listar hábitos del usuario
router.get('/', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await pool.query(
      `SELECT * FROM habitos WHERE user_id = $1 ORDER BY created_at DESC`,
      [userId]
    );

    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Error en GET habitos:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/habitos/:id/log - Registrar completación con contexto
router.post('/:id/log', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { fecha, duracion_minutos, lugar, hora, estado_animo, notas } = req.body;

    if (!fecha) {
      return res.status(400).json({ error: 'Fecha requerida' });
    }

    // Verificar que el hábito pertenece al usuario
    const habitCheck = await pool.query(
      'SELECT id FROM habitos WHERE id = $1 AND user_id = $2',
      [id, userId]
    );

    if (habitCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Hábito no encontrado' });
    }

    const result = await pool.query(
      `INSERT INTO habito_logs (habito_id, user_id, fecha, completado, duracion_minutos, lugar, hora, estado_animo, notas)
       VALUES ($1, $2, $3, true, $4, $5, $6, $7, $8)
       RETURNING *`,
      [id, userId, fecha, duracion_minutos, lugar, hora, estado_animo, notas]
    );

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Error en POST habito log:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/habitos/:id/stats - Estadísticas del hábito
router.get('/:id/stats', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Verificar que pertenece al usuario
    const habitCheck = await pool.query(
      'SELECT id FROM habitos WHERE id = $1 AND user_id = $2',
      [id, userId]
    );

    if (habitCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Hábito no encontrado' });
    }

    // Contar completaciones
    const totalResult = await pool.query(
      'SELECT COUNT(*) as total FROM habito_logs WHERE habito_id = $1 AND completado = true',
      [id]
    );

    // Calcular racha (días consecutivos)
    const racharesult = await pool.query(
      `SELECT COUNT(*) as racha FROM habito_logs
       WHERE habito_id = $1 AND completado = true
       AND fecha >= CURRENT_DATE - INTERVAL '90 days'
       ORDER BY fecha DESC`,
      [id]
    );

    // Últimos 7 logs
    const logsResult = await pool.query(
      `SELECT * FROM habito_logs WHERE habito_id = $1 ORDER BY fecha DESC LIMIT 7`,
      [id]
    );

    res.json({
      success: true,
      data: {
        total_completaciones: parseInt(totalResult.rows[0].total),
        racha: parseInt(racharesult.rows[0].racha),
        ultimos_logs: logsResult.rows
      }
    });
  } catch (error) {
    console.error('Error en GET habito stats:', error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/habitos/:id - Eliminar hábito
router.delete('/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const result = await pool.query(
      'DELETE FROM habitos WHERE id = $1 AND user_id = $2 RETURNING *',
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Hábito no encontrado' });
    }

    res.json({ success: true, message: 'Hábito eliminado' });
  } catch (error) {
    console.error('Error en DELETE habitos:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
