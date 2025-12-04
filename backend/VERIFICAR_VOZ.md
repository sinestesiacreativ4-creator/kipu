# 🎙️ Verificación del Agente de Voz

## Pasos para verificar que el agente de voz funcione

### 1. Verificar API Key de Gemini

Asegúrate de tener `GEMINI_API_KEY` configurada en el archivo `.env` del backend:

```bash
cd backend
echo "GEMINI_API_KEY=tu_api_key_aqui" >> .env
```

O edita manualmente el archivo `.env` y agrega:
```
GEMINI_API_KEY=tu_api_key_aqui
```

### 2. Verificar que el modelo esté disponible

El agente usa `gemini-2.0-flash-exp`. Si no está disponible, puedes:

1. Verificar modelos disponibles:
```bash
cd backend
npm run build
node dist/scripts/listModels.js
```

2. Si el modelo no está disponible, edita `backend/src/services/geminiLiveSession.ts` y cambia:
   - Línea 26: `const model = 'gemini-2.0-flash-exp';` 
   - Línea 58: `model: 'models/gemini-2.0-flash-exp',`
   
   Por un modelo alternativo como `gemini-2.5-flash-live` si está disponible.

### 3. Compilar y ejecutar el backend

```bash
cd backend
npm install
npm run build
npm start
```

Deberías ver:
```
✅ WebSocket server configured for /voice
🚀 Server running on port 10000
👉 WebSocket: ws://localhost:10000/voice
```

### 4. Probar la API REST

En otra terminal:
```bash
curl -X POST http://localhost:10000/api/voice/init/test-recording-id
```

**Respuesta esperada:**
```json
{
  "success": true,
  "sessionId": "voice_test-recording-id_...",
  "message": "Voice session initialized"
}
```

**Si hay error:**
- `GEMINI_API_KEY is not configured` → Agrega la API key al .env
- `Recording not found` → Normal si usas un ID de prueba
- `model is not available` → El modelo no está disponible para tu cuenta

### 5. Probar desde el frontend

1. Inicia el frontend:
```bash
npm run dev
```

2. Abre una grabación en el navegador
3. Ve a la pestaña "Voz"
4. Haz click en "Iniciar Conversación"
5. Deberías ver "Conectado" y el micrófono se activará automáticamente

### 6. Troubleshooting

#### Error: "Error al conectar"
- Abre la consola del navegador (F12)
- Busca mensajes que empiecen con `[VoiceAgent]`
- Verifica que el backend esté corriendo en el puerto 10000

#### Error: "WebSocket connection failed"
- Verifica que el backend muestre `✅ WebSocket server configured for /voice`
- Si estás en producción, asegúrate de que Render permita WebSockets

#### Error: "GEMINI_API_KEY is not configured"
- Verifica que el archivo `.env` esté en la carpeta `backend/`
- Reinicia el servidor después de agregar la API key

#### El audio no se reproduce
- Verifica permisos del micrófono en el navegador
- Asegúrate de usar Chrome/Edge (mejor soporte)
- Revisa la consola del navegador para errores de AudioContext

### 7. Modelos alternativos

Si `gemini-2.0-flash-exp` no funciona, puedes probar:
- `gemini-2.5-flash-live`
- `gemini-1.5-flash-live` (si está disponible)

Edita `backend/src/services/geminiLiveSession.ts` líneas 26 y 58.

---

**Nota**: Gemini Live API está en preview y puede no estar disponible para todas las cuentas. Si no funciona, considera usar el Chat AI (pestaña "Chat AI") que usa el mismo modelo pero sin voz.

