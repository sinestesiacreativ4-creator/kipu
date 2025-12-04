# Arquitectura de Microservicios - Kipu SaaS B2B

## 🏗️ Visión General

Esta aplicación ha sido escalada a una arquitectura de microservicios B2B SaaS, lista para producción con:
- ✅ Sistema de pagos (Stripe)
- ✅ Códigos de organización al pagar
- ✅ Multi-tenancy completo
- ✅ Límites por plan
- ✅ Autenticación por organización
- ✅ Estructura de microservicios

## 📦 Microservicios

### 1. **Auth Service** (Puerto 10001)
**Responsabilidades:**
- Autenticación de usuarios (login, signup)
- Autenticación de organizaciones
- Gestión de usuarios
- Control de acceso basado en roles

**Endpoints:**
- `POST /api/auth/login`
- `POST /api/auth/signup`
- `GET /api/auth/me`
- `POST /api/organizations/validate-code`
- `POST /api/organizations/create-from-code`

### 2. **Payments Service** (Puerto 10002)
**Responsabilidades:**
- Integración con Stripe
- Gestión de suscripciones
- Procesamiento de pagos
- Generación de códigos de organización
- Webhooks de facturación

**Endpoints:**
- `POST /api/payments/checkout` - Crear sesión de checkout
- `POST /api/payments/webhook` - Webhook de Stripe
- `POST /api/payments/validate-code` - Validar código de organización
- `GET /api/payments/subscription/:organizationId` - Obtener suscripción

### 3. **Recordings Service** (Puerto 10003)
**Responsabilidades:**
- Operaciones CRUD de grabaciones
- Análisis de grabaciones
- Gestión de estado de grabaciones
- Consultas y filtros

**Endpoints:**
- `GET /api/recordings` - Listar grabaciones
- `GET /api/recordings/:id` - Obtener grabación
- `GET /api/recordings/:id/analysis` - Obtener análisis
- `GET /api/status/:recordingId` - Estado de procesamiento

### 4. **Voice Service** (Puerto 10004)
**Responsabilidades:**
- Conexiones WebSocket del agente de voz
- Integración con Gemini Live API
- Streaming de audio en tiempo real
- Gestión de sesiones de voz

**Endpoints:**
- `POST /api/voice/init/:sessionId` - Inicializar sesión
- `WebSocket /api/voice/ws/:sessionId` - Conexión WebSocket

### 5. **Storage Service** (Puerto 10005)
**Responsabilidades:**
- Subida de archivos (chunks)
- Almacenamiento (Redis, S3, Gemini)
- Recuperación de archivos
- Gestión de cuotas de almacenamiento

**Endpoints:**
- `POST /api/chunks/:recordingId` - Subir chunk
- `POST /api/finalize/:recordingId` - Finalizar grabación
- `POST /api/upload` - Subida directa

### 6. **Audio Processing Service** (Puerto 10006)
**Responsabilidades:**
- Chunking de audio
- Análisis de audio (Gemini)
- Procesamiento de trabajos en background
- Gestión de colas

**Tipo:** Worker (no expone HTTP endpoints)

## 🔐 Autenticación Multi-Tenant

### Código de Organización

Cada organización recibe un **código único** al realizar el pago. Este código se usa para:
1. Autenticar todas las peticiones
2. Aislar datos entre organizaciones
3. Validar límites del plan

### Headers Requeridos

```
x-organization-code: ABC123XYZ
x-user-id: user-uuid (opcional, para operaciones específicas de usuario)
```

### Middleware de Autenticación

```typescript
import { authenticateOrganization } from './middleware/authMiddleware';

// Proteger ruta con autenticación de organización
router.get('/recordings', authenticateOrganization, getRecordings);

// Proteger ruta con autenticación de usuario
router.post('/recordings', authenticateOrganization, authenticateUser, createRecording);

// Verificar límites
router.post('/users', authenticateOrganization, checkOrganizationLimits('users'), createUser);
```

## 💳 Sistema de Pagos

### Flujo de Pago

1. **Cliente crea checkout:**
   ```bash
   POST /api/payments/checkout
   {
     "organizationId": "org-uuid",
     "plan": "PROFESSIONAL",
     "successUrl": "https://app.com/success",
     "cancelUrl": "https://app.com/cancel"
   }
   ```

2. **Cliente paga en Stripe Checkout**

3. **Webhook de Stripe:**
   - Crea registro de pago
   - Genera código de organización único
   - Activa suscripción
   - Actualiza límites de organización

4. **Cliente recibe código:**
   - Código único de 10 caracteres (ej: `ABC123XYZ9`)
   - Se guarda en `OrganizationCode` table
   - Se vincula a `Payment` y `Organization`

### Planes Disponibles

| Plan | Precio | Usuarios | Grabaciones | Almacenamiento |
|------|--------|----------|-------------|----------------|
| FREE | $0 | 1 | 10 | 1 GB |
| STARTER | $29/mes | 5 | 100 | 10 GB |
| PROFESSIONAL | $99/mes | 20 | 500 | 50 GB |
| ENTERPRISE | $299/mes | 100 | 2000 | 200 GB |

## 🗄️ Base de Datos

### Nuevas Tablas

#### `Subscription`
- Gestiona suscripciones de Stripe
- Vincula organización con suscripción
- Almacena estado y períodos

#### `Payment`
- Registra todos los pagos
- Vincula con código de organización
- Almacena detalles de Stripe

#### `OrganizationCode`
- Códigos únicos de organización
- Generados al pagar
- Validación y expiración

### Cambios en `Organization`
- `code`: Código único de organización
- `status`: TRIAL, ACTIVE, SUSPENDED, CANCELLED
- `plan`: FREE, STARTER, PROFESSIONAL, ENTERPRISE
- `maxUsers`, `maxRecordings`, `maxStorageGB`: Límites del plan
- `currentStorageGB`: Uso actual

## 🚀 Despliegue

### Variables de Entorno

```bash
# Mercado Pago (Colombia)
MERCADOPAGO_ACCESS_TOKEN=APP_USR-... # o TEST-... para desarrollo

# Database
DATABASE_URL=postgresql://...

# Microservices URLs (opcional, para gateway)
AUTH_SERVICE_URL=http://localhost:10001
PAYMENTS_SERVICE_URL=http://localhost:10002
RECORDINGS_SERVICE_URL=http://localhost:10003
VOICE_SERVICE_URL=http://localhost:10004
STORAGE_SERVICE_URL=http://localhost:10005
```

### Migración de Base de Datos

```bash
cd backend
npx prisma migrate dev --name add_payments_and_subscriptions
npx prisma generate
```

### Iniciar Servicios

**Monolítico (actual):**
```bash
npm run start
```

**Microservicios (futuro):**
```bash
# Auth Service
PORT=10001 npm run start:auth

# Payments Service
PORT=10002 npm run start:payments

# Recordings Service
PORT=10003 npm run start:recordings

# Voice Service
PORT=10004 npm run start:voice

# Storage Service
PORT=10005 npm run start:storage
```

## 📝 Uso del API

### 1. Crear Checkout de Pago

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
window.location.href = url; // Redirigir a Stripe Checkout
```

### 2. Validar Código de Organización

```typescript
const response = await fetch('/api/payments/validate-code', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ code: 'ABC123XYZ9' })
});

const { organization } = await response.json();
```

### 3. Usar Código en Peticiones

```typescript
const response = await fetch('/api/recordings', {
  headers: {
    'x-organization-code': 'ABC123XYZ9',
    'x-user-id': 'user-uuid'
  }
});
```

## 🔄 Próximos Pasos

1. **Separar en microservicios reales:**
   - Cada servicio en su propio repositorio
   - Despliegue independiente
   - Comunicación vía HTTP/gRPC

2. **API Gateway:**
   - Kong, AWS API Gateway, o NGINX
   - Rate limiting
   - Load balancing

3. **Service Discovery:**
   - Consul, Eureka, o Kubernetes DNS

4. **Message Queue:**
   - RabbitMQ, Kafka, o AWS SQS
   - Para comunicación asíncrona

5. **Monitoring:**
   - Prometheus + Grafana
   - Distributed tracing (Jaeger)

6. **CI/CD:**
   - Pipeline por microservicio
   - Tests automatizados
   - Despliegue automático

## 📚 Referencias

- [Mercado Pago API Docs](https://www.mercadopago.com.co/developers/es/docs)
- [Prisma Multi-Tenancy](https://www.prisma.io/docs/guides/performance-and-optimization/connection-management#multi-tenancy)
- [Microservices Patterns](https://microservices.io/patterns/)

