# 🧪 Probar el Agente de Voz Ahora

## ✅ Estado Actual

- API de Gemini configurada correctamente
- Límites disponibles: RPM 0/10, TPM 0/250K, RPD 0/500 para `gemini-2.0-flash-exp`
- Cuota no excedida actualmente

## 🔍 Pasos para Probar

### 1. Verificar que el Backend Esté Desplegado

Asegúrate de que los últimos cambios estén en Render:

```bash
# Verifica que los cambios estén pusheados
git status

# Si hay cambios, haz commit y push
git add .
git commit -m "Fix: Better error handling for Gemini quota"
git push origin main
```

### 2. Verificar Logs del Backend en Render

Ve a Render Dashboard → Tu servicio → **Logs** y busca:

```
✅ WebSocket server configured for /voice
[Voice] Connecting to Gemini Live API for session...
[GeminiLive] Session ... connected
[GeminiLive] Setup sent for session...
```

### 3. Probar desde el Frontend

1. Abre tu aplicación en Vercel
2. Ve a una grabación
3. Click en la pestaña **"Voz"**
4. Click en **"Iniciar Conversación"**
5. **Habla claramente** y haz una pausa de 1-2 segundos

### 4. Qué Buscar en los Logs

#### ✅ Si Funciona:
```
[GeminiLive] Setup complete for session ...
[VoiceAgent] Received message from server: {...}
[VoiceAgent] Setup complete - ready to receive audio
[VoiceAgent] Model turn with X parts
[VoiceAgent] Received audio chunk, adding to queue
```

#### ❌ Si Hay Problemas:

**Error de Modelo:**
```
[GeminiLive] Connection closed (code: 1008, reason: model not available)
```
→ Solución: Cambiar a `gemini-2.5-flash-live` o `gemini-2.0-flash`

**Error de Formato:**
```
[GeminiLive] Error parsing message
```
→ Solución: Revisar formato del setup message

**Sin Respuesta:**
```
[GeminiLive] Setup sent...
(pero no hay "Setup complete")
```
→ Solución: Esperar más tiempo, Gemini puede tardar

## 🎯 Posibles Problemas Restantes

### 1. Modelo No Disponible para Live API

El modelo `gemini-2.0-flash-exp` puede no soportar Live API (audio en tiempo real).

**Solución:** Cambiar a un modelo que soporte Live API:

```typescript
// En backend/src/services/geminiLiveSession.ts
const model = 'gemini-2.5-flash-live'; // O gemini-2.0-flash-live
```

### 2. Formato del Setup Incorrecto

Gemini Live API puede requerir un formato específico.

**Verificar:** Revisa los logs del backend para ver si hay errores de formato.

### 3. WebSocket de Gemini No Responde

Puede ser un problema temporal de conectividad.

**Solución:** Esperar unos segundos después de conectar, o reintentar.

## 📊 Verificar en Tiempo Real

### Backend (Render Logs):
- `[GeminiLive] Received message from Gemini` → Gemini está respondiendo
- `[Voice] Forwarding message from Gemini to client` → Mensaje enviado al frontend

### Frontend (Consola del Navegador):
- `[VoiceAgent] Received message from server` → Mensaje recibido
- `[VoiceAgent] Received audio chunk` → Audio recibido y listo para reproducir

## 🔧 Si Aún No Funciona

1. **Revisa los logs completos** del backend en Render
2. **Comparte los logs** de:
   - Backend (últimas 50 líneas)
   - Frontend (consola completa)
3. **Verifica el modelo** - puede que `gemini-2.0-flash-exp` no soporte Live API

## 💡 Nota Importante

Aunque la API esté bien configurada, **Gemini Live API** es una funcionalidad específica que:
- Puede no estar disponible en todos los modelos
- Puede requerir permisos especiales
- Puede tener límites diferentes a la API estándar

Si el problema persiste, considera usar el **Chat AI** (texto) que funciona con la misma API pero sin requerir Live API.

---

**¿Quieres que pruebe algo específico o necesitas ayuda con los logs?**

