-- ============================================================================
-- 0002_dte_reparacion
--
-- Lleva el esquema que dejo 0001_dte_api_sem al modelo DT-e API-SEM verificado
-- (docs/plan-dte/09 y 11). 0001 ya pudo haberse aplicado en Neon: no se edita,
-- se corrige aca, hacia adelante y sin perder datos.
--
--   1. movement_rule vuelve a los nombres de columna de 0000_init. El codigo
--      los habia renombrado sin migracion; si la base se sincronizo con
--      `drizzle-kit push`, las columnas se renombran de vuelta.
--   2. Estados del DT-e como enum oficial (ADR-012). Los valores del modelo
--      anterior (DRAFT, ISSUED, APPROVED, CLOSED, REJECTED, CANCELLED) se
--      traducen.
--   3. Fecha de carga y vencimiento como fecha calendario (date), alzas como
--      enteros y codigos API-SEM de la especificacion (API-SEM, 24.45,
--      "Extraccion de miel", "Alzas melarias", UNIDAD).
--   4. Unicidad: un DT-e en juego por movimiento, numero API-SEM unico, RENAPA
--      de apiario y codigo SENASA de sala unicos, una delegacion por servicio.
--   5. Datos: se quitan marcadores inventados (codigo VER-0000, patente
--      AAA000, PDF simulado), se marca SIMULADO lo que emitio el simulador y
--      se completan titularidad, documento e historial.
--
-- Todo lo que no se puede corregir sin una decision humana (duplicados,
-- estados o formatos desconocidos) detiene la migracion con un mensaje que
-- dice que revisar. Antes de desplegar, correr
-- docs/plan-dte/sql/diagnostico-pre-0002.sql contra la base real.
--
-- Es segura sobre tres puntos de partida: 0001 aplicada con el migrador,
-- base sincronizada con `drizzle-kit push`, y base nueva (CI).
-- ============================================================================

-- 1) movement_rule: nombres de 0000_init ------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'movement_rule' AND column_name = 'source_establishment_type')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'movement_rule' AND column_name = 'origin_type') THEN
    ALTER TABLE "movement_rule" RENAME COLUMN "source_establishment_type" TO "origin_type";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'movement_rule' AND column_name = 'destination_establishment_type')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'movement_rule' AND column_name = 'destination_type') THEN
    ALTER TABLE "movement_rule" RENAME COLUMN "destination_establishment_type" TO "destination_type";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'movement_rule' AND column_name = 'legal_basis')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'movement_rule' AND column_name = 'legal_reference') THEN
    ALTER TABLE "movement_rule" RENAME COLUMN "legal_basis" TO "legal_reference";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'movement_rule' AND column_name = 'description') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'movement_rule' AND column_name = 'notes') THEN
      ALTER TABLE "movement_rule" RENAME COLUMN "description" TO "notes";
    ELSE
      UPDATE "movement_rule" SET "notes" = COALESCE("notes", "description");
      ALTER TABLE "movement_rule" DROP COLUMN "description";
    END IF;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'movement_rule' AND column_name = 'origin_type') THEN
    ALTER TABLE "movement_rule" ADD COLUMN "origin_type" "public"."establishment_type";
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'movement_rule' AND column_name = 'destination_type') THEN
    ALTER TABLE "movement_rule" ADD COLUMN "destination_type" "public"."establishment_type";
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'movement_rule' AND column_name = 'legal_reference') THEN
    ALTER TABLE "movement_rule" ADD COLUMN "legal_reference" varchar(300);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'movement_rule' AND column_name = 'notes') THEN
    ALTER TABLE "movement_rule" ADD COLUMN "notes" varchar(1000);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'movement_rule' AND column_name = 'updated_at') THEN
    ALTER TABLE "movement_rule" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;
  END IF;
END $$;--> statement-breakpoint
ALTER TABLE "movement_rule" ALTER COLUMN "name" SET DATA TYPE varchar(200);--> statement-breakpoint
ALTER TABLE "movement_rule" ALTER COLUMN "notes" SET DATA TYPE varchar(1000);--> statement-breakpoint
ALTER TABLE "movement_rule" ALTER COLUMN "legal_reference" SET DATA TYPE varchar(300);--> statement-breakpoint
DROP INDEX IF EXISTS "movement_rule_match_idx";--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "movement_rule_vigencia_idx" ON "movement_rule" USING btree ("active","effective_from","effective_to");--> statement-breakpoint

-- 2) Tipos nuevos ------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE "public"."dte_history_source" AS ENUM('USUARIO', 'SISTEMA', 'SENASA');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "public"."dte_issue_mode" AS ENUM('MANUAL', 'SIMULADO', 'SIGSA');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "public"."senasa_delegation_status" AS ENUM('NO_INICIADA', 'PENDIENTE', 'ACEPTADA', 'REVOCADA', 'RECHAZADA');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "public"."senasa_service" AS ENUM('SIGSA_DTE', 'SITA');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint

-- 3) Estado del DT-e: vocabulario oficial ------------------------------------
ALTER TABLE "dte" ALTER COLUMN "status" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "dte" ALTER COLUMN "status" SET DATA TYPE text USING "status"::text;--> statement-breakpoint
UPDATE "dte" SET "status" = CASE upper(trim("status"))
  WHEN 'DRAFT' THEN 'BORRADOR'
  WHEN 'ISSUED' THEN 'EMITIDO'
  WHEN 'APPROVED' THEN 'EMITIDO'
  WHEN 'CLOSED' THEN 'CERRADO'
  WHEN 'REJECTED' THEN 'RECHAZADO'
  WHEN 'CANCELLED' THEN CASE WHEN "number" IS NULL THEN 'ELIMINADO' ELSE 'ANULADO' END
  ELSE upper(trim("status"))
END;--> statement-breakpoint
DO $$
DECLARE bad text;
BEGIN
  SELECT string_agg(DISTINCT "status", ', ') INTO bad FROM "dte"
  WHERE "status" NOT IN ('BORRADOR', 'SOLICITADO', 'EMITIDO', 'VIGENTE', 'CERRADO', 'VENCIDO', 'CADUCADO', 'SIN_ARRIBO', 'RECHAZADO', 'ANULADO', 'ELIMINADO');
  IF bad IS NOT NULL THEN
    RAISE EXCEPTION '0002_dte_reparacion: la tabla dte tiene estados desconocidos (%). Corregirlos antes de migrar: ver docs/plan-dte/sql/diagnostico-pre-0002.sql, consulta D1.', bad;
  END IF;
END $$;--> statement-breakpoint
ALTER TABLE "dte_status_history" ALTER COLUMN "source" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "dte_status_history" ALTER COLUMN "from_status" SET DATA TYPE text USING "from_status"::text;--> statement-breakpoint
ALTER TABLE "dte_status_history" ALTER COLUMN "to_status" SET DATA TYPE text USING "to_status"::text;--> statement-breakpoint
ALTER TABLE "dte_status_history" ALTER COLUMN "source" SET DATA TYPE text USING "source"::text;--> statement-breakpoint
UPDATE "dte_status_history" SET
  "from_status" = CASE upper(trim("from_status"))
    WHEN 'DRAFT' THEN 'BORRADOR' WHEN 'ISSUED' THEN 'EMITIDO' WHEN 'APPROVED' THEN 'EMITIDO'
    WHEN 'CLOSED' THEN 'CERRADO' WHEN 'REJECTED' THEN 'RECHAZADO' WHEN 'CANCELLED' THEN 'ANULADO'
    ELSE upper(trim("from_status")) END,
  "to_status" = CASE upper(trim("to_status"))
    WHEN 'DRAFT' THEN 'BORRADOR' WHEN 'ISSUED' THEN 'EMITIDO' WHEN 'APPROVED' THEN 'EMITIDO'
    WHEN 'CLOSED' THEN 'CERRADO' WHEN 'REJECTED' THEN 'RECHAZADO' WHEN 'CANCELLED' THEN 'ANULADO'
    ELSE upper(trim("to_status")) END,
  "source" = CASE upper(trim("source"))
    WHEN 'SISTEMA_CRON' THEN 'SISTEMA' WHEN 'CRON' THEN 'SISTEMA' WHEN 'SYSTEM' THEN 'SISTEMA'
    WHEN 'USER' THEN 'USUARIO' WHEN '' THEN 'USUARIO'
    ELSE upper(trim("source")) END;--> statement-breakpoint
DO $$
DECLARE bad text;
BEGIN
  SELECT string_agg(DISTINCT v, ', ') INTO bad FROM (
    SELECT "from_status" AS v FROM "dte_status_history" WHERE "from_status" IS NOT NULL
    UNION SELECT "to_status" FROM "dte_status_history"
  ) s
  WHERE v NOT IN ('BORRADOR', 'SOLICITADO', 'EMITIDO', 'VIGENTE', 'CERRADO', 'VENCIDO', 'CADUCADO', 'SIN_ARRIBO', 'RECHAZADO', 'ANULADO', 'ELIMINADO');
  IF bad IS NOT NULL THEN
    RAISE EXCEPTION '0002_dte_reparacion: el historial del DT-e tiene estados desconocidos (%). Ver docs/plan-dte/sql/diagnostico-pre-0002.sql, consulta D1.', bad;
  END IF;
  SELECT string_agg(DISTINCT "source", ', ') INTO bad FROM "dte_status_history"
  WHERE "source" NOT IN ('USUARIO', 'SISTEMA', 'SENASA');
  IF bad IS NOT NULL THEN
    RAISE EXCEPTION '0002_dte_reparacion: el historial del DT-e tiene origenes desconocidos (%). Ver docs/plan-dte/sql/diagnostico-pre-0002.sql, consulta D1.', bad;
  END IF;
END $$;--> statement-breakpoint
-- El tipo dte_status de 0000 (DRAFT, ISSUED, ...) ya no lo usa ninguna columna.
DROP TYPE IF EXISTS "public"."dte_status";--> statement-breakpoint
CREATE TYPE "public"."dte_status" AS ENUM('BORRADOR', 'SOLICITADO', 'EMITIDO', 'VIGENTE', 'CERRADO', 'VENCIDO', 'CADUCADO', 'SIN_ARRIBO', 'RECHAZADO', 'ANULADO', 'ELIMINADO');--> statement-breakpoint
ALTER TABLE "dte" ALTER COLUMN "status" SET DATA TYPE "public"."dte_status" USING "status"::"public"."dte_status";--> statement-breakpoint
ALTER TABLE "dte" ALTER COLUMN "status" SET DEFAULT 'BORRADOR'::"public"."dte_status";--> statement-breakpoint
ALTER TABLE "dte_status_history" ALTER COLUMN "from_status" SET DATA TYPE "public"."dte_status" USING "from_status"::"public"."dte_status";--> statement-breakpoint
ALTER TABLE "dte_status_history" ALTER COLUMN "to_status" SET DATA TYPE "public"."dte_status" USING "to_status"::"public"."dte_status";--> statement-breakpoint
ALTER TABLE "dte_status_history" ALTER COLUMN "source" SET DATA TYPE "public"."dte_history_source" USING "source"::"public"."dte_history_source";--> statement-breakpoint
ALTER TABLE "dte_status_history" ALTER COLUMN "source" SET DEFAULT 'USUARIO'::"public"."dte_history_source";--> statement-breakpoint

-- 4) Delegaciones SENASA: una por titular y servicio -------------------------
UPDATE "senasa_delegation" SET "service" = upper(trim("service")), "status" = upper(trim("status"));--> statement-breakpoint
DO $$
DECLARE bad text;
BEGIN
  SELECT string_agg(DISTINCT "service", ', ') INTO bad FROM "senasa_delegation" WHERE "service" NOT IN ('SIGSA_DTE', 'SITA');
  IF bad IS NOT NULL THEN
    RAISE EXCEPTION '0002_dte_reparacion: senasa_delegation.service tiene valores desconocidos (%). Ver docs/plan-dte/sql/diagnostico-pre-0002.sql, consulta D2.', bad;
  END IF;
  SELECT string_agg(DISTINCT "status", ', ') INTO bad FROM "senasa_delegation" WHERE "status" NOT IN ('NO_INICIADA', 'PENDIENTE', 'ACEPTADA', 'REVOCADA', 'RECHAZADA');
  IF bad IS NOT NULL THEN
    RAISE EXCEPTION '0002_dte_reparacion: senasa_delegation.status tiene valores desconocidos (%). Ver docs/plan-dte/sql/diagnostico-pre-0002.sql, consulta D2.', bad;
  END IF;
END $$;--> statement-breakpoint
-- Si hay dos registros para el mismo titular y servicio se conserva el ultimo
-- actualizado: describen el mismo hecho en momentos distintos.
DELETE FROM "senasa_delegation" AS "d"
USING "senasa_delegation" AS "newer"
WHERE "newer"."producer_id" = "d"."producer_id"
  AND "newer"."service" = "d"."service"
  AND ("newer"."updated_at", "newer"."id") > ("d"."updated_at", "d"."id");--> statement-breakpoint
ALTER TABLE "senasa_delegation" ALTER COLUMN "status" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "senasa_delegation" ALTER COLUMN "service" SET DATA TYPE "public"."senasa_service" USING "service"::"public"."senasa_service";--> statement-breakpoint
ALTER TABLE "senasa_delegation" ALTER COLUMN "status" SET DATA TYPE "public"."senasa_delegation_status" USING "status"::"public"."senasa_delegation_status";--> statement-breakpoint
ALTER TABLE "senasa_delegation" ALTER COLUMN "status" SET DEFAULT 'NO_INICIADA'::"public"."senasa_delegation_status";--> statement-breakpoint
DROP INDEX IF EXISTS "senasa_delegation_producer_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "senasa_delegation_status_idx";--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "senasa_delegation" ADD CONSTRAINT "senasa_delegation_producer_service_uq" UNIQUE("producer_id","service");
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;--> statement-breakpoint
ALTER TABLE "senasa_delegation" DROP CONSTRAINT IF EXISTS "senasa_delegation_producer_id_producer_id_fk";--> statement-breakpoint
ALTER TABLE "senasa_delegation" ADD CONSTRAINT "senasa_delegation_producer_id_producer_id_fk" FOREIGN KEY ("producer_id") REFERENCES "public"."producer"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint

-- 5) Codigos oficiales de origen (apiario) y destino (sala) -----------------
UPDATE "apiary" SET
  "renapa_code" = NULLIF(upper(regexp_replace(coalesce("renapa_code", ''), '\s+', '', 'g')), ''),
  "renapa_status" = CASE upper(trim(coalesce("renapa_status", '')))
    WHEN '' THEN 'PENDING_VERIFICATION' WHEN 'SIN VERIFICAR' THEN 'PENDING_VERIFICATION'
    WHEN 'ACTIVO' THEN 'ACTIVE' WHEN 'ACTIVA' THEN 'ACTIVE' WHEN 'HABILITADO' THEN 'ACTIVE' WHEN 'HABILITADA' THEN 'ACTIVE'
    WHEN 'SUSPENDIDO' THEN 'SUSPENDED' WHEN 'SUSPENDIDA' THEN 'SUSPENDED'
    WHEN 'VENCIDO' THEN 'EXPIRED' WHEN 'VENCIDA' THEN 'EXPIRED'
    WHEN 'BAJA' THEN 'CANCELLED' WHEN 'DADO DE BAJA' THEN 'CANCELLED'
    ELSE upper(trim("renapa_status")) END;--> statement-breakpoint
UPDATE "establishment" SET
  "senasa_code" = NULLIF(upper(regexp_replace(coalesce("senasa_code", ''), '\s+', '', 'g')), ''),
  "senasa_status" = CASE upper(trim(coalesce("senasa_status", '')))
    WHEN '' THEN 'PENDING_VERIFICATION' WHEN 'SIN VERIFICAR' THEN 'PENDING_VERIFICATION'
    WHEN 'ACTIVO' THEN 'ACTIVE' WHEN 'ACTIVA' THEN 'ACTIVE' WHEN 'HABILITADO' THEN 'ACTIVE' WHEN 'HABILITADA' THEN 'ACTIVE'
    WHEN 'SUSPENDIDO' THEN 'SUSPENDED' WHEN 'SUSPENDIDA' THEN 'SUSPENDED'
    WHEN 'VENCIDO' THEN 'EXPIRED' WHEN 'VENCIDA' THEN 'EXPIRED'
    WHEN 'BAJA' THEN 'CANCELLED' WHEN 'DADO DE BAJA' THEN 'CANCELLED'
    ELSE upper(trim("senasa_status")) END;--> statement-breakpoint
DO $$
DECLARE bad text;
BEGIN
  SELECT string_agg(DISTINCT "renapa_status", ', ') INTO bad FROM "apiary"
  WHERE "renapa_status" NOT IN ('PENDING_VERIFICATION', 'ACTIVE', 'SUSPENDED', 'EXPIRED', 'CANCELLED');
  IF bad IS NOT NULL THEN
    RAISE EXCEPTION '0002_dte_reparacion: apiary.renapa_status tiene valores desconocidos (%). Ver docs/plan-dte/sql/diagnostico-pre-0002.sql, consulta D3.', bad;
  END IF;
  SELECT string_agg(DISTINCT "senasa_status", ', ') INTO bad FROM "establishment"
  WHERE "senasa_status" NOT IN ('PENDING_VERIFICATION', 'ACTIVE', 'SUSPENDED', 'EXPIRED', 'CANCELLED');
  IF bad IS NOT NULL THEN
    RAISE EXCEPTION '0002_dte_reparacion: establishment.senasa_status tiene valores desconocidos (%). Ver docs/plan-dte/sql/diagnostico-pre-0002.sql, consulta D3.', bad;
  END IF;
  SELECT string_agg("renapa_code", ', ') INTO bad FROM (
    SELECT "renapa_code" FROM "apiary" WHERE "renapa_code" IS NOT NULL GROUP BY "renapa_code" HAVING count(*) > 1
  ) d;
  IF bad IS NOT NULL THEN
    RAISE EXCEPTION '0002_dte_reparacion: hay codigos RENAPA repetidos entre apiarios (%). Cada apiario tiene el suyo. Ver docs/plan-dte/sql/diagnostico-pre-0002.sql, consulta D4.', bad;
  END IF;
  SELECT string_agg("senasa_code", ', ') INTO bad FROM (
    SELECT "senasa_code" FROM "establishment" WHERE "senasa_code" IS NOT NULL GROUP BY "senasa_code" HAVING count(*) > 1
  ) d;
  IF bad IS NOT NULL THEN
    RAISE EXCEPTION '0002_dte_reparacion: hay codigos SENASA repetidos entre establecimientos (%). Ver docs/plan-dte/sql/diagnostico-pre-0002.sql, consulta D4.', bad;
  END IF;
END $$;--> statement-breakpoint
ALTER TABLE "apiary" ALTER COLUMN "renapa_status" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "apiary" ALTER COLUMN "renapa_status" SET DATA TYPE "public"."registration_status" USING "renapa_status"::"public"."registration_status";--> statement-breakpoint
ALTER TABLE "apiary" ALTER COLUMN "renapa_status" SET DEFAULT 'PENDING_VERIFICATION'::"public"."registration_status";--> statement-breakpoint
ALTER TABLE "establishment" ALTER COLUMN "senasa_status" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "establishment" ALTER COLUMN "senasa_status" SET DATA TYPE "public"."registration_status" USING "senasa_status"::"public"."registration_status";--> statement-breakpoint
ALTER TABLE "establishment" ALTER COLUMN "senasa_status" SET DEFAULT 'PENDING_VERIFICATION'::"public"."registration_status";--> statement-breakpoint
-- Vigencias: 0001 las guardo como texto. Se aceptan AAAA-MM-DD y DD/MM/AAAA.
-- Cada valor se valida antes de convertir la columna: una fecha imposible
-- (31/02/2026) detiene la migracion mostrando el valor a corregir, no con un
-- error generico de PostgreSQL.
DO $$
DECLARE
  bad text;
  target record;
  item record;
BEGIN
  FOR target IN
    SELECT * FROM (VALUES ('apiary', 'renapa_valid_to'), ('establishment', 'senasa_valid_to')) AS t(tbl, col)
  LOOP
    IF (SELECT data_type FROM information_schema.columns WHERE table_schema = 'public' AND table_name = target.tbl AND column_name = target.col) <> 'date' THEN
      bad := NULL;
      FOR item IN EXECUTE format(
        'SELECT trim(%1$I) AS v FROM %2$I WHERE %1$I IS NOT NULL AND trim(%1$I) <> ''''',
        target.col, target.tbl
      ) LOOP
        BEGIN
          IF item.v ~ '^\d{4}-\d{2}-\d{2}$' THEN
            PERFORM item.v::date;
          ELSIF item.v ~ '^\d{2}/\d{2}/\d{4}$' THEN
            PERFORM to_date(item.v, 'DD/MM/YYYY');
          ELSE
            bad := concat_ws(', ', bad, item.v);
          END IF;
        EXCEPTION WHEN others THEN
          bad := concat_ws(', ', bad, item.v);
        END;
      END LOOP;
      IF bad IS NOT NULL THEN
        RAISE EXCEPTION '0002_dte_reparacion: %.% tiene fechas invalidas o con formato desconocido (%). Ver docs/plan-dte/sql/diagnostico-pre-0002.sql, consulta D3.', target.tbl, target.col, bad;
      END IF;
      EXECUTE format(
        'ALTER TABLE %2$I ALTER COLUMN %1$I SET DATA TYPE date USING CASE WHEN trim(%1$I) ~ ''^\d{4}-\d{2}-\d{2}$'' THEN trim(%1$I)::date WHEN trim(%1$I) ~ ''^\d{2}/\d{2}/\d{4}$'' THEN to_date(trim(%1$I), ''DD/MM/YYYY'') ELSE NULL END',
        target.col, target.tbl
      );
    END IF;
  END LOOP;
END $$;--> statement-breakpoint
DROP INDEX IF EXISTS "apiary_renapa_code_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "establishment_senasa_code_idx";--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "apiary_renapa_code_uq" ON "apiary" USING btree ("renapa_code");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "establishment_senasa_code_uq" ON "establishment" USING btree ("senasa_code");--> statement-breakpoint

-- 6) DT-e: tipos del tramite API-SEM ----------------------------------------
-- Fechas de carga y vencimiento: dias calendario argentinos, no instantes.
-- 0001 las guardo como timestamptz a partir de un texto AAAA-MM-DD, es decir a
-- la medianoche de la zona de la sesion. Sumar 12 horas antes de tomar la
-- fecha UTC recupera el dia cargado para cualquier zona entre UTC-12 y UTC+11.
DO $$
DECLARE
  col text;
  kind text;
  bad text;
  item record;
BEGIN
  FOREACH col IN ARRAY ARRAY['load_date', 'expiry_date'] LOOP
    SELECT data_type INTO kind FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'dte' AND column_name = col;
    IF kind = 'timestamp with time zone' THEN
      EXECUTE format('ALTER TABLE "dte" ALTER COLUMN %1$I SET DATA TYPE date USING ((%1$I AT TIME ZONE ''UTC'') + interval ''12 hours'')::date', col);
    ELSIF kind IN ('character varying', 'text') THEN
      -- Base sincronizada con drizzle-kit push: la fecha es texto AAAA-MM-DD.
      bad := NULL;
      FOR item IN EXECUTE format('SELECT trim(%1$I) AS v FROM "dte" WHERE %1$I IS NOT NULL AND trim(%1$I) <> ''''', col) LOOP
        BEGIN
          IF item.v ~ '^\d{4}-\d{2}-\d{2}' THEN
            PERFORM substring(item.v from 1 for 10)::date;
          ELSE
            bad := concat_ws(', ', bad, item.v);
          END IF;
        EXCEPTION WHEN others THEN
          bad := concat_ws(', ', bad, item.v);
        END;
      END LOOP;
      IF bad IS NOT NULL THEN
        RAISE EXCEPTION '0002_dte_reparacion: dte.% tiene fechas invalidas (%). Ver docs/plan-dte/sql/diagnostico-pre-0002.sql, consulta D5.', col, bad;
      END IF;
      EXECUTE format('ALTER TABLE "dte" ALTER COLUMN %1$I SET DATA TYPE date USING CASE WHEN trim(%1$I) ~ ''^\d{4}-\d{2}-\d{2}'' THEN substring(trim(%1$I) from 1 for 10)::date ELSE NULL END', col);
    END IF;
  END LOOP;
END $$;--> statement-breakpoint
-- Alzas: unidades enteras (las medias y 3/4 alzas cuentan como una).
ALTER TABLE "dte" ALTER COLUMN "estimated_quantity" SET DATA TYPE integer USING round("estimated_quantity")::integer;--> statement-breakpoint
ALTER TABLE "dte" ALTER COLUMN "declared_quantity" SET DATA TYPE integer USING round("declared_quantity")::integer;--> statement-breakpoint
ALTER TABLE "dte" ALTER COLUMN "confirmed_quantity" SET DATA TYPE integer USING round("confirmed_quantity")::integer;--> statement-breakpoint
-- Sin valores por defecto inventados: los campos del tramite los fija el servicio.
ALTER TABLE "dte" ALTER COLUMN "unit" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "dte" ALTER COLUMN "unit" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "dte" ALTER COLUMN "movement_type_code" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "dte" ALTER COLUMN "movement_type_code" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "dte" ALTER COLUMN "transit_reason" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "dte" ALTER COLUMN "transit_reason" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "dte" ALTER COLUMN "product_code" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "dte" ALTER COLUMN "product_code" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "dte" ALTER COLUMN "product_name" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "dte" ALTER COLUMN "product_name" DROP NOT NULL;--> statement-breakpoint
-- API-SEM son los DT-e que tienen fecha de carga (los que creo el modulo DT-e);
-- los anteriores quedan como documentos genericos, sin vigencia retroactiva.
UPDATE "dte" SET
  "movement_type_code" = 'API-SEM',
  "transit_reason" = 'Extracción de miel',
  "product_code" = '24.45',
  "product_name" = 'Alzas melarias',
  "unit" = 'UNIDAD'
WHERE "load_date" IS NOT NULL;--> statement-breakpoint
UPDATE "dte" SET
  "movement_type_code" = NULL,
  "transit_reason" = NULL,
  "product_code" = NULL,
  "product_name" = NULL,
  "unit" = NULL,
  "origin_code" = NULL,
  "destination_code" = NULL
WHERE "load_date" IS NULL;--> statement-breakpoint
-- Origen oficial = RENAPA del apiario; destino oficial = codigo SENASA de la
-- sala. 0001 guardaba el nombre del predio como origen.
UPDATE "dte" AS "d" SET
  "origin_code" = (
    SELECT "a"."renapa_code" FROM "movement" AS "m"
    JOIN "apiary" AS "a" ON "a"."id" = "m"."origin_apiary_id"
    WHERE "m"."id" = "d"."movement_id"
  ),
  "destination_code" = (
    SELECT "e"."senasa_code" FROM "movement" AS "m"
    JOIN "establishment" AS "e" ON "e"."id" = "m"."destination_establishment_id"
    WHERE "m"."id" = "d"."movement_id"
  )
WHERE "d"."movement_type_code" = 'API-SEM';--> statement-breakpoint
-- Canal de emision: el simulador de 0001 marcaba sus DT-e como MANUAL.
ALTER TABLE "dte" ALTER COLUMN "issue_mode" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "dte" ALTER COLUMN "issue_mode" SET DATA TYPE text USING "issue_mode"::text;--> statement-breakpoint
UPDATE "dte" SET "issue_mode" = CASE
  WHEN "external_id" LIKE 'SIGSA-SIM-%' OR "external_id" LIKE 'SIM-%' THEN 'SIMULADO'
  WHEN upper(trim("issue_mode")) IN ('MANUAL', 'SIMULADO', 'SIGSA') THEN upper(trim("issue_mode"))
  ELSE 'MANUAL'
END;--> statement-breakpoint
ALTER TABLE "dte" ALTER COLUMN "issue_mode" SET DATA TYPE "public"."dte_issue_mode" USING "issue_mode"::"public"."dte_issue_mode";--> statement-breakpoint
ALTER TABLE "dte" ALTER COLUMN "issue_mode" SET DEFAULT 'MANUAL'::"public"."dte_issue_mode";--> statement-breakpoint
-- El PDF "simulado" de 0001 apuntaba a una direccion que no existe.
UPDATE "dte" SET "pdf_url" = NULL WHERE "issue_mode" = 'SIMULADO' OR "pdf_url" LIKE '%/static/dte/simulado/%';--> statement-breakpoint
-- Un numero cargado a mano no se verifico contra SIGSA: no esta sincronizado.
UPDATE "dte" SET "sync_status" = 'PENDING_SYNC'
WHERE "issue_mode" = 'MANUAL' AND "number" IS NOT NULL AND "external_id" IS NULL AND "sync_status" = 'SYNCHRONIZED';--> statement-breakpoint
-- Marcadores inventados por la ruta heredada de 0001: no son datos reales.
UPDATE "dte" SET "verification_code" = NULL WHERE "verification_code" = 'VER-0000';--> statement-breakpoint
UPDATE "dte" SET
  "transport_plate" = NULLIF(upper(regexp_replace(coalesce("transport_plate", ''), '[\s.\-_]', '', 'g')), ''),
  "transport_trailer_plate" = NULLIF(upper(regexp_replace(coalesce("transport_trailer_plate", ''), '[\s.\-_]', '', 'g')), '');--> statement-breakpoint
UPDATE "dte" SET "transport_plate" = NULL WHERE "transport_plate" IN ('AAA000', 'NO', 'SIN');--> statement-breakpoint
UPDATE "dte" SET "transport_trailer_plate" = NULL WHERE "transport_trailer_plate" IN ('AAA000', 'NO', 'SIN');--> statement-breakpoint
-- Tipo de vehiculo (Camion, Camioneta, Furgon...). 0001 guardaba quien era el
-- dueno del transporte (PROPIO, CONTRATADO), que no es lo que pide SIGSA.
UPDATE "dte" SET "transport_type" = NULL
WHERE "transport_type" IS NOT NULL AND upper(trim("transport_type")) NOT IN ('CAMION', 'CAMIONETA', 'FURGON', 'UTILITARIO', 'OTRO');--> statement-breakpoint
UPDATE "dte" SET "transport_type" = upper(trim("transport_type")) WHERE "transport_type" IS NOT NULL;--> statement-breakpoint
DO $$
DECLARE bad text;
BEGIN
  SELECT string_agg("id"::text, ', ') INTO bad FROM "dte"
  WHERE length("verification_code") > 20 OR length("transport_plate") > 15 OR length("transport_trailer_plate") > 15
     OR length("origin_code") > 40 OR length("destination_code") > 40;
  IF bad IS NOT NULL THEN
    RAISE EXCEPTION '0002_dte_reparacion: DT-e con codigos o patentes demasiado largos (%). Ver docs/plan-dte/sql/diagnostico-pre-0002.sql, consulta D5.', bad;
  END IF;
END $$;--> statement-breakpoint
ALTER TABLE "dte" ALTER COLUMN "verification_code" SET DATA TYPE varchar(20);--> statement-breakpoint
ALTER TABLE "dte" ALTER COLUMN "transport_plate" SET DATA TYPE varchar(15);--> statement-breakpoint
ALTER TABLE "dte" ALTER COLUMN "transport_trailer_plate" SET DATA TYPE varchar(15);--> statement-breakpoint
ALTER TABLE "dte" ALTER COLUMN "origin_code" SET DATA TYPE varchar(40);--> statement-breakpoint
ALTER TABLE "dte" ALTER COLUMN "destination_code" SET DATA TYPE varchar(40);--> statement-breakpoint
ALTER TABLE "dte" ALTER COLUMN "unit" SET DATA TYPE varchar(20);--> statement-breakpoint
ALTER TABLE "dte" ALTER COLUMN "movement_type_code" SET DATA TYPE varchar(20);--> statement-breakpoint
ALTER TABLE "dte" ALTER COLUMN "transit_reason" SET DATA TYPE varchar(80);--> statement-breakpoint
ALTER TABLE "dte" ALTER COLUMN "product_code" SET DATA TYPE varchar(20);--> statement-breakpoint
ALTER TABLE "dte" ALTER COLUMN "product_name" SET DATA TYPE varchar(80);--> statement-breakpoint
ALTER TABLE "dte" ALTER COLUMN "transport_type" SET DATA TYPE varchar(40);--> statement-breakpoint
UPDATE "dte" SET "fee_paid" = false WHERE "fee_paid" IS NULL;--> statement-breakpoint
ALTER TABLE "dte" ALTER COLUMN "fee_paid" SET DEFAULT false;--> statement-breakpoint
ALTER TABLE "dte" ALTER COLUMN "fee_paid" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "dte" ADD COLUMN IF NOT EXISTS "replaces_dte_id" uuid;--> statement-breakpoint

-- 7) Claves foraneas ---------------------------------------------------------
-- Si una organizacion se elimina, el DT-e (documento sanitario) se conserva.
ALTER TABLE "dte" DROP CONSTRAINT IF EXISTS "dte_issuer_organization_id_organization_id_fk";--> statement-breakpoint
ALTER TABLE "dte" ADD CONSTRAINT "dte_issuer_organization_id_organization_id_fk" FOREIGN KEY ("issuer_organization_id") REFERENCES "public"."organization"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dte" DROP CONSTRAINT IF EXISTS "dte_destination_organization_id_organization_id_fk";--> statement-breakpoint
ALTER TABLE "dte" ADD CONSTRAINT "dte_destination_organization_id_organization_id_fk" FOREIGN KEY ("destination_organization_id") REFERENCES "public"."organization"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dte" DROP CONSTRAINT IF EXISTS "dte_holder_producer_id_producer_id_fk";--> statement-breakpoint
ALTER TABLE "dte" ADD CONSTRAINT "dte_holder_producer_id_producer_id_fk" FOREIGN KEY ("holder_producer_id") REFERENCES "public"."producer"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dte" DROP CONSTRAINT IF EXISTS "dte_replaces_dte_id_dte_id_fk";--> statement-breakpoint
ALTER TABLE "dte" ADD CONSTRAINT "dte_replaces_dte_id_dte_id_fk" FOREIGN KEY ("replaces_dte_id") REFERENCES "public"."dte"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dte_status_history" DROP CONSTRAINT IF EXISTS "dte_status_history_dte_id_dte_id_fk";--> statement-breakpoint
ALTER TABLE "dte_status_history" ADD CONSTRAINT "dte_status_history_dte_id_dte_id_fk" FOREIGN KEY ("dte_id") REFERENCES "public"."dte"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint

-- 7b) Un solo DT-e en juego por movimiento --------------------------------
-- 0001 permitia preparar un DT-e nuevo aunque el movimiento ya tuviera uno
-- (vencido, cerrado o registrado antes de 0001). Lo que no tiene existencia
-- oficial (un borrador sin numero o una emision SIMULADA) y compite con otro
-- DT-e del mismo movimiento se elimina: se conserva el que tiene numero real
-- o, si no hay ninguno, el mas reciente. Si despues de esto quedan dos DT-e
-- en juego con numero real, la migracion se detiene en el paso 9.
WITH "duplicados" AS (
  SELECT "d"."id", "d"."status" FROM "dte" AS "d"
  WHERE "d"."status" NOT IN ('ANULADO', 'ELIMINADO', 'RECHAZADO')
    AND (("d"."number" IS NULL AND "d"."status" IN ('BORRADOR', 'SOLICITADO')) OR "d"."issue_mode" = 'SIMULADO')
    AND EXISTS (
      SELECT 1 FROM "dte" AS "o"
      WHERE "o"."movement_id" = "d"."movement_id"
        AND "o"."id" <> "d"."id"
        AND "o"."status" NOT IN ('ANULADO', 'ELIMINADO', 'RECHAZADO')
        AND (
          ("o"."number" IS NOT NULL AND "o"."issue_mode" <> 'SIMULADO')
          OR ("o"."created_at", "o"."id") > ("d"."created_at", "d"."id")
        )
    )
), "eliminados" AS (
  UPDATE "dte" SET
    "status" = 'ELIMINADO',
    "voided_at" = now(),
    "void_reason" = 'DT-e sin validez oficial (borrador o simulado) duplicado: otro DT-e ya amparaba el mismo movimiento (migracion 0002).',
    "updated_at" = now()
  FROM "duplicados"
  WHERE "dte"."id" = "duplicados"."id"
  RETURNING "dte"."id", "duplicados"."status" AS "previo"
)
INSERT INTO "dte_status_history" ("dte_id", "from_status", "to_status", "source", "reason", "occurred_at")
SELECT "id", "previo", 'ELIMINADO', 'SISTEMA', 'DT-e sin validez oficial (borrador o simulado) duplicado: otro DT-e ya amparaba el mismo movimiento (migracion 0002).', now()
FROM "eliminados";--> statement-breakpoint

-- 8) Titularidad, documento e historial de los DT-e existentes ---------------
UPDATE "dte" SET
  "issuer_organization_id" = COALESCE("dte"."issuer_organization_id", "eo"."organization_id"),
  "destination_organization_id" = COALESCE("dte"."destination_organization_id", "ed"."organization_id"),
  "holder_producer_id" = COALESCE("dte"."holder_producer_id", "eo"."producer_id")
FROM "movement" "m"
JOIN "establishment" "eo" ON "eo"."id" = "m"."origin_establishment_id"
JOIN "establishment" "ed" ON "ed"."id" = "m"."destination_establishment_id"
WHERE "m"."id" = "dte"."movement_id";--> statement-breakpoint
UPDATE "dte" SET "holder_tax_id" = "p"."tax_id"
FROM "producer" "p"
WHERE "p"."id" = "dte"."holder_producer_id" AND "dte"."holder_tax_id" IS NULL;--> statement-breakpoint
-- Documento asociado: el modelo lo busca por metadata.dteId.
UPDATE "document" AS "doc" SET "metadata" = COALESCE("doc"."metadata", '{}'::jsonb) || jsonb_build_object('dteId', "d"."id")
FROM "dte" AS "d"
WHERE "doc"."type" = 'DTE'
  AND "doc"."movement_id" = "d"."movement_id"
  AND ("doc"."metadata" IS NULL OR NOT ("doc"."metadata" ? 'dteId'))
  AND (SELECT count(*) FROM "dte" AS "other" WHERE "other"."movement_id" = "d"."movement_id") = 1;--> statement-breakpoint
INSERT INTO "document" ("type", "number", "movement_id", "issued_at", "external_system", "external_id", "metadata", "created_at")
SELECT 'DTE', "d"."number", "d"."movement_id", "d"."issued_at", 'SENASA_SIGSA', "d"."external_id", jsonb_build_object('dteId', "d"."id"), "d"."created_at"
FROM "dte" AS "d"
WHERE NOT EXISTS (
  SELECT 1 FROM "document" AS "doc" WHERE "doc"."type" = 'DTE' AND "doc"."metadata" ->> 'dteId' = "d"."id"::text
);--> statement-breakpoint
INSERT INTO "dte_status_history" ("dte_id", "from_status", "to_status", "source", "reason", "occurred_at")
SELECT "d"."id", NULL, "d"."status", 'SISTEMA', 'Estado registrado al reparar el modelo del DT-e (migracion 0002).', "d"."updated_at"
FROM "dte" AS "d"
WHERE NOT EXISTS (SELECT 1 FROM "dte_status_history" AS "h" WHERE "h"."dte_id" = "d"."id");--> statement-breakpoint

-- 9) Indices y unicidad ------------------------------------------------------
DO $$
DECLARE bad text;
BEGIN
  SELECT string_agg("movement_id"::text, ', ') INTO bad FROM (
    SELECT "movement_id" FROM "dte"
    WHERE "status" NOT IN ('ANULADO', 'ELIMINADO', 'RECHAZADO')
    GROUP BY "movement_id" HAVING count(*) > 1
  ) d;
  IF bad IS NOT NULL THEN
    RAISE EXCEPTION '0002_dte_reparacion: movimientos con mas de un DT-e en juego (%). Solo uno puede amparar el traslado. Ver docs/plan-dte/sql/diagnostico-pre-0002.sql, consulta D6.', bad;
  END IF;
  SELECT string_agg("number", ', ') INTO bad FROM (
    SELECT "number" FROM "dte"
    WHERE "number" IS NOT NULL AND "movement_type_code" = 'API-SEM'
    GROUP BY "number" HAVING count(*) > 1
  ) d;
  IF bad IS NOT NULL THEN
    RAISE EXCEPTION '0002_dte_reparacion: numeros de DT-e repetidos (%). Ver docs/plan-dte/sql/diagnostico-pre-0002.sql, consulta D6.', bad;
  END IF;
END $$;--> statement-breakpoint
DROP INDEX IF EXISTS "dte_issuer_org_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "dte_destination_org_idx";--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "dte_movement_idx" ON "dte" USING btree ("movement_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "dte_status_sync_idx" ON "dte" USING btree ("status","sync_status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "dte_number_idx" ON "dte" USING btree ("number");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "dte_issuer_org_status_idx" ON "dte" USING btree ("issuer_organization_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "dte_destination_org_status_idx" ON "dte" USING btree ("destination_organization_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "dte_holder_status_idx" ON "dte" USING btree ("holder_producer_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "dte_load_date_idx" ON "dte" USING btree ("load_date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "dte_status_history_dte_idx" ON "dte_status_history" USING btree ("dte_id","occurred_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "dte_movement_active_uq" ON "dte" USING btree ("movement_id") WHERE status NOT IN ('ANULADO', 'ELIMINADO', 'RECHAZADO');--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "dte_api_sem_number_uq" ON "dte" USING btree ("number") WHERE number IS NOT NULL AND movement_type_code = 'API-SEM';
