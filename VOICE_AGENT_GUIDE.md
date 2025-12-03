# 🎙️ Agente de Voz con Gemini Live API

## 📋 Resumen

Hemos implementado un **agente de voz conversacional** que te permite hablar sobre tus reuniones usando Gemini Live API. El agente tiene acceso completo al análisis de la reunión y puede responder preguntas en tiempo real con voz natural.

## ✅ Lo que se implementó

### Backend
1. **`geminiLiveSession.ts`** - Gestor de sesiones WebSocket con Gemini Live API
2. **`voiceController.ts`** - Controlador REST + WebSocket para sesiones de voz
3. **Rutas API**:
   - `POST /api/voice/init/:recordingId` - Inicializa sesión de voz
   - `POST /api/voice/close/:sessionId` - Cierra sesión
   - `WS /voice?sessionId=xxx` - WebSocket para streaming de audio

### Frontend
1. **`VoiceChat.tsx`** - Componente React con UI completa
   - Captura de micrófono
   - Reproducción de audio
   - Indicadores visuales
   - Controles de conexión

## 🚀 Cómo usar

### 1. Integrar en DetailView

Agrega el componente `VoiceChat` a tu vista de detalles de grabación:

```typescript
import VoiceChat from './VoiceChat';

// En tu DetailView.tsx
<div className="mt-8">
  <VoiceChat recordingId={recording.id} />
</div>
```

### 2. Flujo de uso

1. **Usuario abre una grabación** → Ve el botón "Iniciar Conversación"
2. **Click en "Iniciar Conversación"** → Se conecta al backend
3. **Backend crea sesión** → Conecta con Gemini Live API
4. **Usuario presiona "Hablar"** → Micrófono se activa
5. **Usuario hace pregunta** → Audio se envía a Gemini
6. **Gemini responde con voz** → Se reproduce automáticamente

### 3. Ejemplos de preguntas

```
"¿Qué decisiones se tomaron en esta reunión?"
"¿Quién mencionó el presupuesto?"
"Resume los puntos principales"
"¿Qué tareas tengo pendientes?"
"¿De qué hablaron sobre el proyecto?"
```

## ⚙️ Configuración

### Variables de entorno necesarias

```bash
GEMINI_API_KEY=tu_api_key_aqui
```

### Dependencias

```bash
# Backend
npm install ws @types/ws

# Frontend (ya incluidas)
# - React
# - lucide-react
```

## 🎯 Características

### ✅ Implementado

- ✅ Conexión WebSocket bidireccional
- ✅ Streaming de audio en tiempo real
- ✅ Voz natural con Gemini 2.0 Flash
- ✅ Contexto completo de la reunión
- ✅ Indicadores visuales (hablando/escuchando)
- ✅ Auto-limpieza de sesiones (30 min timeout)
- ✅ Manejo de errores robusto

### 🔜 Mejoras futuras

- [ ] Detección de actividad de voz (VAD)
- [ ] Interrupciones naturales
- [ ] Historial de conversación persistente
- [ ] Múltiples voces (selección de voz)
- [ ] Transcripción en tiempo real
- [ ] Modo manos libres

## 📊 Límites y Consideraciones

### Límites de Gemini Live API

| Límite | Valor |
|--------|-------|
| Duración máxima de sesión | 30 minutos |
| Latencia típica | ~300-500ms |
| Calidad de audio | 24kHz PCM |
| Idiomas soportados | Múltiples (incluido español) |

### Costos

- **Gemini 2.0 Flash**: Gratis durante preview
- **Después del preview**: ~$0.075 por 1M tokens de entrada
- **Audio**: Cuenta como tokens según duración

### Requisitos del navegador

- ✅ Chrome/Edge (recomendado)
- ✅ Firefox
- ✅ Safari (con limitaciones)
- ❌ IE11 (no soportado)

## 🐛 Troubleshooting

### "No se pudo acceder al micrófono"

**Solución**: Asegúrate de que:
1. El sitio use HTTPS (o localhost)
2. El usuario haya dado permisos de micrófono
3. No haya otra app usando el micrófono

### "Error de conexión WebSocket"

**Solución**:
1. Verifica que `GEMINI_API_KEY` esté configurada
2. Revisa los logs del backend
3. Confirma que el modelo `gemini-2.0-flash-exp` esté disponible

### "El audio no se reproduce"

**Solución**:
1. Verifica que el navegador soporte Web Audio API
2. Revisa la consola del navegador
3. Prueba con otro navegador

## 📝 Notas técnicas

### Arquitectura

```
Frontend (VoiceChat.tsx)
    ↓ WebSocket
Backend (voiceController.ts)
    ↓ WebSocket
Gemini Live API
    ↓ Audio Response
Backend → Frontend → Speaker
```

### Formato de audio

- **Entrada**: WebM/Opus (del navegador)
- **Procesamiento**: PCM 16kHz mono
- **Salida**: PCM 24kHz (de Gemini)

### Seguridad

- ✅ Sesiones con timeout automático
- ✅ Validación de sessionId
- ✅ CORS configurado
- ⚠️ TODO: Rate limiting por usuario
- ⚠️ TODO: Autenticación de sesiones

## 🎨 Personalización

### Cambiar la voz

En `geminiLiveSession.ts`, línea 36:

```typescript
voice_name: 'Puck' // Opciones: Puck, Charon, Kore, Fenrir, Aoede
```

### Ajustar temperatura

En `geminiLiveSession.ts`, línea 21:

```typescript
generation_config: {
    temperature: 0.7, // 0.0 = más determinista, 1.0 = más creativo
    // ...
}
```

### Modificar el prompt del sistema

En `geminiLiveSession.ts`, línea 43-55, personaliza las instrucciones.

## 📚 Referencias

- [Gemini Live API Docs](https://ai.google.dev/api/multimodal-live)
- [Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)
- [MediaRecorder API](https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder)

---

**Estado**: ✅ Implementado y listo para usar
**Última actualización**: 2025-12-03
