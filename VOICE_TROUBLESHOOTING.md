# 🔧 Troubleshooting - Agente de Voz

## Error: "Error al conectar"

### Diagnóstico

Abre la consola del navegador (F12) y busca mensajes que empiecen con `[Voice]`.

### Posibles Causas y Soluciones

#### 1. Error 404 en `/api/voice/init/:recordingId`

**Causa**: El backend no tiene las rutas de voz configuradas.

**Solución**:
```bash
# Verifica que el backend esté actualizado
cd backend
npm install ws @types/ws
npm run build
npm start
```

#### 2. Error de WebSocket

**Causa**: El servidor WebSocket no está corriendo o la ruta es incorrecta.

**Solución**:
- Verifica que veas este mensaje al iniciar el backend:
  ```
  ✅ WebSocket server configured for /voice
  ```
- Si no lo ves, reinicia el servidor

#### 3. Error 500 "Failed to initialize voice session"

**Causa**: Falta la `GEMINI_API_KEY` o el modelo no está disponible.

**Solución**:
```bash
# Verifica que la API key esté configurada
echo $GEMINI_API_KEY  # Linux/Mac
echo %GEMINI_API_KEY%  # Windows

# Si no está configurada, agrégala al .env
echo "GEMINI_API_KEY=tu_api_key_aqui" >> .env
```

#### 4. "Sesión inválida" (WebSocket code 1008)

**Causa**: El sessionId no existe o expiró.

**Solución**:
- Esto es normal si el servidor se reinició
- Simplemente haz click en "Iniciar Conversación" de nuevo

## Verificación Paso a Paso

### 1. Backend Local

```bash
cd backend
npm start
```

**Deberías ver**:
```
✅ WebSocket server configured for /voice
🚀 Server running on port 10000
👉 WebSocket: ws://localhost:10000/voice
```

### 2. Prueba la API REST

```bash
curl -X POST http://localhost:10000/api/voice/init/test-recording-id
```

**Respuesta esperada**:
```json
{
  "success": true,
  "sessionId": "voice_test-recording-id_1234567890",
  "message": "Voice session initialized"
}
```

### 3. Prueba el WebSocket

Abre la consola del navegador y ejecuta:

```javascript
const ws = new WebSocket('ws://localhost:10000/voice?sessionId=test');
ws.onopen = () => console.log('✅ WebSocket connected!');
ws.onerror = (e) => console.error('❌ WebSocket error:', e);
```

## Limitaciones Actuales

### ⚠️ Gemini Live API

La API de Gemini Live (`gemini-2.0-flash-exp`) está en **preview** y puede no estar disponible para todas las cuentas.

**Alternativas**:

1. **Usar el Chat de Texto** (pestaña "Chat AI")
   - Funciona 100%
   - Usa el mismo modelo
   - Sin necesidad de WebSocket

2. **Esperar a que Gemini Live esté disponible**
   - Google está expandiendo el acceso gradualmente
   - Verifica en: https://ai.google.dev/

3. **Implementar Web Speech API** (fallback)
   - Usa la voz del navegador
   - No requiere backend especial
   - Menos natural pero funcional

## Logs Útiles

### Frontend (Consola del Navegador)

```
[Voice] Connecting to: http://localhost:10000/api/voice/init/abc123
[Voice] Session initialized: { sessionId: "voice_abc123_..." }
[Voice] Connecting WebSocket to: ws://localhost:10000/voice?sessionId=...
[Voice] WebSocket connected
```

### Backend (Terminal)

```
[Voice] Session voice_abc123_... connected
[GeminiLive] Session voice_abc123_... connected
[GeminiLive] Setup sent for session voice_abc123_...
```

## Solución Temporal

Si el agente de voz no funciona, **usa el Chat AI**:

1. Click en la pestaña "Chat AI"
2. Escribe tu pregunta
3. Obtén la misma información sin necesidad de voz

El chat de texto usa el mismo modelo y tiene acceso al mismo contexto.

## Reportar Problemas

Si ninguna solución funciona, comparte:

1. **Logs del frontend** (consola del navegador)
2. **Logs del backend** (terminal)
3. **Versión de Node.js**: `node --version`
4. **Sistema operativo**

---

**Última actualización**: 2025-12-03
