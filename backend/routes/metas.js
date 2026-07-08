const express = require('express');
const { pool } = require('../models/db');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

// POST /api/metas - Crear meta
router.post('/', verifyToken, async (req, res) => {
  try {
    const { nombre, descripcion, objetivo_cantidad, fecha_limite } = req.body;
    const userId = req.user.id;

    if (!nombre || !objetivo_cantidad) {
      return res.status(400).json({ error: 'Nombre y objetivo_cantidad requeridos' });
    }

    const result = await pool.query(
      `INSERT INTO metas (user_id, nombre, descripcion, objetivo_cantidad, fecha_limite, estado)
       VALUES ($1, $2, $3, $4, $5, 'activo')
       RETURNING *`,
      [userId, nombre, descripcion, objetivo_cantidad, fecha_limite]
    );

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Error en POST metas:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/metas - Listar metas del usuario
router.get('/', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { estado } = req.query;

    let query = 'SELECT * FROM metas WHERE user_id = $1';
    const params = [userId];

    if (estado) {
      query += ` AND estado = $${params.length + 1}`;
      params.push(estado);
    }

    query += ' ORDER BY created_at DESC';

    const result = await pool.query(query, params);
    res.json({ success: true, data: result.rows });
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

    // Obtener la meta
    const metaResult = await pool.query(
      'SELECT * FROM metas WHERE id = $1 AND user_id = $2',
      [id, userId]
    );

    if (metaResult.rows.length === 0) {
      return res.status(404).json({ error: 'Meta no encontrada' });
    }

    const meta = metaResult.rows[0];

    // Calcular ahorro actual (suma de transacciones asociadas a esta meta)
    const ahorroResult = await pool.query(
      `SELECT COALESCE(SUM(cantidad), 0) as total
       FROM finanzas
       WHERE user_id = $1 AND meta_id = $2 AND tipo = 'ingreso'`,
      [userId, id]
    );

    const ahorroActual = parseFloat(ahorroResult.rows[0].total);
    const porcentaje = (ahorroActual / meta.objetivo_cantidad) * 100;
    const faltante = meta.objetivo_cantidad - ahorroActual;

    // Predicción simple: si alcanzará la meta en X meses
    // Calculamos el promedio mensual de ahorro
    const mesesesult = await pool.query(
      `SELECT COUNT(DISTINCT DATE_TRUNC('month', fecha)) as meses
       FROM finanzas
       WHERE user_id = $1 AND meta_id = $2 AND tipo = 'ingreso'`,
      [userId, id]
    );

    const meses = parseInt(mesesesult.rows[0].meses) || 1;
    const promedioMensual = ahorroActual / meses;
    const mesesParaAlcanzar = promedioMensual > 0 ? Math.ceil(faltante / promedioMensual) : 0;

    res.json({
      success: true,
      data: {
        meta,
        ahorro_actual: ahorroActual,
        faltante,
        porcentaje: Math.min(100, Math.round(porcentaje)),
        prediccion: `Alcanzarás tu meta en ${mesesParaAlcanzar} meses`
      }
    });
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

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Meta no encontrada' });
    }

    res.json({ success: true, data: result.rows[0] });
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

    const result = await pool.query(
      'DELETE FROM metas WHERE id = $1 AND user_id = $2 RETURNING *',
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Meta no encontrada' });
    }

    res.json({ success: true, message: 'Meta eliminada' });
  } catch (error) {
    console.error('Error en DELETE metas:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
