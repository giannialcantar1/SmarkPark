-- RF1 Multi-tenant - garage_id propagation and RLS
-- IMPORTANTE:
-- 1) Reemplaza el UUID de ejemplo por el garage_id real que usaras para los datos existentes.
-- 2) Si tu tabla garajes sigue usando id INTEGER, no puedes crear una foreign key directa con este garage_id UUID
--    hasta alinear ese esquema. Este script deja garage_id operativo en las tablas tenant-scoped.

begin;

alter table public.vehicles add column if not exists garage_id uuid;
alter table public.parking_spaces add column if not exists garage_id uuid;
alter table public.settings add column if not exists garage_id uuid;
alter table public.vehicle_logs add column if not exists garage_id uuid;

-- Backfill temporal para filas existentes.
-- Cambia este UUID por el garage_id real que corresponda antes de ejecutar en produccion.
update public.vehicles
set garage_id = coalesce(garage_id, 'd12e9e15-76fd-4cbb-9895-587a29e0cd0f'::uuid)
where garage_id is null;

update public.parking_spaces
set garage_id = coalesce(garage_id, 'd12e9e15-76fd-4cbb-9895-587a29e0cd0f'::uuid)
where garage_id is null;

update public.settings
set garage_id = coalesce(garage_id, 'd12e9e15-76fd-4cbb-9895-587a29e0cd0f'::uuid)
where garage_id is null;

update public.vehicle_logs
set garage_id = coalesce(garage_id, 'd12e9e15-76fd-4cbb-9895-587a29e0cd0f'::uuid)
where garage_id is null;

alter table public.vehicles alter column garage_id set not null;
alter table public.parking_spaces alter column garage_id set not null;
alter table public.settings alter column garage_id set not null;
alter table public.vehicle_logs alter column garage_id set not null;

create index if not exists idx_vehicles_garage_id on public.vehicles (garage_id);
create index if not exists idx_vehicles_garage_status on public.vehicles (garage_id, status);
create index if not exists idx_vehicles_garage_space on public.vehicles (garage_id, space_id);

create index if not exists idx_parking_spaces_garage_id on public.parking_spaces (garage_id);
create index if not exists idx_parking_spaces_garage_estado on public.parking_spaces (garage_id, estado);

create index if not exists idx_settings_garage_id on public.settings (garage_id);
create unique index if not exists uq_settings_user_garage on public.settings (user_id, garage_id);

create index if not exists idx_vehicle_logs_garage_id on public.vehicle_logs (garage_id);
create index if not exists idx_vehicle_logs_garage_created_at on public.vehicle_logs (garage_id, created_at desc);

alter table public.vehicles enable row level security;
alter table public.parking_spaces enable row level security;
alter table public.settings enable row level security;
alter table public.vehicle_logs enable row level security;

drop policy if exists vehicles_tenant_isolation on public.vehicles;
create policy vehicles_tenant_isolation
on public.vehicles
for all
to authenticated
using (
  garage_id = ((auth.jwt() -> 'user_metadata' ->> 'garage_id')::uuid)
)
with check (
  garage_id = ((auth.jwt() -> 'user_metadata' ->> 'garage_id')::uuid)
);

drop policy if exists parking_spaces_tenant_isolation on public.parking_spaces;
create policy parking_spaces_tenant_isolation
on public.parking_spaces
for all
to authenticated
using (
  garage_id = ((auth.jwt() -> 'user_metadata' ->> 'garage_id')::uuid)
)
with check (
  garage_id = ((auth.jwt() -> 'user_metadata' ->> 'garage_id')::uuid)
);

drop policy if exists settings_tenant_isolation on public.settings;
create policy settings_tenant_isolation
on public.settings
for all
to authenticated
using (
  garage_id = ((auth.jwt() -> 'user_metadata' ->> 'garage_id')::uuid)
)
with check (
  garage_id = ((auth.jwt() -> 'user_metadata' ->> 'garage_id')::uuid)
);

drop policy if exists vehicle_logs_tenant_isolation on public.vehicle_logs;
create policy vehicle_logs_tenant_isolation
on public.vehicle_logs
for all
to authenticated
using (
  garage_id = ((auth.jwt() -> 'user_metadata' ->> 'garage_id')::uuid)
)
with check (
  garage_id = ((auth.jwt() -> 'user_metadata' ->> 'garage_id')::uuid)
);

commit;

-- Paso manual recomendado:
-- asigna garage_id en metadata a cada usuario autenticado para que el aislamiento funcione:
-- update auth.users
-- set raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('garage_id', '00000000-0000-0000-0000-000000000001')
-- where email = 'usuario@ejemplo.com';
