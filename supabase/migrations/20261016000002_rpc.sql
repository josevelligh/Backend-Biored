-- ---------------------------------------------------------------------------
-- BioRed · Funciones RPC transaccionales
--
-- Toda operación que toca varias tablas vive aquí para garantizar atomicidad
-- (el mismo contrato que replican los métodos `*Atomic` del repositorio
-- en memoria usado en la demo local).
--
-- Los errores de negocio se elevan como `BIORED:<CODE>:<detalle>` y la API los
-- traduce a respuestas HTTP con código estable para la app móvil.
-- ---------------------------------------------------------------------------

-- Helper: estado de tolva desde el % de carga -------------------------------
create or replace function public.biored_node_status(load_percent double precision)
returns public.node_status
language sql
immutable
as $$
  select case
    when load_percent >= 90 then 'full'::public.node_status
    when load_percent >= 70 then 'busy'::public.node_status
    else 'available'::public.node_status
  end;
$$;

-- 1. Liquidar un vale QR (programa "Rama por Planta") ------------------------
create or replace function public.biored_verify_ticket(
  p_lookup text,
  p_operator_id text,
  p_load_delta_percent double precision
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ticket public.pruning_tickets;
  v_node   public.bio_nodes;
  v_user   public.users;
  v_operator public.users;
  v_load   double precision;
begin
  select * into v_ticket
  from public.pruning_tickets
  where qr_code_hash = p_lookup or code = p_lookup or qr_payload = p_lookup
  for update;

  if not found then
    raise exception 'BIORED:TICKET_NOT_FOUND:El vale QR no existe o ya expiró.'
      using errcode = 'P0001';
  end if;

  if v_ticket.status = 'VERIFIED' then
    raise exception 'BIORED:TICKET_ALREADY_VERIFIED:Este vale ya fue liquidado anteriormente.'
      using errcode = 'P0001';
  end if;

  if v_ticket.status = 'CANCELLED' then
    raise exception 'BIORED:TICKET_CANCELLED:Este vale fue cancelado por el vecino.'
      using errcode = 'P0001';
  end if;

  select * into v_operator from public.users where id = p_operator_id;
  if not found then
    raise exception 'BIORED:OPERATOR_NOT_FOUND:Operario % no encontrado.', p_operator_id
      using errcode = 'P0001';
  end if;

  select * into v_node from public.bio_nodes where id = v_ticket.assigned_node_id for update;
  if not found then
    raise exception 'BIORED:NODE_NOT_FOUND:El Bio-Nodo asignado ya no existe.'
      using errcode = 'P0001';
  end if;

  select * into v_user from public.users where id = v_ticket.user_id for update;
  if not found then
    raise exception 'BIORED:USER_NOT_FOUND:El vecino titular del vale no existe.'
      using errcode = 'P0001';
  end if;

  update public.pruning_tickets
     set status = 'VERIFIED',
         verified_at = now(),
         verified_by = p_operator_id
   where id = v_ticket.id
   returning * into v_ticket;

  v_load := greatest(0, least(100, v_node.current_load_percent + p_load_delta_percent));

  update public.bio_nodes
     set current_load_percent = v_load,
         status = public.biored_node_status(v_load),
         updated_at = now()
   where id = v_node.id
   returning * into v_node;

  update public.users
     set eco_points = eco_points + v_ticket.points_awarded,
         total_kg_delivered = total_kg_delivered + v_ticket.estimated_weight_kg
   where id = v_user.id
   returning * into v_user;

  return jsonb_build_object(
    'ticket', to_jsonb(v_ticket),
    'user', to_jsonb(v_user),
    'node', to_jsonb(v_node)
  );
end;
$$;

-- 2. Canje de Eco-Puntos en "Hoy en Viveros" ---------------------------------
create or replace function public.biored_redeem_item(
  p_user_id text,
  p_item_id text,
  p_code text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user public.users;
  v_item public.nursery_items;
  v_redemption public.redemptions;
begin
  select * into v_user from public.users where id = p_user_id for update;
  if not found then
    raise exception 'BIORED:USER_NOT_FOUND:Vecino % no encontrado.', p_user_id
      using errcode = 'P0001';
  end if;

  select * into v_item from public.nursery_items where id = p_item_id for update;
  if not found then
    raise exception 'BIORED:ITEM_NOT_FOUND:Insumo % no encontrado.', p_item_id
      using errcode = 'P0001';
  end if;

  if v_item.stock <= 0 then
    raise exception 'BIORED:OUT_OF_STOCK:% está agotado en este vivero.', v_item.title
      using errcode = 'P0001';
  end if;

  if v_user.eco_points < v_item.points_cost then
    raise exception 'BIORED:INSUFFICIENT_POINTS:Te faltan % Eco-Puntos para canjear %.',
      (v_item.points_cost - v_user.eco_points), v_item.title
      using errcode = 'P0001';
  end if;

  update public.users
     set eco_points = eco_points - v_item.points_cost
   where id = v_user.id
   returning * into v_user;

  update public.nursery_items
     set stock = stock - 1
   where id = v_item.id
   returning * into v_item;

  insert into public.redemptions (id, user_id, item_id, item_title, points_spent, code)
  values (
    'redemption-' || gen_random_uuid()::text,
    v_user.id,
    v_item.id,
    v_item.title,
    v_item.points_cost,
    p_code
  )
  returning * into v_redemption;

  return jsonb_build_object(
    'user', to_jsonb(v_user),
    'item', to_jsonb(v_item),
    'redemption', to_jsonb(v_redemption)
  );
end;
$$;

-- 3. Registrar un lote procesado por la UCT-3 --------------------------------
--    Suma producto al inventario del nodo, acumula horas de cuchillas y libera
--    tolva (el material ya salió como mulch/compost/fibra).
create or replace function public.biored_apply_batch(
  p_id text,
  p_node_id text,
  p_tons_processed double precision,
  p_moisture_percent double precision,
  p_coarse_mulch_kg double precision,
  p_fine_compost_kg double precision,
  p_medium_fiber_kg double precision,
  p_bio_pots integer,
  p_blade_hours double precision,
  p_compost_ready_at timestamptz,
  p_estimated_value_usd double precision,
  p_load_delta_percent double precision
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_node  public.bio_nodes;
  v_batch public.bio_batches;
  v_load  double precision;
begin
  select * into v_node from public.bio_nodes where id = p_node_id for update;
  if not found then
    raise exception 'BIORED:NODE_NOT_FOUND:Bio-Nodo % no encontrado.', p_node_id
      using errcode = 'P0001';
  end if;

  insert into public.bio_batches (
    id, node_id, tons_processed, moisture_percent, coarse_mulch_kg, fine_compost_kg,
    medium_fiber_kg, bio_pots, blade_hours, compost_ready_at, estimated_value_usd
  ) values (
    p_id, p_node_id, p_tons_processed, p_moisture_percent, p_coarse_mulch_kg,
    p_fine_compost_kg, p_medium_fiber_kg, p_bio_pots, p_blade_hours,
    p_compost_ready_at, p_estimated_value_usd
  )
  returning * into v_batch;

  v_load := greatest(0, least(100, v_node.current_load_percent + p_load_delta_percent));

  update public.bio_nodes
     set available_mulch_kg   = available_mulch_kg + p_coarse_mulch_kg,
         available_compost_kg = available_compost_kg + p_fine_compost_kg,
         available_bio_pots   = available_bio_pots + p_bio_pots,
         blade_hours_used     = blade_hours_used + p_blade_hours,
         current_load_percent = v_load,
         status               = public.biored_node_status(v_load),
         updated_at           = now()
   where id = v_node.id
   returning * into v_node;

  return jsonb_build_object('batch', to_jsonb(v_batch), 'node', to_jsonb(v_node));
end;
$$;

-- 4. Mantenimiento: recalcular horas de cuchillas desde los lotes -------------
create or replace function public.biored_recalculate_blade_hours()
returns void
language sql
security definer
set search_path = public
as $$
  update public.bio_nodes n
     set blade_hours_used = coalesce(b.hours, 0) + 6, -- 6 h de marcha en vacío/histórico
         updated_at = now()
    from (
      select node_id, sum(blade_hours) as hours
      from public.bio_batches
      group by node_id
    ) b
   where b.node_id = n.id;
$$;

-- Permisos: la app móvil nunca escribe directo; solo la Edge Function (service_role).
revoke all on function public.biored_verify_ticket(text, text, double precision) from public, anon, authenticated;
revoke all on function public.biored_redeem_item(text, text, text) from public, anon, authenticated;
revoke all on function public.biored_recalculate_blade_hours() from public, anon, authenticated;
revoke all on function public.biored_apply_batch(
  text, text, double precision, double precision, double precision, double precision,
  double precision, integer, double precision, timestamptz, double precision, double precision
) from public, anon, authenticated;

grant execute on function public.biored_verify_ticket(text, text, double precision) to service_role;
grant execute on function public.biored_redeem_item(text, text, text) to service_role;
grant execute on function public.biored_recalculate_blade_hours() to service_role;
grant execute on function public.biored_apply_batch(
  text, text, double precision, double precision, double precision, double precision,
  double precision, integer, double precision, timestamptz, double precision, double precision
) to service_role;

-- RLS: lectura pública de catálogos, escritura solo con service_role ---------
alter table public.users            enable row level security;
alter table public.bio_nodes        enable row level security;
alter table public.pruning_tickets  enable row level security;
alter table public.nursery_items    enable row level security;
alter table public.community_posts  enable row level security;
alter table public.redemptions      enable row level security;
alter table public.bio_batches      enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array[
    'bio_nodes', 'nursery_items', 'community_posts', 'users', 'bio_batches'
  ] loop
    execute format(
      'drop policy if exists %I_read_all on public.%I',
      t, t
    );
    execute format(
      'create policy %I_read_all on public.%I for select to anon, authenticated using (true)',
      t, t
    );
  end loop;
end $$;
