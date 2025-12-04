# ⚠️ Problema: Cuota de Gemini API Excedida

## 🔍 Problema Identificado

El script de prueba reveló el problema real:

```
Connection closed (code: 1011, reason: You exceeded your current quota, please check your plan and billing details)
```

**Esto explica por qué la IA no responde** - No es un problema de código, sino de cuota/billing de la API de Gemini.

## ✅ Soluciones

### Opción 1: Actualizar Plan de Gemini (Recomendado)

1. **Ve a Google AI Studio:**
   - https://ai.google.dev/
   - O directamente: https://aistudio.google.com/

2. **Verifica tu cuenta:**
   - Click en tu perfil (arriba derecha)
   - Ve a "Billing" o "Usage"
   - Revisa tu plan actual y límites

3. **Actualiza tu plan:**
   - Si estás en el plan gratuito, considera actualizar a un plan de pago
   - O espera a que se reinicie tu cuota (si es mensual)

### Opción 2: Usar Chat AI en Lugar de Voz (Temporal)

Mientras resuelves el tema de la cuota, puedes usar el **Chat AI** (pestaña "Chat AI") que:
- ✅ Funciona con la misma API pero consume menos recursos
- ✅ No requiere WebSocket
- ✅ Puede tener límites diferentes de cuota

### Opción 3: Verificar Límites de Cuota

Los límites de Gemini API dependen de:
- **Plan gratuito:** ~15 RPM (requests per minute), límite diario
- **Plan de pago:** Límites más altos según el plan

**Verifica tus límites:**
```bash
# En Google Cloud Console
https://console.cloud.google.com/apis/api/generativelanguage.googleapis.com/quotas
```

### Opción 4: Usar Modelo Diferente (Si está disponible)

Algunos modelos pueden tener cuotas diferentes. Prueba cambiar a:

```typescript
// En backend/src/services/geminiLiveSession.ts
const model = 'gemini-2.5-flash-live'; // O gemini-1.5-flash-live
```

## 🔧 Cambios Realizados en el Código

He actualizado el código para:
1. ✅ Detectar específicamente el error de cuota (código 1011)
2. ✅ Mostrar mensajes de error más claros
3. ✅ Guiar al usuario a verificar su billing

## 📊 Verificar Estado de Cuota

### Método 1: Google AI Studio
1. Ve a https://aistudio.google.com/
2. Intenta hacer una petición
3. Verás el error de cuota si está excedida

### Método 2: Script de Prueba
```bash
cd backend
node dist/scripts/testGeminiLive.js
```

Si ves `code: 1011` y mensaje sobre quota → Cuota excedida

## 💡 Recomendaciones

### Para Desarrollo/Testing:
- Usa el **Chat AI** (texto) en lugar de voz mientras resuelves la cuota
- El Chat AI consume menos recursos y puede tener límites diferentes

### Para Producción:
- Considera un plan de pago de Gemini API
- O implementa rate limiting en tu aplicación
- O usa un modelo alternativo si está disponible

## 🎯 Próximos Pasos

1. **Inmediato:** Usa Chat AI mientras resuelves la cuota
2. **Corto plazo:** Verifica/actualiza tu plan en Google AI Studio
3. **Largo plazo:** Considera implementar:
   - Rate limiting en el backend
   - Fallback a Chat AI cuando la cuota esté cerca
   - Monitoreo de uso de API

## 📝 Nota Importante

El código está funcionando correctamente. El problema es **exclusivamente de cuota/billing** de la API de Gemini. Una vez que resuelvas esto, el agente de voz debería funcionar perfectamente.

---

**¿Necesitas ayuda con alguna de estas opciones?** Puedo ayudarte a:
- Configurar el Chat AI como alternativa temporal
- Implementar mejor manejo de errores de cuota
- Configurar rate limiting

