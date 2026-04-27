CREATE TABLE "waste_events" (
	"id" uuid PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"client_op_id" uuid,
	"tenant_id" uuid NOT NULL,
	"outlet_id" uuid NOT NULL,
	"inventory_item_id" uuid NOT NULL,
	"quantity_milli" bigint NOT NULL,
	"reason" text NOT NULL,
	"reported_by" uuid NOT NULL,
	"reported_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "waste_events_qty_chk" CHECK (quantity_milli > 0)
);
--> statement-breakpoint
CREATE TABLE "purchase_orders" (
	"id" uuid PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"client_op_id" uuid,
	"tenant_id" uuid NOT NULL,
	"supplier_id" uuid NOT NULL,
	"outlet_id" uuid NOT NULL,
	"po_number" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"items" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"total_amount" bigint DEFAULT 0 NOT NULL,
	"expected_at" timestamp with time zone,
	"received_at" timestamp with time zone,
	"notes" text,
	"created_by" uuid NOT NULL,
	CONSTRAINT "po_status_chk" CHECK (status in ('draft','sent','partial','received','cancelled'))
);
--> statement-breakpoint
CREATE TABLE "suppliers" (
	"id" uuid PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"client_op_id" uuid,
	"tenant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"contact_name" text,
	"phone" text,
	"email" text,
	"address" text,
	"npwp" text,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "voucher_redemptions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"client_op_id" uuid,
	"tenant_id" uuid NOT NULL,
	"redeemed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"discount_applied" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vouchers" (
	"id" uuid PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"client_op_id" uuid,
	"tenant_id" uuid NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"value" bigint NOT NULL,
	"min_subtotal" bigint DEFAULT 0 NOT NULL,
	"max_usages" integer DEFAULT 0 NOT NULL,
	"used_count" integer DEFAULT 0 NOT NULL,
	"valid_from" timestamp with time zone,
	"valid_to" timestamp with time zone,
	"schedule" text,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "vouchers_type_chk" CHECK (type in ('percent','amount','happy_hour'))
);
--> statement-breakpoint
CREATE INDEX "waste_events_outlet_day_idx" ON "waste_events" USING btree ("tenant_id","outlet_id","reported_at");--> statement-breakpoint
CREATE INDEX "purchase_orders_tenant_idx" ON "purchase_orders" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "suppliers_tenant_idx" ON "suppliers" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "voucher_redemptions_tenant_idx" ON "voucher_redemptions" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "vouchers_tenant_code_uq" ON "vouchers" USING btree ("tenant_id","code") WHERE deleted_at is null;--> statement-breakpoint
CREATE INDEX "vouchers_tenant_idx" ON "vouchers" USING btree ("tenant_id");