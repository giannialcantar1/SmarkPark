BEGIN;

ALTER TABLE IF EXISTS public.garajes RENAME TO garages;
ALTER TABLE IF EXISTS public.alertas_acceso RENAME TO access_alerts;
ALTER TABLE IF EXISTS public.notificaciones RENAME TO notifications;
ALTER TABLE IF EXISTS public.reservas RENAME TO reservations;
ALTER TABLE IF EXISTS public.visitantes RENAME TO visitors;

COMMIT;
