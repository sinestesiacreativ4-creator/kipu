# 🚀 Despliegue Automático a Render

## ✅ Estado Actual

- **Código:** Subido a GitHub (commit `b84318e`)
- **Arquitectura:** Híbrida (API + Worker en un solo proceso)
- **Redis:** BullMQ para cola de jobs
- **Base de Datos:** PostgreSQL (Prisma)

---

## 📋 Qué sucederá automáticamente

Si ya tienes el servicio **`kipu-backend`** conectado a tu repositorio GitHub en Render:

1. ✅ Render detectará el nuevo commit automáticamente
2. ✅ Iniciará un nuevo deploy
3. ✅ Ejecutará:
   ```bash
   npm install
   npx prisma generate
   npm run build
   npx prisma db push
   node dist/index.js
   ```
4. ✅ El Worker se iniciará dentro del mismo proceso

**Tiempo estimado:** 5-7 minutos

---

## 🔍 Cómo Verificar el Despliegue

### Paso 1: Ir al Dashboard
1. Abre: https://dashboard.render.com/
2. Busca el servicio: **`kipu-backend`**

### Paso 2: Ver el Deploy en Progreso
1. Click en **`kipu-backend`**
2. Ve a la pestaña **"Events"**
3. Deberías ver:
   ```
   Deploying commit b84318e: Architecture: Hybrid API+Worker...
   ```

### Paso 3: Verificar los Logs
Una vez que el deploy termine (punto verde), ve a **"Logs"** y busca:

```
[Server] Backend running on port 10000
[Worker] Running in hybrid mode (same process as API)
[Worker] Audio Processing Worker Started
[Worker] Redis connection established
[Worker] Worker is ready and waiting for jobs
```

**Si ves estos mensajes → ✅ Deploy exitoso**

---

## ⚠️ Si NO tienes el servicio aún

Debes crear el servicio manualmente en Render:

### Variables de Entorno Necesarias:

```env
NODE_ENV=production
PORT=10000
REDIS_URL=redis://default:YHSnbqQscG4re07AsiJFJagXWSWBoe5a@redis-17454.c8.us-east-1-2.ec2.cloud.redislabs.com:17454
GEMINI_API_KEY=AIzaSyAXGFG6wYKyAYF3ltIzPoINVRbzSMu8fMw
FRONTEND_URL=https://kipu.vercel.app
DATABASE_URL=(se conecta automáticamente desde kipu-db)
```

### Comandos de Build/Start:

- **Build:** `npm install && npx prisma generate && npm run build`
- **Start:** `npx prisma generate && npx prisma db push && node dist/index.js`

---

## 🎯 Prueba Final

Una vez desplegado, prueba la aplicación en:

**Frontend:** https://kipu.vercel.app
1. Ingresa código: `demo`
2. Graba o sube un archivo
3. La subida debe ser instantánea (202 Accepted)
4. El análisis aparecerá en ~10-30 segundos

**Backend API:** https://kipu-ruki.onrender.com/health
- Debería responder: `"Audio Processing Service OK"`

---

## 📊 Arquitectura Desplegada

```
┌─────────────────────────────────────┐
│  kipu-backend (Render)              │
│  ┌──────────┐    ┌──────────────┐  │
│  │ Express  │───▶│ BullMQ Worker│  │
│  │ (API)    │    │ (Background) │  │
│  └──────────┘    └──────────────┘  │
│       ↓                 ↓           │
│  PostgreSQL         Redis           │
└─────────────────────────────────────┘
         ↑
         │
    Vercel Frontend
```

**Todo en UN SOLO PROCESO** = **Menos costo + Más simple** 🚀
