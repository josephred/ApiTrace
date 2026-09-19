-- Migracion 0001: DT-e API-SEM (SENASA / ARCA), delegaciones y codigos oficiales
CREATE TABLE IF NOT EXISTS "senasa_delegation" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"producer_id" uuid NOT NULL,
	"service" varchar(40) NOT NULL,
	"status" varchar(40) DEFAULT 'NO_INICIADA' NOT NULL,
	"delegated_to_tax_id" varchar(20),
	"form_number" varchar(60),
	"requested_at" timestamp with time zone,
	"accepted_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"notes" varchar(600),
	"updated_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "senasa_delegation" ADD CONSTRAINT "senasa_delegation_producer_id_producer_id_fk" FOREIGN KEY ("producer_id") REFERENCES "public"."producer"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "senasa_delegation_producer_idx" ON "senasa_delegation" USING btree ("producer_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "senasa_delegation_status_idx" ON "senasa_delegation" USING btree ("status");
--> statement-breakpoint
ALTER TABLE "apiary" ADD COLUMN IF NOT EXISTS "renapa_code" varchar(40);
--> statement-breakpoint
ALTER TABLE "apiary" ADD COLUMN IF NOT EXISTS "renapa_status" varchar(40) DEFAULT 'PENDING_VERIFICATION' NOT NULL;
--> statement-breakpoint
ALTER TABLE "apiary" ADD COLUMN IF NOT EXISTS "renapa_valid_to" varchar(10);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "apiary_renapa_code_idx" ON "apiary" USING btree ("renapa_code");
--> statement-breakpoint
ALTER TABLE "establishment" ADD COLUMN IF NOT EXISTS "senasa_code" varchar(40);
--> statement-breakpoint
ALTER TABLE "establishment" ADD COLUMN IF NOT EXISTS "senasa_status" varchar(40) DEFAULT 'PENDING_VERIFICATION' NOT NULL;
--> statement-breakpoint
ALTER TABLE "establishment" ADD COLUMN IF NOT EXISTS "senasa_valid_to" varchar(10);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "establishment_senasa_code_idx" ON "establishment" USING btree ("senasa_code");
--> statement-breakpoint
ALTER TABLE "dte" DROP CONSTRAINT IF EXISTS "dte_movement_id_unique";
--> statement-breakpoint
ALTER TABLE "dte" ALTER COLUMN "status" DROP DEFAULT;
--> statement-breakpoint
ALTER TABLE "dte" ALTER COLUMN "status" TYPE varchar(40) USING "status"::text;
--> statement-breakpoint
ALTER TABLE "dte" ALTER COLUMN "status" SET DEFAULT 'BORRADOR';
--> statement-breakpoint
ALTER TABLE "dte" ADD COLUMN IF NOT EXISTS "load_date" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "dte" ADD COLUMN IF NOT EXISTS "expiry_date" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "dte" ADD COLUMN IF NOT EXISTS "declared_quantity" numeric(14, 3);
--> statement-breakpoint
ALTER TABLE "dte" ADD COLUMN IF NOT EXISTS "estimated_quantity" numeric(14, 3);
--> statement-breakpoint
ALTER TABLE "dte" ADD COLUMN IF NOT EXISTS "confirmed_quantity" numeric(14, 3);
--> statement-breakpoint
ALTER TABLE "dte" ADD COLUMN IF NOT EXISTS "arrival_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "dte" ADD COLUMN IF NOT EXISTS "unit" varchar(40) DEFAULT 'ALZA' NOT NULL;
--> statement-breakpoint
ALTER TABLE "dte" ADD COLUMN IF NOT EXISTS "movement_type_code" varchar(40) DEFAULT 'MATERIAL_MELARIO' NOT NULL;
--> statement-breakpoint
ALTER TABLE "dte" ADD COLUMN IF NOT EXISTS "transit_reason" varchar(40) DEFAULT 'EXTRACCION' NOT NULL;
--> statement-breakpoint
ALTER TABLE "dte" ADD COLUMN IF NOT EXISTS "product_code" varchar(40) DEFAULT 'MIEL' NOT NULL;
--> statement-breakpoint
ALTER TABLE "dte" ADD COLUMN IF NOT EXISTS "product_name" varchar(160) DEFAULT 'Miel a granel' NOT NULL;
--> statement-breakpoint
ALTER TABLE "dte" ADD COLUMN IF NOT EXISTS "issuer_organization_id" uuid;
--> statement-breakpoint
ALTER TABLE "dte" ADD COLUMN IF NOT EXISTS "destination_organization_id" uuid;
--> statement-breakpoint
ALTER TABLE "dte" ADD COLUMN IF NOT EXISTS "holder_producer_id" uuid;
--> statement-breakpoint
ALTER TABLE "dte" ADD COLUMN IF NOT EXISTS "holder_tax_id" varchar(20);
--> statement-breakpoint
ALTER TABLE "dte" ADD COLUMN IF NOT EXISTS "origin_code" varchar(60);
--> statement-breakpoint
ALTER TABLE "dte" ADD COLUMN IF NOT EXISTS "destination_code" varchar(60);
--> statement-breakpoint
ALTER TABLE "dte" ADD COLUMN IF NOT EXISTS "issue_mode" varchar(40) DEFAULT 'MANUAL' NOT NULL;
--> statement-breakpoint
ALTER TABLE "dte" ADD COLUMN IF NOT EXISTS "requested_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "dte" ADD COLUMN IF NOT EXISTS "requested_by_id" uuid;
--> statement-breakpoint
ALTER TABLE "dte" ADD COLUMN IF NOT EXISTS "verification_code" varchar(40);
--> statement-breakpoint
ALTER TABLE "dte" ADD COLUMN IF NOT EXISTS "pdf_url" varchar(500);
--> statement-breakpoint
ALTER TABLE "dte" ADD COLUMN IF NOT EXISTS "transport_type" varchar(40);
--> statement-breakpoint
ALTER TABLE "dte" ADD COLUMN IF NOT EXISTS "transport_plate" varchar(20);
--> statement-breakpoint
ALTER TABLE "dte" ADD COLUMN IF NOT EXISTS "transport_trailer_plate" varchar(20);
--> statement-breakpoint
ALTER TABLE "dte" ADD COLUMN IF NOT EXISTS "voided_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "dte" ADD COLUMN IF NOT EXISTS "void_reason" varchar(600);
--> statement-breakpoint
ALTER TABLE "dte" ADD COLUMN IF NOT EXISTS "fee_paid" boolean DEFAULT false;
--> statement-breakpoint
ALTER TABLE "dte" ADD COLUMN IF NOT EXISTS "regularized_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "dte" ADD COLUMN IF NOT EXISTS "regularized_by_id" uuid;
--> statement-breakpoint
ALTER TABLE "dte" ADD COLUMN IF NOT EXISTS "regularization_note" varchar(600);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "dte" ADD CONSTRAINT "dte_issuer_organization_id_organization_id_fk" FOREIGN KEY ("issuer_organization_id") REFERENCES "public"."organization"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "dte" ADD CONSTRAINT "dte_destination_organization_id_organization_id_fk" FOREIGN KEY ("destination_organization_id") REFERENCES "public"."organization"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "dte" ADD CONSTRAINT "dte_holder_producer_id_producer_id_fk" FOREIGN KEY ("holder_producer_id") REFERENCES "public"."producer"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "dte_movement_idx" ON "dte" USING btree ("movement_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "dte_status_sync_idx" ON "dte" USING btree ("status", "sync_status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "dte_number_idx" ON "dte" USING btree ("number");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "dte_issuer_org_idx" ON "dte" USING btree ("issuer_organization_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "dte_destination_org_idx" ON "dte" USING btree ("destination_organization_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "dte_load_date_idx" ON "dte" USING btree ("load_date");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "dte_status_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dte_id" uuid NOT NULL,
	"from_status" varchar(40),
	"to_status" varchar(40) NOT NULL,
	"source" varchar(30) DEFAULT 'USUARIO' NOT NULL,
	"reason" varchar(600),
	"actor_user_id" uuid,
	"correlation_id" varchar(80),
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "dte_status_history" ADD CONSTRAINT "dte_status_history_dte_id_dte_id_fk" FOREIGN KEY ("dte_id") REFERENCES "public"."dte"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "dte_status_history_dte_idx" ON "dte_status_history" USING btree ("dte_id", "occurred_at");
