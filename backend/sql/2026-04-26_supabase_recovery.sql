-- SmartPark recovery script
-- Ejecuta este archivo completo en Supabase SQL Editor.

create extension if not exists pgcrypto;

-- Tabla users
create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  email varchar unique not null,
  password varchar,
  nombre varchar not null,
  rol varchar default 'usuario',
  garage_id uuid,
  created_at timestamp default now()
);

-- Tabla vehicles
create table if not exists public.vehicles (
  id uuid primary key default gen_random_uuid(),
  placa varchar unique not null,
  marca varchar,
  modelo varchar,
  tipo varchar,
  color varchar,
  propietario_id uuid references public.users(id),
  garage_id uuid,
  created_at timestamp default now()
);

-- Tabla parking_spaces
create table if not exists public.parking_spaces (
  id uuid primary key default gen_random_uuid(),
  numero varchar,
  piso varchar,
  ocupado boolean default false,
  tipo_espacio varchar,
  vehiculo_id uuid references public.vehicles(id),
  garage_id uuid,
  created_at timestamp default now()
);

-- Tabla parking_sessions
create table if not exists public.parking_sessions (
  id uuid primary key default gen_random_uuid(),
  vehiculo_id uuid references public.vehicles(id),
  entrada timestamp,
  salida timestamp,
  duracion int,
  usuario_id uuid references public.users(id),
  espacio_id uuid references public.parking_spaces(id),
  created_at timestamp default now()
);

-- Tabla payments
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  garage_id uuid not null,
  session_id uuid references public.parking_sessions(id),
  monto decimal,
  metodo varchar,
  estado varchar,
  fecha timestamp default now()
);

-- Tabla service_rates
create table if not exists public.service_rates (
  id uuid primary key default gen_random_uuid(),
  tipo_vehiculo varchar,
  tarifa_hora decimal,
  tarifa_minima decimal,
  tarifa_diaria decimal,
  garage_id uuid
);

-- Tabla notificaciones
create table if not exists public.notificaciones (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid references public.users(id),
  titulo varchar,
  mensaje text,
  tipo varchar,
  leida boolean default false,
  fecha timestamp default now()
);

-- Tabla alertas_acceso
create table if not exists public.alertas_acceso (
  id uuid primary key default gen_random_uuid(),
  garage_id uuid,
  descripcion text,
  tipo_alerta varchar,
  estado varchar,
  fecha timestamp default now()
);

-- Tabla auth_logs
create table if not exists public.auth_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id),
  email varchar,
  garage_id uuid,
  event varchar,
  status varchar,
  ip_address varchar,
  user_agent varchar,
  created_at timestamp default now()
);

-- Tabla parking_history
create table if not exists public.parking_history (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references public.parking_sessions(id),
  vehiculo_id uuid references public.vehicles(id),
  espacio_id uuid references public.parking_spaces(id),
  garage_id uuid,
  event_type varchar,
  placa varchar,
  owner_name varchar,
  created_at timestamp default now()
);

-- Datos mínimos de prueba
insert into public.service_rates (tipo_vehiculo, tarifa_hora, tarifa_minima, tarifa_diaria, garage_id)
select 'auto', 100, 50, 500, 'd12e9e15-76fd-4cbb-9895-587a29e0cd0f'::uuid
where not exists (
  select 1
  from public.service_rates
  where tipo_vehiculo = 'auto'
    and garage_id = 'd12e9e15-76fd-4cbb-9895-587a29e0cd0f'::uuid
);

with seed_spaces(numero, piso) as (
  values
    ('A1', 'A'),
    ('A2', 'A'),
    ('A3', 'A'),
    ('A4', 'A'),
    ('A5', 'A'),
    ('A6', 'A'),
    ('A7', 'A'),
    ('A8', 'A'),
    ('B1', 'B'),
    ('B2', 'B'),
    ('B3', 'B'),
    ('B4', 'B'),
    ('B5', 'B'),
    ('B6', 'B'),
    ('B7', 'B'),
    ('B8', 'B')
)
insert into public.parking_spaces (numero, piso, ocupado, tipo_espacio, garage_id)
select
  seed_spaces.numero,
  seed_spaces.piso,
  false,
  'regular',
  'd12e9e15-76fd-4cbb-9895-587a29e0cd0f'::uuid
from seed_spaces
where not exists (
  select 1
  from public.parking_spaces spaces
  where spaces.numero = seed_spaces.numero
    and spaces.garage_id = 'd12e9e15-76fd-4cbb-9895-587a29e0cd0f'::uuid
);
