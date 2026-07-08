# 🚀 HabitFinans v2.0 - Deployment en Railway

## ✨ Características de Deployment

- ✅ Rama: `syntra-mvp` (rama limpia con código profesional)
- ✅ Backend: Express.js + Node 18
- ✅ Database: PostgreSQL automático (Neon)
- ✅ Frontend: HTML premium con diseño espectacular
- ✅ Fase 2: Email Service + IA + Cron Jobs

---

## 📋 Requisitos Previos

- Cuenta en [Railway.app](https://railway.app)
- Repositorio GitHub conectado
- Rama `syntra-mvp` pusheada a GitHub

---

## 🎯 Paso a Paso: Deployment en Railway

### 1️⃣ Crear Proyecto en Railway

```
1. Ir a https://railway.app/new
2. Clickear "Nuevo Proyecto"
3. Seleccionar "Conectar desde GitHub"
4. Seleccionar el repositorio "habitfinans"
5. Seleccionar rama "syntra-mvp"
6. Clickear "Deploy"
```

### 2️⃣ Railway Agregará Automáticamente

- ✅ Container Node.js
- ✅ PostgreSQL Database
- ✅ Railway generará `DATABASE_URL` automáticamente

### 3️⃣ Configurar Variables de Entorno

En Railway Dashboard → Variables:

```
DATABASE_URL = (auto-generado por Railway)
JWT_SECRET = tu-super-secret-key-produccion
NODE_ENV = production
PORT = (auto 5000)
EMAIL_USER = tu-gmail@gmail.com
EMAIL_PASSWORD = tu-app-password-gmail
EMAIL_FROM = noreply@habitfinans.app
CRON_TIME = 0 20 * * *
```

### 4️⃣ Configurar Email (Opcional pero Recomendado)

Para Gmail:
1. Ir a [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords)
2. Crear contraseña de aplicación (16 caracteres)
3. Usar esa contraseña en `EMAIL_PASSWORD`

### 5️⃣ Deploy Automático

- Railway desplegará automáticamente al hacer push a `syntra-mvp`
- Ver logs en Railway Dashboard
- URL generada automáticamente (ej: habitfinans-prod.railway.app)

---

## 🔧 Configuración Post-Deployment

### 1. Verificar Salud del Servidor

```bash
curl https://habitfinans-prod.railway.app/api/health
```

Respuesta esperada:
```json
{
  "status": "ok",
  "message": "HabitFinans API funcionando correctamente"
}
```

### 2. Probar Base de Datos

El servidor sincronizará automáticamente el schema de PostgreSQL.

### 3. Verificar Email (si está configurado)

Los resúmenes se enviarán diariamente a las 8 PM según `CRON_TIME`.

---

## 📊 Monitoreo

### Logs en Railway

```
Railway Dashboard → Logs
- Buscar "✅ Configuración de email verificada"
- Buscar "Tareas programadas inicializadas"
- Buscar errores con "❌"
```

### Cron Jobs

Los cron jobs se inicializan automáticamente:
- **Diario** (8 PM): Generar insight + enviar email
- **Semanal** (Lunes 9 AM): Resumen semanal
- **Nightly** (12 AM): Actualizar scores

---

## 🐛 Troubleshooting

### Error: "Database connection refused"

✅ **Solución**: Railway crea la BD automáticamente. Esperar 2-3 minutos.

### Error: "Email not configured"

⚠️ **Solución**: Email es opcional. La app funcionará sin él.

### Error: "503 Service Unavailable"

✅ **Solución**: Base de datos se está inicializando. Reintentar en 1 min.

---

## 🚀 Actualizar Código en Producción

```bash
# En tu máquina local
git add .
git commit -m "Tu cambio"
git push origin syntra-mvp

# Railway detecta el push y redeploya automáticamente
```

---

## 📈 Próximas Mejoras (Fase 3)

- [ ] Google Calendar sync
- [ ] Apple Health integration
- [ ] Notificaciones push
- [ ] Reportes automáticos
- [ ] Claude API para IA avanzada

---

## 🎨 URLs Importantes

| Recurso | URL |
|---------|-----|
| App | `https://habitfinans-prod.railway.app` |
| API | `https://habitfinans-prod.railway.app/api` |
| Salud | `https://habitfinans-prod.railway.app/api/health` |
| Logs | Railway Dashboard |

---

## ✅ Checklist Final

- [ ] Código en rama `syntra-mvp`
- [ ] Proyecto creado en Railway
- [ ] BD PostgreSQL conectada
- [ ] Variables de entorno configuradas
- [ ] Email configurado (opcional)
- [ ] URL generada y probada
- [ ] Logs sin errores críticos

---

**¡Listo para producción! 🚀**

Cualquier duda: [Documentación Railway](https://docs.railway.app/)
