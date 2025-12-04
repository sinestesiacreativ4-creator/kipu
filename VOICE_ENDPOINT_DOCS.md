# 🎙️ Endpoint POST /api/voice/init/:sessionId

## 📋 Descripción

Endpoint simple y directo para inicializar una sesión de voz. Devuelve la información necesaria para que el frontend se conecte al WebSocket.

## 🔗 Endpoint

```
POST /api/voice/init/:sessionId
```

## 📥 Request

### URL Parameters
- `sessionId` (string, requerido): ID de la sesión de voz

### Ejemplo
```
POST /api/voice/init/my-session-123
```

## 📤 Response

### Success (200 OK)
```json
{
  "success": true,
  "sessionId": "my-session-123",
  "wsUrl": "wss://kipu-backend-8006.onrender.com/api/voice/ws/my-session-123",
  "createdAt": "2025-12-04T03:32:09.346Z"
}
```

### Error (500)
```json
{
  "success": false,
  "error": "Error message"
}
```

## 🔧 Características

- ✅ **Sin autenticación**: No requiere tokens ni validaciones adicionales
- ✅ **Detección automática de URL**: Detecta automáticamente el host y protocolo
- ✅ **Soporte para variables de entorno**: Usa `BACKEND_URL` o `RENDER_EXTERNAL_URL` si están configuradas
- ✅ **Listo para producción**: Funciona en Render, Vercel y otros servicios

## 🌐 WebSocket Connection

Después de recibir la respuesta, el frontend debe conectarse al WebSocket usando el `wsUrl` proporcionado:

```javascript
const response = await fetch('/api/voice/init/my-session-123', {
  method: 'POST'
});

const { wsUrl } = await response.json();

// Conectar al WebSocket
const ws = new WebSocket(wsUrl);
```

## 📝 Notas Técnicas

### Detección de URL

El endpoint detecta automáticamente:
1. **Protocolo**: `https` → `wss`, `http` → `ws`
2. **Host**: Del header `Host` de la request
3. **Fallback**: `kipu-backend-8006.onrender.com` si no se puede detectar

### Variables de Entorno

Si están configuradas, se usan en este orden:
1. `BACKEND_URL`
2. `RENDER_EXTERNAL_URL`

### WebSocket Path

El WebSocket está disponible en:
- `/api/voice/ws/:sessionId` (nuevo formato)
- `/voice?sessionId=:sessionId` (legacy, para compatibilidad)

## 🚀 Ejemplo de Uso Completo

```javascript
// 1. Inicializar sesión
const sessionId = 'my-session-123';
const response = await fetch(`/api/voice/init/${sessionId}`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  }
});

const data = await response.json();

if (data.success) {
  // 2. Conectar al WebSocket
  const ws = new WebSocket(data.wsUrl);
  
  ws.onopen = () => {
    console.log('WebSocket connected');
  };
  
  ws.onmessage = (event) => {
    const message = JSON.parse(event.data);
    console.log('Message received:', message);
  };
  
  // 3. Enviar mensaje
  ws.send(JSON.stringify({
    type: 'audio',
    data: 'base64-encoded-audio-data'
  }));
}
```

## ✅ Estado

- ✅ Implementado
- ✅ Probado
- ✅ Listo para producción
- ✅ Documentado

---

**Última actualización**: 2025-12-04

