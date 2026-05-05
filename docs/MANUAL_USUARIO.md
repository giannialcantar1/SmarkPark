# Manual de Usuario - SmartPark

## 1. Introduccion

SmartPark es un sistema web para gestionar estacionamientos de forma simple y segura. Este manual explica las acciones basicas que puede realizar un usuario u operario dentro de la plataforma.

## 2. Requisitos para usar el sistema

- Tener acceso a internet
- Contar con una cuenta registrada
- Usar un navegador actualizado
- Tener acceso al correo electronico para recibir OTP

## 3. Acceso al sistema

### 3.1 Como registrarse

1. Ingrese a la pantalla de registro desde el enlace `Registrarse`.
2. Complete nombre, correo y contrasena.
3. Presione el boton `Crear cuenta`.
4. El sistema enviara un codigo OTP al correo registrado.

**Captura descrita:** formulario con campos de nombre completo, correo, contrasena y confirmacion de contrasena, con boton principal de color azul.

### 3.2 Como verificar OTP

1. Abra el correo recibido.
2. Copie el codigo OTP enviado por SmartPark.
3. En la pantalla `Verificar codigo`, escriba el codigo.
4. Presione `Verificar`.
5. Si el codigo es correcto, la cuenta quedara activada.

**Captura descrita:** pantalla centrada con campo para codigo OTP de 6 digitos y botones para verificar o reenviar codigo.

### 3.3 Como iniciar sesion

1. Entre a la pantalla `Iniciar sesion`.
2. Escriba su correo y contrasena.
3. Presione `Iniciar sesion`.
4. Si los datos son correctos, ingresara al dashboard.

**Captura descrita:** formulario de login con fondo visual del estacionamiento, campos de correo y contrasena, boton principal y acceso a registro.

## 4. Uso del sistema

### 4.1 Como ver el dashboard

Al iniciar sesion, el sistema muestra el dashboard principal con:

- total de espacios ocupados
- espacios disponibles
- vehiculos activos
- ingresos del dia
- actividad reciente
- estado de los espacios por piso

**Captura descrita:** panel administrativo con metricas, mapa de espacios y seccion de actividad reciente.

### 4.2 Como registrar entrada de vehiculo

1. Vaya al modulo de entradas o al formulario de acceso rapido.
2. Escriba la placa del vehiculo.
3. Confirme la operacion.
4. El sistema localizara el vehiculo y asignara un espacio disponible.
5. Se mostrara un mensaje de exito con el espacio asignado.

**Captura descrita:** modal o formulario con campo de placa, boton `Confirmar entrada` y mensaje con numero de espacio asignado.

### 4.3 Como registrar salida

1. Abra el modulo de salidas.
2. Introduzca la placa del vehiculo.
3. El sistema calculara la duracion y el monto a pagar.
4. Confirme la salida.
5. La sesion se cerrara y el espacio quedara libre.

**Captura descrita:** formulario con campo de placa, resumen de tiempo estacionado, costo generado y boton para procesar la salida.

### 4.4 Como ver pagos

1. Entre al modulo `Pagos`.
2. Revise la lista de cobros registrados.
3. Puede consultar metodo, monto, fecha y estado del pago.
4. Si aplica, abra el recibo asociado a la sesion.

**Captura descrita:** tabla de pagos con columnas de sesion, monto, metodo, estado y fecha.

### 4.5 Como cerrar sesion

1. Abra el menu del perfil o la seccion de configuracion.
2. Presione `Cerrar sesion`.
3. El sistema eliminara la sesion activa y volvera a la pantalla de login.

**Captura descrita:** pantalla de configuracion o panel lateral con boton destacado para cerrar sesion.

## 5. Recomendaciones de uso

- Verifique que la placa este escrita correctamente antes de registrar entrada o salida.
- No comparta su codigo OTP con terceros.
- Si una pagina no carga informacion, actualice la vista o vuelva a iniciar sesion.
- Revise el dashboard regularmente para monitorear disponibilidad y actividad.

## 6. Preguntas frecuentes

### No me llega el codigo OTP

- Revise la carpeta de spam
- Espere unos minutos
- Use la opcion `Reenviar codigo`

### No puedo iniciar sesion

- Confirme que el correo este bien escrito
- Verifique la contrasena
- Asegurese de haber validado el OTP

### Un vehiculo no aparece al registrar entrada

- Confirme que el vehiculo este registrado
- Verifique la placa
- Pida al administrador que revise el modulo de vehiculos

### El dashboard muestra pocos datos

- Puede deberse a que aun no hay movimientos registrados
- Tambien puede indicar que faltan espacios o tarifas cargadas en la base de datos

## 7. Soporte

En caso de incidencias, contacte al administrador del sistema o al equipo tecnico de SmartPark.
