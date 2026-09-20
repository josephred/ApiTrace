-- Migracion 0002: Alinear columnas de movement_rule con el esquema Drizzle
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='movement_rule' AND column_name='origin_type') THEN
    ALTER TABLE "movement_rule" RENAME COLUMN "origin_type" TO "source_establishment_type";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='movement_rule' AND column_name='destination_type') THEN
    ALTER TABLE "movement_rule" RENAME COLUMN "destination_type" TO "destination_establishment_type";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='movement_rule' AND column_name='legal_reference') THEN
    ALTER TABLE "movement_rule" RENAME COLUMN "legal_reference" TO "legal_basis";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='movement_rule' AND column_name='notes') THEN
    ALTER TABLE "movement_rule" RENAME COLUMN "notes" TO "description";
  END IF;
END $$;
--> statement-breakpoint
DROP INDEX IF EXISTS "movement_rule_match_idx";
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "movement_rule_match_idx" ON "movement_rule" USING btree ("active", "movement_type", "source_establishment_type", "destination_establishment_type", "priority");
