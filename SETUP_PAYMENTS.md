# 🚀 Setup de Pagos y Códigos de Organización

> ⚠️ **NOTA:** Este documento ha sido actualizado para usar **Mercado Pago** (Colombia) en lugar de Stripe.
> Ver `SETUP_MERCADOPAGO.md` para la guía completa actualizada.

## Configuración Inicial

### 1. Variables de Entorno

Agrega estas variables a tu `.env`:

```bash
# Mercado Pago (Colombia)
MERCADOPAGO_ACCESS_TOKEN=TEST-... # o APP_USR-... para producción
BACKEND_URL=https://kipu-backend-XXXX.onrender.com

# Database (ya debería estar)
DATABASE_URL=postgresql://...
```

### 2. Obtener Credenciales de Mercado Pago

1. Ve a [Mercado Pago Developers](https://www.mercadopago.com.co/developers)
2. Crea una aplicación o selecciona una existente
3. Copia el **Access Token**:
   - `TEST-...` para desarrollo (no cobra real)
   - `APP_USR-...` para producción (cobros reales)
4. **Webhooks** → Agrega URL:
   - URL: `https://tu-backend.com/api/payments/webhook`
   - Eventos: `payment.created`, `payment.updated`

### 3. Migrar Base de Datos

```bash
cd backend
npx prisma migrate dev --name add_payments_and_subscriptions
npx prisma generate
```

## Flujo de Pago

### Paso 1: Cliente Inicia Checkout

```typescript
// Frontend
const response = await fetch('/api/payments/checkout', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    organizationId: 'org-uuid', // ID de organización existente o nuevo
    plan: 'PROFESSIONAL', // STARTER, PROFESSIONAL, ENTERPRISE
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
2. ✅ Genera código único de organización (ej: `ABC123XYZ9`)
3. ✅ Crea/actualiza `Subscription`
4. ✅ Actualiza `Organization` con código y límites

### Paso 4: Cliente Recibe Código

El código se genera automáticamente y se puede obtener:

```typescript
// Obtener código desde payment
const payment = await fetch(`/api/payments/subscription/${organizationId}`);
const { organization } = await payment.json();
console.log(organization.code); // "ABC123XYZ9"
```

## Crear Organización desde Código

Cuando un usuario tiene un código (después de pagar), puede crear su organización:

```typescript
const response = await fetch('/api/organizations/create-from-code', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: 'Mi Empresa',
    code: 'ABC123XYZ9',
    ownerEmail: 'admin@empresa.com',
    ownerName: 'Juan Pérez'
  })
});

const { organization, owner } = await response.json();
```

## Validar Código

```typescript
const response = await fetch('/api/organizations/validate-code', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    code: 'ABC123XYZ9'
  })
});

if (response.ok) {
  const { organization } = await response.json();
  console.log('Código válido:', organization);
} else {
  console.log('Código inválido o expirado');
}
```

## Usar Código en Peticiones

Todas las peticiones requieren el código de organización:

```typescript
// Ejemplo: Obtener grabaciones
const recordings = await fetch('/api/recordings', {
  headers: {
    'x-organization-code': 'ABC123XYZ9',
    'x-user-id': 'user-uuid' // Opcional
  }
});
```

## Planes Disponibles

| Plan | Precio | Usuarios | Grabaciones | Almacenamiento |
|------|--------|----------|-------------|----------------|
| FREE | $0 | 1 | 10 | 1 GB |
| STARTER | $99,000 COP | 5 | 100 | 10 GB |
| PROFESSIONAL | $299,000 COP | 20 | 500 | 50 GB |
| ENTERPRISE | $799,000 COP | 100 | 2000 | 200 GB |

*Precios en pesos colombianos (COP)*

## Testing

### Modo Test de Mercado Pago

1. Usa `TEST-...` en desarrollo
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

## Troubleshooting

### Error: "MERCADOPAGO_ACCESS_TOKEN is not configured"
- Verifica que `MERCADOPAGO_ACCESS_TOKEN` esté en `.env`
- Reinicia el servidor después de agregar variables

### Error: "Failed to create checkout"
- Verifica que el Access Token sea válido
- Asegúrate de usar `TEST-...` para desarrollo
- Revisa los logs para ver el error específico

### Código no se genera
- Verifica logs del webhook
- Confirma que el evento `payment.created` o `payment.updated` se está recibiendo
- Revisa que `PaymentService.handlePaymentSuccess` se ejecute correctamente
- Verifica que el pago esté en estado "approved"

### Organización no se crea desde código
- Verifica que el código no haya sido usado antes
- Confirma que `isActive` sea `true`
- Revisa que no haya expirado (`expiresAt`)

## Próximos Pasos

1. **Frontend Integration:**
   - Página de checkout
   - Página de éxito con código
   - Formulario de creación de organización

2. **Email Notifications:**
   - Enviar código por email después del pago
   - Recordatorios de suscripción

3. **Dashboard de Billing:**
   - Ver suscripción actual
   - Cambiar plan
   - Cancelar suscripción
   - Historial de pagos

---

**Ver también:** `SETUP_MERCADOPAGO.md` para documentación completa de Mercado Pago.
