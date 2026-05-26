# SmartPark - Sistema de Gestion de Estacionamientos

SmartPark es una plataforma web para la administracion operativa de estacionamientos. El sistema permite registrar usuarios, autenticar acceso con JWT y OTP por correo, gestionar vehiculos, controlar entradas y salidas, registrar pagos y consultar reportes desde una interfaz moderna construida con React y un backend API en Flask conectado a Supabase PostgreSQL.

## Descripcion general

El objetivo del proyecto es centralizar la operacion de un garaje en una sola plataforma, reduciendo el registro manual y facilitando el seguimiento de espacios, vehiculos, sesiones de parqueo, pagos y eventos de seguridad.

## Stack tecnologico

- Frontend: React + Vite
- Backend: Python + Flask
- Base de datos: Supabase PostgreSQL
- Autenticacion: JWT + OTP por correo
- Correo saliente: Gmail SMTP

## Requisitos previos

- Node.js 18 o superior
- npm 9 o superior
- Python 3.10 o superior
- pip
- Cuenta de Supabase
- Cuenta de Gmail con App Password

## Instalacion

### 1. Clonar el proyecto

```bash
git clone <repositorio>
cd SmarkPark
```

### 2. Configurar el backend

Crear `backend/.env` con valores reales:

```env
SUPABASE_URL=https://witurjrwsiwgouomxqvb.supabase.co
SUPABASE_KEY=tu_clave_anon
SUPABASE_SERVICE_ROLE_KEY=tu_service_role_key
JWT_SECRET_KEY=tu_secret_aqui
JWT_ALGORITHM=HS256
JWT_ACCESS_TTL_MINUTES=60
JWT_REFRESH_TTL_DAYS=7
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=tu_correo@gmail.com
SMTP_PASSWORD=tu_app_password
SMTP_SENDER=tu_correo@gmail.com
HOST=127.0.0.1
PORT=5000
DEBUG=True
```

Instalar dependencias:

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
```

### 3. Configurar el frontend

Crear `frontend/.env`:

```env
VITE_API_URL=http://127.0.0.1:5000
```

Instalar dependencias:

```bash
cd frontend
npm install
```

## Ejecucion

### Backend

```bash
cd backend
python -m app.main
```

### Frontend

```bash
cd frontend
npm run dev
```

## Estructura del proyecto

```text
SmarkPark/
├── backend/
│   ├── app/
│   ├── controllers/
│   ├── repositories/
│   ├── routes/
│   ├── services/
│   ├── sql/
│   ├── utils/
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
├── docs/
└── README.md
```

## Modulos principales

- Autenticacion de usuarios con JWT y OTP
- Registro y gestion de vehiculos
- Control de espacios de parqueo
- Registro de entradas y salidas
- Pagos y comprobantes
- Reportes de ocupacion e ingresos
- Notificaciones y alertas de acceso

## Endpoints principales de la API

### Autenticacion

- `POST /api/auth/login`
- `POST /api/auth/register`
- `GET /api/auth/verify`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `POST /api/auth/verify-otp`
- `POST /api/auth/resend-otp`

### Espacios de parqueo

- `GET /api/parking-spaces`
- `GET /api/parking-spaces/stats`
- `GET /api/parking-spaces/floor/<floor>`
- `PUT /api/parking-spaces/<space_id>`

### Vehiculos

- `GET /api/vehicles`
- `POST /api/vehicles`
- `GET /api/vehicles/garage/<garage_id>`
- `GET /api/vehicles/search`
- `PUT /api/vehicles/<vehicle_id>`
- `DELETE /api/vehicles/<vehicle_id>`

### Sesiones de parqueo

- `POST /api/parking-sessions/entry`
- `POST /api/parking-sessions/exit`
- `GET /api/parking-sessions/active`

### Pagos

- `POST /api/payments`
- `GET /api/payments`
- `GET /api/payments/receipt/<session_id>`

### Dashboard y reportes

- `GET /api/dashboard/stats`
- `GET /api/reports/occupancy`
- `GET /api/reports/income`
- `GET /api/reports/vehicles`
- `GET /api/reports/users`

### Usuarios, notificaciones y alertas

- `GET /api/users`
- `POST /api/users`
- `PUT /api/users/<user_id>`
- `DELETE /api/users/<user_id>`
- `GET /api/notificaciones`
- `POST /api/notificaciones/mark-read/<notification_id>`
- `GET /api/alertas-acceso`

## Ejemplo de request y response

### Login

```http
POST /api/auth/login
Content-Type: application/json
```

```json
{
  "email": "giannisubervi@gmail.com",
  "password": "SmartPark123"
}
```

Respuesta esperada:

```json
{
  "success": true,
  "message": "Login exitoso",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "uuid-del-usuario",
    "email": "giannisubervi@gmail.com",
    "name": "Gianni Subervi",
    "role": "admin",
    "garage_id": "d12e9e15-76fd-4cbb-9895-587a29e0cd0f"
  }
}
```

### Registrar entrada

```http
POST /api/parking-sessions/entry
Authorization: Bearer <token>
Content-Type: application/json
```

```json
{
  "placa": "ABC1234"
}
```

Respuesta esperada:

```json
{
  "success": true,
  "space": {
    "id": "uuid-espacio",
    "number": "A1",
    "floor": "A",
    "status": "occupied"
  },
  "duration": 0,
  "message": "Entrada registrada correctamente"
}
```

## Tablas principales en Supabase

- `users`
- `parking_spaces`
- `parking_sessions`
- `vehicles`
- `payments`
- `auth_logs`
- `login_sessions`
- `otp_codes`
- `notificaciones`
- `alertas_acceso`
- `registration_logs`
- `garajes`
- `settings`
- `registros_usuarios`

## Equipo

- Desarrollador: Gianni Subervi Alcantara
- Administrador de Proyecto: Jose Luis Rijo Rodriguez
- Institucion: Instituto Politecnico Parroquial Santa Ana
- Ano: 2026
