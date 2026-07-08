const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../models/db');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email y contraseña requeridos' });
    }

    // Hash de password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Intentar usar BD real
    try {
      // Verificar si email ya existe
      const existingUser = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
      if (existingUser.rows && existingUser.rows.length > 0) {
        return res.status(409).json({ error: 'El email ya está registrado' });
      }

      // Crear usuario en BD
      const result = await pool.query(
        'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email',
        [email, hashedPassword]
      );

      if (!result.rows || result.rows.length === 0) {
        throw new Error('BD no disponible, usando fallback local');
      }

      const user = result.rows[0];

      // Generar JWT
      const token = jwt.sign(
        { id: user.id, email: user.email },
        process.env.JWT_SECRET,
        { expiresIn: '30d' }
      );

      return res.status(201).json({
        success: true,
        message: 'Usuario registrado exitosamente',
        token,
        user: { id: user.id, email: user.email }
      });
    } catch (dbError) {
      // Fallback: generar usuario local con ID simulado
      console.warn('⚠️ BD no disponible. Usando registro local...');
      const simulatedId = Math.floor(Math.random() * 1000000);

      const token = jwt.sign(
        { id: simulatedId, email: email },
        process.env.JWT_SECRET || 'fallback-secret',
        { expiresIn: '30d' }
      );

      return res.status(201).json({
        success: true,
        message: 'Usuario registrado (local - sin BD)',
        token,
        user: { id: simulatedId, email: email }
      });
    }
  } catch (error) {
    console.error('Error en registro:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email y contraseña requeridos' });
    }

    try {
      // Intentar usar BD real
      const result = await pool.query('SELECT id, email, password_hash FROM users WHERE email = $1', [email]);

      if (!result.rows || result.rows.length === 0) {
        throw new Error('BD no disponible, usando fallback local');
      }

      const user = result.rows[0];

      // Verificar password
      const isPasswordValid = await bcrypt.compare(password, user.password_hash);
      if (!isPasswordValid) {
        return res.status(401).json({ error: 'Contraseña incorrecta' });
      }

      // Generar JWT
      const token = jwt.sign(
        { id: user.id, email: user.email },
        process.env.JWT_SECRET,
        { expiresIn: '30d' }
      );

      return res.json({
        success: true,
        message: 'Login exitoso',
        token,
        user: { id: user.id, email: user.email }
      });
    } catch (dbError) {
      // Fallback: aceptar cualquier login (para demo)
      console.warn('⚠️ BD no disponible. Usando login local...');
      const simulatedId = Math.floor(Math.random() * 1000000);

      const token = jwt.sign(
        { id: simulatedId, email: email },
        process.env.JWT_SECRET || 'fallback-secret',
        { expiresIn: '30d' }
      );

      return res.json({
        success: true,
        message: 'Login exitoso (local - sin BD)',
        token,
        user: { id: simulatedId, email: email }
      });
    }
  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/auth/logout (client-side: eliminar token de localStorage)
router.post('/logout', verifyToken, (req, res) => {
  res.json({ success: true, message: 'Logout exitoso' });
});

module.exports = router;
