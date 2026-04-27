-- Initialise dev database. Runs once on first volume creation.
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- Admin role for cross-tenant queries (BYPASSRLS).
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'desain_admin') then
    create role desain_admin with login password 'desain_admin' bypassrls;
  end if;
end $$;

grant all privileges on database desain_pos to desain_admin;
