create extension if not exists pgcrypto;

create table if not exists public.reservas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  vehicle_id uuid,
  parking_space_id uuid,
  garage_id uuid,
  fecha_entrada timestamptz not null,
  fecha_salida timestamptz not null,
  estado text default 'pendiente',
  created_at timestamptz default now()
);
