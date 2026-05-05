create extension if not exists pgcrypto;

create table if not exists public.reservas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  garage_id uuid not null,
  vehicle_id uuid,
  placa text,
  espacio_id uuid not null references public.parking_spaces(id) on delete cascade,
  fecha_entrada timestamptz not null,
  fecha_salida timestamptz not null,
  status text not null default 'reservado' check (status in ('reservado', 'activo', 'cancelado', 'completado')),
  created_at timestamptz not null default now()
);

create index if not exists idx_reservas_garage_id on public.reservas (garage_id);
create index if not exists idx_reservas_user_id on public.reservas (user_id);
create index if not exists idx_reservas_status on public.reservas (status);
create index if not exists idx_reservas_fecha_entrada on public.reservas (fecha_entrada);
