-- ============================================================================
-- Generic audit trigger. AGENTS.md §10.3.
-- Captures INSERT/UPDATE/DELETE diffs into audit_logs for selected tables.
-- ============================================================================

create or replace function fn_audit_log() returns trigger as $$
declare
  v_tenant_id uuid;
  v_actor uuid;
  v_role text;
  v_outlet uuid;
  v_device uuid;
  v_diff jsonb;
  v_entity_id text;
begin
  -- Tenant: prefer NEW row's tenant_id, fall back to OLD, fall back to session.
  v_tenant_id := coalesce(
    case when tg_op in ('INSERT','UPDATE') then NEW.tenant_id end,
    case when tg_op = 'DELETE' then OLD.tenant_id end,
    nullif(current_setting('app.current_tenant_id', true), '')::uuid
  );

  v_actor := nullif(current_setting('app.current_user_id', true), '')::uuid;
  v_role := nullif(current_setting('app.current_actor_role', true), '');
  v_outlet := nullif(current_setting('app.current_outlet_id', true), '')::uuid;
  v_device := nullif(current_setting('app.current_device_id', true), '')::uuid;

  -- Best-effort entity_id: many tables have `id`, but composite-PK tables (e.g. tenant_features
  -- on (tenant_id, feature_code)) don't. Build a textual key from the full row when no id exists.
  begin
    if tg_op = 'DELETE' then
      v_entity_id := (to_jsonb(OLD) ->> 'id');
    else
      v_entity_id := (to_jsonb(NEW) ->> 'id');
    end if;
  exception when others then
    v_entity_id := null;
  end;

  if tg_op = 'INSERT' then
    v_diff := jsonb_build_object('after', to_jsonb(NEW));
  elsif tg_op = 'DELETE' then
    v_diff := jsonb_build_object('before', to_jsonb(OLD));
  else
    v_diff := jsonb_build_object(
      'before', to_jsonb(OLD),
      'after', to_jsonb(NEW)
    );
  end if;

  insert into audit_logs (
    tenant_id, actor_user_id, actor_role, actor_outlet_id, device_id,
    entity_kind, entity_id, operation, diff,
    reason
  ) values (
    v_tenant_id, v_actor, v_role, v_outlet, v_device,
    tg_table_name, v_entity_id, tg_op, v_diff,
    nullif(current_setting('app.audit_reason', true), '')
  );

  if tg_op = 'DELETE' then return OLD; end if;
  return NEW;
end;
$$ language plpgsql security definer;

-- Attach the trigger to auditable tables.
do $$
declare
  t text;
  audited_tables text[] := array[
    'orders', 'order_items', 'payments', 'payment_refunds',
    'menu_items',
    'memberships',
    'stock_movements',
    'tenant_features',
    'shifts', 'cash_movements'
  ];
begin
  foreach t in array audited_tables loop
    execute format('drop trigger if exists trg_audit_%I on %I', t, t);
    execute format(
      'create trigger trg_audit_%I after insert or update or delete on %I for each row execute function fn_audit_log()',
      t, t
    );
  end loop;
end $$;
