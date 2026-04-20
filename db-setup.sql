-- ============================================================
-- MERLIN EVENTS v2 — Script de migración de base de datos
-- Ejecutar en Supabase SQL Editor (una sola vez)
-- ============================================================

-- 1. Extender tabla events
ALTER TABLE events ADD COLUMN IF NOT EXISTS tipo          TEXT    DEFAULT 'evento';
ALTER TABLE events ADD COLUMN IF NOT EXISTS banner_url    TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS registration_open BOOLEAN DEFAULT true;
ALTER TABLE events ADD COLUMN IF NOT EXISTS custom_fields JSONB   DEFAULT '[]'::jsonb;
ALTER TABLE events ADD COLUMN IF NOT EXISTS slug          TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS terminos_url  TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS privacidad_url TEXT;

-- 2. Tabla de registros (formulario público)
CREATE TABLE IF NOT EXISTS registrations (
  id                UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id          UUID        REFERENCES events(id) ON DELETE CASCADE,
  nombres           TEXT        NOT NULL,
  apellidos         TEXT        NOT NULL,
  tipo_documento    TEXT        DEFAULT 'DNI',
  numero_documento  TEXT,
  email             TEXT        NOT NULL,
  celular_codigo    TEXT        DEFAULT '+51',
  celular           TEXT,
  whatsapp_codigo   TEXT        DEFAULT '+51',
  whatsapp          TEXT,
  pais_procedencia  TEXT,
  pais_residencia   TEXT,
  fecha_nacimiento  DATE,
  genero            TEXT,
  acepta_terminos   BOOLEAN     DEFAULT false,
  acepta_privacidad BOOLEAN     DEFAULT false,
  custom_data       JSONB       DEFAULT '{}'::jsonb,
  email_enviado     BOOLEAN     DEFAULT false,
  created_at        TIMESTAMPTZ DEFAULT now()
);

-- Índices útiles
CREATE INDEX IF NOT EXISTS idx_registrations_event   ON registrations(event_id);
CREATE INDEX IF NOT EXISTS idx_registrations_email   ON registrations(email);
CREATE INDEX IF NOT EXISTS idx_registrations_doc     ON registrations(numero_documento);

-- ============================================================
-- Listo. Los demás campos (participants, attendance, feedback)
-- no necesitan cambios — registrations se sincroniza
-- automáticamente con participants al guardarse el registro.
-- ============================================================
