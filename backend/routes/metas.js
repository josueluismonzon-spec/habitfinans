const express = require('express');
const { pool } = require('../models/db');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

// Almacenamiento en memoria
const memoriaMetas = new Map(); // userId -> [metas]
let nextMetaId = 1;

// POST /api/metas - Crear meta
router.post('/', verifyToken, async (req, res) => {
  try {
    const { nombre, descripcion, objetivo_cantidad, fecha_limite } = req.body;
    const userId = req.user.id;

    if (!nombre || !objetivo_cantidad) {
      return res.status(400).json({ error: 'Nombre y objetivo_cantidad requeridos' });
    }

    try {
      const result = await pool.query(
        `INSERT INTO metas (user_id, nombre, descripcion, objetivo_cantidad, fecha_limite, estado)
         VALUES ($1, $2, $3, $4, $5, 'activo')
         RETURNING *`,
        [userId, nombre, descripcion, objetivo_cantidad, fecha_limite]
      );

      if (!result.rows || result.rows.length === 0) {
        throw new Error('BD no disponible');
      }

      return res.status(201).json({ success: true, data: result.rows[0] });
    } catch (dbError) {
      console.warn('⚠️ Usando memoria para metas');

      const meta = {
        id: nextMetaId++,
        user_id: userId,
        nombre,
        descripcion,
        objetivo_cantidad: parseFloat(objetivo_cantidad),
        fecha_limite,
        estado: 'activo',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      if (!memoriaMetas.has(userId)) {
        memoriaMetas.set(userId, []);
      }
      memoriaMetas.get(userId).push(meta);

      return res.status(201).json({ success: true, data: meta });
    }
  } catch (error) {
    console.error('Error en POST metas:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/metas - Listar metas del usuario (ANTES de /:id)
router.get('/', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { estado } = req.query;

    try {
      let query = 'SELECT * FROM metas WHERE user_id = $1';
      const params = [userId];

      if (estado) {
        query += ` AND estado = $${params.length + 1}`;
        params.push(estado);
      }

      query += ' ORDER BY created_at DESC';

      const result = await pool.query(query, params);
      if (result.rows) {
        return res.json({ success: true, data: result.rows });
      }
      throw new Error('BD no disponible');
    } catch (dbError) {
      let metas = memoriaMetas.get(userId) || [];
      if (estado) {
        metas = metas.filter(m => m.estado === estado);
      }
      return res.json({ success: true, data: metas });
    }
  } catch (error) {
    console.error('Error en GET metas:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/metas/:id/progreso - Progreso y predicción de la meta
router.get('/:id/progreso', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    try {
      const metaResult = await pool.query(
        'SELECT * FROM metas WHERE id = $1 AND user_id = $2',
        [id, userId]
      );

      if (metaResult.rows.length === 0) {
        throw new Error('BD no disponible');
      }

      const meta = metaResult.rows[0];

      const ahorroResult = await pool.query(
        `SELECT COALESCE(SUM(cantidad), 0) as total
         FROM finanzas
         WHERE user_id = $1 AND meta_id = $2 AND tipo = 'ingreso'`,
        [userId, id]
      );

      const ahorroActual = parseFloat(ahorroResult.rows[0].total);
      const porcentaje = (ahorroActual / meta.objetivo_cantidad) * 100;
      const faltante = meta.objetivo_cantidad - ahorroActual;
      const mesesParaAlcanzar = faltante > 0 ? Math.ceil(faltante / 100) : 0;

      return res.json({
        success: true,
        data: {
          meta,
          ahorro_actual: ahorroActual,
          faltante,
          porcentaje: Math.min(100, Math.round(porcentaje)),
          prediccion: `Alcanzarás tu meta en ${mesesParaAlcanzar} meses`
        }
      });
    } catch (dbError) {
      const metas = memoriaMetas.get(userId) || [];
      const meta = metas.find(m => m.id === parseInt(id));

      if (!meta) {
        return res.status(404).json({ error: 'Meta no encontrada' });
      }

      return res.json({
        success: true,
        data: {
          meta,
          ahorro_actual: 0,
          faltante: meta.objetivo_cantidad,
          porcentaje: 0,
          prediccion: `Alcanzarás tu meta en ${Math.ceil(meta.objetivo_cantidad / 100)} meses`
        }
      });
    }
  } catch (error) {
    console.error('Error en GET meta progreso:', error);
    res.status(500).json({ error: error.message });
  }
});

// PATCH /api/metas/:id - Actualizar estado de la meta
router.patch('/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { estado, nombre, descripcion, fecha_limite } = req.body;

    try {
      const result = await pool.query(
        `UPDATE metas
         SET estado = COALESCE($1, estado),
             nombre = COALESCE($2, nombre),
             descripcion = COALESCE($3, descripcion),
             fecha_limite = COALESCE($4, fecha_limite),
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $5 AND user_id = $6
         RETURNING *`,
        [estado, nombre, descripcion, fecha_limite, id, userId]
      );

      if (result.rows && result.rows.length > 0) {
        return res.json({ success: true, data: result.rows[0] });
      }
      throw new Error('BD no disponible');
    } catch (dbError) {
      const metas = memoriaMetas.get(userId) || [];
      const meta = metas.find(m => m.id === parseInt(id));

      if (!meta) {
        return res.status(404).json({ error: 'Meta no encontrada' });
      }

      if (estado) meta.estado = estado;
      if (nombre) meta.nombre = nombre;
      if (descripcion) meta.descripcion = descripcion;
      if (fecha_limite) meta.fecha_limite = fecha_limite;
      meta.updated_at = new Date().toISOString();

      return res.json({ success: true, data: meta });
    }
  } catch (error) {
    console.error('Error en PATCH metas:', error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/metas/:id - Eliminar meta
router.delete('/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    try {
      const result = await pool.query(
        'DELETE FROM metas WHERE id = $1 AND user_id = $2 RETURNING *',
        [id, userId]
      );

      if (result.rows && result.rows.length > 0) {
        return res.json({ success: true, message: 'Meta eliminada' });
      }
      throw new Error('BD no disponible');
    } catch (dbError) {
      const metas = memoriaMetas.get(userId) || [];
      const idx = metas.findIndex(m => m.id === parseInt(id));

      if (idx === -1) {
        return res.status(404).json({ error: 'Meta no encontrada' });
      }

      metas.splice(idx, 1);
      return res.json({ success: true, message: 'Meta eliminada' });
    }
  } catch (error) {
    console.error('Error en DELETE metas:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
