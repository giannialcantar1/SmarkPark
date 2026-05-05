CREATE TABLE IF NOT EXISTS notificaciones (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  garage_id UUID,
  titulo TEXT NOT NULL,
  mensaje TEXT,
  tipo TEXT DEFAULT 'info',
  leida BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
