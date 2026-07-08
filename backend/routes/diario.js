const express = require('express');
const { pool } = require('../models/db');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

// Almacenamiento en memoria (fallback cuando no hay BD)
const memoriadiario = new Map(); // userId -> [entradas]
let nextDiarioId = 1;

// POST /api/diario - Guardar entrada diaria
router.post('/', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { fecha, sentimiento, notas } = req.body;

    if (!fecha) {
      return res.status(400).json({ error: 'Fecha requerida' });
    }

    try {
      const result = await pool.query(
        `INSERT INTO diario_personal (user_id, fecha, sentimiento, notas)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [userId, fecha, sentimiento, notas]
      );

      if (!result.rows || result.rows.length === 0) {
        throw new Error('BD no disponible');
      }

      return res.status(201).json({ success: true, data: result.rows[0] });
    } catch (dbError) {
      console.warn('⚠️ Usando almacenamiento en memoria para diario');

      // Buscar si ya existe una entrada para este día
      const entradas = memoriadiario.get(userId) || [];
      const existente = entradas.findIndex(e => e.fecha === fecha);

      if (existente !== -1) {
        // Actualizar existente
        entradas[existente] = {
          ...entradas[existente],
          sentimiento,
          notas,
          updated_at: new Date().toISOString()
        };
        return res.status(201).json({ success: true, data: entradas[existente] });
      }

      // Crear nueva entrada
      const entrada = {
        id: nextDiarioId++,
        user_id: userId,
        fecha,
        sentimiento,
        notas,
        created_at: new Date().toISOString()
      };

      if (!memoriadiario.has(userId)) {
        memoriadiario.set(userId, []);
      }
      memoriadiario.get(userId).push(entrada);

      return res.status(201).json({ success: true, data: entrada });
    }
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

    try {
      let query = 'SELECT * FROM diario_personal WHERE user_id = $1';
      const params = [userId];

      if (mes && anio) {
        query += ` AND EXTRACT(MONTH FROM fecha) = $${params.length + 1} AND EXTRACT(YEAR FROM fecha) = $${params.length + 2}`;
        params.push(mes, anio);
      }

      query += ' ORDER BY fecha DESC';

      const result = await pool.query(query, params);

      // Si tiene datos en BD, devolverlos
      if (result.rows && result.rows.length > 0) {
        return res.json({ success: true, data: result.rows });
      }

      throw new Error('BD vacía o no disponible - usar memoria');
    } catch (dbError) {
      // Fallback: usar memoria
      let entradas = memoriadiario.get(userId) || [];

      if (mes && anio) {
        entradas = entradas.filter(e => {
          const fecha = new Date(e.fecha);
          return fecha.getMonth() + 1 === parseInt(mes) && fecha.getFullYear() === parseInt(anio);
        });
      }

      entradas.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

      return res.json({ success: true, data: entradas });
    }
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

    try {
      const result = await pool.query(
        `SELECT * FROM diario_personal WHERE user_id = $1 AND fecha = $2`,
        [userId, fecha]
      );

      if (result.rows && result.rows.length > 0) {
        return res.json({ success: true, data: result.rows[0] });
      }

      throw new Error('BD no disponible - usar memoria');
    } catch (dbError) {
      // Fallback: usar memoria
      const entradas = memoriadiario.get(userId) || [];
      const entrada = entradas.find(e => e.fecha === fecha);

      if (!entrada) {
        return res.status(404).json({ error: 'Entrada no encontrada' });
      }

      return res.json({ success: true, data: entrada });
    }
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

    try {
      const result = await pool.query(
        'DELETE FROM diario_personal WHERE user_id = $1 AND fecha = $2 RETURNING *',
        [userId, fecha]
      );

      if (result.rows && result.rows.length > 0) {
        return res.json({ success: true, message: 'Entrada eliminada' });
      }

      throw new Error('BD no disponible - usar memoria');
    } catch (dbError) {
      // Fallback: usar memoria
      const entradas = memoriadiario.get(userId) || [];
      const idx = entradas.findIndex(e => e.fecha === fecha);

      if (idx === -1) {
        return res.status(404).json({ error: 'Entrada no encontrada' });
      }

      entradas.splice(idx, 1);
      return res.json({ success: true, message: 'Entrada eliminada' });
    }
  } catch (error) {
    console.error('Error en DELETE diario:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
