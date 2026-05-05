ALTER TABLE alertas_acceso
ADD COLUMN IF NOT EXISTS tipo TEXT DEFAULT 'acceso_denegado';
