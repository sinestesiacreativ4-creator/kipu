# 🚀 Desplegar a Render - Guía Completa

## 📋 Pasos para Desplegar

### 1. Preparar el Repositorio

Asegúrate de que todos los cambios estén commitados y pusheados a GitHub:

```bash
git add .
git commit -m "Agregar agente de voz con WebSocket support"
git push origin main
```

### 2. Crear/Actualizar Servicio en Render

#### Opción A: Usar render.yaml (Recomendado)

1. Ve a https://dashboard.render.com/
2. Click en **"New"** → **"Blueprint"**
3. Conecta tu repositorio de GitHub
4. Render detectará automáticamente el `render.yaml`
5. Click en **"Apply"**

#### Opción B: Crear Manualmente

1. Ve a https://dashboard.render.com/
2. Click en **"New"** → **"Web Service"**
3. Conecta tu repositorio de GitHub
4. Configura:
   - **Name:** `kipu-backend`
   - **Root Directory:** `backend`
   - **Environment:** `Node`
   - **Build Command:** `npm install && npx prisma generate && npm run build`
   - **Start Command:** `npx prisma generate && npx prisma db push --accept-data-loss && node dist/index.js`
   - **Plan:** Free (o el que prefieras)

### 3. Configurar Variables de Entorno

En el panel de Render, ve a **"Environment"** y agrega:

| Variable | Valor | Notas |
|----------|-------|-------|
| `NODE_ENV` | `production` | Automático si usas render.yaml |
| `PORT` | `10000` | Automático si usas render.yaml |
| `GEMINI_API_KEY` | `tu_api_key_aqui` | **CRÍTICO para el agente de voz** |
| `REDIS_URL` | `redis://...` | Si usas Redis externo |
| `DATABASE_URL` | (auto) | Se conecta automáticamente si creas la DB |
| `FRONTEND_URL` | `https://tu-frontend.vercel.app` | Opcional, para CORS |

**⚠️ IMPORTANTE:** `GEMINI_API_KEY` es **obligatoria** para que el agente de voz funcione.

### 4. Crear Base de Datos (si no existe)

1. En Render, click **"New"** → **"PostgreSQL"**
2. Name: `kipu-db`
3. Plan: Free
4. Render conectará automáticamente `DATABASE_URL` al servicio

### 5. Verificar el Despliegue

Una vez desplegado, verifica los logs. Deberías ver:

```
✅ WebSocket server configured for /voice
🚀 Server running on port 10000
👉 WebSocket: wss://kipu-backend-8006.onrender.com/voice
```

### 6. Probar el Agente de Voz

1. Abre tu frontend (Vercel o donde esté)
2. Ve a una grabación
3. Click en la pestaña **"Voz"**
4. Click en **"Iniciar Conversación"**
5. Deberías ver "Conectado" y el micrófono se activará

## 🔧 Troubleshooting

### Error: "GEMINI_API_KEY is not configured"

**Solución:**
1. Ve a Render Dashboard → Tu servicio → Environment
2. Agrega `GEMINI_API_KEY` con tu API key de Gemini
3. Haz **"Manual Deploy"** para aplicar los cambios

### Error: "WebSocket connection failed"

**Solución:**
- Render soporta WebSockets automáticamente
- Verifica que el servicio esté en estado "Live" (punto verde)
- Revisa los logs del backend para ver si hay errores

### Error: "Recording not found"

**Solución:**
- Normal si pruebas con un ID de prueba
- Asegúrate de tener grabaciones reales en la base de datos

### El servicio no inicia

**Solución:**
1. Revisa los logs en Render
2. Verifica que `DATABASE_URL` esté configurada
3. Verifica que el build haya sido exitoso
4. Asegúrate de que `PORT=10000` esté configurado

## 📝 Notas Importantes

### WebSockets en Render

- ✅ Render soporta WebSockets automáticamente en servicios web
- ✅ No necesitas configuración especial
- ✅ Usa `wss://` (WebSocket Secure) en producción

### URL del Backend

El frontend está configurado para usar:
- **Desarrollo:** `http://localhost:10000`
- **Producción:** `https://kipu-backend-8006.onrender.com`

Si tu servicio tiene otro nombre, actualiza:
- `components/VoiceAgent.tsx` (líneas 57 y 74)
- `components/VoiceChat.tsx` (línea 30)

### Modelo de Gemini

El agente usa `gemini-2.0-flash-exp`. Si no está disponible:
1. Edita `backend/src/services/geminiLiveSession.ts`
2. Cambia `gemini-2.0-flash-exp` por `gemini-2.5-flash-live` o el que esté disponible
3. Redespliega

## 🎯 Checklist Final

Antes de considerar el despliegue completo:

- [ ] Código pusheado a GitHub
- [ ] Servicio creado en Render
- [ ] `GEMINI_API_KEY` configurada
- [ ] Base de datos creada y conectada
- [ ] Build exitoso (ver logs)
- [ ] Servicio en estado "Live"
- [ ] WebSocket funcionando (ver logs: "WebSocket server configured")
- [ ] Frontend actualizado con URL correcta
- [ ] Prueba del agente de voz exitosa

## 📞 Soporte

Si tienes problemas:
1. Revisa los logs en Render Dashboard
2. Revisa la consola del navegador (F12)
3. Consulta `backend/VERIFICAR_VOZ.md` para troubleshooting del agente de voz

---

**Última actualización:** 2025-01-XX
**Versión:** Con soporte completo para Agente de Voz con WebSockets

