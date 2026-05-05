# Manual Tecnico - SmartPark

## 1. Introduccion

Este documento describe la arquitectura, componentes, instalacion y operacion tecnica del sistema SmartPark. Esta dirigido a desarrolladores, mantenedores y evaluadores tecnicos del proyecto.

## 2. Arquitectura del sistema

SmartPark sigue una arquitectura por capas orientada a objetos:

```text
Frontend React
    ->
Routes (Flask Blueprints)
    ->
Controllers
    ->
Services
    ->
Repositories
    ->
Supabase PostgreSQL
```

### 2.1 Capa Routes

Define los endpoints HTTP y registra los blueprints de Flask.

### 2.2 Capa Controllers

Recibe la solicitud, valida el contexto web y delega la logica al servicio correspondiente.

### 2.3 Capa Services

Implementa reglas de negocio: autenticacion, sesiones, pagos, reportes, notificaciones y alertas.

### 2.4 Capa Repositories

Centraliza el acceso a datos y abstrae las operaciones CRUD hacia Supabase.

### 2.5 Utilidades

Incluye gestion JWT, validadores, cliente de Supabase, generacion de PDF y decoradores de autenticacion.

## 3. Stack tecnologico

- Frontend: React + Vite
- Backend: Python + Flask
- Base de datos: Supabase PostgreSQL
- Autenticacion: JWT
- Verificacion de cuenta: OTP por Gmail SMTP
- Comunicacion: REST API con JSON

## 4. Estructura de carpetas

```text
SmarkPark/
├── backend/
│   ├── controllers/
│   ├── repositories/
│   ├── routes/
│   ├── services/
│   ├── sql/
│   ├── utils/
│   ├── app/
│   ├── app.py
│   ├── config.py
│   └── requirements.txt
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── assets/
│   │   ├── components/
│   │   ├── contexts/
│   │   ├── hooks/
│   │   ├── lib/
│   │   ├── pages/
│   │   ├── services/
│   │   ├── App.jsx
│   │   └── styles.css
│   ├── package.json
│   └── vite.config.js
└── docs/
```

## 5. Endpoints de la API

### 5.1 Autenticacion

| Metodo | Endpoint | Descripcion |
|---|---|---|
| POST | `/api/auth/login` | Inicia sesion y devuelve JWT |
| POST | `/api/auth/register` | Registra un usuario nuevo |
| GET | `/api/auth/verify` | Valida el token actual |
| POST | `/api/auth/logout` | Cierra sesion |
| GET | `/api/auth/me` | Devuelve el usuario autenticado |
| POST | `/api/auth/verify-otp` | Verifica codigo OTP |
| POST | `/api/auth/resend-otp` | Reenvia OTP al correo |

### 5.2 Espacios de parqueo

| Metodo | Endpoint | Descripcion |
|---|---|---|
| GET | `/api/parking-spaces` | Lista todos los espacios del garage |
| GET | `/api/parking-spaces/stats` | Devuelve estadisticas de ocupacion |
| GET | `/api/parking-spaces/floor/<floor>` | Lista espacios por piso |
| PUT | `/api/parking-spaces/<space_id>` | Actualiza estado de un espacio |

### 5.3 Vehiculos

| Metodo | Endpoint | Descripcion |
|---|---|---|
| GET | `/api/vehicles` | Lista vehiculos del usuario |
| POST | `/api/vehicles` | Registra un vehiculo |
| GET | `/api/vehicles/garage/<garage_id>` | Lista vehiculos del garage |
| GET | `/api/vehicles/search` | Busca vehiculos |
| PUT | `/api/vehicles/<vehicle_id>` | Actualiza un vehiculo |
| DELETE | `/api/vehicles/<vehicle_id>` | Elimina un vehiculo |

### 5.4 Sesiones de parqueo

| Metodo | Endpoint | Descripcion |
|---|---|---|
| POST | `/api/parking-sessions/entry` | Registra entrada de vehiculo |
| POST | `/api/parking-sessions/exit` | Registra salida y calcula monto |
| GET | `/api/parking-sessions/active` | Lista sesiones activas |

### 5.5 Pagos

| Metodo | Endpoint | Descripcion |
|---|---|---|
| POST | `/api/payments` | Registra pago de una sesion |
| GET | `/api/payments` | Lista pagos del garage |
| GET | `/api/payments/receipt/<session_id>` | Obtiene recibo de pago |

### 5.6 Dashboard

| Metodo | Endpoint | Descripcion |
|---|---|---|
| GET | `/api/dashboard/stats` | Devuelve metricas generales del sistema |

### 5.7 Usuarios

| Metodo | Endpoint | Descripcion |
|---|---|---|
| GET | `/api/users` | Lista usuarios |
| POST | `/api/users` | Crea usuario |
| PUT | `/api/users/<user_id>` | Actualiza usuario |
| DELETE | `/api/users/<user_id>` | Elimina usuario |

### 5.8 Reportes

| Metodo | Endpoint | Descripcion |
|---|---|---|
| GET | `/api/reports/occupancy` | Reporte de ocupacion |
| GET | `/api/reports/income` | Reporte de ingresos |
| GET | `/api/reports/vehicles` | Reporte de vehiculos |
| GET | `/api/reports/users` | Reporte de usuarios |

### 5.9 Notificaciones y alertas

| Metodo | Endpoint | Descripcion |
|---|---|---|
| GET | `/api/notificaciones` | Lista notificaciones |
| POST | `/api/notificaciones/mark-read/<notification_id>` | Marca notificacion como leida |
| GET | `/api/alertas-acceso` | Lista alertas de acceso |

## 6. Base de datos

El sistema utiliza Supabase PostgreSQL. Las tablas principales documentadas para el proyecto son:

### 6.1 `users`

- `id`
- `email`
- `password`
- `nombre`
- `rol`
- `garage_id`
- `created_at`

### 6.2 `parking_spaces`

- `id`
- `numero`
- `piso`
- `ocupado`
- `tipo_espacio`
- `vehiculo_id`
- `garage_id`
- `created_at`

### 6.3 `parking_sessions`

- `id`
- `vehiculo_id`
- `entrada`
- `salida`
- `duracion`
- `usuario_id`
- `espacio_id`
- `created_at`

### 6.4 `vehicles`

- `id`
- `placa`
- `marca`
- `modelo`
- `tipo`
- `color`
- `propietario_id`
- `garage_id`
- `created_at`

### 6.5 `payments`

- `id`
- `session_id`
- `monto`
- `metodo`
- `estado`
- `fecha`

### 6.6 `auth_logs`

- `id`
- `user_id`
- `email`
- `garage_id`
- `event`
- `status`
- `ip_address`
- `user_agent`
- `created_at`

### 6.7 `login_sessions`

- `id`
- `user_id`
- `token`
- `created_at`
- `expires_at`
- `status`

### 6.8 `otp_codes`

- `id`
- `user_id`
- `email`
- `code`
- `expires_at`
- `used`
- `created_at`

### 6.9 `notificaciones`

- `id`
- `usuario_id`
- `titulo`
- `mensaje`
- `tipo`
- `leida`
- `fecha`

### 6.10 `alertas_acceso`

- `id`
- `garage_id`
- `descripcion`
- `tipo_alerta`
- `estado`
- `fecha`

### 6.11 `registration_logs`

- `id`
- `user_id`
- `email`
- `status`
- `created_at`

### 6.12 `garajes`

- `id`
- `nombre`
- `direccion`
- `capacidad`
- `created_at`

### 6.13 `settings`

- `id`
- `garage_id`
- `clave`
- `valor`
- `updated_at`

### 6.14 `registros_usuarios`

- `id`
- `usuario_id`
- `accion`
- `descripcion`
- `fecha`

## 7. Variables de entorno necesarias

### Backend

```env
SUPABASE_URL=
SUPABASE_KEY=
SUPABASE_SERVICE_ROLE_KEY=
JWT_SECRET_KEY=
JWT_ALGORITHM=HS256
JWT_ACCESS_TTL_MINUTES=60
JWT_REFRESH_TTL_DAYS=7
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=
SMTP_PASSWORD=
SMTP_SENDER=
HOST=127.0.0.1
PORT=5000
DEBUG=True
```

### Frontend

```env
VITE_API_URL=http://127.0.0.1:5000
```

## 8. Proceso de instalacion tecnica

### 8.1 Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
python -m app.main
```

### 8.2 Frontend

```bash
cd frontend
npm install
npm run dev
```

## 9. Pruebas de endpoints

### Login

```bash
curl -X POST http://localhost:5000/api/auth/login ^
  -H "Content-Type: application/json" ^
  -d "{\"email\":\"giannisubervi@gmail.com\",\"password\":\"SmartPark123\"}"
```

### Verificacion de token

```bash
curl http://localhost:5000/api/auth/verify ^
  -H "Authorization: Bearer <token>"
```

### Registro de entrada

```bash
curl -X POST http://localhost:5000/api/parking-sessions/entry ^
  -H "Authorization: Bearer <token>" ^
  -H "Content-Type: application/json" ^
  -d "{\"placa\":\"ABC-123\"}"
```

## 10. Recomendaciones tecnicas

- Mantener consistencia entre nombres de tablas legacy y nuevas.
- Validar la carga de espacios y tarifas antes de probar el dashboard.
- Centralizar el uso de `garage_id` en todos los modulos.
- Probar siempre login, espacios, dashboard y sesiones despues de cambios en Supabase.
