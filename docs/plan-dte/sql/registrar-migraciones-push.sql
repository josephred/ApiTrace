-- =============================================================================
-- registrar-migraciones-push.sql
--
-- SOLO para una base creada o sincronizada con `drizzle-kit push` (npm run
-- db:push). Se reconoce porque la consulta D0a de diagnostico-pre-0002.sql
-- falla con: relation "drizzle.__drizzle_migrations" does not exist.
--
-- Por que hace falta: `push` crea las tablas sin registrar migraciones. Al
-- desplegar, el migrador (npm run start:render) intentaria aplicar 0000_init
-- desde cero y fallaria con "type ... already exists". Este script registra
-- 0000_init y 0001_dte_api_sem como aplicadas, para que el migrador aplique
-- solo 0002_dte_reparacion, que lleva el esquema de push al modelo correcto
-- (renombra columnas, convierte tipos y repara datos).
--
-- Como correrlo: Neon > SQL Editor > pegar TODO el archivo > Run. Es una
-- transaccion: si una guardia falla, no cambia nada.
--
-- Hashes: sha256 de backend/drizzle/0000_init.sql y 0001_dte_api_sem.sql tal
-- como estan en el repositorio. El migrador solo compara created_at; el hash es
-- informativo.
-- =============================================================================
BEGIN;

CREATE SCHEMA IF NOT EXISTS drizzle;

CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
  id SERIAL PRIMARY KEY,
  hash text NOT NULL,
  created_at bigint
);

DO $$
BEGIN
  IF to_regclass('public.dte') IS NULL OR to_regclass('public.movement_rule') IS NULL THEN
    RAISE EXCEPTION 'La base no tiene las tablas de ApiTrace: no es una base sincronizada con push. No correr este script (el migrador crea todo solo).';
  END IF;
  IF EXISTS (SELECT 1 FROM drizzle.__drizzle_migrations) THEN
    RAISE EXCEPTION 'drizzle.__drizzle_migrations ya tiene filas: la base usa el migrador. No correr este script.';
  END IF;
END $$;

INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES
  ('9c6b798a991a0661a1ffd449f7ecb094cb253373dc970f0746d315d7f1cc2be9', 1787677742317), -- 0000_init
  ('88d6d4f5da8d25419bb876e9a131370191bb5605f9477f3eb771d765b3cebf08', 1787677842317); -- 0001_dte_api_sem

SELECT id, hash, created_at FROM drizzle.__drizzle_migrations ORDER BY created_at;

COMMIT;
