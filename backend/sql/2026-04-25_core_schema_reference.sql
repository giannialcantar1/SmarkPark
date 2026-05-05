-- SmartPark core schema reference
-- Basado en el modelo funcional compartido por el proyecto.

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  password text,
  nombre text not null,
  rol text not null default 'usuario',
  garage_id uuid not null,
  created_at timestamptz not null default now()
);

create table if not exists public.vehicles (
  id uuid primary key default gen_random_uuid(),
  placa text not null,
  marca text not null,
  modelo text not null,
  tipo text,
  color text,
  propietario_id uuid not null,
  garage_id uuid not null
);

create table if not exists public.parking_spaces (
  id uuid primary key default gen_random_uuid(),
  numero text not null,
  piso text not null,
  ocupado boolean not null default false,
  tipo_espacio text,
  vehiculo_id uuid,
  garage_id uuid not null
);

create table if not exists public.parking_sessions (
  id uuid primary key default gen_random_uuid(),
  vehiculo_id uuid not null,
  entrada timestamptz not null default now(),
  salida timestamptz,
  duracion integer,
  usuario_id uuid not null,
  espacio_id uuid not null
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null,
  monto numeric(12,2) not null,
  metodo text not null,
  estado text not null default 'pendiente',
  fecha timestamptz not null default now()
);

create table if not exists public.service_rates (
  id uuid primary key default gen_random_uuid(),
  tipo_vehiculo text not null,
  tarifa_hora numeric(12,2) not null,
  tarifa_minima numeric(12,2),
  tarifa_diaria numeric(12,2),
  garage_id uuid not null
);

create table if not exists public.notificaciones (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null,
  mensaje text not null,
  tipo text not null,
  leida boolean not null default false,
  fecha timestamptz not null default now()
);

create table if not exists public.alertas_acceso (
  id uuid primary key default gen_random_uuid(),
  garage_id uuid not null,
  descripcion text not null,
  tipo_alerta text not null,
  fecha timestamptz not null default now(),
  estado text not null default 'pendiente'
);
