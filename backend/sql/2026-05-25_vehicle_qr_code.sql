alter table public.vehicles
  add column if not exists qr_code text;

create unique index if not exists idx_vehicles_qr_code
  on public.vehicles (qr_code)
  where qr_code is not null;

create index if not exists idx_vehicles_garage_qr_code
  on public.vehicles (garage_id, qr_code);
