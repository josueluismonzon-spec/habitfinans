# 💳 HabitFinans v2.0 - Premium Edition

**Tu compañero de finanzas y hábitos. Controla tu dinero, rastrea tus hábitos, y visualiza tu progreso con un diseño espectacular.**

Diseño profesional + Backend robusto + Base de datos relacional.

---

## 📊 Características

✅ **Dashboard Premium** - Score visual que muestra tu progreso diario (0-100)  
✅ **Gestión de Finanzas** - Ingresos, gastos, balance, patrimonio neto, clasificación  
✅ **Tracking de Hábitos** - Con contexto (duración, lugar, hora, estado de ánimo)  
✅ **Metas Inteligentes** - Objetivos de ahorro con predicción de alcance  
✅ **Diario Personal** - Entradas diarias con análisis de bienestar  
✅ **Estadísticas Visuales** - Últimos 6 meses con comparativas interactivas  
✅ **Autenticación Segura** - JWT + bcrypt  
✅ **Diseño Espectacular** - Premium UI con animaciones y efectos  
✅ **Base de Datos Relacional** - PostgreSQL con schema completo  

---

## 🏗️ Arquitectura

### Backend (Node.js + Express)
```
backend/
├── server.js              # Servidor Express principal
├── models/
│   └── db.js             # Conexión y schema PostgreSQL
├── middleware/
│   └── auth.js           # Verificación JWT
├── routes/
│   ├── auth.js           # Login/Registro
│   ├── finanzas.js       # Transacciones, balance, patrimonio
│   ├── habitos.js        # Crear, completar, estadísticas
│   ├── metas.js          # Crear, progreso, predicción
│   └── estadisticas.js   # Score diario, métricas
└── .env                  # Variables de entorno
```

### Frontend (HTML/CSS/JS Premium)
```
frontend/
└── index.html            # App single-file con diseño espectacular
                         # Fondo animado, partículas, efectos premium
```

---

## 🛠️ Setup Local

### 1. Clonar el repositorio
```bash
git clone https://github.com/josueluismonzon-spec/habitfinans.git
cd habitfinans
git checkout syntra-mvp
```

### 2. Instalar dependencias
```bash
npm install
```

### 3. Configurar variables de entorno
Crear archivo `backend/.env`:
```env
DATABASE_URL=postgresql://usuario:password@localhost:5432/syntra
JWT_SECRET=tu-super-secret-jwt-key-change-in-production
PORT=5000
NODE_ENV=development
```

### 4. Crear base de datos PostgreSQL
```bash
createdb habitfinans
```

### 5. Iniciar servidor
```bash
npm start
```

El servidor estará en `http://localhost:5000`

---

## 📱 Módulos Principales

### 🏠 Dashboard
- Score Visual (0-100) - Tu progreso personalizado
- 8 métricas: Energía, Finanzas, Progreso, Racha, Objetivos, Tiempo, Salud, Aprendizaje
- Últimas transacciones
- Hábitos de hoy

### 💰 Finanzas
- Registrar ingresos y gastos
- Categorías y clasificaciones (Necesidad, Deseo, Inversión, Emergencia, Impulsivo)
- Balance y patrimonio neto
- Historial mensual

### 🔥 Hábitos
- Crear hábitos con frecuencia (diario, semanal, mensual)
- Registrar completación con contexto:
  - Duración (minutos)
  - Lugar
  - Hora
  - Estado de ánimo
  - Notas
- Racha y estadísticas

### 🎯 Metas
- Crear metas de ahorro (carro, casa, viaje, etc.)
- Ver progreso en porcentaje
- Predicción IA: "Alcanzarás tu meta en 18 meses"
- Conectar con transacciones

### 📝 Diario Personal
- Entrada diaria con ánimo (😊 😐 😔)
- Notas del día
- Análisis de patrones (Fase 2)

---

## 🔌 API Endpoints

### Auth
```
POST   /api/auth/register       # Crear usuario
POST   /api/auth/login          # Login
POST   /api/auth/logout         # Logout
```

### Finanzas
```
POST   /api/finanzas            # Agregar transacción
GET    /api/finanzas            # Listar transacciones
GET    /api/finanzas/balance    # Balance actual
GET    /api/finanzas/patrimonio # Patrimonio neto
DELETE /api/finanzas/:id        # Eliminar transacción
```

### Hábitos
```
POST   /api/habitos             # Crear hábito
GET    /api/habitos             # Listar hábitos
POST   /api/habitos/:id/log     # Registrar completación
GET    /api/habitos/:id/stats   # Estadísticas
DELETE /api/habitos/:id         # Eliminar hábito
```

### Metas
```
POST   /api/metas               # Crear meta
GET    /api/metas               # Listar metas
PATCH  /api/metas/:id           # Actualizar meta
GET    /api/metas/:id/progreso  # Progreso y predicción
DELETE /api/metas/:id           # Eliminar meta
```

### Estadísticas
```
GET    /api/estadisticas/hoy    # Índice Syntra + métricas de hoy
GET    /api/estadisticas/semana # Últimos 7 días
GET    /api/estadisticas/mes    # Último mes
GET    /api/estadisticas/6m     # Últimos 6 meses
```

---

## 🗄️ Schema Base de Datos

### Tabla `users`
```sql
id SERIAL PRIMARY KEY
email VARCHAR(255) UNIQUE NOT NULL
password_hash VARCHAR(255) NOT NULL
created_at TIMESTAMP
updated_at TIMESTAMP
```

### Tabla `finanzas`
```sql
id SERIAL PRIMARY KEY
user_id INTEGER NOT NULL (FK → users)
meta_id INTEGER (FK → metas)
tipo VARCHAR(50) -- 'ingreso' | 'gasto'
categoria VARCHAR(100)
clasificacion VARCHAR(50) -- necesidad, deseo, inversión, emergencia, impulsivo
cantidad DECIMAL(15, 2)
descripcion TEXT
fecha DATE
created_at TIMESTAMP
```

### Tabla `habitos`
```sql
id SERIAL PRIMARY KEY
user_id INTEGER NOT NULL (FK → users)
meta_id INTEGER (FK → metas)
nombre VARCHAR(255)
descripcion TEXT
frecuencia VARCHAR(50) -- diario, semanal, mensual
created_at TIMESTAMP
```

### Tabla `habito_logs`
```sql
id SERIAL PRIMARY KEY
habito_id INTEGER NOT NULL (FK → habitos)
user_id INTEGER NOT NULL (FK → users)
fecha DATE
completado BOOLEAN
duracion_minutos INTEGER
lugar VARCHAR(255)
hora TIME
estado_animo INTEGER -- 1-5
notas TEXT
created_at TIMESTAMP
```

### Tabla `metas`
```sql
id SERIAL PRIMARY KEY
user_id INTEGER NOT NULL (FK → users)
nombre VARCHAR(255)
descripcion TEXT
objetivo_cantidad DECIMAL(15, 2)
fecha_limite DATE
estado VARCHAR(50) -- activo, completado, pausado
created_at TIMESTAMP
```

### Tabla `estadisticas_diarias`
```sql
id SERIAL PRIMARY KEY
user_id INTEGER NOT NULL (FK → users)
fecha DATE NOT NULL UNIQUE
indice_syntra INTEGER -- 0-100
energia INTEGER -- 1-10
finanzas_score INTEGER -- 0-100
progreso_metas INTEGER -- 0-100
racha_habitos INTEGER
objetivos_activos INTEGER
tiempo_productivo INTEGER -- minutos
salud_score INTEGER -- 0-100
aprendizaje_score INTEGER -- 0-100
created_at TIMESTAMP
```

---

## 🚀 Deployment en Railway

### 1. Crear cuenta en Railway
[railway.app](https://railway.app)

### 2. Conectar repositorio GitHub
```bash
git remote add origin https://github.com/tu-usuario/habitfinans.git
git push -u origin syntra-mvp
```

### 3. Crear proyecto en Railway
- Nuevo Proyecto
- Conectar GitHub repository
- Seleccionar rama `syntra-mvp`

### 4. Agregar PostgreSQL
- Agregar servicio PostgreSQL
- Railway generará DATABASE_URL automáticamente

### 5. Configurar variables de entorno
En Railway dashboard:
```
DATABASE_URL=postgresql://...  # Auto-generado
JWT_SECRET=your-secret-key
NODE_ENV=production
PORT=5000
```

### 6. Deploy
Railway desplegará automáticamente en cada push a `syntra-mvp`

---

## 📋 Roadmap

### ✅ Fase 1: MVP Premium (Completada)
- [x] Auth y BD relacional
- [x] CRUD de finanzas, hábitos, metas
- [x] Dashboard con Score visual
- [x] Frontend con diseño espectacular
- [x] Animaciones y efectos premium
- [x] Backend Express profesional

### 🔄 Fase 2: IA y Gamificación (Próxima)
- [ ] Motor IA básico (resúmenes diarios)
- [ ] Análisis de patrones
- [ ] Predicciones
- [ ] Email diario con Nodemailer
- [ ] Sistema de logros y desafíos

### 📱 Fase 3: Integraciones (Futuro)
- [ ] Google Calendar
- [ ] Apple Health / Google Fit
- [ ] Notificaciones push
- [ ] Reportes por email

---

## 📞 Soporte

Para preguntas o issues, contactar a: josueluismonzon@gmail.com

---

**Made with 💚 by Josue Monzon & Claude**

Última actualización: 2026-07-08
