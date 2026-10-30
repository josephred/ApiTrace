-- ============================================================================
-- 0004_fincas_polinizacion
--
-- Acompana el alta de «Finca / Polinizacion» en Carga de datos (doc 14): el
-- campo de un tercero al que el apicultor lleva colmenas a polinizar. La finca
-- ya existia como establecimiento FINCA_POLINIZACION (migracion 0003); ahora
-- se registra con los mismos datos que muestra la pantalla:
--
--   1. Zona: la misma zona del apicultor que agrupa sus apiarios. Borrar la
--      zona deja la finca «sin zona» (ON DELETE SET NULL), como al apiario.
--   2. Colmenas: las que el apicultor lleva a polinizar a esa finca. Solo la
--      finca la usa; el resto de los establecimientos la deja en NULL.
--   3. RENSPA del campo: opcional y tal como lo informa el apicultor. No es un
--      RENSPA propio (ese se asocia con CU-06 en renspa_registration, que es
--      unico en toda la plataforma): varios apicultores pueden llevar colmenas
--      al mismo campo, asi que aca no se exige unicidad. El DT-e lo toma como
--      RENSPA de destino cuando la finca no tiene uno asociado.
--
-- No se completan datos de las fincas ya cargadas: quedan sin zona, sin
-- colmenas informadas y sin RENSPA hasta que alguien los cargue.
--
-- Aditiva e idempotente, como la 0003: columnas, clave foranea, control e
-- indice se crean solo si faltan (la base pudo sincronizarse antes con
-- `drizzle-kit push`). Drizzle aplica las migraciones pendientes en una sola
-- transaccion: por eso esta migracion no usa el valor de enum
-- FINCA_POLINIZACION, que en una base nueva llega en la misma transaccion.
-- ============================================================================

-- 1) Columnas nuevas --------------------------------------------------------
ALTER TABLE "establishment" ADD COLUMN IF NOT EXISTS "zone_id" uuid;--> statement-breakpoint
ALTER TABLE "establishment" ADD COLUMN IF NOT EXISTS "hive_count" integer;--> statement-breakpoint
ALTER TABLE "establishment" ADD COLUMN IF NOT EXISTS "renspa_number" varchar(60);--> statement-breakpoint

-- 2) Clave foranea y control (solo si faltan) -------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'establishment_zone_id_zone_id_fk') THEN
    ALTER TABLE "establishment" ADD CONSTRAINT "establishment_zone_id_zone_id_fk" FOREIGN KEY ("zone_id") REFERENCES "public"."zone"("id") ON DELETE set null ON UPDATE no action;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'establishment_hive_count_ck') THEN
    ALTER TABLE "establishment" ADD CONSTRAINT "establishment_hive_count_ck" CHECK ("establishment"."hive_count" IS NULL OR "establishment"."hive_count" >= 0);
  END IF;
END $$;--> statement-breakpoint

-- 3) Indice de la clave foranea nueva ---------------------------------------
CREATE INDEX IF NOT EXISTS "establishment_zone_idx" ON "establishment" USING btree ("zone_id");
