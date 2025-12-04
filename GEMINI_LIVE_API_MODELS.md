# 🎙️ Modelos de Gemini para Live API

## ⚠️ Problema Actual

El error indica que el modelo no está disponible:
```
models/gemini-2.5-flash-live is not found for API version v1alpha, 
or is not supported for bidiGenerateContent
```

## 📋 Modelos que Soportan Live API

Gemini Live API (`bidiGenerateContent` con `AUDIO`) requiere modelos específicos. No todos los modelos de Gemini soportan esta funcionalidad.

### Modelos Probados

1. **`gemini-1.5-flash-live`** ✅ (Actual)
   - Específicamente diseñado para Live API
   - Puede estar retirado según algunas fuentes

2. **`gemini-2.5-flash-live`** ❌ (No disponible)
   - Error: "not found for API version v1alpha"

3. **`gemini-2.0-flash`** ❓ (No probado)
   - Puede no soportar Live API (solo texto)

## 🔍 Cómo Verificar Modelos Disponibles

### Opción 1: Google AI Studio
1. Ve a https://aistudio.google.com/
2. Ve a "API keys" o "Models"
3. Busca modelos con "live" en el nombre

### Opción 2: API Directa
```bash
curl "https://generativelanguage.googleapis.com/v1beta/models?key=TU_API_KEY" | grep "live"
```

### Opción 3: Script de Prueba
```bash
cd backend
npm run build
node dist/scripts/testGeminiLive.js
```

## 🔧 Soluciones

### Solución 1: Verificar Modelos Disponibles

Ejecuta este script para listar modelos disponibles:

```bash
cd backend
node dist/scripts/listModels.js
```

Busca modelos que contengan "live" en el nombre.

### Solución 2: Usar Chat AI en Lugar de Voz

Si Live API no está disponible, puedes usar el **Chat AI** (texto) que:
- ✅ Funciona con todos los modelos de Gemini
- ✅ No requiere Live API
- ✅ Proporciona la misma información

### Solución 3: Solicitar Acceso a Live API

Gemini Live API puede requerir:
- Acceso especial a la API
- Plan de pago específico
- Solicitud de acceso en Google AI Studio

## 📝 Estado Actual

- **Modelo configurado:** `gemini-1.5-flash-live`
- **Estado:** Esperando verificación después del despliegue
- **Alternativa:** Chat AI (texto) funciona perfectamente

## 🚀 Próximos Pasos

1. **Despliega los cambios:**
   ```bash
   git add .
   git commit -m "Change to gemini-1.5-flash-live for Live API"
   git push origin main
   ```

2. **Espera el despliegue** (5-7 minutos)

3. **Prueba el agente de voz** y revisa los logs

4. **Si sigue fallando:**
   - Verifica modelos disponibles con el script
   - Considera usar Chat AI como alternativa
   - Solicita acceso a Live API si es necesario

---

**Nota:** Gemini Live API es una funcionalidad en preview y puede no estar disponible para todas las cuentas. El Chat AI (texto) es una alternativa funcional que proporciona la misma información.

