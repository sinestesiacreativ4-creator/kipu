# 💳 Setup de PayU (Colombia)

## 🚀 Configuración Inicial

### 1. Crear Cuenta en PayU

1. Ve a https://www.payu.com.co/
2. Crea una cuenta comercial
3. Completa el proceso de verificación
4. Accede al panel de administración

### 2. Obtener Credenciales

En el panel de PayU → **Configuración** → **API**:

1. **API Key** - Clave pública de la API
2. **API Login** - Login de la API
3. **Merchant ID** - ID del comercio
4. **Account ID** - ID de la cuenta (para Colombia generalmente es el mismo que Merchant ID)

**Modo Test:**
- Usa credenciales de sandbox para pruebas
- No se realizan cobros reales

**Modo Producción:**
- Usa credenciales de producción
- Se realizan cobros reales

### 3. Variables de Entorno

Agrega a tu `.env`:

```bash
# PayU Colombia
PAYU_API_KEY=tu_api_key
PAYU_API_LOGIN=tu_api_login
PAYU_MERCHANT_ID=tu_merchant_id
PAYU_ACCOUNT_ID=tu_account_id
PAYU_TEST_MODE=true # false para producción
BACKEND_URL=https://kipu-backend-XXXX.onrender.com
```

### 4. Configurar Webhook

1. En PayU → **Configuración** → **Notificaciones**
2. Agrega URL: `https://kipu-backend-XXXX.onrender.com/api/payments/webhook`
3. Eventos a recibir:
   - ✅ Confirmación de pago
   - ✅ Cambio de estado

## 💰 Planes y Precios (COP)

| Plan | Precio | Usuarios | Grabaciones | Almacenamiento |
|------|--------|----------|-------------|----------------|
| STARTER | $99,000 COP | 5 | 100 | 10 GB |
| PROFESSIONAL | $299,000 COP | 20 | 500 | 50 GB |
| ENTERPRISE | $799,000 COP | 100 | 2000 | 200 GB |

## 🔄 Flujo de Pago

### Paso 1: Cliente Inicia Checkout

```typescript
const response = await fetch('/api/payments/checkout', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    organizationId: 'org-uuid',
    plan: 'PROFESSIONAL',
    successUrl: 'https://app.com/success',
    cancelUrl: 'https://app.com/cancel'
  })
});

const { url } = await response.json();
window.location.href = url; // Redirigir a PayU
```

### Paso 2: Cliente Paga en PayU

PayU maneja el checkout con múltiples métodos:
- 💳 Tarjetas de crédito/débito
- 🏦 PSE (Pagos Seguros en Línea)
- 💵 Efecty
- 🎫 Baloto
- 📱 Nequi
- 📱 Daviplata
- Y más...

### Paso 3: Webhook Procesa el Pago

El webhook de PayU:
1. ✅ Crea registro de `Payment`
2. ✅ Genera código único de organización
3. ✅ Crea/actualiza `Subscription`
4. ✅ Actualiza `Organization` con código y límites

### Paso 4: Cliente Recibe Código

El código se genera automáticamente y se puede obtener:

```typescript
const payment = await fetch(`/api/payments/subscription/${organizationId}`);
const { organization } = await payment.json();
console.log(organization.code); // "ABC123XYZ9"
```

## 🧪 Testing

### Modo Test

1. Usa `PAYU_TEST_MODE=true` en desarrollo
2. Usa credenciales de sandbox
3. Tarjetas de prueba:
   - **Aprobada:** `4097440000000003`
   - **Rechazada:** `4097440000000004`
   - CVV: `321`
   - Fecha: Cualquier fecha futura

### Probar Webhook Localmente

Usa [ngrok](https://ngrok.com/):

```bash
ngrok http 10000
# Copia la URL (ej: https://abc123.ngrok.io)
# Úsala como webhook URL en PayU
```

## 📝 Endpoints

### Crear Checkout
```
POST /api/payments/checkout
Body: { organizationId, plan, successUrl, cancelUrl }
Response: { success: true, sessionId, url }
```

### Webhook (PayU)
```
POST /api/payments/webhook
Body: { reference_sale, transaction_id, state_pol, value, ... }
```

### Validar Código
```
POST /api/payments/validate-code
Body: { code }
Response: { success: true, organization }
```

### Obtener Suscripción
```
GET /api/payments/subscription/:organizationId
Response: { success: true, organization }
```

## ⚠️ Troubleshooting

### Error: "PayU credentials not configured"

**Solución:**
1. Verifica que todas las credenciales estén en `.env`
2. Reinicia el servidor

### Error: "Failed to create checkout"

**Solución:**
1. Verifica que las credenciales sean válidas
2. Asegúrate de usar credenciales de test en desarrollo
3. Revisa los logs para ver el error específico

### Webhook no se recibe

**Solución:**
1. Verifica que la URL del webhook sea correcta
2. Asegúrate de que el servidor esté accesible públicamente
3. Revisa los logs del servidor
4. Verifica que los eventos estén configurados en PayU

### Código no se genera

**Solución:**
1. Revisa los logs del webhook
2. Verifica que el pago esté en estado "4" o "APPROVED"
3. Confirma que `PaymentService.handlePaymentSuccess` se ejecute

## 🔐 Seguridad

### Variables Sensibles

- ✅ **NUNCA** commitees las credenciales de PayU
- ✅ Usa `PAYU_TEST_MODE=true` para desarrollo
- ✅ Usa credenciales de producción solo en producción

### Webhook Security

- ✅ PayU envía firmas para verificación
- ✅ Puedes verificar la firma si lo necesitas
- ✅ Siempre retorna 200 para evitar reintentos

## 📚 Recursos

- [Documentación PayU](https://developers.payulatam.com/)
- [API Reference](https://developers.payulatam.com/es/docs/api/)
- [Webhooks](https://developers.payulatam.com/es/docs/webhooks.html)

---

**Última actualización:** 2025-01-XX  
**Versión:** Integración con PayU para Colombia

