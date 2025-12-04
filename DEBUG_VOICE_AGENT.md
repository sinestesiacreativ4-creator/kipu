# 🔍 Debug: Agente de Voz - La IA no Responde

## Cambios Realizados

He agregado logs detallados en todo el flujo para identificar dónde se está perdiendo la comunicación.

## Pasos para Debuggear

### 1. Verificar Logs del Backend (Render)

Ve a Render Dashboard → Tu servicio → **Logs** y busca:

#### ✅ Conexión Exitosa
```
[Voice] Session voice_XXX_... initialized
[GeminiLive] Session voice_XXX_... connected
[GeminiLive] Setup sent for session voice_XXX_...
[Voice] Client connected to session voice_XXX_...
```

#### ✅ Audio Recibido
```
[Voice] Received message from client (session XXX): audio
[Voice] Forwarding audio chunk to Gemini (XXXX bytes)
[GeminiLive] Sending audio chunk (XXXX bytes)
```

#### ✅ Respuesta de Gemini
```
[GeminiLive] Received message from Gemini: {...}
[GeminiLive] Model turn received with X parts
[Voice] Forwarding message from Gemini to client (session XXX)
```

### 2. Verificar Logs del Frontend (Consola del Navegador)

Abre la consola (F12) y busca:

#### ✅ Conexión
```
[VoiceAgent] Backend URL: https://kipu-backend-8006.onrender.com
[VoiceAgent] WebSocket URL: wss://kipu-backend-8006.onrender.com/voice?sessionId=...
[VoiceAgent] Connected
```

#### ✅ Audio Enviado
```
[VoiceAgent] Sending turn_complete (silence detected)
```

#### ✅ Respuesta Recibida
```
[VoiceAgent] Received message from server: {...}
[VoiceAgent] Setup complete - ready to receive audio
[VoiceAgent] Model turn with X parts
[VoiceAgent] Received audio chunk, adding to queue
```

## Problemas Comunes y Soluciones

### Problema 1: No se reciben mensajes de Gemini

**Síntomas:**
- El frontend muestra "Conectado" pero no hay respuestas
- No hay logs de `[GeminiLive] Received message from Gemini`

**Posibles Causas:**

#### A. Modelo no disponible
**Solución:**
1. Verifica en los logs del backend si hay errores de modelo
2. Prueba cambiar el modelo en `backend/src/services/geminiLiveSession.ts`:
   ```typescript
   const model = 'gemini-2.5-flash-live'; // En lugar de gemini-2.0-flash-exp
   ```

#### B. API Key inválida o sin permisos
**Solución:**
1. Verifica que `GEMINI_API_KEY` esté configurada en Render
2. Prueba la API key con:
   ```bash
   curl "https://generativelanguage.googleapis.com/v1beta/models?key=TU_API_KEY"
   ```

#### C. Setup no completado
**Síntoma:** No ves `[GeminiLive] Setup complete`
**Solución:** Espera unos segundos después de conectar, Gemini puede tardar en responder

### Problema 2: Audio se envía pero no hay respuesta

**Síntomas:**
- Ves `[Voice] Forwarding audio chunk to Gemini`
- Pero no ves `[GeminiLive] Received message from Gemini`

**Posibles Causas:**

#### A. Formato de audio incorrecto
**Solución:**
- Verifica que el audio sea PCM 16kHz mono
- Los logs muestran el tamaño del buffer, debería ser > 0

#### B. Falta `turn_complete`
**Solución:**
- El código ahora detecta silencio automáticamente
- Si no funciona, habla claramente y haz una pausa de 1 segundo

#### C. Gemini no está procesando
**Solución:**
- Verifica que el modelo soporte audio en tiempo real
- Algunos modelos pueden requerir configuración adicional

### Problema 3: Respuesta recibida pero no se reproduce

**Síntomas:**
- Ves `[VoiceAgent] Received audio chunk`
- Pero no se reproduce audio

**Solución:**
1. Verifica permisos del navegador para reproducir audio
2. Revisa errores en la consola relacionados con AudioContext
3. Verifica que el formato sea `audio/pcm` y esté en base64

## Comandos Útiles para Testing

### Probar la API de Gemini directamente

```bash
# Verificar modelos disponibles
curl "https://generativelanguage.googleapis.com/v1beta/models?key=TU_API_KEY" | grep "gemini.*live"
```

### Probar el backend localmente

```bash
# Iniciar backend
cd backend
npm run build
npm start

# En otra terminal, probar la inicialización
curl -X POST http://localhost:10000/api/voice/init/test-recording-id \
  -H "Content-Type: application/json"
```

## Checklist de Verificación

Antes de reportar un problema, verifica:

- [ ] Backend está "Live" en Render
- [ ] `GEMINI_API_KEY` está configurada en Render
- [ ] Logs del backend muestran conexión a Gemini
- [ ] Logs del frontend muestran conexión al backend
- [ ] Permisos de micrófono otorgados en el navegador
- [ ] No hay errores de CORS en la consola
- [ ] El modelo `gemini-2.0-flash-exp` está disponible para tu API key

## Próximos Pasos

1. **Despliega los cambios:**
   ```bash
   git add .
   git commit -m "Add detailed logging for voice agent debugging"
   git push origin main
   ```

2. **Espera el despliegue** en Render y Vercel

3. **Prueba el agente de voz** y revisa los logs

4. **Comparte los logs** si el problema persiste:
   - Logs del backend (Render Dashboard)
   - Logs del frontend (Consola del navegador)

## Información Útil para Reportar Problemas

Si el problema persiste, comparte:

1. **Logs del Backend** (últimas 50 líneas)
2. **Logs del Frontend** (consola completa)
3. **URL del backend** que estás usando
4. **Modelo de Gemini** configurado
5. **Navegador y versión** (Chrome, Firefox, etc.)

---

**Con estos logs detallados, podremos identificar exactamente dónde se está perdiendo la comunicación.** 🔍

