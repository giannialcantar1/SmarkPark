create extension if not exists pgcrypto;

create table if not exists public.access_codes (
  id uuid primary key default gen_random_uuid(),
  garage_id uuid,
  vehicle_id uuid,
  code text not null,
  created_at timestamptz default now(),
  expires_at timestamptz,
  used_at timestamptz
);

alter table public.access_codes
  add column if not exists garage_id uuid;

alter table public.access_codes
  add column if not exists vehicle_id uuid;

alter table public.access_codes
  add column if not exists code text;

alter table public.access_codes
  add column if not exists created_at timestamptz default now();

alter table public.access_codes
  add column if not exists expires_at timestamptz;

alter table public.access_codes
  add column if not exists used_at timestamptz;

create index if not exists idx_access_codes_garage_id
  on public.access_codes (garage_id);

create index if not exists idx_access_codes_vehicle_id
  on public.access_codes (vehicle_id);

create index if not exists idx_access_codes_code
  on public.access_codes (code);

create index if not exists idx_access_codes_expires_at
  on public.access_codes (expires_at);
