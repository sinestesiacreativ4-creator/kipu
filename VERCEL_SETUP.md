# ⚠️ Configuración Crítica para Vercel

Para que la aplicación funcione correctamente en producción, debes configurar las siguientes variables de entorno en el panel de Vercel:

## 1. Variables de Entorno (Environment Variables)

Ve a **Settings > Environment Variables** en tu proyecto de Vercel y agrega:

| Clave | Valor | Descripción |
|-------|-------|-------------|
| `VITE_GEMINI_API_KEY` | `AIzaSy...` (Tu API Key) | Necesaria para el Chat AI (Texto) |
| `VITE_API_URL` | `https://kipu-backend-8006.onrender.com` | (Opcional) URL del backend |

## 2. Verificar Despliegue

Después de agregar las variables:
1. Ve a la pestaña **Deployments**
2. Haz click en los tres puntos del último deploy
3. Selecciona **Redeploy** para que tome las nuevas variables

## 3. Estado de Funcionalidades

- **Chat AI (Texto)**: Funcionará una vez que `VITE_GEMINI_API_KEY` esté configurada.
- **Agente de Voz**: Funcionará automáticamente con el último código (ya apunta directo a Render).
- **Análisis de Audio**: Funciona a través del backend en Render.

---
**Nota**: Nunca compartas tu `VITE_GEMINI_API_KEY` públicamente. En una versión futura, moveremos toda la lógica de Gemini al backend para mayor seguridad.
