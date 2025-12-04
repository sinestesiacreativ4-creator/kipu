# ⚡ Quick Start - Desplegar en Render

## 🚀 Pasos Rápidos

### 1. Push a GitHub

```bash
git add .
git commit -m "Add payments and microservices to Render"
git push origin main
```

### 2. Configurar Variables en Render

Ve a **Render Dashboard** → `kipu-backend` → **Environment** y agrega:

```
MERCADOPAGO_ACCESS_TOKEN = TEST-... (o APP_USR-... para producción)
BACKEND_URL = https://kipu-backend-XXXX.onrender.com
```

### 3. Crear Webhook en Mercado Pago

1. Ve a https://www.mercadopago.com.co/developers
2. Selecciona tu aplicación → **Webhooks**
3. URL: `https://kipu-backend-XXXX.onrender.com/api/payments/webhook`
4. Events: `payment.created`, `payment.updated`

### 4. Render Auto-Deploy

Render detectará los cambios automáticamente y desplegará.

## ✅ Verificar

1. Logs deberían mostrar: `✅ Payment routes configured`
2. Probar: `curl https://kipu-backend-XXXX.onrender.com/health`
3. Probar checkout: Ver `RENDER_DEPLOY_PAYMENTS.md`

## 📚 Documentación Completa

- **Setup detallado:** `RENDER_DEPLOY_PAYMENTS.md`
- **Arquitectura:** `MICROSERVICES_ARCHITECTURE.md`
- **Pagos:** `SETUP_MERCADOPAGO.md`

