# Manual Tecnico
## SmartPark - Sistema de Gestion de Estacionamientos

### 1. Proposito del documento
Este manual tecnico describe la arquitectura, componentes, base de datos, variables de entorno y flujo de trabajo del backend y frontend de SmartPark. Esta orientado a desarrolladores, mantenedores y personal tecnico que necesite extender o dar soporte al sistema.

### 2. Arquitectura general
SmartPark usa una arquitectura por capas:

- Routes
- Controllers
- Services
- Repositories
- Utils
- Supabase

Flujo principal:

1. La ruta Flask recibe la peticion HTTP.
2. El Controller valida la entrada y prepara la respuesta.
3. El Service aplica la logica de negocio.
4. El Repository consulta o actualiza Supabase.
5. Utils apoya con JWT, validaciones, PDF, correo y conexion.

### 3. Descripcion de capas
#### 3.1 Routes
- Ubicacion: `backend/routes/`
- Funcion: declarar endpoints Flask y delegar al controller correspondiente.
- Regla: no debe contener logica de negocio compleja.

#### 3.2 Controllers
- Ubicacion: `backend/controllers/`
- Funcion: orquestar request/response.
- Responsabilidades:
  - leer `request.get_json()`
  - validar presencia minima de datos
  - invocar services
  - devolver `jsonify()` con codigos HTTP

#### 3.3 Services
- Ubicacion: `backend/services/`
- Funcion: aplicar reglas de negocio del dominio SmartPark.
- Ejemplos:
  - calcular monto a pagar
  - validar sesiones activas
  - asegurar pertenencia al `garage_id`
  - construir reportes

#### 3.4 Repositories
- Ubicacion: `backend/repositories/`
- Funcion: encapsular el acceso a datos y evitar consultas directas dispersas.
- Beneficio: aisla cambios de persistencia y simplifica testing.

#### 3.5 Utils
- Ubicacion: `backend/utils/`
- Funcion:
  - `database.py`: acceso central a Supabase
  - `jwt_manager.py` y `jwt_utils.py`: JWT
  - `validators.py`: validaciones
  - `pdf_generator.py`: generacion de PDF
  - `supabase_client.py`: helpers de normalizacion y operaciones

### 4. Mapa de clases
#### Controllers
- AuthController
- UserController
- VehicleController
- ParkingController
- PaymentController
- ReportController

#### Services principales
- AuthService
- UserService
- VehicleService
- ParkingService
- PaymentService
- ReportService

#### Repositories
- UserRepository
- VehicleRepository
- ParkingSpaceRepository
- PaymentRepository
- SessionRepository

### 5. Cadenas conectadas
| Controller | Service | Repository principal |
|---|---|---|
| AuthController | AuthService | UserRepository |
| UserController | UserService | UserRepository |
| VehicleController | VehicleService | VehicleRepository |
| ParkingController | ParkingService | ParkingSpaceRepository, SessionRepository |
| PaymentController | PaymentService | PaymentRepository |
| ReportController | ReportService | UserRepository, VehicleRepository, ParkingSpaceRepository, SessionRepository, PaymentRepository |

### 6. Estructura de carpetas
```text
backend/
|-- app.py
|-- config.py
|-- controllers/
|-- repositories/
|-- routes/
|-- services/
|-- sql/
|-- utils/
`-- app/
```

### 7. Base de datos
#### 7.1 Tablas principales
- users
- vehicles
- parking_spaces
- parking_sessions
- parking_history
- payments
- service_rates
- notificaciones
- alertas_acceso
- auth_logs

#### 7.2 Tablas de soporte
- garajes
- settings
- vehicle_logs
- otp_codes
- login_sessions
- registros_usuarios

#### 7.3 Relaciones clave
- Un `user` pertenece a un `garage`
- Un `vehicle` pertenece a un `user` y a un `garage`
- Un `parking_space` pertenece a un `garage`
- Una `parking_session` une `vehicle`, `user` y `parking_space`
- Un `payment` pertenece a una `parking_session`
- `service_rates` parametriza cobros por `garage`
- `notificaciones`, `auth_logs` y `alertas_acceso` apoyan operacion y auditoria

### 8. Variables de entorno requeridas
#### Backend
| Variable | Uso |
|---|---|
| SUPABASE_URL | URL del proyecto Supabase |
| SUPABASE_KEY | Key publica o anon |
| SUPABASE_SERVICE_ROLE_KEY | Service role para operaciones administrativas |
| SECRET_KEY | Clave general Flask |
| JWT_SECRET_KEY | Firma de JWT local |
| JWT_ALGORITHM | Algoritmo JWT |
| JWT_ACCESS_TTL_MINUTES | Vida util access token |
| JWT_REFRESH_TTL_DAYS | Vida util refresh token |
| SMARTPARK_DEFAULT_GARAGE_ID | Garage por defecto |
| SMTP_HOST | Servidor SMTP |
| SMTP_PORT | Puerto SMTP |
| SMTP_USERNAME | Usuario SMTP |
| SMTP_PASSWORD | Password SMTP |
| SMTP_SENDER | Remitente |

#### Frontend
| Variable | Uso |
|---|---|
| VITE_API_URL | URL del backend |

### 9. Endpoints del sistema
#### Autenticacion
- POST `/api/auth/login`
- POST `/api/auth/register`
- GET `/api/auth/verify`
- POST `/api/auth/logout`

#### Espacios
- GET `/api/parking-spaces`
- GET `/api/parking-spaces/stats`
- GET `/api/parking-spaces/floor/<floor>`
- PUT `/api/parking-spaces/<space_id>`

#### Vehiculos
- GET `/api/vehicles`
- POST `/api/vehicles`
- GET `/api/vehicles/garage/<garage_id>`
- GET `/api/vehicles/search`
- PUT `/api/vehicles/<vehicle_id>`
- DELETE `/api/vehicles/<vehicle_id>`

#### Sesiones
- POST `/api/parking-sessions/entry`
- POST `/api/parking-sessions/exit`
- GET `/api/parking-sessions/active`

#### Pagos
- POST `/api/payments`
- GET `/api/payments`
- GET `/api/payments/receipt/<session_id>`

#### Dashboard
- GET `/api/dashboard/stats`

#### Usuarios
- GET `/api/users`
- POST `/api/users`
- PUT `/api/users/<user_id>`
- DELETE `/api/users/<user_id>`

#### Reportes
- GET `/api/reports/occupancy`
- GET `/api/reports/income`
- GET `/api/reports/vehicles`
- GET `/api/reports/users`

### 10. Como agregar nuevas funcionalidades
#### Caso ejemplo: modulo de reservas
1. Crear `ReservationRepository`
2. Crear `ReservationService`
3. Crear `ReservationController`
4. Crear `routes/reservations.py`
5. Registrar blueprint en `routes/__init__.py`
6. Agregar validaciones y pruebas
7. Documentar endpoint en README y manuales

### 11. Convenciones recomendadas
- Mantener nombres de clases en PascalCase
- Mantener metodos de negocio en Services
- Evitar consultas directas a Supabase desde Routes
- Reutilizar normalizadores en `utils/supabase_client.py`
- Validar siempre `garage_id` y autenticacion

### 12. Como probar endpoints
#### Opcion 1: curl
```bash
curl -X POST http://localhost:5000/api/auth/login ^
  -H "Content-Type: application/json" ^
  -d "{\"email\":\"admin@smartpark.com\",\"password\":\"SmartPark123\"}"
```

#### Opcion 2: Postman
- Crear coleccion `SmartPark API`
- Guardar `token` como variable de coleccion
- Reutilizar header `Authorization: Bearer {{token}}`

#### Opcion 3: navegador + frontend
- Ejecutar backend
- Ejecutar `npm run dev`
- Validar flujo completo desde interfaz

### 13. Diagnostico rapido
- `401`: token ausente, invalido o expirado
- `403`: acceso a `garage_id` no autorizado
- `404`: recurso no encontrado
- `409`: conflicto de negocio, por ejemplo placa duplicada o sesion activa
- `500`: revisar variables de entorno, tablas y logs

### 14. Recomendaciones de mantenimiento
- centralizar cambios de esquema en `sql/`
- mantener el README sincronizado con los endpoints
- versionar cambios de arquitectura
- agregar pruebas automatizadas para auth, parking y payments
