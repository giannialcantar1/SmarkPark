# Manual de Usuario
## SmartPark - Guia para Operarios

### 1. Introduccion
SmartPark permite controlar el acceso de vehiculos, los espacios ocupados, los pagos y los reportes del estacionamiento desde una interfaz web.

### 2. Requisitos para usar el sistema
- Tener una cuenta registrada
- Contar con acceso al enlace del sistema
- Disponer de conexion a internet o red local donde este desplegado SmartPark

### 3. Como registrarse
1. Abrir la pagina de inicio de SmartPark
2. Presionar `Registrarse`
3. Completar:
   - nombre
   - correo electronico
   - contrasena
4. Confirmar el registro
5. Si el sistema lo requiere, validar el acceso por correo

### 4. Como iniciar sesion
1. Ir a la pantalla `Iniciar Sesion`
2. Escribir correo y contrasena
3. Presionar `Iniciar Sesion`
4. Si las credenciales son correctas, se abrira el dashboard

### 5. Como registrar un vehiculo
1. Ir al modulo `Vehiculos`
2. Presionar `Agregar vehiculo`
3. Completar:
   - placa
   - marca
   - modelo
   - tipo
   - color
4. Guardar el registro

### 6. Como registrar entrada
1. Ir al dashboard o al modulo de parqueo
2. Seleccionar `Nueva Entrada`
3. Escribir la placa del vehiculo
4. Confirmar la operacion
5. El sistema asignara un espacio disponible automaticamente

### 7. Como registrar salida
1. Ir al modulo de sesiones o salida
2. Seleccionar `Registrar Salida`
3. Escribir la placa del vehiculo
4. Confirmar
5. El sistema calculara:
   - tiempo estacionado
   - monto a pagar
   - cierre de sesion

### 8. Como procesar un pago
1. Luego de registrar la salida, revisar el monto
2. Elegir el metodo de pago
3. Confirmar el pago
4. El sistema guardara el recibo y marcara la sesion como pagada

### 9. Como consultar espacios
1. Abrir el modulo `Espacios`
2. Revisar la disponibilidad general
3. Filtrar por piso si es necesario
4. Verificar ocupados, disponibles y porcentaje de ocupacion

### 10. Como consultar vehiculos activos
1. Ir al dashboard
2. Revisar vehiculos dentro del garage
3. Abrir sesiones activas para ver espacio y hora de entrada

### 11. Como generar reportes
1. Abrir `Reportes`
2. Elegir el tipo:
   - ocupacion
   - ingresos
   - vehiculos
   - usuarios
3. Consultar la informacion
4. Si el sistema lo habilita, exportar a PDF

### 12. Preguntas frecuentes
#### No puedo iniciar sesion
- Verifica correo y contrasena
- Asegurate de no tener el token expirado
- Si persiste, solicita restablecimiento

#### La placa no aparece
- Confirma que el vehiculo fue registrado previamente
- Verifica formato de placa

#### No hay espacios disponibles
- El garage esta lleno o faltan espacios por liberar
- Verifica si existen sesiones activas sin salida registrada

#### El monto del pago parece incorrecto
- Verifica hora de entrada y salida
- Revisa la tarifa configurada para el tipo de vehiculo

#### No veo mis cambios en pantalla
- Actualiza la pagina
- Cierra sesion y vuelve a entrar
- Verifica conexion con el backend

### 13. Buenas practicas de operacion
- Registrar entrada inmediatamente al ingreso del vehiculo
- Registrar salida antes de procesar el pago
- Revisar diariamente el dashboard y reportes
- No compartir credenciales de acceso

### 14. Soporte
Si el sistema presenta fallos:
- reporta el problema al administrador
- indica modulo afectado
- adjunta hora del incidente y, si es posible, captura de pantalla
