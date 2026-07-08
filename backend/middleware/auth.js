const jwt = require('jsonwebtoken');

// Secret consistente - fallback si no está configurado
const JWT_SECRET = process.env.JWT_SECRET || 'syntra-super-secret-key-2024';

// Middleware para verificar JWT
const verifyToken = (req, res, next) => {
  const token = req.headers['authorization']?.split(' ')[1]; // Bearer <token>

  // TEMPORAL: Fallback a usuario demo si no hay token
  if (!token) {
    console.warn('⚠️ Token no proporcionado. Usando usuario demo...');
    req.user = { id: 1, email: 'demo@syntra.local' };
    return next();
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded; // { id, email }
    next();
  } catch (error) {
    console.warn('⚠️ Token inválido. Usando usuario demo...');
    // Fallback a usuario demo
    req.user = { id: 1, email: 'demo@syntra.local' };
    next();
  }
};

module.exports = { verifyToken };
