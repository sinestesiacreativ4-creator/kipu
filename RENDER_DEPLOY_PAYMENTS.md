# 🚀 Desplegar a Render con Pagos (Mercado Pago) y Microservicios

## 📋 Configuración en Render

### 1. Actualizar render.yaml

El `render.yaml` ya está actualizado con las nuevas variables de entorno. Solo necesitas:

1. **Hacer commit y push:**
   ```bash
   git add render.yaml backend/prisma/schema.prisma
   git commit -m "Add payments and microservices architecture"
   git push origin main
   ```

2. **Render detectará automáticamente los cambios** y desplegará

### 2. Variables de Entorno en Render Dashboard

Ve a **Render Dashboard** → Tu servicio `kipu-backend` → **Environment** y agrega:

#### Variables Obligatorias:

| Variable | Valor | Dónde Obtener |
|----------|-------|---------------|
| `MERCADOPAGO_ACCESS_TOKEN` | `TEST-...` o `APP_USR-...` | [Mercado Pago Developers](https://www.mercadopago.com.co/developers) |
| `BACKEND_URL` | `https://kipu-backend-XXXX.onrender.com` | URL de tu servicio en Render |

#### Variables Existentes (verificar):

| Variable | Valor | Notas |
|----------|-------|-------|
| `GEMINI_API_KEY` | `tu_api_key` | Ya debería estar |
| `DATABASE_URL` | (auto) | Conectado automáticamente |
| `REDIS_URL` | `redis://...` | Si usas Redis externo |
| `FRONTEND_URL` | `https://tu-frontend.vercel.app` | Opcional |

### 3. Configurar Webhook de Mercado Pago

**⚠️ CRÍTICO:** El webhook debe apuntar a tu URL de Render.

1. Ve a [Mercado Pago Developers](https://www.mercadopago.com.co/developers)
2. Selecciona tu aplicación
3. Ve a **Webhooks**
4. Click **"Agregar URL"**
5. **URL:** `https://kipu-backend-XXXX.onrender.com/api/payments/webhook`
   - Reemplaza `XXXX` con tu ID de servicio
6. **Eventos a recibir:**
   - ✅ `payment.created`
   - ✅ `payment.updated`
7. Guarda la configuración

### 4. Migrar Base de Datos

Render ejecutará automáticamente las migraciones con:

```bash
npx prisma db push --accept-data-loss
```

Pero si quieres hacerlo manualmente:

1. Ve a Render Dashboard → Tu servicio → **Shell**
2. Ejecuta:
   ```bash
   cd backend
   npx prisma migrate dev --name add_payments_and_subscriptions
   npx prisma generate
   ```

### 5. Verificar el Despliegue

Una vez desplegado, verifica los logs. Deberías ver:

```
✅ WebSocket server configured for /voice and /api/voice/ws
🚀 Server running on port 10000
✅ Payment routes configured at /api/payments
✅ Organization routes configured
```

## 🔧 Configuración Paso a Paso

### Paso 1: Obtener Credenciales de Mercado Pago

1. **Mercado Pago Access Token:**
   - Ve a https://www.mercadopago.com.co/developers
   - Crea una aplicación o selecciona una existente
   - Copia el **Access Token**:
     - `TEST-...` para desarrollo (no cobra real)
     - `APP_USR-...` para producción (cobros reales)

### Paso 2: Agregar Variables en Render

1. Ve a https://dashboard.render.com/
2. Click en tu servicio `kipu-backend`
3. Ve a **Environment**
4. Click **"Add Environment Variable"**
5. Agrega cada variable:
   - `MERCADOPAGO_ACCESS_TOKEN` = `TEST-...` (o `APP_USR-...` para producción)
   - `BACKEND_URL` = `https://kipu-backend-XXXX.onrender.com`

### Paso 3: Obtener URL del Backend

1. En Render Dashboard → Tu servicio
2. Copia la URL (ej: `https://kipu-backend-8006.onrender.com`)
3. Úsala para:
   - `BACKEND_URL` en Render
   - Webhook URL en Stripe

### Paso 4: Probar el Webhook

1. En Mercado Pago → **Desarrolladores** → Tu app → **Webhooks**
2. Puedes probar haciendo un pago de prueba
3. Revisa los logs de Render para verificar que se recibió

## 🧪 Testing en Render

### Probar Checkout

```bash
curl -X POST https://kipu-backend-XXXX.onrender.com/api/payments/checkout \
  -H "Content-Type: application/json" \
  -d '{
    "organizationId": "test-org-id",
    "plan": "STARTER",
    "successUrl": "https://tu-frontend.com/success",
    "cancelUrl": "https://tu-frontend.com/cancel"
  }'
```

### Probar Validación de Código

```bash
curl -X POST https://kipu-backend-XXXX.onrender.com/api/organizations/validate-code \
  -H "Content-Type: application/json" \
  -d '{
    "code": "ABC123XYZ9"
  }'
```

## ⚠️ Troubleshooting

### Error: "MERCADOPAGO_ACCESS_TOKEN is not configured"

**Solución:**
1. Ve a Render Dashboard → Tu servicio → Environment
2. Verifica que `MERCADOPAGO_ACCESS_TOKEN` esté configurada
3. Haz **"Manual Deploy"** para aplicar cambios

### Error: "Failed to create checkout"

**Solución:**
1. Verifica que el Access Token sea válido
2. Asegúrate de usar `TEST-...` para desarrollo
3. Revisa los logs para ver el error específico

### Error: "Organization code not generated"

**Solución:**
1. Revisa los logs del webhook en Render
2. Verifica que el evento `checkout.session.completed` se esté recibiendo
3. Revisa que `PaymentService.handlePaymentSuccess` se ejecute correctamente

### Error: "Database migration failed"

**Solución:**
1. Ve a Render Dashboard → Tu servicio → **Shell**
2. Ejecuta manualmente:
   ```bash
   cd backend
   npx prisma db push --accept-data-loss
   npx prisma generate
   ```

### El servicio no inicia después de agregar variables

**Solución:**
1. Haz **"Manual Deploy"** después de agregar variables
2. Revisa los logs para ver errores específicos
3. Verifica que todas las variables estén escritas correctamente (sin espacios)

## 📝 Checklist de Despliegue

Antes de considerar el despliegue completo:

- [ ] Código pusheado a GitHub con `render.yaml` actualizado
- [ ] `MERCADOPAGO_ACCESS_TOKEN` configurada en Render
- [ ] `BACKEND_URL` configurada en Render
- [ ] Webhook creado en Mercado Pago apuntando a Render
- [ ] Base de datos migrada (automático o manual)
- [ ] Build exitoso (ver logs)
- [ ] Servicio en estado "Live"
- [ ] Webhook de prueba enviado y recibido correctamente
- [ ] Endpoint `/api/payments/checkout` funciona
- [ ] Endpoint `/api/organizations/validate-code` funciona

## 🔐 Seguridad

### Variables Sensibles

- ✅ **NUNCA** commitees `MERCADOPAGO_ACCESS_TOKEN` al repositorio
- ✅ Usa `sync: false` en `render.yaml` para variables sensibles
- ✅ Usa `TEST-...` para desarrollo y `APP_USR-...` para producción

### Webhook Security

- ✅ Mercado Pago envía `x-signature` header para verificación
- ✅ Puedes verificar la firma si lo necesitas
- ✅ Siempre retorna 200 para evitar reintentos de Mercado Pago

## 🚀 Próximos Pasos

1. **Configurar Planes:**
   - Los precios están en COP (pesos colombianos)
   - Actualiza `PaymentService.getPlanDetails()` si cambias precios

2. **Frontend Integration:**
   - Integrar checkout en el frontend
   - Mostrar código después del pago
   - Formulario de creación de organización

3. **Monitoring:**
   - Configurar alertas en Stripe para pagos fallidos
   - Monitorear logs de webhooks en Render
   - Trackear métricas de conversión

---

**Última actualización:** 2025-01-XX  
**Versión:** Con soporte completo para Pagos (Stripe) y Microservicios

