# 💳 Setup de Mercado Pago (Colombia)

## 🚀 Configuración Inicial

### 1. Crear Cuenta en Mercado Pago

1. Ve a https://www.mercadopago.com.co/
2. Crea una cuenta o inicia sesión
3. Ve a **Desarrolladores** → **Tus integraciones**

### 2. Obtener Credenciales

1. En **Desarrolladores** → **Tus integraciones**
2. Crea una nueva aplicación o selecciona una existente
3. Copia el **Access Token** (Test o Production)

**Test (Desarrollo):**
- Access Token: `TEST-...`
- Usa para pruebas sin cobrar real

**Production (Producción):**
- Access Token: `APP_USR-...`
- Usa para cobros reales

### 3. Variables de Entorno

Agrega a tu `.env`:

```bash
# Mercado Pago
MERCADOPAGO_ACCESS_TOKEN=TEST-... # o APP_USR-... para producción
BACKEND_URL=https://kipu-backend-XXXX.onrender.com
```

### 4. Configurar Webhook

1. En Mercado Pago → **Desarrolladores** → **Tus integraciones** → Tu app
2. Ve a **Webhooks**
3. Agrega URL: `https://kipu-backend-XXXX.onrender.com/api/payments/webhook`
4. Eventos a recibir:
   - ✅ `payment.created`
   - ✅ `payment.updated`

## 💰 Planes y Precios (COP)

| Plan | Precio | Usuarios | Grabaciones | Almacenamiento |
|------|--------|----------|-------------|----------------|
| STARTER | $99,000 COP | 5 | 100 | 10 GB |
| PROFESSIONAL | $299,000 COP | 20 | 500 | 50 GB |
| ENTERPRISE | $799,000 COP | 100 | 2000 | 200 GB |

*Precios aproximados en pesos colombianos*

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
window.location.href = url; // Redirigir a Mercado Pago
```

### Paso 2: Cliente Paga en Mercado Pago

Mercado Pago maneja el checkout con múltiples métodos:
- 💳 Tarjetas de crédito/débito
- 🏦 PSE (Pagos Seguros en Línea)
- 💵 Efecty
- 📱 Nequi
- Y más...

### Paso 3: Webhook Procesa el Pago

El webhook de Mercado Pago:
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

1. Usa `TEST-...` como `MERCADOPAGO_ACCESS_TOKEN`
2. Usa tarjetas de prueba:
   - **Aprobada:** `5031 7557 3453 0604`
   - **Rechazada:** `5031 4332 1540 6351`
   - CVV: `123`
   - Fecha: Cualquier fecha futura

### Probar Webhook Localmente

Usa [ngrok](https://ngrok.com/) para exponer tu servidor local:

```bash
ngrok http 10000
# Copia la URL (ej: https://abc123.ngrok.io)
# Úsala como webhook URL en Mercado Pago
```

## 📝 Endpoints

### Crear Checkout
```
POST /api/payments/checkout
Body: { organizationId, plan, successUrl, cancelUrl }
Response: { success: true, sessionId, url }
```

### Webhook (Mercado Pago)
```
POST /api/payments/webhook
Headers: x-signature, x-request-id
Body: { type, action, data }
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

### Error: "MERCADOPAGO_ACCESS_TOKEN is not configured"

**Solución:**
1. Verifica que `MERCADOPAGO_ACCESS_TOKEN` esté en `.env`
2. Reinicia el servidor

### Error: "Failed to create checkout"

**Solución:**
1. Verifica que el Access Token sea válido
2. Revisa los logs para ver el error específico
3. Asegúrate de usar `TEST-...` para desarrollo

### Webhook no se recibe

**Solución:**
1. Verifica que la URL del webhook sea correcta
2. Asegúrate de que el servidor esté accesible públicamente
3. Revisa los logs del servidor
4. Verifica que los eventos estén configurados en Mercado Pago

### Código no se genera

**Solución:**
1. Revisa los logs del webhook
2. Verifica que el pago esté en estado "approved"
3. Confirma que `PaymentService.handlePaymentSuccess` se ejecute

## 🔐 Seguridad

### Variables Sensibles

- ✅ **NUNCA** commitees `MERCADOPAGO_ACCESS_TOKEN` al repositorio
- ✅ Usa `TEST-...` para desarrollo
- ✅ Usa `APP_USR-...` solo en producción

### Webhook Security

- ✅ Mercado Pago envía `x-signature` header para verificación
- ✅ Puedes verificar la firma si lo necesitas
- ✅ Siempre retorna 200 para evitar reintentos

## 📚 Recursos

- [Documentación Mercado Pago](https://www.mercadopago.com.co/developers/es/docs)
- [SDK Node.js](https://github.com/mercadopago/sdk-nodejs)
- [Webhooks](https://www.mercadopago.com.co/developers/es/docs/your-integrations/notifications/webhooks)

---

**Última actualización:** 2025-01-XX  
**Versión:** Integración con Mercado Pago para Colombia

