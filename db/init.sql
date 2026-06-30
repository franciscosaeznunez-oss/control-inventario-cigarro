CREATE TABLE IF NOT EXISTS inventario (
  codigo TEXT PRIMARY KEY,
  nombre TEXT NOT NULL,
  costo  INTEGER NOT NULL DEFAULT 0,
  venta  INTEGER NOT NULL DEFAULT 0,
  stock  INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS ventas (
  id       TEXT PRIMARY KEY,
  ts       TIMESTAMPTZ NOT NULL,
  codigo   TEXT NOT NULL,
  nombre   TEXT NOT NULL,
  precio   INTEGER NOT NULL,
  costo    INTEGER NOT NULL DEFAULT 0,
  cantidad INTEGER NOT NULL DEFAULT 1,
  turno    TEXT NOT NULL,
  turno_id TEXT NOT NULL
);
ALTER TABLE ventas ADD COLUMN IF NOT EXISTS cantidad INTEGER NOT NULL DEFAULT 1;

CREATE TABLE IF NOT EXISTS turnos (
  id           TEXT PRIMARY KEY,
  tipo         TEXT NOT NULL,
  inicio       TIMESTAMPTZ NOT NULL,
  fin          TIMESTAMPTZ,
  stock_inicio JSONB NOT NULL DEFAULT '[]'
);

CREATE TABLE IF NOT EXISTS turno_activo (
  id           TEXT PRIMARY KEY DEFAULT 'singleton',
  turno_id     TEXT,
  tipo         TEXT,
  inicio       TIMESTAMPTZ,
  stock_inicio JSONB NOT NULL DEFAULT '[]'
);

INSERT INTO turno_activo (id) VALUES ('singleton') ON CONFLICT DO NOTHING;
