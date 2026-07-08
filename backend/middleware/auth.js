const jwt = require('jsonwebtoken');

// Secret consistente - fallback si no está configurado
const JWT_SECRET = process.env.JWT_SECRET || 'syntra-super-secret-key-2024';

// Middleware para verificar JWT
const verifyToken = (req, res, next) => {
  const token = req.headers['authorization']?.split(' ')[1]; // Bearer <token>

  if (!token) {
    return res.status(401).json({ error: 'Token no proporcionado' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded; // { id, email }
    next();
  } catch (error) {
    return res.status(403).json({ error: 'Token inválido o expirado' });
  }
};

module.exports = { verifyToken };
