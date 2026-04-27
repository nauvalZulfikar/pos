-- ============================================================================
-- Row-Level Security policies for DESAIN POS.
-- AGENTS.md §7.
--
-- Connection convention:
--   set_config('app.current_tenant_id', '<uuid>', true)  → required for tenant-scoped reads/writes
--   set_config('app.current_user_id',   '<uuid>', true)  → required for audit attribution
--   set_config('app.current_outlet_id', '<uuid>', true)  → optional; some policies further narrow by outlet
--
-- The owner-bypass pool sets neither var, and uses a role with `bypassrls`.
-- ============================================================================

-- Helper: read tenant id from session var, raising if absent.
create or replace function app_current_tenant_id() returns uuid as $$
  declare v text;
  begin
    v := current_setting('app.current_tenant_id', true);
    if v is null or v = '' then
      raise exception 'tenant context not set' using errcode = 'P0001';
    end if;
    return v::uuid;
  end;
$$ language plpgsql stable;

create or replace function app_current_user_id() returns uuid as $$
  declare v text;
  begin
    v := current_setting('app.current_user_id', true);
    if v is null or v = '' then return null; end if;
    return v::uuid;
  end;
$$ language plpgsql stable;

-- ----------------------------------------------------------------------------
-- Apply RLS to every tenant-owned table.
-- This block is repeated as a do-block to keep the migration idempotent.
-- ----------------------------------------------------------------------------
do $$
declare
  t text;
  tenant_tables text[] := array[
    'outlets', 'memberships',
    'menu_categories', 'menu_items', 'modifier_groups',
    'orders', 'order_items', 'tables',
    'payments', 'payment_refunds',
    'shifts', 'cash_movements',
    'inventory_items', 'stock_levels', 'stock_movements', 'recipes',
    'tenant_features', 'subscriptions',
    'audit_logs', 'sync_ops', 'idempotency_keys',
    'customers', 'loyalty_accounts',
    'platform_commission_rates', 'delivery_platform_links', 'delivery_webhook_events',
    'daily_briefs', 'menu_performance_scores', 'anomalies',
    'waste_events', 'suppliers', 'purchase_orders', 'vouchers', 'voucher_redemptions'
  ];
begin
  foreach t in array tenant_tables loop
    execute format('alter table %I enable row level security', t);
    execute format('alter table %I force row level security', t);
    execute format('drop policy if exists %I_tenant_isolation on %I', t, t);
    execute format(
      'create policy %I_tenant_isolation on %I using (tenant_id = app_current_tenant_id()) with check (tenant_id = app_current_tenant_id())',
      t, t
    );
  end loop;
end $$;

-- ----------------------------------------------------------------------------
-- `tenants` and `users` and `sessions` are NOT tenant-scoped — different rules.
-- ----------------------------------------------------------------------------

-- tenants: a user can read their own tenant via membership; writes via admin pool.
alter table tenants enable row level security;
alter table tenants force row level security;
drop policy if exists tenants_self_read on tenants;
create policy tenants_self_read on tenants
  for select
  using (
    id = app_current_tenant_id()
    or exists (
      select 1 from memberships m
      where m.user_id = app_current_user_id() and m.tenant_id = tenants.id
    )
  );

-- users: a user can always see themselves. Memberships gate cross-user visibility per tenant.
alter table users enable row level security;
alter table users force row level security;
drop policy if exists users_self_read on users;
create policy users_self_read on users
  for select
  using (
    id = app_current_user_id()
    or exists (
      select 1 from memberships m
      where m.tenant_id = app_current_tenant_id()
        and m.user_id = users.id
    )
  );

-- sessions: a user can only see their own sessions.
alter table sessions enable row level security;
alter table sessions force row level security;
drop policy if exists sessions_self on sessions;
create policy sessions_self on sessions
  using (user_id = app_current_user_id())
  with check (user_id = app_current_user_id());

-- ----------------------------------------------------------------------------
-- Audit log: insert-only at the application layer too. Updates and deletes blocked.
-- ----------------------------------------------------------------------------
create or replace function audit_logs_block_mutation() returns trigger as $$
begin
  raise exception 'audit_logs is append-only' using errcode = 'P0001';
end;
$$ language plpgsql;

drop trigger if exists trg_audit_logs_no_update on audit_logs;
create trigger trg_audit_logs_no_update
  before update or delete on audit_logs
  for each row execute function audit_logs_block_mutation();
