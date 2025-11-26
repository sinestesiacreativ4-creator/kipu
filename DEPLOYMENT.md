# 🚀 Guía de Despliegue - Arquitectura Híbrida

Esta aplicación usa una arquitectura híbrida optimizada:
- **Frontend** → Vercel (CDN global, optimizado para React/Vite)
- **Backend + Workers + DB + Redis** → Render (servicios persistentes)

## 📋 Pre-requisitos

- [ ] Cuenta de [Vercel](https://vercel.com)
- [ ] Cuenta de [Render](https://render.com)
- [ ] Cuenta de [Supabase](https://supabase.com) (para storage)
- [ ] Repositorio en GitHub
- [ ] API Key de Gemini
- [ ] Redis URL (puedes usar [Upstash](https://upstash.com) gratis)

---

## 🎯 Parte 1: Despliegue del Backend en Render

### 1.1 Preparar Redis

**Opción A: Redis en Render**
1. Ve a [Dashboard de Render](https://dashboard.render.com)
2. Click en "New +" → "Redis"
3. Nombre: `kipu-redis`
4. Plan: Free
5. Click "Create Redis"
6. **Copia la URL interna** (Internal Redis URL)

**Opción B: Upstash Redis (Recomendado)**
1. Ve a [Upstash Console](https://console.upstash.com)
2. Click "Create Database"
3. Nombre: `kipu-redis`
4. Tipo: Global
5. **Copia la URL de conexión** (Redis URL)

### 1.2 Configurar Base de Datos

Tu `render.yaml` ya incluye la configuración de PostgreSQL. Render creará automáticamente:
- Base de datos: `kipu-db`
- Usuario: `kipu`
- La URL se inyectará automáticamente como `DATABASE_URL`

### 1.3 Desplegar Backend + Workers

1. **Conectar Repositorio a Render**
   - Ve al [Dashboard de Render](https://dashboard.render.com)
   - Click "New +" → "Blueprint"
   - Conecta tu repositorio de GitHub
   - Render detectará automáticamente el `render.yaml`

2. **Configurar Variables de Entorno**
   
   Render te pedirá las siguientes variables:
   
   ```bash
   REDIS_URL=redis://default:xxxx@xxxx.upstash.io:6379
   GEMINI_API_KEY=tu_gemini_api_key
   SUPABASE_URL=https://tu-proyecto.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=tu_supabase_service_role_key
   ```

3. **Aprobar y Desplegar**
   - Revisa la configuración
   - Click "Apply"
   - Render creará 3 servicios:
     - `kipu-backend` (Web Service)
     - `kipu-audio-worker` (Worker)
     - `kipu-db` (PostgreSQL)

4. **Verificar Despliegue**
   - Espera a que todos los servicios estén "Live" (verde)
   - Copia la URL del backend: `https://kipu-backend.onrender.com`
   - Prueba en navegador: debería responder

### 1.4 Inicializar Base de Datos

Una vez el backend esté desplegado:

1. Ve a `kipu-backend` → "Shell"
2. Ejecuta las migraciones (ya se ejecutan automáticamente en startup)
3. Si necesitas datos de prueba, llama al endpoint:
   ```bash
   curl -X POST https://kipu-backend.onrender.com/api/init-demo-data
   ```

---

## 🎨 Parte 2: Despliegue del Frontend en Vercel

### 2.1 Conectar a Vercel

1. Ve a [Vercel Dashboard](https://vercel.com/dashboard)
2. Click "Add New..." → "Project"
3. Import tu repositorio de GitHub
4. Configuración del proyecto:
   - **Framework Preset**: Vite
   - **Root Directory**: `./` (raíz del proyecto)
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`

### 2.2 Variables de Entorno

Agrega las siguientes variables de entorno en Vercel:

```bash
VITE_API_URL=https://kipu-backend.onrender.com
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_ANON_KEY=tu_supabase_anon_key
```

### 2.3 Desplegar

1. Click "Deploy"
2. Espera a que termine el build (~2 minutos)
3. Vercel te dará una URL: `https://tu-app.vercel.app`

---

## 🔧 Parte 3: Configuración CORS

Una vez tengas la URL de Vercel, actualiza el backend:

1. Ve a Render → `kipu-backend` → Environment
2. Agrega nueva variable:
   ```bash
   FRONTEND_URL=https://tu-app.vercel.app
   ```
3. El backend ya está configurado para leer esta variable y permitir CORS

Si necesitas editar el código manualmente, abre `backend/src/index.ts` y verifica:
```typescript
const allowedOrigins = [
  process.env.FRONTEND_URL,
  'http://localhost:3000',
  'http://localhost:5173'
];
```

---

## ✅ Verificación

### Checklist de Funcionalidad

- [ ] Frontend carga correctamente en Vercel
- [ ] No hay errores en la consola del navegador
- [ ] Puedes hacer login/signup
- [ ] Puedes grabar audio
- [ ] El audio se sube correctamente
- [ ] El worker procesa el audio (revisa Render logs)
- [ ] Ves el análisis de tu grabación
- [ ] No hay errores de CORS

### Monitoring

**Logs del Backend:**
- Render Dashboard → `kipu-backend` → Logs

**Logs del Worker:**
- Render Dashboard → `kipu-audio-worker` → Logs

**Logs del Frontend:**
- Vercel Dashboard → Deployments → [último deploy] → Functions
- O en DevTools del navegador

---

## 🐛 Troubleshooting

### Error: CORS blocked

**Solución:**
1. Verifica que `FRONTEND_URL` esté configurada en Render
2. La URL debe ser exacta (sin `/` al final)
3. Reinicia el servicio backend en Render

### Error: Cannot connect to backend

**Solución:**
1. Verifica que `VITE_API_URL` en Vercel apunte a la URL correcta de Render
2. Verifica que el backend esté "Live" en Render
3. Prueba el endpoint en Postman: `GET https://kipu-backend.onrender.com/health`

### Worker no procesa trabajos

**Solución:**
1. Verifica logs del worker en Render
2. Verifica que `REDIS_URL` esté configurada correctamente
3. Verifica que `GEMINI_API_KEY` sea válida
4. Prueba conexión Redis manualmente

### Base de datos no conecta

**Solución:**
1. Render Dashboard → `kipu-db` → Info
2. Verifica que esté "Available"
3. La variable `DATABASE_URL` se inyecta automáticamente
4. Revisa logs de Prisma en el backend

---

## 📊 Costos Estimados

### Plan Free (actual)

- **Vercel**: Gratis (100GB bandwidth/mes)
- **Render**:
  - Backend: Gratis (750 hrs/mes)
  - Worker: Gratis (750 hrs/mes)
  - PostgreSQL: Gratis (90 días, luego $7/mes)
  - Redis (optional): Gratis en Upstash (10K comandos/día)

**Total**: $0/mes (primeros 90 días), luego $7/mes para DB

### Plan Producción (recomendado)

- **Vercel**: Pro $20/mes (incluye funciones avanzadas)
- **Render**:
  - Backend: Standard $7/mes (512MB RAM)
  - Worker: Standard $7/mes
  - PostgreSQL: Standard $7/mes (256MB RAM)
- **Upstash Redis**: Pro $10/mes (ilimitado)

**Total**: ~$51/mes

---

## 🔄 Actualizar en el Futuro

### Actualizar Frontend
```bash
git push origin main
```
Vercel detecta automáticamente y redespliega.

### Actualizar Backend
```bash
git push origin main
```
Render detecta automáticamente y redespliega.

### Actualizar Variables de Entorno
- Vercel: Settings → Environment Variables
- Render: Environment → Environment Variables → Add Variable

---

## 📞 Soporte

- **Vercel Docs**: https://vercel.com/docs
- **Render Docs**: https://render.com/docs
- **Upstash Docs**: https://docs.upstash.com

¡Listo! Tu aplicación ahora está desplegada con una arquitectura híbrida optimizada. 🎉
