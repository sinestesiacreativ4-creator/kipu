# ✅ Checklist de Despliegue a Render

## Antes de Desplegar

### 1. Código Local
- [x] Correcciones del agente de voz aplicadas
- [x] Formato de mensajes corregido (type: 'audio')
- [x] Modelo actualizado a gemini-2.0-flash-exp
- [x] Manejo de errores mejorado
- [ ] **TODO:** Commit y push a GitHub

### 2. Configuración de Render

#### Si es la primera vez:
- [ ] Crear cuenta en https://dashboard.render.com/
- [ ] Conectar repositorio de GitHub
- [ ] Crear servicio usando `render.yaml` (Blueprint) o manualmente

#### Si ya existe el servicio:
- [ ] Verificar que esté conectado al repositorio correcto
- [ ] El servicio debería auto-desplegarse con el nuevo push

### 3. Variables de Entorno en Render

Ve a tu servicio → **Environment** y verifica/agrega:

- [ ] `GEMINI_API_KEY` = `tu_api_key_de_gemini` ⚠️ **CRÍTICO**
- [ ] `NODE_ENV` = `production` (automático)
- [ ] `PORT` = `10000` (automático)
- [ ] `DATABASE_URL` = (conectado automáticamente si usas DB de Render)
- [ ] `REDIS_URL` = (si usas Redis externo)
- [ ] `FRONTEND_URL` = (opcional, para CORS)

### 4. Base de Datos

- [ ] Base de datos creada en Render (si no existe)
- [ ] `DATABASE_URL` conectada automáticamente al servicio

## Durante el Despliegue

### 5. Monitorear el Build

1. Ve a Render Dashboard → Tu servicio
2. Click en **"Events"** o **"Logs"**
3. Deberías ver:
   ```
   Building...
   npm install
   npx prisma generate
   npm run build
   ```

### 6. Verificar Logs de Inicio

Una vez que el build termine, busca en los logs:

```
✅ WebSocket server configured for /voice
🚀 Server running on port 10000
👉 WebSocket: wss://kipu-backend-XXXX.onrender.com/voice
✅ Audio processing worker initialized
```

**Si ves estos mensajes → ✅ Despliegue exitoso**

## Después del Despliegue

### 7. Probar el Backend

```bash
# Health check
curl https://kipu-backend-XXXX.onrender.com/health

# Debería responder: {"status":"ok",...}
```

### 8. Probar el Agente de Voz

1. Abre tu frontend (Vercel o donde esté)
2. Ve a una grabación existente
3. Click en la pestaña **"Voz"**
4. Click en **"Iniciar Conversación"**
5. Deberías ver:
   - Estado: "Conectado"
   - El micrófono se activa automáticamente
   - Puedes hablar y recibir respuestas de voz

### 9. Verificar WebSocket

Abre la consola del navegador (F12) y busca:

```
[VoiceAgent] Connected
[VoiceAgent] Session initialized
```

**Si hay errores:**
- Revisa `backend/VERIFICAR_VOZ.md`
- Verifica que `GEMINI_API_KEY` esté configurada
- Revisa los logs del backend en Render

## 🚨 Problemas Comunes

### El servicio no inicia
- **Causa:** Falta `GEMINI_API_KEY` o `DATABASE_URL`
- **Solución:** Agrega las variables de entorno y redespliega

### WebSocket no funciona
- **Causa:** El servicio no está en estado "Live"
- **Solución:** Espera a que termine el despliegue (punto verde)

### "Error al conectar" en el frontend
- **Causa:** URL del backend incorrecta o servicio caído
- **Solución:** Verifica la URL en `VoiceAgent.tsx` y que el servicio esté activo

### El audio no se reproduce
- **Causa:** Permisos del micrófono o modelo no disponible
- **Solución:** 
  - Permite acceso al micrófono en el navegador
  - Verifica que el modelo `gemini-2.0-flash-exp` esté disponible

## 📝 Notas Finales

- **URL del Backend:** Render generará una URL como `https://kipu-backend-XXXX.onrender.com`
- **WebSockets:** Render soporta WebSockets automáticamente (usa `wss://`)
- **Tiempo de Despliegue:** 5-7 minutos típicamente
- **Costo:** Plan Free de Render es suficiente para desarrollo/testing

## 🎯 Siguiente Paso

Una vez que todo funcione:
1. Actualiza la URL del backend en el frontend si cambió
2. Prueba todas las funcionalidades
3. Documenta cualquier problema encontrado

---

**¿Listo para desplegar?** Sigue los pasos en `RENDER_DEPLOY.md` 🚀

