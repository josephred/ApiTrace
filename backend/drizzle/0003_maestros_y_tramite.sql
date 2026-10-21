-- ============================================================================
-- 0003_maestros_y_tramite
--
-- Acompana el rediseno de las pantallas (doc 13): alta de cuenta del
-- apicultor, maestros de datos (apiarios, salas, transportes) y el asistente
-- «Nuevo tramite DT-e» de cinco pasos.
--
--   1. Cuenta: se entra con el correo o con la CUIT. «Creá tu cuenta» pide
--      nombre, CUIT, RENAPA y contrasena: el correo pasa a ser opcional y la
--      CUIT (11 digitos, sin guiones) identifica la cuenta. Al menos uno de los
--      dos tiene que existir.
--   2. Zonas: el apicultor agrupa sus apiarios por zona. Cada organizacion
--      tiene las suyas; el nombre no se repite sin importar mayusculas.
--   3. Fotos: tabla media_file (bytea) para la foto del apiario, de la sala y
--      del transporte, con miniatura. Tope de 3 MB por foto, ya comprimida en
--      el telefono.
--   4. Ubicaciones: el establecimiento suma FINCA_POLINIZACION (el campo al que
--      se llevan colmenas a polinizar); FRACCIONADORA ya era la sala de
--      fraccionamiento y DEPOSITO el deposito. El material suma REINA.
--   5. Transportes: el vehiculo pasa a pertenecer a una organizacion (la
--      transportista es opcional), lleva conductor y nombre, y la patente es
--      unica dentro de cada organizacion en lugar de en toda la plataforma.
--   6. Tramite: el movimiento guarda lo que se transporta (cargo_type: alzas,
--      colmenas, nucleos, tambores, frascos o reinas) y el apiario de destino
--      cuando las colmenas van de un apiario a otro.
--
-- Drizzle aplica las migraciones pendientes en una sola transaccion: los
-- valores de enum agregados aca (FINCA_POLINIZACION, REINA) no se usan en esta
-- misma migracion, porque PostgreSQL no lo permite hasta confirmarla.
--
-- Todo es aditivo y se puede volver a correr: tablas, columnas, indices y
-- restricciones se crean solo si faltan (la base pudo sincronizarse antes con
-- `drizzle-kit push`).
-- ============================================================================

-- 1) Enums ------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'cargo_type') THEN
    CREATE TYPE "public"."cargo_type" AS ENUM('ALZAS', 'COLMENAS', 'NUCLEOS', 'TAMBORES', 'FRASCOS', 'REINAS');
  END IF;
END $$;--> statement-breakpoint
ALTER TYPE "public"."establishment_type" ADD VALUE IF NOT EXISTS 'FINCA_POLINIZACION';--> statement-breakpoint
ALTER TYPE "public"."material_type" ADD VALUE IF NOT EXISTS 'REINA';--> statement-breakpoint

-- 2) Fotos y zonas ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS "media_file" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid,
	"entity_type" varchar(40) NOT NULL,
	"content_type" varchar(60) NOT NULL,
	"data" bytea NOT NULL,
	"thumbnail" bytea,
	"byte_size" integer NOT NULL,
	"width" integer,
	"height" integer,
	"created_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "media_file_size_ck" CHECK ("media_file"."byte_size" > 0 AND "media_file"."byte_size" <= 3145728),
	CONSTRAINT "media_file_content_type_ck" CHECK ("media_file"."content_type" IN ('image/jpeg', 'image/png', 'image/webp'))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "zone" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" varchar(120) NOT NULL,
	"created_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

-- 3) Columnas nuevas --------------------------------------------------------
ALTER TABLE "app_user" ALTER COLUMN "email" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "app_user" ADD COLUMN IF NOT EXISTS "tax_id" varchar(11);--> statement-breakpoint
ALTER TABLE "establishment" ADD COLUMN IF NOT EXISTS "photo_id" uuid;--> statement-breakpoint
ALTER TABLE "apiary" ADD COLUMN IF NOT EXISTS "zone_id" uuid;--> statement-breakpoint
ALTER TABLE "apiary" ADD COLUMN IF NOT EXISTS "photo_id" uuid;--> statement-breakpoint
ALTER TABLE "vehicle" ALTER COLUMN "carrier_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "vehicle" ADD COLUMN IF NOT EXISTS "organization_id" uuid;--> statement-breakpoint
ALTER TABLE "vehicle" ADD COLUMN IF NOT EXISTS "name" varchar(80);--> statement-breakpoint
ALTER TABLE "vehicle" ADD COLUMN IF NOT EXISTS "driver_name" varchar(160);--> statement-breakpoint
ALTER TABLE "vehicle" ADD COLUMN IF NOT EXISTS "created_by_id" uuid;--> statement-breakpoint
ALTER TABLE "movement" ADD COLUMN IF NOT EXISTS "destination_apiary_id" uuid;--> statement-breakpoint
ALTER TABLE "movement" ADD COLUMN IF NOT EXISTS "cargo_type" "cargo_type";--> statement-breakpoint

-- 4) Datos existentes -------------------------------------------------------
-- El vehiculo de una transportista con organizacion pasa a esa organizacion.
UPDATE "vehicle" v
SET "organization_id" = c."organization_id"
FROM "carrier" c
WHERE v."carrier_id" = c."id" AND v."organization_id" IS NULL AND c."organization_id" IS NOT NULL;--> statement-breakpoint

-- Lo que ya se transporto se describe con el vocabulario del asistente. Solo
-- se traduce lo inequivoco; el resto queda NULL (no se inventa).
UPDATE "movement"
SET "cargo_type" = CASE
  WHEN "material_type" = 'MATERIAL_MELARIO' THEN 'ALZAS'::"cargo_type"
  WHEN "material_type" = 'COLMENA' THEN 'COLMENAS'::"cargo_type"
  WHEN "material_type" = 'NUCLEO' THEN 'NUCLEOS'::"cargo_type"
  WHEN "movement_type" = 'PRODUCTO_FRACCIONADO' THEN 'FRASCOS'::"cargo_type"
  WHEN "material_type" = 'MIEL' AND ("unit" = 'TAMBOR' OR "movement_type" = 'MIEL_A_GRANEL') THEN 'TAMBORES'::"cargo_type"
  ELSE NULL
END
WHERE "cargo_type" IS NULL;--> statement-breakpoint

-- 5) La patente deja de ser unica en toda la plataforma ---------------------
ALTER TABLE "vehicle" DROP CONSTRAINT IF EXISTS "vehicle_plate_unique";--> statement-breakpoint

-- 6) Claves foraneas y restricciones (solo si faltan) -----------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'media_file_organization_id_organization_id_fk') THEN
    ALTER TABLE "media_file" ADD CONSTRAINT "media_file_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE restrict ON UPDATE no action;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'zone_organization_id_organization_id_fk') THEN
    ALTER TABLE "zone" ADD CONSTRAINT "zone_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE restrict ON UPDATE no action;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'establishment_photo_id_media_file_id_fk') THEN
    ALTER TABLE "establishment" ADD CONSTRAINT "establishment_photo_id_media_file_id_fk" FOREIGN KEY ("photo_id") REFERENCES "public"."media_file"("id") ON DELETE set null ON UPDATE no action;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'apiary_zone_id_zone_id_fk') THEN
    ALTER TABLE "apiary" ADD CONSTRAINT "apiary_zone_id_zone_id_fk" FOREIGN KEY ("zone_id") REFERENCES "public"."zone"("id") ON DELETE set null ON UPDATE no action;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'apiary_photo_id_media_file_id_fk') THEN
    ALTER TABLE "apiary" ADD CONSTRAINT "apiary_photo_id_media_file_id_fk" FOREIGN KEY ("photo_id") REFERENCES "public"."media_file"("id") ON DELETE set null ON UPDATE no action;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vehicle_organization_id_organization_id_fk') THEN
    ALTER TABLE "vehicle" ADD CONSTRAINT "vehicle_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE restrict ON UPDATE no action;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'movement_destination_apiary_id_apiary_id_fk') THEN
    ALTER TABLE "movement" ADD CONSTRAINT "movement_destination_apiary_id_apiary_id_fk" FOREIGN KEY ("destination_apiary_id") REFERENCES "public"."apiary"("id") ON DELETE set null ON UPDATE no action;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'app_user_tax_id_unique') THEN
    ALTER TABLE "app_user" ADD CONSTRAINT "app_user_tax_id_unique" UNIQUE("tax_id");
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'app_user_identifier_ck') THEN
    ALTER TABLE "app_user" ADD CONSTRAINT "app_user_identifier_ck" CHECK ("app_user"."email" IS NOT NULL OR "app_user"."tax_id" IS NOT NULL);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'app_user_tax_id_ck') THEN
    ALTER TABLE "app_user" ADD CONSTRAINT "app_user_tax_id_ck" CHECK ("app_user"."tax_id" IS NULL OR "app_user"."tax_id" ~ '^[0-9]{11}$');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vehicle_owner_ck') THEN
    ALTER TABLE "vehicle" ADD CONSTRAINT "vehicle_owner_ck" CHECK ("vehicle"."organization_id" IS NOT NULL OR "vehicle"."carrier_id" IS NOT NULL);
  END IF;
END $$;--> statement-breakpoint

-- 7) Indices (incluye los de las claves foraneas nuevas) --------------------
CREATE INDEX IF NOT EXISTS "media_file_organization_idx" ON "media_file" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "zone_organization_name_uq" ON "zone" USING btree ("organization_id",lower("name"));--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "establishment_photo_idx" ON "establishment" USING btree ("photo_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "apiary_zone_idx" ON "apiary" USING btree ("zone_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "apiary_photo_idx" ON "apiary" USING btree ("photo_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "vehicle_organization_plate_uq" ON "vehicle" USING btree ("organization_id","plate") WHERE "vehicle"."organization_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "vehicle_carrier_plate_uq" ON "vehicle" USING btree ("carrier_id","plate") WHERE "vehicle"."organization_id" IS NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "vehicle_carrier_idx" ON "vehicle" USING btree ("carrier_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "movement_destination_apiary_idx" ON "movement" USING btree ("destination_apiary_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "movement_vehicle_idx" ON "movement" USING btree ("vehicle_id");
