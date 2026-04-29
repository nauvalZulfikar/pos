CREATE TABLE "demand_forecasts" (
	"id" uuid PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"client_op_id" uuid,
	"tenant_id" uuid NOT NULL,
	"outlet_id" uuid,
	"menu_item_id" uuid NOT NULL,
	"target_day" text NOT NULL,
	"expected_qty" integer NOT NULL,
	"lower_qty" integer NOT NULL,
	"upper_qty" integer NOT NULL,
	"sample_days" integer NOT NULL,
	"method" text NOT NULL,
	"detail" jsonb
);
--> statement-breakpoint
CREATE INDEX "demand_forecasts_target_idx" ON "demand_forecasts" USING btree ("tenant_id","target_day","menu_item_id");--> statement-breakpoint
CREATE UNIQUE INDEX "demand_forecasts_uq" ON "demand_forecasts" USING btree ("tenant_id","outlet_id","menu_item_id","target_day");
