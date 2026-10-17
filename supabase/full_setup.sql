-- ---------------------------------------------------------------------------
-- BioRed · Esquema base
-- Plataforma de Bio-Nodos Barriales de Managua (Desafío 04)
-- ---------------------------------------------------------------------------

-- Dominios -------------------------------------------------------------------

do $$ begin
  create type public.user_role as enum ('CITIZEN', 'BRIGADE', 'OPERATOR', 'MUNICIPAL_ADMIN');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.node_status as enum ('available', 'busy', 'full');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.ticket_status as enum ('PENDING', 'VERIFIED', 'CANCELLED');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.size_category as enum ('sm', 'md', 'lg');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.nursery_category as enum ('COMPOST', 'PLANT', 'BIOPOT', 'MULCH');
exception when duplicate_object then null; end $$;

-- Tablas ---------------------------------------------------------------------

create table if not exists public.users (
  id                 text primary key,
  name               text not null,
  role               public.user_role not null default 'CITIZEN',
  district           text not null default 'Distrito I',
  avatar_url         text,
  eco_points         integer not null default 50 check (eco_points >= 0),
  total_kg_delivered double precision not null default 0 check (total_kg_delivered >= 0),
  created_at         timestamptz not null default now()
);

create table if not exists public.bio_nodes (
  id                   text primary key,
  name                 text not null,
  district             text not null,
  address              text not null,
  latitude             double precision not null check (latitude between -90 and 90),
  longitude            double precision not null check (longitude between -180 and 180),
  capacity_ton_day     double precision not null default 3.5 check (capacity_ton_day > 0),
  current_load_percent double precision not null default 0 check (current_load_percent between 0 and 100),
  status               public.node_status not null default 'available',
  available_mulch_kg   double precision not null default 0,
  available_compost_kg double precision not null default 0,
  available_bio_pots   integer not null default 0,
  blade_hours_used     double precision not null default 0,
  coordinator          text,
  phone                text,
  operating_hours      text,
  updated_at           timestamptz not null default now()
);

create table if not exists public.pruning_tickets (
  id                   text primary key,
  code                 text not null unique,
  qr_code_hash         text not null unique,
  qr_payload           text not null,
  user_id              text not null references public.users (id) on delete cascade,
  assigned_node_id     text not null references public.bio_nodes (id),
  size_category        public.size_category not null,
  estimated_volume_m3  double precision not null check (estimated_volume_m3 > 0),
  estimated_weight_kg  double precision not null check (estimated_weight_kg > 0),
  points_awarded       integer not null check (points_awarded >= 0),
  photo_url            text,
  status               public.ticket_status not null default 'PENDING',
  created_at           timestamptz not null default now(),
  verified_at          timestamptz,
  verified_by          text references public.users (id)
);

create table if not exists public.nursery_items (
  id                   text primary key,
  node_id              text not null references public.bio_nodes (id) on delete cascade,
  provider_name        text not null,
  provider_avatar      text,
  title                text not null,
  description          text not null,
  category             public.nursery_category not null,
  points_cost          integer not null check (points_cost > 0),
  branches_kg_required double precision not null default 0,
  stock                integer not null default 0 check (stock >= 0),
  image_url            text
);

create table if not exists public.community_posts (
  id                 text primary key,
  user_id            text not null references public.users (id) on delete cascade,
  node_id            text references public.bio_nodes (id) on delete set null,
  author_name        text not null,
  author_role        text not null,
  author_avatar      text,
  location           text not null,
  content            text not null,
  image_url          text,
  kg_contributed     double precision not null default 0,
  likes_count        integer not null default 0,
  comments_count     integer not null default 0,
  is_challenge       boolean not null default false,
  challenge_goal_kg  double precision,
  current_kg         double precision,
  end_date           text,
  participants_count integer,
  tag                text,
  verified_badge     boolean not null default false,
  created_at         timestamptz not null default now()
);

create table if not exists public.redemptions (
  id           text primary key,
  user_id      text not null references public.users (id) on delete cascade,
  item_id      text not null references public.nursery_items (id),
  item_title   text not null,
  points_spent integer not null check (points_spent > 0),
  code         text not null unique,
  created_at   timestamptz not null default now()
);

create table if not exists public.bio_batches (
  id                 text primary key,
  node_id            text not null references public.bio_nodes (id) on delete cascade,
  tons_processed     double precision not null check (tons_processed > 0),
  moisture_percent   double precision not null check (moisture_percent between 0 and 100),
  coarse_mulch_kg    double precision not null default 0,
  fine_compost_kg    double precision not null default 0,
  medium_fiber_kg    double precision not null default 0,
  bio_pots           integer not null default 0,
  blade_hours        double precision not null default 0,
  compost_ready_at   timestamptz not null,
  estimated_value_usd double precision not null default 0,
  created_at         timestamptz not null default now()
);

-- Índices --------------------------------------------------------------------

create index if not exists pruning_tickets_user_idx        on public.pruning_tickets (user_id, created_at desc);
create index if not exists pruning_tickets_status_idx      on public.pruning_tickets (status);
create index if not exists pruning_tickets_node_idx        on public.pruning_tickets (assigned_node_id);
create index if not exists community_posts_created_idx     on public.community_posts (created_at desc);
create index if not exists community_posts_challenge_idx   on public.community_posts (is_challenge);
create index if not exists nursery_items_node_idx          on public.nursery_items (node_id);
create index if not exists bio_batches_node_idx            on public.bio_batches (node_id, created_at desc);
create index if not exists bio_batches_created_idx         on public.bio_batches (created_at desc);
create index if not exists redemptions_user_idx            on public.redemptions (user_id, created_at desc);

-- Vista de red (útil para paneles y para depurar el pitch) --------------------

create or replace view public.biored_network_overview as
select
  n.id,
  n.name,
  n.district,
  n.status,
  n.current_load_percent,
  n.capacity_ton_day,
  n.available_mulch_kg,
  n.available_compost_kg,
  n.available_bio_pots,
  n.blade_hours_used,
  n.blade_hours_used >= 40 as blade_alert,
  case
    when n.status = 'full' or n.current_load_percent >= 90 then false
    else true
  end as receives_biomass,
  coalesce(b.tons_processed, 0) as tons_processed_total
from public.bio_nodes n
left join (
  select node_id, sum(tons_processed) as tons_processed
  from public.bio_batches
  group by node_id
) b on b.node_id = n.id;
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
-- ---------------------------------------------------------------------------
-- BioRed · Datos semilla de Managua (generado por scripts/generate-seed-sql.ts)
-- No editar a mano: ejecuta `npm run seed:sql` para regenerarlo.
-- ---------------------------------------------------------------------------

-- Usuarios (vecinos, brigadas, operario UCT-3 y administración municipal)
insert into public.users (id, name, role, district, avatar_url, eco_points, total_kg_delivered) values
  ('user-jose', 'José Mendoza', 'CITIZEN'::public.user_role, 'Distrito I', 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80', 485, 1280),
  ('user-martha', 'Doña Martha Rivas', 'CITIZEN'::public.user_role, 'Distrito I', 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=200&auto=format&fit=crop&q=80', 210, 96),
  ('user-marcos', 'Marcos Zelaya', 'BRIGADE'::public.user_role, 'Distrito II', 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&auto=format&fit=crop&q=80', 640, 742),
  ('user-operador-carmen', 'Carmen Ruiz', 'OPERATOR'::public.user_role, 'Distrito II', 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=200&auto=format&fit=crop&q=80', 0, 0),
  ('user-alma', 'Alma Lagos', 'MUNICIPAL_ADMIN'::public.user_role, 'Distrito III', 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=200&auto=format&fit=crop&q=80', 0, 0);

-- Los 4 Bio-Nodos estratégicos de Managua
insert into public.bio_nodes (id, name, district, address, latitude, longitude, capacity_ton_day, current_load_percent, status, available_mulch_kg, available_compost_kg, available_bio_pots, blade_hours_used, coordinator, phone, operating_hours) values
  ('node-luis-alfonso', 'Bio-Nodo Parque Luis Alfonso Velásquez', 'Distrito II', 'Av. Bolívar, Centro Histórico de Managua', 12.1445, -86.2735, 3.5, 45, 'available'::public.node_status, 920, 410, 64, 18.5, 'Cuadrilla Municipal Centro', '+505 8731-9014', 'Lun - Dom: 6:30 AM - 5:00 PM'),
  ('node-las-madres', 'Bio-Nodo Parque Las Madres', 'Distrito I', 'Costado Sur, Rotonda El Güegüense, Managua', 12.1328, -86.2764, 2.5, 78, 'busy'::public.node_status, 1240, 300, 48, 31.2, 'Brigada Verde Bolonia', '+505 8890-4122', 'Lun - Sáb: 7:00 AM - 4:30 PM'),
  ('node-plantel-noroeste', 'Bio-Nodo Plantel Noroeste Alcaldía', 'Distrito II', 'Km 6 Carretera Norte, entrada a San Sebastián', 12.152, -86.288, 5, 92, 'full'::public.node_status, 2100, 760, 132, 42.5, 'Gestión Ambiental ALMA', '+505 8920-5571', 'Lun - Vie: 6:00 AM - 3:30 PM'),
  ('node-japones', 'Bio-Nodo Parque Japonés / Distrito I', 'Distrito I', 'Los Robles, frente a Plaza Cuba, Managua', 12.122, -86.265, 2, 30, 'available'::public.node_status, 680, 210, 26, 9.4, 'Comité Ecológico Los Robles', '+505 8452-1190', 'Mar - Dom: 7:00 AM - 4:00 PM');

-- "Hoy en Viveros": insumos canjeables con Eco-Puntos
insert into public.nursery_items (id, node_id, provider_name, provider_avatar, title, description, category, points_cost, branches_kg_required, stock, image_url) values
  ('item-abono-5kg', 'node-las-madres', 'Brigada Verde Bolonia', 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80', 'Abono Rápido 5kg', 'Compost barrial orgánico madurado a 28 días con microorganismos eficientes de Managua.', 'COMPOST'::public.nursery_category, 40, 15, 48, 'https://images.unsplash.com/photo-1585320806297-9794b3e4eeae?w=500&auto=format&fit=crop&q=80'),
  ('item-madero-negro', 'node-japones', 'Comité Ecológico Los Robles', 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&auto=format&fit=crop&q=80', 'Planta Madero Negro', 'Especie nativa fijadora de nitrógeno para sombra y regeneración de microclimas urbanos.', 'PLANT'::public.nursery_category, 50, 25, 22, 'https://images.unsplash.com/photo-1509423350716-97f9360b4e09?w=500&auto=format&fit=crop&q=80'),
  ('item-biomaceta', 'node-luis-alfonso', 'Cuadrilla Municipal Centro', 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&auto=format&fit=crop&q=80', 'Pack 10 Bio-Macetas', 'Fabricadas con fibra de poda triturada y aglutinante vegetal. Se plantan directo en tierra.', 'BIOPOT'::public.nursery_category, 25, 10, 65, 'https://images.unsplash.com/photo-1485955900006-10f4d324d411?w=500&auto=format&fit=crop&q=80'),
  ('item-mulch-10kg', 'node-plantel-noroeste', 'Gestión Ambiental ALMA', 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=200&auto=format&fit=crop&q=80', 'Mulch Térmico 10kg', 'Corteza y astillas para cobertura de suelo: reduce 6.5°C la evaporación y ahorra 50% de agua.', 'MULCH'::public.nursery_category, 30, 20, 90, 'https://images.unsplash.com/photo-1599685315640-9ceab2f58944?w=500&auto=format&fit=crop&q=80');

-- Feed comunitario y Retos Barriales
insert into public.community_posts (id, user_id, node_id, author_name, author_role, author_avatar, location, content, image_url, kg_contributed, likes_count, comments_count, is_challenge, challenge_goal_kg, current_kg, end_date, participants_count, tag, verified_badge, created_at) values
  ('post-1', 'user-martha', 'node-las-madres', 'Doña Martha Rivas', 'Vecina de Bolonia', 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=200&auto=format&fit=crop&q=80', 'Distrito I, Managua', '¡Hola vecinos! Hoy completamos la poda preventiva del patio y llevamos 25 kg de ramas secas al Bio-Nodo del Parque Las Madres. El proceso de triturado fue súper rápido y ya canjeamos nuestro compost de 28 días 🌱.', 'https://images.unsplash.com/photo-1592150621744-aca64f48394a?w=800&auto=format&fit=crop&q=80', 25, 64, 18, false, null, null, null, null, null, true, now() - interval '0.031 days'),
  ('post-2', 'user-marcos', 'node-luis-alfonso', 'Marcos Zelaya', 'Jardinero Urbano Independiente', 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&auto=format&fit=crop&q=80', 'Distrito II, San Antonio', 'Descargando carretilla completa en el Bio-Nodo Luis Alfonso. En vez de quemar o botar las ramas en cauces, aquí se transforman en mulch térmico. ¡Menos calor y más tierra sana para nuestra ciudad!', 'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=800&auto=format&fit=crop&q=80', 85, 92, 11, false, null, null, null, null, null, true, now() - interval '0.083 days'),
  ('post-3', 'user-marcos', 'node-japones', 'Cuadrilla Verde Nica', 'Voluntariado Ambiental', 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=200&auto=format&fit=crop&q=80', 'Los Robles, Managua', 'Jornada dominical en Los Robles. Entregamos 240 kg de biomasa triturada al nodo Parque Japonés. ¡Canjeamos 6 Bio-Macetas para reforestar el parque infantil!', 'https://images.unsplash.com/photo-1588880331179-bc9b93a8cb5e?w=800&auto=format&fit=crop&q=80', 240, 178, 34, false, null, null, null, null, null, true, now() - interval '0.208 days'),
  ('challenge-1', 'user-marcos', 'node-las-madres', 'Ing. Carlos Mendoza', 'Coordinador de Reto', 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80', 'Las Colinas, Managua', 'Reto Poda Verde Las Colinas', 'https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?w=800&auto=format&fit=crop&q=80', 940, 56, 12, true, 1500, 940, 'Domingo 5:00 PM', 38, 'Meta Biomasa Fin de Semana', true, now() - interval '1.083 days'),
  ('challenge-2', 'user-martha', 'node-japones', 'Valeria Solís', 'Coordinadora de Reto', 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&auto=format&fit=crop&q=80', 'Villa Fontana Sur', 'Brigada Limpieza Villa Fontana', 'https://images.unsplash.com/photo-1513836279014-a89f7a76ae86?w=800&auto=format&fit=crop&q=80', 1620, 88, 21, true, 2000, 1620, 'Sábado 2:00 PM', 52, 'Comunidad Activa', true, now() - interval '1.250 days');

-- Vales QR de ejemplo (programa "Rama por Planta")
insert into public.pruning_tickets (id, code, qr_code_hash, qr_payload, user_id, assigned_node_id, size_category, estimated_volume_m3, estimated_weight_kg, points_awarded, photo_url, status, created_at, verified_at, verified_by) values
  ('ticket-demo-pending', 'BIORED-MADRES-4821', 'a2f1d0e4b7c94f6b1f0a2c3d4e5f60718293a4b5c6d7e8f9012345678abcdef', 'BIORED::VALE::BIORED-MADRES-4821::MADRES::0.8M3::35PTS', 'user-jose', 'node-las-madres', 'md'::public.size_category, 0.8, 96, 35, null, 'PENDING'::public.ticket_status, now() - interval '0.042 days', null, null),
  ('ticket-demo-verified', 'BIORED-LUIS-AL-7410', 'b1c2d3e4f5061728394a5b6c7d8e9f0a1b2c3d4e5f60718293a4b5c6d7e8f901', 'BIORED::VALE::BIORED-LUIS-AL-7410::LUIS-AL::2.5M3::100PTS', 'user-jose', 'node-luis-alfonso', 'lg'::public.size_category, 2.5, 300, 100, null, 'VERIFIED'::public.ticket_status, now() - interval '4.000 days', '2026-10-13T02:51:04.693Z'::timestamptz, 'user-operador-carmen');

-- Recibos de canje
insert into public.redemptions (id, user_id, item_id, item_title, points_spent, code, created_at) values
  ('redemption-demo-1', 'user-jose', 'item-biomaceta', 'Pack 10 Bio-Macetas', 25, 'CANJE-BIO-2QK7P', now() - interval '6.000 days');

-- Lotes procesados por la UCT-3 (salidas calculadas con el motor real)
insert into public.bio_batches (id, node_id, tons_processed, moisture_percent, coarse_mulch_kg, fine_compost_kg, medium_fiber_kg, bio_pots, blade_hours, compost_ready_at, estimated_value_usd, created_at) values
  ('batch-01', 'node-las-madres', 4.1, 62, 2542, 738, 820, 172, 1.43, '2026-11-13T02:51:04.693Z'::timestamptz, 357.75, now() - interval '1.000 days'),
  ('batch-02', 'node-luis-alfonso', 4, 45, 2240, 1040, 720, 151, 1.4, '2026-11-11T02:51:04.693Z'::timestamptz, 361.5, now() - interval '3.000 days'),
  ('batch-03', 'node-japones', 4.2, 28, 2066.4, 1520.4, 613.2, 129, 1.47, '2026-11-09T02:51:04.693Z'::timestamptz, 391.54, now() - interval '5.000 days'),
  ('batch-04', 'node-luis-alfonso', 3.2, 30, 1600, 1120, 480, 101, 1.12, '2026-11-05T02:51:04.693Z'::timestamptz, 297.3, now() - interval '9.000 days'),
  ('batch-05', 'node-plantel-noroeste', 3.8, 55, 2280, 760, 760, 160, 1.33, '2026-11-02T02:51:04.693Z'::timestamptz, 337.8, now() - interval '12.000 days'),
  ('batch-06', 'node-las-madres', 4.5, 22, 2106, 1791, 603, 127, 1.58, '2026-10-29T02:51:04.693Z'::timestamptz, 423.99, now() - interval '16.000 days'),
  ('batch-07', 'node-japones', 3.9, 35, 2028, 1248, 624, 131, 1.37, '2026-10-25T02:51:04.693Z'::timestamptz, 358.92, now() - interval '20.000 days'),
  ('batch-08', 'node-plantel-noroeste', 4.4, 40, 2376, 1276, 748, 157, 1.54, '2026-10-21T02:51:04.693Z'::timestamptz, 401.34, now() - interval '24.000 days'),
  ('batch-09', 'node-luis-alfonso', 3.6, 26, 1742.4, 1346.4, 511.2, 107, 1.26, '2026-10-17T02:51:04.693Z'::timestamptz, 336.28, now() - interval '28.000 days'),
  ('batch-10', 'node-las-madres', 4.1, 30, 2050, 1435, 615, 129, 1.43, '2026-10-12T02:51:04.693Z'::timestamptz, 380.55, now() - interval '33.000 days'),
  ('batch-11', 'node-japones', 3.5, 25, 1680, 1330, 490, 103, 1.22, '2026-10-07T02:51:04.693Z'::timestamptz, 327.9, now() - interval '38.000 days');

-- Nota: las horas de cuchillas se cargaron con su valor de máquina real.
-- Para recalcularlas desde los lotes: select public.biored_recalculate_blade_hours();
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
