const express = require('express');
const { pool } = require('../models/db');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

// Almacenamiento en memoria
const memoriaHabitos = new Map(); // userId -> [habitos]
const memoriaHabitoLogs = new Map(); // userId -> [logs]
let nextHabitoId = 1;
let nextLogId = 1;

// POST /api/habitos - Crear hábito
router.post('/', verifyToken, async (req, res) => {
  try {
    const { nombre, descripcion, frecuencia, meta_id } = req.body;
    const userId = req.user.id;

    if (!nombre) {
      return res.status(400).json({ error: 'El nombre del hábito es requerido' });
    }

    try {
      const result = await pool.query(
        `INSERT INTO habitos (user_id, nombre, descripcion, frecuencia, meta_id)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [userId, nombre, descripcion, frecuencia || 'diario', meta_id]
      );

      if (!result.rows || result.rows.length === 0) {
        throw new Error('BD no disponible');
      }

      return res.status(201).json({ success: true, data: result.rows[0] });
    } catch (dbError) {
      console.warn('⚠️ Usando memoria para hábitos');

      const habito = {
        id: nextHabitoId++,
        user_id: userId,
        nombre,
        descripcion,
        frecuencia: frecuencia || 'diario',
        meta_id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      if (!memoriaHabitos.has(userId)) {
        memoriaHabitos.set(userId, []);
      }
      memoriaHabitos.get(userId).push(habito);

      return res.status(201).json({ success: true, data: habito });
    }
  } catch (error) {
    console.error('Error en POST habitos:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/habitos - Listar hábitos del usuario (ANTES de /:id)
router.get('/', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;

    try {
      const result = await pool.query(
        `SELECT * FROM habitos WHERE user_id = $1 ORDER BY created_at DESC`,
        [userId]
      );

      // Si result.rows existe Y tiene datos, devolverlo
      if (result.rows && result.rows.length > 0) {
        return res.json({ success: true, data: result.rows });
      }
      // Si está vacío, intentar memoria
      throw new Error('BD vacía o no disponible - usar memoria');
    } catch (dbError) {
      // Fallback: usar memoria
      const habitos = memoriaHabitos.get(userId) || [];
      return res.json({ success: true, data: habitos });
    }
  } catch (error) {
    console.error('Error en GET habitos:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/habitos/:id/log - Registrar completación
router.post('/:id/log', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { fecha, duracion_minutos, lugar, hora, estado_animo, notas } = req.body;

    if (!fecha) {
      return res.status(400).json({ error: 'Fecha requerida' });
    }

    try {
      const habitCheck = await pool.query(
        'SELECT id FROM habitos WHERE id = $1 AND user_id = $2',
        [id, userId]
      );

      if (!habitCheck.rows || habitCheck.rows.length === 0) {
        throw new Error('BD no disponible');
      }

      const result = await pool.query(
        `INSERT INTO habito_logs (habito_id, user_id, fecha, completado, duracion_minutos, lugar, hora, estado_animo, notas)
         VALUES ($1, $2, $3, true, $4, $5, $6, $7, $8)
         RETURNING *`,
        [id, userId, fecha, duracion_minutos, lugar, hora, estado_animo, notas]
      );

      if (result.rows && result.rows.length > 0) {
        return res.status(201).json({ success: true, data: result.rows[0] });
      }
      throw new Error('BD no disponible');
    } catch (dbError) {
      const log = {
        id: nextLogId++,
        habito_id: parseInt(id),
        user_id: userId,
        fecha,
        completado: true,
        duracion_minutos,
        lugar,
        hora,
        estado_animo,
        notas,
        created_at: new Date().toISOString()
      };

      if (!memoriaHabitoLogs.has(userId)) {
        memoriaHabitoLogs.set(userId, []);
      }
      memoriaHabitoLogs.get(userId).push(log);

      return res.status(201).json({ success: true, data: log });
    }
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

    try {
      const habitCheck = await pool.query(
        'SELECT id FROM habitos WHERE id = $1 AND user_id = $2',
        [id, userId]
      );

      if (!habitCheck.rows || habitCheck.rows.length === 0) {
        throw new Error('BD no disponible');
      }

      const totalResult = await pool.query(
        'SELECT COUNT(*) as total FROM habito_logs WHERE habito_id = $1 AND completado = true',
        [id]
      );

      const racharesult = await pool.query(
        `SELECT COUNT(*) as racha FROM habito_logs
         WHERE habito_id = $1 AND completado = true
         AND fecha >= CURRENT_DATE - INTERVAL '90 days'
         ORDER BY fecha DESC`,
        [id]
      );

      const logsResult = await pool.query(
        `SELECT * FROM habito_logs WHERE habito_id = $1 ORDER BY fecha DESC LIMIT 7`,
        [id]
      );

      if (totalResult.rows && totalResult.rows.length > 0) {
        return res.json({
          success: true,
          data: {
            total_completaciones: parseInt(totalResult.rows[0].total),
            racha: parseInt(racharesult.rows[0].racha),
            ultimos_logs: logsResult.rows
          }
        });
      }
      throw new Error('BD no disponible');
    } catch (dbError) {
      const logs = (memoriaHabitoLogs.get(userId) || []).filter(log => log.habito_id === parseInt(id));
      const total_completaciones = logs.length;
      const racha = logs.length;

      return res.json({
        success: true,
        data: {
          total_completaciones,
          racha,
          ultimos_logs: logs.slice(0, 7)
        }
      });
    }
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

    try {
      const result = await pool.query(
        'DELETE FROM habitos WHERE id = $1 AND user_id = $2 RETURNING *',
        [id, userId]
      );

      if (result.rows && result.rows.length > 0) {
        return res.json({ success: true, message: 'Hábito eliminado' });
      }
      throw new Error('BD no disponible');
    } catch (dbError) {
      const habitos = memoriaHabitos.get(userId) || [];
      const idx = habitos.findIndex(h => h.id === parseInt(id));

      if (idx === -1) {
        return res.status(404).json({ error: 'Hábito no encontrado' });
      }

      habitos.splice(idx, 1);
      return res.json({ success: true, message: 'Hábito eliminado' });
    }
  } catch (error) {
    console.error('Error en DELETE habitos:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
