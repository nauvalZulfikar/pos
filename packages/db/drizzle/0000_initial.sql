CREATE TABLE "tenants" (
	"id" uuid PRIMARY KEY NOT NULL,
	"legal_name" text NOT NULL,
	"display_name" text NOT NULL,
	"npwp" text,
	"is_pkp" boolean DEFAULT false NOT NULL,
	"segment" text NOT NULL,
	"default_locale" text DEFAULT 'id-ID' NOT NULL,
	"default_timezone" text DEFAULT 'Asia/Jakarta' NOT NULL,
	"business_day_boundary" text DEFAULT '04:00' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tenants_segment_chk" CHECK ("tenants"."segment" in ('warung','cafe','multi_cabang','chain')),
	CONSTRAINT "tenants_status_chk" CHECK ("tenants"."status" in ('active','suspended','churned'))
);
--> statement-breakpoint
CREATE TABLE "outlets" (
	"id" uuid PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"client_op_id" uuid,
	"tenant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"code" text NOT NULL,
	"address_line1" text NOT NULL,
	"address_line2" text,
	"city" text NOT NULL,
	"province" text NOT NULL,
	"postal_code" text,
	"phone" text,
	"ppn_bps_override" integer,
	"service_charge_bps" integer DEFAULT 0 NOT NULL,
	"business_day_boundary" text,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "memberships" (
	"id" uuid PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"client_op_id" uuid,
	"tenant_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" text NOT NULL,
	"outlet_permissions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"active_tenant_id" uuid,
	"outlet_id" uuid,
	"device_id" uuid,
	"session_type" text DEFAULT 'web' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone,
	"ip_address" text,
	"user_agent" text
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"client_op_id" uuid,
	"email" text NOT NULL,
	"full_name" text NOT NULL,
	"phone" text,
	"password_hash" text,
	"pin_hash" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"email_verified_at" timestamp with time zone,
	"last_login_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "menu_categories" (
	"id" uuid PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"client_op_id" uuid,
	"tenant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"icon_key" text,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "menu_items" (
	"id" uuid PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"client_op_id" uuid,
	"tenant_id" uuid NOT NULL,
	"category_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"sku" text,
	"base_price" bigint NOT NULL,
	"pricing_by_profile" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"outlet_overrides" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"image_url" text,
	"modifier_group_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"ppn_bps_override" integer,
	CONSTRAINT "menu_items_base_price_chk" CHECK ("menu_items"."base_price" >= 0)
);
--> statement-breakpoint
CREATE TABLE "modifier_groups" (
	"id" uuid PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"client_op_id" uuid,
	"tenant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"selection_min" integer DEFAULT 0 NOT NULL,
	"selection_max" integer DEFAULT 1 NOT NULL,
	"required" boolean DEFAULT false NOT NULL,
	"modifiers" jsonb DEFAULT '[]'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_items" (
	"id" uuid PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"client_op_id" uuid,
	"tenant_id" uuid NOT NULL,
	"order_id" uuid NOT NULL,
	"menu_item_id" uuid NOT NULL,
	"item_name_snapshot" text NOT NULL,
	"unit_price" bigint NOT NULL,
	"quantity" integer NOT NULL,
	"modifiers" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"modifiers_total" bigint DEFAULT 0 NOT NULL,
	"line_subtotal" bigint NOT NULL,
	"notes" text,
	"status" text DEFAULT 'queued' NOT NULL,
	"ppn_bps_snapshot" integer DEFAULT 0 NOT NULL,
	"void_reason" text,
	"voided_by" uuid,
	"voided_at" timestamp with time zone,
	CONSTRAINT "order_items_qty_chk" CHECK (quantity > 0),
	CONSTRAINT "order_items_status_chk" CHECK (status in ('queued','preparing','ready','served','voided'))
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" uuid PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"client_op_id" uuid,
	"tenant_id" uuid NOT NULL,
	"outlet_id" uuid NOT NULL,
	"shift_id" uuid,
	"table_id" uuid,
	"outlet_order_number" text NOT NULL,
	"business_day" text NOT NULL,
	"source" text NOT NULL,
	"pricing_profile" text DEFAULT 'dine_in' NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"customer_name" text,
	"customer_phone" text,
	"guest_count" integer,
	"subtotal" bigint DEFAULT 0 NOT NULL,
	"discount_total" bigint DEFAULT 0 NOT NULL,
	"service_charge" bigint DEFAULT 0 NOT NULL,
	"ppn_total" bigint DEFAULT 0 NOT NULL,
	"rounding" bigint DEFAULT 0 NOT NULL,
	"total" bigint DEFAULT 0 NOT NULL,
	"discounts" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"notes" text,
	"paid_at" timestamp with time zone,
	"external_order_id" text,
	"received_at" timestamp with time zone,
	CONSTRAINT "orders_source_chk" CHECK (source in ('pos_dine_in','pos_take_away','gofood','grabfood','shopeefood','whatsapp','web')),
	CONSTRAINT "orders_status_chk" CHECK (status in ('open','sent_to_kitchen','ready','served','paid','voided','cancelled')),
	CONSTRAINT "orders_totals_chk" CHECK (subtotal >= 0 and discount_total >= 0 and service_charge >= 0 and ppn_total >= 0 and total >= 0)
);
--> statement-breakpoint
CREATE TABLE "tables" (
	"id" uuid PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"client_op_id" uuid,
	"tenant_id" uuid NOT NULL,
	"outlet_id" uuid NOT NULL,
	"label" text NOT NULL,
	"capacity" integer DEFAULT 2 NOT NULL,
	"status" text DEFAULT 'available' NOT NULL,
	CONSTRAINT "tables_status_chk" CHECK (status in ('available','occupied','reserved','cleaning'))
);
--> statement-breakpoint
CREATE TABLE "payment_refunds" (
	"id" uuid PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"client_op_id" uuid,
	"tenant_id" uuid NOT NULL,
	"payment_id" uuid NOT NULL,
	"amount" bigint NOT NULL,
	"reason" text NOT NULL,
	"provider_ref" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"refunded_by" uuid NOT NULL,
	"refunded_at" timestamp with time zone,
	CONSTRAINT "payment_refunds_status_chk" CHECK (status in ('pending','succeeded','failed'))
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"client_op_id" uuid,
	"tenant_id" uuid NOT NULL,
	"order_id" uuid NOT NULL,
	"outlet_id" uuid NOT NULL,
	"method" text NOT NULL,
	"provider" text DEFAULT 'manual' NOT NULL,
	"provider_ref" text,
	"amount" bigint NOT NULL,
	"change_returned" bigint DEFAULT 0 NOT NULL,
	"qr_payload" text,
	"provider_fee" bigint,
	"status" text DEFAULT 'pending' NOT NULL,
	"received_at" timestamp with time zone,
	"settled_at" timestamp with time zone,
	"recorded_by" uuid NOT NULL,
	"notes" text,
	CONSTRAINT "payments_method_chk" CHECK (method in ('cash','qris','gopay','ovo','dana','shopeepay','card_edc','bank_transfer','voucher','other')),
	CONSTRAINT "payments_status_chk" CHECK (status in ('pending','awaiting_settlement','settled','failed','refunded','partially_refunded','cancelled')),
	CONSTRAINT "payments_provider_chk" CHECK (provider in ('midtrans','xendit','manual')),
	CONSTRAINT "payments_amount_chk" CHECK (amount >= 0)
);
--> statement-breakpoint
CREATE TABLE "cash_movements" (
	"id" uuid PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"client_op_id" uuid,
	"tenant_id" uuid NOT NULL,
	"shift_id" uuid NOT NULL,
	"outlet_id" uuid NOT NULL,
	"type" text NOT NULL,
	"amount" bigint NOT NULL,
	"reason" text,
	"performed_by" uuid NOT NULL,
	"performed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cash_movements_type_chk" CHECK (type in ('drop','pickup','expense','correction','tip'))
);
--> statement-breakpoint
CREATE TABLE "shifts" (
	"id" uuid PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"client_op_id" uuid,
	"tenant_id" uuid NOT NULL,
	"outlet_id" uuid NOT NULL,
	"opened_by" uuid NOT NULL,
	"closed_by" uuid,
	"opened_at" timestamp with time zone DEFAULT now() NOT NULL,
	"closed_at" timestamp with time zone,
	"starting_cash" bigint NOT NULL,
	"expected_cash" bigint,
	"counted_cash" bigint,
	"cash_variance" bigint,
	"total_sales" bigint DEFAULT 0 NOT NULL,
	"total_orders" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"closing_notes" text,
	CONSTRAINT "shifts_status_chk" CHECK (status in ('open','closing','closed'))
);
--> statement-breakpoint
CREATE TABLE "inventory_items" (
	"id" uuid PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"client_op_id" uuid,
	"tenant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"sku" text,
	"unit" text NOT NULL,
	"unit_cost" bigint NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "inventory_items_unit_chk" CHECK (unit in ('gram','kilogram','milliliter','liter','piece','pack'))
);
--> statement-breakpoint
CREATE TABLE "recipes" (
	"id" uuid PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"client_op_id" uuid,
	"tenant_id" uuid NOT NULL,
	"menu_item_id" uuid NOT NULL,
	"ingredients" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"auto_deduct" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stock_levels" (
	"tenant_id" uuid NOT NULL,
	"outlet_id" uuid NOT NULL,
	"inventory_item_id" uuid NOT NULL,
	"quantity_milli" bigint DEFAULT 0 NOT NULL,
	"reorder_threshold_milli" bigint,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "stock_levels_tenant_id_outlet_id_inventory_item_id_pk" PRIMARY KEY("tenant_id","outlet_id","inventory_item_id")
);
--> statement-breakpoint
CREATE TABLE "stock_movements" (
	"id" uuid PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"client_op_id" uuid,
	"tenant_id" uuid NOT NULL,
	"outlet_id" uuid NOT NULL,
	"inventory_item_id" uuid NOT NULL,
	"type" text NOT NULL,
	"delta_milli" bigint NOT NULL,
	"reason" text,
	"reference" text,
	"performed_by" uuid NOT NULL,
	"performed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "stock_movements_type_chk" CHECK (type in ('purchase','sale_deduction','manual_adjust','transfer_in','transfer_out','waste','correction'))
);
--> statement-breakpoint
CREATE TABLE "features" (
	"code" text PRIMARY KEY NOT NULL,
	"group" text NOT NULL,
	"display_name" jsonb NOT NULL,
	"description" jsonb NOT NULL,
	"monthly_price" bigint NOT NULL,
	"depends_on" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "features_group_chk" CHECK ("features"."group" in ('core','payment','multi_outlet','delivery','inventory','ai','crm','compliance','ops'))
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"tenant_id" uuid NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"billing_cycle" text DEFAULT 'monthly' NOT NULL,
	"current_period_start" timestamp with time zone NOT NULL,
	"current_period_end" timestamp with time zone NOT NULL,
	"last_bill_snapshot" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "subscriptions_status_chk" CHECK (status in ('active','past_due','cancelled','trialing'))
);
--> statement-breakpoint
CREATE TABLE "tenant_features" (
	"tenant_id" uuid NOT NULL,
	"feature_code" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"enabled_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone,
	"source" text DEFAULT 'subscription' NOT NULL,
	CONSTRAINT "tenant_features_tenant_id_feature_code_pk" PRIMARY KEY("tenant_id","feature_code"),
	CONSTRAINT "tenant_features_source_chk" CHECK (source in ('subscription','trial','comp'))
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"tenant_id" uuid NOT NULL,
	"actor_user_id" uuid,
	"actor_role" text,
	"actor_outlet_id" uuid,
	"device_id" uuid,
	"entity_kind" text NOT NULL,
	"entity_id" text,
	"operation" text NOT NULL,
	"diff" jsonb NOT NULL,
	"reason" text,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "idempotency_keys" (
	"key" text PRIMARY KEY NOT NULL,
	"tenant_id" uuid NOT NULL,
	"method" text NOT NULL,
	"path" text NOT NULL,
	"request_hash" text NOT NULL,
	"response_status" text,
	"response_body" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sync_ops" (
	"client_op_id" uuid PRIMARY KEY NOT NULL,
	"tenant_id" uuid NOT NULL,
	"outlet_id" uuid NOT NULL,
	"shift_id" uuid,
	"user_id" uuid NOT NULL,
	"device_id" uuid NOT NULL,
	"type" text NOT NULL,
	"payload" jsonb NOT NULL,
	"client_at" timestamp with time zone NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"status" text DEFAULT 'applied' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"id" uuid PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"client_op_id" uuid,
	"tenant_id" uuid NOT NULL,
	"full_name" text NOT NULL,
	"phone_hash" text,
	"phone_encrypted" text,
	"email" text,
	"npwp_encrypted" text,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_visit_at" timestamp with time zone,
	"visit_count" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "loyalty_accounts" (
	"id" uuid PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"client_op_id" uuid,
	"tenant_id" uuid NOT NULL,
	"points_balance" bigint DEFAULT 0 NOT NULL,
	"tier" text DEFAULT 'regular' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "delivery_platform_links" (
	"id" uuid PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"client_op_id" uuid,
	"tenant_id" uuid NOT NULL,
	"outlet_id" uuid NOT NULL,
	"platform" text NOT NULL,
	"external_merchant_id" text NOT NULL,
	"credentials_encrypted" text,
	"auto_accept" jsonb DEFAULT '{"enabled":false}'::jsonb NOT NULL,
	"last_synced_at" timestamp with time zone,
	"sync_status" text DEFAULT 'idle' NOT NULL,
	"sync_error" text
);
--> statement-breakpoint
CREATE TABLE "delivery_webhook_events" (
	"id" uuid PRIMARY KEY NOT NULL,
	"tenant_id" uuid NOT NULL,
	"platform" text NOT NULL,
	"external_event_id" text NOT NULL,
	"event_type" text NOT NULL,
	"payload" jsonb NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone,
	"status" text DEFAULT 'queued' NOT NULL,
	"error" text
);
--> statement-breakpoint
CREATE TABLE "platform_commission_rates" (
	"tenant_id" uuid NOT NULL,
	"platform" text NOT NULL,
	"commission_bps" integer NOT NULL,
	"effective_from" timestamp with time zone DEFAULT now() NOT NULL,
	"effective_to" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "anomalies" (
	"id" uuid PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"client_op_id" uuid,
	"tenant_id" uuid NOT NULL,
	"outlet_id" uuid,
	"detected_at" timestamp with time zone DEFAULT now() NOT NULL,
	"metric" text NOT NULL,
	"severity" text NOT NULL,
	"expected_value" text,
	"observed_value" text,
	"detail" jsonb NOT NULL,
	"acknowledged_at" timestamp with time zone,
	"acknowledged_by" uuid
);
--> statement-breakpoint
CREATE TABLE "daily_briefs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"client_op_id" uuid,
	"tenant_id" uuid NOT NULL,
	"outlet_id" uuid,
	"business_day" text NOT NULL,
	"facts" jsonb NOT NULL,
	"narrative" text NOT NULL,
	"recommendation" jsonb NOT NULL,
	"prompt_version" text NOT NULL,
	"model_id" text NOT NULL,
	"tokens_input" integer DEFAULT 0 NOT NULL,
	"tokens_output" integer DEFAULT 0 NOT NULL,
	"sent_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "menu_performance_scores" (
	"id" uuid PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"client_op_id" uuid,
	"tenant_id" uuid NOT NULL,
	"outlet_id" uuid,
	"menu_item_id" uuid NOT NULL,
	"period_start" text NOT NULL,
	"period_end" text NOT NULL,
	"category" text NOT NULL,
	"sales_quantity" integer NOT NULL,
	"gross_revenue" bigint NOT NULL,
	"gross_margin" bigint NOT NULL,
	"rationale" text
);
--> statement-breakpoint
CREATE INDEX "outlets_tenant_idx" ON "outlets" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "outlets_tenant_code_uq" ON "outlets" USING btree ("tenant_id","code") WHERE deleted_at is null;--> statement-breakpoint
CREATE INDEX "memberships_tenant_idx" ON "memberships" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "memberships_user_idx" ON "memberships" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "memberships_tenant_user_uq" ON "memberships" USING btree ("tenant_id","user_id") WHERE deleted_at is null;--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sessions_expires_idx" ON "sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_uq" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "menu_categories_tenant_idx" ON "menu_categories" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "menu_items_tenant_idx" ON "menu_items" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "menu_items_category_idx" ON "menu_items" USING btree ("tenant_id","category_id");--> statement-breakpoint
CREATE UNIQUE INDEX "menu_items_tenant_sku_uq" ON "menu_items" USING btree ("tenant_id","sku") WHERE sku is not null and deleted_at is null;--> statement-breakpoint
CREATE INDEX "modifier_groups_tenant_idx" ON "modifier_groups" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "order_items_tenant_order_idx" ON "order_items" USING btree ("tenant_id","order_id");--> statement-breakpoint
CREATE INDEX "orders_tenant_idx" ON "orders" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "orders_outlet_day_idx" ON "orders" USING btree ("tenant_id","outlet_id","business_day");--> statement-breakpoint
CREATE INDEX "orders_tenant_status_idx" ON "orders" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "orders_paid_at_idx" ON "orders" USING btree ("tenant_id","paid_at");--> statement-breakpoint
CREATE UNIQUE INDEX "orders_tenant_external_uq" ON "orders" USING btree ("tenant_id","source","external_order_id") WHERE external_order_id is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "orders_outlet_day_num_uq" ON "orders" USING btree ("tenant_id","outlet_id","business_day","outlet_order_number");--> statement-breakpoint
CREATE INDEX "tables_outlet_idx" ON "tables" USING btree ("tenant_id","outlet_id");--> statement-breakpoint
CREATE INDEX "payment_refunds_payment_idx" ON "payment_refunds" USING btree ("tenant_id","payment_id");--> statement-breakpoint
CREATE INDEX "payments_tenant_order_idx" ON "payments" USING btree ("tenant_id","order_id");--> statement-breakpoint
CREATE INDEX "payments_tenant_status_idx" ON "payments" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "cash_movements_shift_idx" ON "cash_movements" USING btree ("tenant_id","shift_id");--> statement-breakpoint
CREATE INDEX "shifts_tenant_outlet_idx" ON "shifts" USING btree ("tenant_id","outlet_id");--> statement-breakpoint
CREATE INDEX "shifts_tenant_status_idx" ON "shifts" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "inventory_items_tenant_idx" ON "inventory_items" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "inventory_items_tenant_sku_uq" ON "inventory_items" USING btree ("tenant_id","sku") WHERE sku is not null and deleted_at is null;--> statement-breakpoint
CREATE UNIQUE INDEX "recipes_menu_item_uq" ON "recipes" USING btree ("tenant_id","menu_item_id");--> statement-breakpoint
CREATE INDEX "stock_movements_outlet_item_idx" ON "stock_movements" USING btree ("tenant_id","outlet_id","inventory_item_id");--> statement-breakpoint
CREATE INDEX "subscriptions_tenant_idx" ON "subscriptions" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "tenant_features_tenant_idx" ON "tenant_features" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "audit_logs_tenant_occurred_idx" ON "audit_logs" USING btree ("tenant_id","occurred_at");--> statement-breakpoint
CREATE INDEX "audit_logs_entity_idx" ON "audit_logs" USING btree ("tenant_id","entity_kind","entity_id");--> statement-breakpoint
CREATE INDEX "idempotency_keys_expires_idx" ON "idempotency_keys" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "idempotency_keys_tenant_idx" ON "idempotency_keys" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "sync_ops_tenant_received_idx" ON "sync_ops" USING btree ("tenant_id","received_at");--> statement-breakpoint
CREATE INDEX "sync_ops_device_idx" ON "sync_ops" USING btree ("device_id");--> statement-breakpoint
CREATE INDEX "customers_tenant_idx" ON "customers" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "customers_tenant_phone_hash_uq" ON "customers" USING btree ("tenant_id","phone_hash") WHERE phone_hash is not null and deleted_at is null;--> statement-breakpoint
CREATE INDEX "loyalty_accounts_tenant_idx" ON "loyalty_accounts" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "delivery_platform_outlet_idx" ON "delivery_platform_links" USING btree ("tenant_id","outlet_id","platform");--> statement-breakpoint
CREATE UNIQUE INDEX "delivery_platform_ext_uq" ON "delivery_platform_links" USING btree ("platform","external_merchant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "delivery_webhook_ext_uq" ON "delivery_webhook_events" USING btree ("platform","external_event_id");--> statement-breakpoint
CREATE INDEX "delivery_webhook_status_idx" ON "delivery_webhook_events" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "platform_commission_tenant_idx" ON "platform_commission_rates" USING btree ("tenant_id","platform");--> statement-breakpoint
CREATE INDEX "anomalies_tenant_detected_idx" ON "anomalies" USING btree ("tenant_id","detected_at");--> statement-breakpoint
CREATE UNIQUE INDEX "daily_briefs_tenant_outlet_day_uq" ON "daily_briefs" USING btree ("tenant_id","outlet_id","business_day");--> statement-breakpoint
CREATE INDEX "daily_briefs_tenant_day_idx" ON "daily_briefs" USING btree ("tenant_id","business_day");--> statement-breakpoint
CREATE INDEX "menu_perf_item_period_idx" ON "menu_performance_scores" USING btree ("tenant_id","menu_item_id","period_start");