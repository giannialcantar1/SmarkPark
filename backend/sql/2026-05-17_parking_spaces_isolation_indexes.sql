begin;

create index if not exists idx_parking_spaces_garage_floor_numero
on public.parking_spaces (garage_id, piso, numero);

commit;
