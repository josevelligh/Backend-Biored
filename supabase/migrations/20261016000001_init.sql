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
