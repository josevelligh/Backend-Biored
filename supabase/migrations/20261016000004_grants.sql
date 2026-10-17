-- ---------------------------------------------------------------------------
-- Grants explícitos y política de RLS para el service role.
--
-- En un proyecto Supabase real, el rol `postgres` ya trae default privileges
-- que otorgan acceso a `anon`, `authenticated` y `service_role`, y `service_role`
-- tiene BYPASSRLS. Este archivo replica ese comportamiento de forma explícita
-- para que las migraciones funcionen igual en cualquier Postgres (CI, contenedor
-- local, etc.) sin depender de la configuración previa del servidor.
--
-- La Edge Function usa la service role key: sus consultas pasan por la política
-- `*_service_all`. La app móvil nunca escribe directo a Postgres.
-- ---------------------------------------------------------------------------

grant usage on schema public to anon, authenticated, service_role;

-- Catálogo de lectura pública para anon/authenticated (RLS sigue mandando).
grant select, insert, update, delete on all tables in schema public to anon, authenticated;
grant usage, select on all sequences in schema public to anon, authenticated;

-- El backend (Edge Function) necesita acceso total.
grant all privileges on all tables in schema public to service_role;
grant all privileges on all sequences in schema public to service_role;
grant all privileges on all functions in schema public to service_role;

-- Permite al service role atravesar RLS sin depender de BYPASSRLS.
do $$
declare
  t text;
begin
  foreach t in array array[
    'users', 'bio_nodes', 'pruning_tickets', 'nursery_items',
    'community_posts', 'redemptions', 'bio_batches'
  ] loop
    execute format('drop policy if exists %I_service_all on public.%I', t, t);
    execute format(
      'create policy %I_service_all on public.%I for all to service_role using (true) with check (true)',
      t, t
    );
  end loop;
end $$;

-- Privilegios por defecto para objetos que se agreguen en el futuro.
alter default privileges in schema public grant all on tables to service_role;
alter default privileges in schema public grant all on sequences to service_role;
alter default privileges in schema public grant execute on functions to service_role;
