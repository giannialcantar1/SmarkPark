-- SmartPark SaaS company onboarding
-- Ejecuta este script en Supabase SQL Editor para guardar cada empresa/garaje como tenant propio.

create extension if not exists pgcrypto;

create table if not exists public.garajes (
  id uuid primary key default gen_random_uuid(),
  garage_id uuid not null unique,
  tenant_id uuid not null unique,
  codigo text not null unique,
  nombre text not null,
  direccion text,
  telefono text,
  cupos_totales integer not null default 20,
  owner_user_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.garajes add column if not exists garage_id uuid;
alter table public.garajes add column if not exists tenant_id uuid;
alter table public.garajes add column if not exists codigo text;
alter table public.garajes add column if not exists nombre text;
alter table public.garajes add column if not exists direccion text;
alter table public.garajes add column if not exists telefono text;
alter table public.garajes add column if not exists cupos_totales integer default 20;
alter table public.garajes add column if not exists owner_user_id uuid;
alter table public.garajes add column if not exists created_at timestamptz default now();
alter table public.garajes add column if not exists updated_at timestamptz default now();

alter table public.settings add column if not exists garage_id uuid;
alter table public.settings add column if not exists company_name text;
alter table public.settings add column if not exists address text;
alter table public.settings add column if not exists phone text;
alter table public.settings add column if not exists hourly_rate numeric(12,2);
alter table public.settings add column if not exists updated_at timestamptz;

update public.garajes
set codigo = 'GAR-' || upper(left(replace(id::text, '-', ''), 8))
where codigo is null or btrim(codigo) = '';

alter table public.garajes alter column codigo set not null;

create index if not exists idx_garajes_garage_id on public.garajes (garage_id);
create index if not exists idx_garajes_owner_user_id on public.garajes (owner_user_id);
create unique index if not exists uq_garajes_codigo on public.garajes (codigo);
create index if not exists idx_settings_garage_id on public.settings (garage_id);
create unique index if not exists uq_settings_user_garage on public.settings (user_id, garage_id);
