-- RF7 - Visitantes y parqueo temporal
-- Ejecuta este script en Supabase SQL Editor antes de usar el modulo.

create extension if not exists pgcrypto;

do $$
begin
  if not exists (
    select 1
    from pg_type
    where typname = 'visitor_status'
  ) then
    create type public.visitor_status as enum ('dentro', 'fuera');
  end if;
end$$;

create table if not exists public.visitantes (
  id uuid primary key default gen_random_uuid(),
  garage_id uuid not null,
  nombre text not null,
  cedula text,
  telefono text,
  placa text not null,
  modelo text,
  espacio_id uuid,
  entrada timestamptz not null default now(),
  salida timestamptz,
  duracion_estimada integer,
  notas text,
  estado public.visitor_status not null default 'dentro',
  created_at timestamptz not null default now()
);

alter table public.visitantes
  add constraint fk_visitantes_garage
  foreign key (garage_id)
  references public.garajes (garage_id)
  on delete cascade;

alter table public.visitantes
  add constraint fk_visitantes_espacio
  foreign key (espacio_id)
  references public.parking_spaces (id)
  on delete set null;

create index if not exists idx_visitantes_garage_estado
  on public.visitantes (garage_id, estado);

create index if not exists idx_visitantes_garage_entrada
  on public.visitantes (garage_id, entrada desc);

create index if not exists idx_visitantes_placa
  on public.visitantes (placa);
