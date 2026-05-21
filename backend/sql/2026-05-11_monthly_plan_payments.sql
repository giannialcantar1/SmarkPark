create extension if not exists pgcrypto;

create table if not exists public.monthly_plan_payments (
  id uuid primary key default gen_random_uuid(),
  garage_id uuid not null,
  plan_id uuid not null references public.monthly_plans(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  amount numeric(12,2) not null,
  method text not null check (method in ('card', 'transfer', 'manual')),
  reference text not null unique,
  status text not null default 'approved' check (status in ('approved')),
  receipt_url text,
  paid_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_monthly_plan_payments_garage_id
  on public.monthly_plan_payments (garage_id);

create index if not exists idx_monthly_plan_payments_plan_id
  on public.monthly_plan_payments (plan_id, paid_at desc);

create index if not exists idx_monthly_plan_payments_user_id
  on public.monthly_plan_payments (user_id, paid_at desc);

alter table public.monthly_plan_payments enable row level security;

drop policy if exists "monthly_plan_payments_select_authenticated" on public.monthly_plan_payments;
create policy "monthly_plan_payments_select_authenticated"
on public.monthly_plan_payments
for select
to authenticated
using (true);

drop policy if exists "monthly_plan_payments_insert_authenticated" on public.monthly_plan_payments;
create policy "monthly_plan_payments_insert_authenticated"
on public.monthly_plan_payments
for insert
to authenticated
with check (true);

drop policy if exists "monthly_plan_payments_delete_authenticated" on public.monthly_plan_payments;
create policy "monthly_plan_payments_delete_authenticated"
on public.monthly_plan_payments
for delete
to authenticated
using (true);

insert into storage.buckets (id, name, public)
values ('receipts', 'receipts', true)
on conflict (id) do update set public = true;

drop policy if exists "receipts_public_read" on storage.objects;
create policy "receipts_public_read"
on storage.objects
for select
to public
using (bucket_id = 'receipts');

drop policy if exists "receipts_authenticated_insert" on storage.objects;
create policy "receipts_authenticated_insert"
on storage.objects
for insert
to authenticated
with check (bucket_id = 'receipts');

drop policy if exists "receipts_authenticated_delete" on storage.objects;
create policy "receipts_authenticated_delete"
on storage.objects
for delete
to authenticated
using (bucket_id = 'receipts');
