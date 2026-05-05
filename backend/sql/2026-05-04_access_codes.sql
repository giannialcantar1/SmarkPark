create extension if not exists pgcrypto;

create table if not exists public.access_codes (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  code text not null,
  created_at timestamptz not null default now(),
  used_at timestamptz,
  expires_at timestamptz not null
);

create index if not exists idx_access_codes_vehicle_id
  on public.access_codes (vehicle_id);

create index if not exists idx_access_codes_code
  on public.access_codes (code);

create index if not exists idx_access_codes_expires_at
  on public.access_codes (expires_at);
