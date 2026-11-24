ALTER TABLE "inventory" ADD COLUMN "id" serial NOT NULL;--> statement-breakpoint
ALTER TABLE "inventory" ADD CONSTRAINT "inventory_id_unique" UNIQUE("id");