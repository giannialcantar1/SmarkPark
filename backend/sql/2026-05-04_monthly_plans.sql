create extension if not exists pgcrypto;

create table if not exists public.monthly_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  garage_id uuid not null,
  amount numeric(10,2) not null,
  due_date timestamptz not null,
  status text not null default 'pendiente' check (status in ('pagado', 'pendiente', 'vencido')),
  created_at timestamptz not null default now()
);

create index if not exists idx_monthly_plans_garage_id on public.monthly_plans (garage_id);
create index if not exists idx_monthly_plans_user_id on public.monthly_plans (user_id);
create index if not exists idx_monthly_plans_status on public.monthly_plans (status);
