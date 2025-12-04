# 🔧 Fix: Agente de Voz en Vercel

## Problema

El agente de voz estaba intentando usar `/api/voice/init/...` a través del proxy de Vercel, pero:
1. Vercel no puede hacer proxy de WebSockets
2. El código necesita conectarse directamente a Render

## Solución Aplicada

### 1. Código Actualizado

`VoiceAgent.tsx` ahora:
- ✅ Detecta correctamente el entorno (localhost vs producción)
- ✅ Usa la URL completa de Render en producción
- ✅ Soporta variable de entorno `VITE_API_URL` o `VITE_BACKEND_URL`
- ✅ Conecta WebSockets directamente a Render (no a través de Vercel)

### 2. Configuración en Vercel

**Opción A: Usar variable de entorno (Recomendado)**

1. Ve a tu proyecto en Vercel Dashboard
2. Settings → Environment Variables
3. Agrega:
   - **Key:** `VITE_BACKEND_URL`
   - **Value:** `https://kipu-backend-8006.onrender.com`
   - **Environment:** Production, Preview, Development
4. Haz **Redeploy** del proyecto

**Opción B: El código detecta automáticamente**

Si no configuras la variable, el código detectará automáticamente:
- `localhost` → `http://localhost:10000`
- Cualquier otro dominio → `https://kipu-backend-8006.onrender.com`

## Verificación

### 1. Revisa los Logs del Navegador

Abre la consola (F12) y busca:

```
[VoiceAgent] Backend URL: https://kipu-backend-8006.onrender.com Hostname: kipu-alpha.vercel.app
[VoiceAgent] WebSocket URL: wss://kipu-backend-8006.onrender.com/voice?sessionId=...
```

**Si ves la URL de Render → ✅ Correcto**
**Si ves la URL de Vercel → ❌ Problema**

### 2. Prueba la Conexión

1. Abre una grabación
2. Click en pestaña "Voz"
3. Click en "Iniciar Conversación"
4. Deberías ver "Conectado" sin errores

## Troubleshooting

### Error: "404 Not Found" en `/api/voice/init/...`

**Causa:** El código compilado está usando una versión antigua

**Solución:**
1. Asegúrate de que los cambios estén commitados
2. Haz push a GitHub
3. Vercel debería auto-desplegar
4. O haz **Redeploy** manual en Vercel Dashboard

### Error: "CORS error"

**Causa:** El backend no tiene CORS configurado para Vercel

**Solución:**
- El backend ya tiene CORS configurado para todos los orígenes
- Verifica que el backend esté corriendo en Render

### Error: "WebSocket connection failed"

**Causa:** El backend no está corriendo o la URL es incorrecta

**Solución:**
1. Verifica que el backend esté "Live" en Render
2. Prueba: `curl https://kipu-backend-8006.onrender.com/health`
3. Revisa los logs del backend en Render

## Cambios Realizados

1. ✅ `components/VoiceAgent.tsx` - Detección mejorada de entorno
2. ✅ Soporte para `VITE_BACKEND_URL` variable de entorno
3. ✅ Logs de debug agregados
4. ✅ WebSocket siempre conecta directamente a Render

## Próximos Pasos

1. **Commit y push los cambios:**
   ```bash
   git add .
   git commit -m "Fix: Agente de voz conecta directamente a Render"
   git push origin main
   ```

2. **Espera el despliegue en Vercel** (automático)

3. **Opcional: Configura `VITE_BACKEND_URL`** en Vercel para mayor control

4. **Prueba el agente de voz** desde producción

---

**Nota:** Si tu backend de Render tiene una URL diferente a `kipu-backend-8006.onrender.com`, configura `VITE_BACKEND_URL` en Vercel con la URL correcta.

