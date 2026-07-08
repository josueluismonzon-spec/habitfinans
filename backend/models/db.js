const { Pool } = require('pg');
require('dotenv').config();

let pool = null;

// Solo crear pool si hay DATABASE_URL
if (process.env.DATABASE_URL) {
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });
} else {
  console.warn('⚠️ DATABASE_URL no configurada. BD deshabilitada.');
  // Crear un pool dummy
  pool = {
    query: async () => ({ rows: [] }),
    connect: async () => {}
  };
}

// Schema SQL completo para SYNTRA
const SCHEMA = `
-- Tabla de usuarios
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de metas (ahorros, objetivos)
CREATE TABLE IF NOT EXISTS metas (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  nombre VARCHAR(255) NOT NULL,
  descripcion TEXT,
  objetivo_cantidad DECIMAL(15, 2) NOT NULL,
  fecha_limite DATE,
  estado VARCHAR(50) DEFAULT 'activo',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de hábitos
CREATE TABLE IF NOT EXISTS habitos (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  meta_id INTEGER REFERENCES metas(id) ON DELETE SET NULL,
  nombre VARCHAR(255) NOT NULL,
  descripcion TEXT,
  frecuencia VARCHAR(50) DEFAULT 'diario',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de registros de hábitos (logs)
CREATE TABLE IF NOT EXISTS habito_logs (
  id SERIAL PRIMARY KEY,
  habito_id INTEGER NOT NULL REFERENCES habitos(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  fecha DATE NOT NULL,
  completado BOOLEAN DEFAULT true,
  duracion_minutos INTEGER,
  lugar VARCHAR(255),
  hora TIME,
  estado_animo INTEGER,
  notas TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de finanzas (ingresos y gastos)
CREATE TABLE IF NOT EXISTS finanzas (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  meta_id INTEGER REFERENCES metas(id) ON DELETE SET NULL,
  tipo VARCHAR(50) NOT NULL,
  categoria VARCHAR(100),
  clasificacion VARCHAR(50),
  cantidad DECIMAL(15, 2) NOT NULL,
  descripcion TEXT,
  fecha DATE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de presupuestos
CREATE TABLE IF NOT EXISTS presupuestos (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  categoria VARCHAR(100) NOT NULL,
  monto_mensual DECIMAL(15, 2) NOT NULL,
  mes_ano VARCHAR(10),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de estadísticas diarias
CREATE TABLE IF NOT EXISTS estadisticas_diarias (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  fecha DATE NOT NULL UNIQUE,
  indice_syntra INTEGER DEFAULT 50,
  energia INTEGER,
  finanzas_score INTEGER,
  progreso_metas INTEGER,
  racha_habitos INTEGER,
  objetivos_activos INTEGER,
  tiempo_productivo INTEGER,
  salud_score INTEGER,
  aprendizaje_score INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de diario personal
CREATE TABLE IF NOT EXISTS diario_personal (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  fecha DATE NOT NULL,
  sentimiento VARCHAR(50),
  notas TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de insights IA
CREATE TABLE IF NOT EXISTS ai_insights (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tipo VARCHAR(50) NOT NULL,
  contenido TEXT NOT NULL,
  fecha_generado TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  enviado_email BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_metas_user_id ON metas(user_id);
CREATE INDEX IF NOT EXISTS idx_habitos_user_id ON habitos(user_id);
CREATE INDEX IF NOT EXISTS idx_habito_logs_user_id ON habito_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_habito_logs_fecha ON habito_logs(fecha);
CREATE INDEX IF NOT EXISTS idx_finanzas_user_id ON finanzas(user_id);
CREATE INDEX IF NOT EXISTS idx_finanzas_fecha ON finanzas(fecha);
CREATE INDEX IF NOT EXISTS idx_estadisticas_user_id ON estadisticas_diarias(user_id);
CREATE INDEX IF NOT EXISTS idx_diario_user_id ON diario_personal(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_insights_user_id ON ai_insights(user_id);
`;

// Función para inicializar la BD
async function initializeDatabase() {
  try {
    console.log('Inicializando base de datos...');
    await pool.query(SCHEMA);
    console.log('✅ Base de datos inicializada correctamente');
    return pool;
  } catch (error) {
    console.error('❌ Error inicializando BD:', error.message);
    process.exit(1);
  }
}

// Función de prueba de conexión
async function testConnection() {
  try {
    const result = await pool.query('SELECT NOW()');
    console.log('✅ Conexión a BD exitosa:', result.rows[0]);
  } catch (error) {
    console.error('❌ Error conectando a BD:', error.message);
  }
}

module.exports = {
  pool,
  initializeDatabase,
  testConnection
};
