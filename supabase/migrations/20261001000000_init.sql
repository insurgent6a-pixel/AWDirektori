-- AsiaWorks Direktori: tables, row-level security and RPC for a fresh Supabase project.
-- Run once in the SQL Editor (or `supabase db push`).
--
-- The browser only holds the anon key, so every rule is enforced here, never in the UI:
--   * RLS + column grants   who may read or write which rows and columns
--   * security definer RPC  the few actions that cross those lines (review, contacts, RSVP)
--   * *_feed views + search the only public projection of the data

create extension if not exists postgis with schema extensions;
create extension if not exists pgcrypto with schema extensions;

create schema if not exists private; -- never exposed through the API
revoke all on schema private from public, anon, authenticated;

-- Contact encryption key lives in Supabase Vault, so a database dump alone cannot read contacts.
do $$
begin
  if not exists (select 1 from vault.secrets where name = 'aw_contact_key') then
    perform vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'aw_contact_key');
  end if;
end $$;

create function private.contact_key() returns text
language sql stable security definer set search_path = '' as
$$ select decrypted_secret from vault.decrypted_secrets where name = 'aw_contact_key' $$;

create function private.enc(v text) returns bytea
language sql security definer set search_path = '' as
$$ select extensions.pgp_sym_encrypt(v, private.contact_key()) $$;

create function private.dec(v bytea) returns text
language sql stable security definer set search_path = '' as
$$ select extensions.pgp_sym_decrypt(v, private.contact_key()) $$;

-- Links are rendered as <a href>, so only http(s) may be stored (no javascript: URLs).
create function private.all_http(urls text[]) returns boolean
language sql immutable as
$$ select coalesce(array_ndims(urls), 1) = 1
      and coalesce(bool_and(u is not null and u ~* '^https?://[^\s]+$'), true)
   from unnest(urls) u $$;

-- A member's image must sit in their own storage folder, so nobody can attach someone else's file to their content.
create function private.own_media(path text) returns boolean
language sql stable as
$$ select path is null or path like (select auth.uid())::text || '/%' $$;

-- "kopi sus" -> 'kopi:* & sus:*' so search matches while the user is still typing.
create function private.tsq(q text) returns tsquery
language sql immutable as $$
  select to_tsquery('simple', string_agg(w || ':*', ' & '))
  from regexp_split_to_table(lower(regexp_replace(coalesce(q, ''), '[^[:alnum:]]+', ' ', 'g')), '\s+') w
  where w <> ''
$$;

-- ───────────────────────────── Types ─────────────────────────────

create type public.user_role           as enum ('member', 'staff');
create type public.verification_status as enum ('draft', 'pending', 'approved', 'rejected');
create type public.review_status       as enum ('draft', 'pending', 'approved', 'rejected', 'suspended');
create type public.service_type        as enum ('produk', 'jasa', 'keduanya');
create type public.location_mode       as enum ('exact', 'area');
create type public.peluang_kind        as enum ('supplier', 'partner', 'vendor', 'konsultan', 'freelancer', 'karyawan');
create type public.event_kind          as enum ('meetup', 'workshop', 'gathering');
create type public.connection_status   as enum ('pending', 'accepted', 'declined', 'intro');
create type public.rsvp_status         as enum ('going', 'waitlist');
create type public.privacy_kind        as enum ('export', 'delete');

-- Image columns hold a path inside our own bucket ({uid}/{file}), never an external URL.
create domain public.media_path as text check (value ~ '^[0-9a-f-]{36}/[A-Za-z0-9._-]+$');

-- ───────────────────────────── Tables ─────────────────────────────

create table public.profiles (
  id                uuid primary key references auth.users on delete cascade,
  role              public.user_role not null default 'member',
  full_name         text not null default '',
  nickname          text,
  -- The AsiaWorks programs this person says they finished, and the batch number of each. Asking for verification
  -- takes at least one program. LP needs its batch number; IB and IA may go without one.
  programs          text[] not null default '{}' check (programs <@ array['IB', 'IA', 'LP']),
  batch_lp          int check (batch_lp > 0),
  batch_ib          int check (batch_ib > 0),
  batch_ia          int check (batch_ia > 0),
  verification      public.verification_status not null default 'draft',
  verification_note text,
  created_at        timestamptz not null default now(),
  constraint profiles_batch_of_a_chosen_program check (
    (batch_lp is null or 'LP' = any (programs)) and (batch_ib is null or 'IB' = any (programs)) and (batch_ia is null or 'IA' = any (programs)))
);

create table public.businesses (
  id             uuid primary key default gen_random_uuid(),
  owner_id       uuid not null references public.profiles on delete cascade,
  name           text, -- optional: the owner's name is shown when empty
  description    text not null default '',
  category       text not null check (btrim(category) <> ''),
  category_other text,
  service_type   public.service_type,
  links          text[] not null default '{}' check (private.all_http(links)),
  image_path     public.media_path,
  online_only    boolean not null default false, -- hide every location, appear as online
  status         public.review_status not null default 'draft',
  review_note    text,
  consent_at     timestamptz, -- the owner's consent to publish
  active         boolean not null default true, -- the owner's on/off switch
  views          int not null default 0,
  created_at     timestamptz not null default now(),
  -- Publishing needs two things: the owner's consent and a moderator's approval.
  visible        boolean generated always as (status = 'approved' and consent_at is not null and active) stored,
  -- Punctuation becomes a space, exactly as private.tsq does to the query, so "logo/kemasan" is found by "kemasan".
  fts            tsvector generated always as (to_tsvector('simple'::regconfig, regexp_replace(
                   coalesce(name, '') || ' ' || description || ' ' || category || ' ' || coalesce(category_other, ''),
                   '[^[:alnum:]]+', ' ', 'g'))) stored,
  -- The submit rules keep holding after a listing is sent: an owner can edit a live listing, not empty it.
  check (status in ('draft', 'rejected') or (btrim(description) <> '' and cardinality(links) > 0))
);
create index businesses_fts on public.businesses using gin (fts);

create table public.locations (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses on delete cascade,
  label       text,
  address     text,
  city        text not null check (btrim(city) <> ''),
  area        text not null check (btrim(area) <> ''),
  mode        public.location_mode not null default 'exact', -- 'area' = approximate
  lat         double precision not null check (lat between -90 and 90),
  lng         double precision not null check (lng between -180 and 180),
  created_at  timestamptz not null default now(),
  geog        geography(Point, 4326) generated always as (st_setsrid(st_makepoint(lng, lat), 4326)::geography) stored
);
create index locations_geog on public.locations using gist (geog);

-- One deal per business, shown on its card as the "GLP perk". The code is for graduates only.
create table public.promos (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null unique references public.businesses on delete cascade,
  title       text not null,
  code        text not null,
  valid_until date,
  active      boolean not null default true,
  status      public.review_status not null default 'pending',
  review_note text,
  created_at  timestamptz not null default now()
);

create table public.peluang (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references public.profiles on delete cascade,
  business_id uuid references public.businesses on delete cascade, -- optional
  kind        public.peluang_kind not null,
  title       text not null,
  description text not null,
  area        text,
  deadline    date,
  status      public.review_status not null default 'pending',
  review_note text,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

create table public.connections (
  id           uuid primary key default gen_random_uuid(),
  from_id      uuid not null references public.profiles on delete cascade,
  to_id        uuid not null references public.profiles on delete cascade,
  business_id  uuid references public.businesses on delete cascade,
  peluang_id   uuid references public.peluang on delete cascade,
  message      text not null,
  status       public.connection_status not null default 'pending',
  created_at   timestamptz not null default now(),
  responded_at timestamptz,
  check (from_id <> to_id)
);
-- One open request per sender and target. Two taps at the same moment cannot both get in.
create unique index connections_one_open on public.connections (from_id, to_id, business_id, peluang_id)
  nulls not distinct where status in ('pending', 'intro');

create table public.contact_views (
  business_id uuid not null references public.businesses on delete cascade,
  viewer_id   uuid not null references public.profiles on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (business_id, viewer_id)
);

create table public.saves (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles on delete cascade,
  business_id uuid references public.businesses on delete cascade,
  peluang_id  uuid references public.peluang on delete cascade,
  created_at  timestamptz not null default now(),
  check (num_nonnulls(business_id, peluang_id) = 1),
  unique (user_id, business_id),
  unique (user_id, peluang_id)
);

create table public.events (
  id          uuid primary key default gen_random_uuid(),
  kind        public.event_kind not null,
  title       text not null,
  description text not null default '',
  starts_at   timestamptz not null,
  ends_at     timestamptz,
  venue       text not null,
  city        text not null,
  capacity    int check (capacity > 0), -- null = unlimited
  fee         text,
  image_path  public.media_path,
  host_id     uuid references public.profiles on delete cascade, -- the graduate who offered to host; offers go with the account
  status      public.review_status not null default 'pending',
  review_note text,
  created_at  timestamptz not null default now()
);

create table public.rsvps (
  event_id   uuid not null references public.events on delete cascade,
  user_id    uuid not null references public.profiles on delete cascade,
  status     public.rsvp_status not null,
  created_at timestamptz not null default now(),
  primary key (event_id, user_id)
);

-- A collaboration story between two businesses. Public only while both owners agree.
create table public.stories (
  id         uuid primary key default gen_random_uuid(),
  title      text not null,
  body       text not null,
  image_path public.media_path,
  business_a uuid not null references public.businesses on delete cascade,
  business_b uuid not null references public.businesses on delete cascade,
  agree_a    boolean not null default false,
  agree_b    boolean not null default false,
  created_by uuid references public.profiles on delete set null,
  created_at timestamptz not null default now(),
  -- A stamp of the text. An owner agrees to the version they were shown (story_consent).
  version    text generated always as (md5(title || body || coalesce(image_path, '') || business_a::text || business_b::text)) stored,
  check (business_a <> business_b)
);

-- The banner at the top, put up by staff: an announcement (no business), or an ad for one business. Members cannot
-- add one, so nothing waits for review: a banner is live while it is switched on (and, for an ad, while its business
-- is public: see banner_feed).
create table public.banners (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  body        text,
  image_path  public.media_path,
  -- a web address, or a path on this site ("/acara"). Not "//host" or "/\host", which a browser reads as another site.
  link_url    text check (link_url is null or link_url ~* '^(https?://[^\s]+|/([^/\\\s][^\s]*)?)$'),
  business_id uuid references public.businesses on delete cascade,
  created_by  uuid references public.profiles on delete set null,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

create table public.reports (
  id          uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles on delete cascade,
  business_id uuid references public.businesses on delete cascade,
  peluang_id  uuid references public.peluang on delete cascade,
  reason      text not null,
  created_at  timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references public.profiles on delete set null,
  check (num_nonnulls(business_id, peluang_id) = 1)
);

create table public.privacy_requests (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles on delete cascade,
  kind       public.privacy_kind not null,
  created_at timestamptz not null default now(),
  handled_at timestamptz,
  handled_by uuid references public.profiles on delete set null
);

create table public.audit_log (
  id          bigint generated always as identity primary key,
  actor_id    uuid references public.profiles on delete set null,
  action      text not null,
  target_kind text,
  target_id   uuid,
  note        text,
  created_at  timestamptz not null default now()
);

create table public.settings (
  id           boolean primary key default true check (id), -- single row
  auto_approve boolean not null default false,         -- graduates
  auto_approve_business boolean not null default false,
  auto_approve_peluang boolean not null default false,
  auto_approve_promo boolean not null default false
);
insert into public.settings default values;

-- Payments are switched off in the app. When an account is deleted the amount stays, with its date and what was
-- sold, detached from the person (user_id becomes null). purpose is a fixed code, never a sentence, so the row
-- cannot name anyone.
create table public.payments (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references public.profiles on delete set null,
  amount     int not null check (amount >= 0), -- rupiah
  purpose    text not null check (purpose in ('ad')), -- what was sold; add a code when something else is
  created_at timestamptz not null default now()
);

-- Encrypted contacts. Reachable only through the RPCs below.
create table private.profile_contact (
  user_id   uuid primary key references public.profiles on delete cascade,
  phone_enc bytea not null
);
create table private.business_contact (
  business_id uuid primary key references public.businesses on delete cascade,
  contact_enc bytea not null
);

-- ───────────────────────────── Role helpers ─────────────────────────────
-- Definer functions list pg_temp last (or use an empty search_path), so a temp table can never shadow a real one.

create function public.is_staff() returns boolean
language sql stable security definer set search_path = '' as
$$ select exists (select 1 from public.profiles where id = (select auth.uid()) and role = 'staff') $$;

-- Graduate status only ever comes from staff approval.
create function public.is_graduate() returns boolean
language sql stable security definer set search_path = '' as
$$ select exists (select 1 from public.profiles where id = (select auth.uid()) and verification = 'approved') $$;

create function public.owns_business(p_business uuid) returns boolean
language sql stable security definer set search_path = '' as
$$ select exists (select 1 from public.businesses where id = p_business and owner_id = (select auth.uid())) $$;

-- ───────────────────────────── Triggers ─────────────────────────────

create function private.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''));
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function private.handle_new_user();

-- Approximate locations are rounded to ~1 km before they are stored, so the exact point never exists.
create function private.locations_privacy() returns trigger
language plpgsql as $$
begin
  if new.mode = 'area' then
    new.lat := round(new.lat::numeric, 2);
    new.lng := round(new.lng::numeric, 2);
    new.address := null;
  end if;
  return new;
end $$;
create trigger locations_privacy before insert or update on public.locations
  for each row execute function private.locations_privacy();

-- Staff content goes live at once; anything a member submits waits for review.
create function private.set_initial_status() returns trigger
language plpgsql as $$
begin
  new.status := (case when public.is_staff() then 'approved' else 'pending' end)::public.review_status;
  return new;
end $$;
create trigger set_initial_status before insert on public.events
  for each row execute function private.set_initial_status();

-- A rejected Peluang or promo goes back to the review queue when its owner saves the form again.
create function private.resubmit_on_edit() returns trigger
language plpgsql as $$
begin
  -- A promo may be created before verification (promos_insert), so correcting one must not need it either.
  if old.status = 'rejected' and new.status = 'rejected' and not public.is_staff()
     and (tg_table_name = 'promos' or public.is_graduate()) then
    new.status := 'pending';
    new.review_note := null;
  end if;
  return new;
end $$;
-- "update of": fires when the owner saves the form, not for the on/off switch.
create trigger resubmit_on_edit before update of kind, title, description, area, deadline on public.peluang
  for each row execute function private.resubmit_on_edit();
create trigger resubmit_on_edit before update of title, code, valid_until on public.promos
  for each row execute function private.resubmit_on_edit();

-- "Auto Approve Peluang" (demo): while the switch is on, a Peluang that would wait for review goes live at once.
-- The owner must be a verified graduate, as for an approval by staff (moderate).
create function private.auto_approve_peluang() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.status = 'pending' and (select auto_approve_peluang from settings)
     and exists (select 1 from profiles where id = new.owner_id and (verification = 'approved' or role = 'staff')) then
    new.status := 'approved';
    new.review_note := null;
    if not is_staff() then -- no staff member decided this, and the log says so (staff's own changes are logged by audit_row)
      insert into audit_log (action, target_kind, target_id) values ('auto_approved', 'peluang', new.id);
    end if;
  end if;
  return new;
end $$;
-- "z": triggers of one event run in name order, and this one must see what resubmit_on_edit put back in the queue.
create trigger z_auto_approve before insert or update on public.peluang
  for each row execute function private.auto_approve_peluang();

-- "Auto Approve Promo" (demo): the same for a promo. As with staff's approval, the perk still shows only while its
-- business is public.
create function private.auto_approve_promo() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.status = 'pending' and (select auto_approve_promo from settings) then
    new.status := 'approved';
    new.review_note := null;
    if not is_staff() then
      insert into audit_log (action, target_kind, target_id) values ('auto_approved', 'promos', new.id);
    end if;
  end if;
  return new;
end $$;
create trigger z_auto_approve before insert or update on public.promos
  for each row execute function private.auto_approve_promo();

-- Owners agreed to the text they saw. Changing it asks them again.
create function private.stories_reset_consent() returns trigger
language plpgsql as $$
begin
  if (new.title, new.body, new.image_path, new.business_a, new.business_b)
     is distinct from (old.title, old.body, old.image_path, old.business_a, old.business_b) then
    new.agree_a := false;
    new.agree_b := false;
  end if;
  return new;
end $$;
create trigger stories_reset_consent before update on public.stories
  for each row execute function private.stories_reset_consent();

-- Audit log of who did what. 'status' tables log moderation decisions only, 'all' tables log every staff change.
create function private.audit_row() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_id     uuid;
  v_action text := lower(tg_op);
  v_note   text;
begin
  if not is_staff() then return null; end if;
  if tg_op = 'DELETE' then
    v_id := old.id;
  else
    v_id := new.id;
    if tg_op = 'UPDATE' and (to_jsonb(new) ->> 'status') is distinct from (to_jsonb(old) ->> 'status') then
      v_action := to_jsonb(new) ->> 'status';
      v_note := to_jsonb(new) ->> 'review_note';
    elsif tg_argv[0] = 'status' then
      return null;
    end if;
  end if;
  insert into audit_log (actor_id, action, target_kind, target_id, note)
  values (auth.uid(), v_action, tg_table_name, v_id, v_note);
  return null;
end $$;
create trigger audit after insert or update or delete on public.businesses       for each row execute function private.audit_row('status');
create trigger audit after insert or update or delete on public.peluang          for each row execute function private.audit_row('status');
create trigger audit after insert or update or delete on public.promos           for each row execute function private.audit_row('status');
create trigger audit after insert or update or delete on public.events           for each row execute function private.audit_row('all');
create trigger audit after insert or update or delete on public.banners          for each row execute function private.audit_row('all');
create trigger audit after insert or update or delete on public.stories          for each row execute function private.audit_row('all');
create trigger audit after insert or update or delete on public.reports          for each row execute function private.audit_row('all');
create trigger audit after insert or update or delete on public.privacy_requests for each row execute function private.audit_row('all');

-- A reason typed by staff can name a person or a business. When its subject is deleted (by any route), the log keeps
-- who did what and when, and forgets the words.
create function private.audit_forget() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  update audit_log set note = null where target_id = old.id and note is not null;
  return null;
end $$;
create trigger audit_forget after delete on public.profiles   for each row execute function private.audit_forget();
create trigger audit_forget after delete on public.businesses for each row execute function private.audit_forget();
create trigger audit_forget after delete on public.peluang    for each row execute function private.audit_forget();
create trigger audit_forget after delete on public.promos     for each row execute function private.audit_forget();
create trigger audit_forget after delete on public.events     for each row execute function private.audit_forget();
create trigger audit_forget after delete on public.banners    for each row execute function private.audit_forget();
create trigger audit_forget after delete on public.stories    for each row execute function private.audit_forget();

-- ───────────────────────────── RLS + grants ─────────────────────────────
-- Base tables are for owners and staff. The public reads through the feeds further down.
-- Column grants keep review state (status, consent, role, verification) out of reach of direct writes.

do $$
declare t text;
begin
  foreach t in array array['profiles', 'businesses', 'locations', 'promos', 'peluang', 'connections', 'contact_views',
                           'saves', 'events', 'rsvps', 'stories', 'banners', 'reports', 'privacy_requests',
                           'audit_log', 'settings', 'payments'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant select on public.%I to authenticated', t);
    execute format('grant all on public.%I to service_role', t);
  end loop;
end $$;

-- profiles: written only through save_profile / verify_graduate.
create policy profiles_read on public.profiles for select to authenticated
  using (id = (select auth.uid()) or public.is_staff() or (verification = 'approved' and public.is_graduate()));

-- businesses
grant insert (owner_id, name, description, category, category_other, service_type, links, image_path, online_only, active)
  on public.businesses to authenticated;
grant update (name, description, category, category_other, service_type, links, image_path, online_only, active)
  on public.businesses to authenticated;
grant delete on public.businesses to authenticated;
create policy businesses_read on public.businesses for select to authenticated
  using (owner_id = (select auth.uid()) or public.is_staff());
create policy businesses_insert on public.businesses for insert to authenticated
  with check (owner_id = (select auth.uid()) and private.own_media(image_path));
create policy businesses_update on public.businesses for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()) and private.own_media(image_path));
create policy businesses_delete on public.businesses for delete to authenticated
  using (owner_id = (select auth.uid()));

-- locations
grant insert (business_id, label, address, city, area, mode, lat, lng) on public.locations to authenticated;
grant update (label, address, city, area, mode, lat, lng) on public.locations to authenticated;
grant delete on public.locations to authenticated;
create policy locations_read on public.locations for select to authenticated
  using (public.owns_business(business_id) or public.is_staff());
create policy locations_insert on public.locations for insert to authenticated
  with check (public.owns_business(business_id));
create policy locations_update on public.locations for update to authenticated
  using (public.owns_business(business_id)) with check (public.owns_business(business_id));
create policy locations_delete on public.locations for delete to authenticated
  using (public.owns_business(business_id));

-- promos
grant insert (business_id, title, code, valid_until, active) on public.promos to authenticated;
grant update (title, code, valid_until, active) on public.promos to authenticated;
grant delete on public.promos to authenticated;
create policy promos_read on public.promos for select to authenticated
  using (public.owns_business(business_id) or public.is_staff());
create policy promos_insert on public.promos for insert to authenticated
  with check (public.owns_business(business_id));
create policy promos_update on public.promos for update to authenticated
  using (public.owns_business(business_id)) with check (public.owns_business(business_id));
create policy promos_delete on public.promos for delete to authenticated
  using (public.owns_business(business_id));

-- peluang: only graduates create them, with or without a business.
grant insert (owner_id, business_id, kind, title, description, area, deadline, active) on public.peluang to authenticated;
-- business_id is not updatable: detaching a Peluang from a suspended listing would bring it back without review.
grant update (kind, title, description, area, deadline, active) on public.peluang to authenticated;
grant delete on public.peluang to authenticated;
create policy peluang_read on public.peluang for select to authenticated
  using (owner_id = (select auth.uid()) or public.is_staff());
create policy peluang_insert on public.peluang for insert to authenticated
  with check (owner_id = (select auth.uid()) and public.is_graduate()
              and (business_id is null or public.owns_business(business_id)));
create policy peluang_update on public.peluang for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy peluang_delete on public.peluang for delete to authenticated
  using (owner_id = (select auth.uid()));

-- connections, contact_views, rsvps: written only through RPC.
create policy connections_read on public.connections for select to authenticated
  using ((select auth.uid()) in (from_id, to_id)); -- between the two members: staff do not see requests
create policy contact_views_read on public.contact_views for select to authenticated
  using (public.owns_business(business_id) or public.is_staff());
create policy rsvps_read on public.rsvps for select to authenticated
  using (user_id = (select auth.uid()) or public.is_staff());

-- saves
grant insert (user_id, business_id, peluang_id) on public.saves to authenticated;
grant delete on public.saves to authenticated;
create policy saves_read on public.saves for select to authenticated using (user_id = (select auth.uid()));
create policy saves_insert on public.saves for insert to authenticated with check (user_id = (select auth.uid()));
create policy saves_delete on public.saves for delete to authenticated using (user_id = (select auth.uid()));

-- events: staff run them, graduates may offer to host one.
grant insert (kind, title, description, starts_at, ends_at, venue, city, capacity, fee, image_path, host_id)
  on public.events to authenticated;
grant update (kind, title, description, starts_at, ends_at, venue, city, capacity, fee, image_path)
  on public.events to authenticated;
grant delete on public.events to authenticated;
create policy events_read on public.events for select to authenticated
  using (host_id = (select auth.uid()) or public.is_staff());
create policy events_insert on public.events for insert to authenticated
  with check ((public.is_staff() and (host_id is null or host_id = (select auth.uid()))) -- staff: no event in a member's name
              or (public.is_graduate() and host_id = (select auth.uid()) and private.own_media(image_path)));
create policy events_update on public.events for update to authenticated
  using (public.is_staff()) with check (public.is_staff());
create policy events_delete on public.events for delete to authenticated using (public.is_staff());

-- stories: staff write, owners consent through story_consent().
grant insert (title, body, image_path, business_a, business_b, created_by) on public.stories to authenticated;
grant update (title, body, image_path, business_a, business_b) on public.stories to authenticated;
grant delete on public.stories to authenticated;
create policy stories_read on public.stories for select to authenticated
  using (public.is_staff() or public.owns_business(business_a) or public.owns_business(business_b));
create policy stories_insert on public.stories for insert to authenticated with check (public.is_staff());
create policy stories_update on public.stories for update to authenticated
  using (public.is_staff()) with check (public.is_staff());
create policy stories_delete on public.stories for delete to authenticated using (public.is_staff());

-- banners: only staff add, change or remove one. An owner may read the ads for their own business, because deleting
-- the business has to find their pictures (private.listing_file_of_mine).
grant insert (title, body, image_path, link_url, business_id, created_by) on public.banners to authenticated;
grant update (title, body, image_path, link_url, business_id, active) on public.banners to authenticated;
grant delete on public.banners to authenticated;
create policy banners_read on public.banners for select to authenticated
  using (public.is_staff() or public.owns_business(business_id));
create policy banners_insert on public.banners for insert to authenticated with check (public.is_staff());
create policy banners_update on public.banners for update to authenticated
  using (public.is_staff()) with check (public.is_staff());
create policy banners_delete on public.banners for delete to authenticated using (public.is_staff());

-- reports
grant insert (reporter_id, business_id, peluang_id, reason) on public.reports to authenticated;
grant update (resolved_at, resolved_by) on public.reports to authenticated;
create policy reports_read on public.reports for select to authenticated
  using (reporter_id = (select auth.uid()) or public.is_staff());
create policy reports_insert on public.reports for insert to authenticated
  with check (reporter_id = (select auth.uid()));
create policy reports_update on public.reports for update to authenticated
  using (public.is_staff()) with check (public.is_staff());

-- privacy requests
grant insert (user_id, kind) on public.privacy_requests to authenticated;
grant update (handled_at, handled_by) on public.privacy_requests to authenticated;
create policy privacy_read on public.privacy_requests for select to authenticated
  using (user_id = (select auth.uid()) or public.is_staff());
create policy privacy_insert on public.privacy_requests for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy privacy_update on public.privacy_requests for update to authenticated
  using (public.is_staff()) with check (public.is_staff());

-- staff-only reads
create policy audit_read on public.audit_log for select to authenticated using (public.is_staff());
create policy settings_read on public.settings for select to authenticated using (public.is_staff());
create policy payments_read on public.payments for select to authenticated
  using (user_id = (select auth.uid()) or public.is_staff());

-- ───────────────────────────── Public feeds ─────────────────────────────
-- Views run as their owner, so each one states exactly which rows and columns the public gets.
-- Every feed checks businesses.visible: a suspended or switched-off listing disappears everywhere at once.

create view public.peluang_feed as
select p.id, p.owner_id, p.business_id, p.kind, p.title, p.description, p.area, p.deadline, p.created_at,
       coalesce(o.nickname, o.full_name) as owner_name, o.batch_lp,
       coalesce(nullif(trim(b.name), ''), bo.full_name) as business_name,
       (select count(*)::int from public.connections c where c.peluang_id = p.id) as interested
from public.peluang p
join public.profiles o on o.id = p.owner_id
left join public.businesses b on b.id = p.business_id
left join public.profiles bo on bo.id = b.owner_id
where p.status = 'approved' and p.active
  and (p.deadline is null or p.deadline >= (now() at time zone 'Asia/Jakarta')::date) -- the server runs on UTC
  and (p.business_id is null or b.visible);

create view public.event_feed as
select e.id, e.kind, e.title, e.description, e.starts_at, e.ends_at, e.venue, e.city, e.capacity, e.fee, e.image_path,
       coalesce(h.nickname, h.full_name) as host_name, h.batch_lp as host_lp,
       (select count(*)::int from public.rsvps r where r.event_id = e.id and r.status = 'going') as going,
       (select count(*)::int from public.rsvps r where r.event_id = e.id and r.status = 'waitlist') as waitlist
from public.events e
left join public.profiles h on h.id = e.host_id
where e.status = 'approved';

create view public.story_feed as
select s.id, s.title, s.body, s.image_path, s.created_at,
       s.business_a, coalesce(nullif(trim(a.name), ''), pa.full_name) as name_a,
       s.business_b, coalesce(nullif(trim(b.name), ''), pb.full_name) as name_b
from public.stories s
join public.businesses a on a.id = s.business_a
join public.profiles pa on pa.id = a.owner_id
join public.businesses b on b.id = s.business_b
join public.profiles pb on pb.id = b.owner_id
where s.agree_a and s.agree_b and a.visible and b.visible;

create view public.banner_feed as
select n.id, n.title, n.body, n.image_path, n.link_url, n.business_id, n.created_at
from public.banners n
left join public.businesses b on b.id = n.business_id
where n.active and (n.business_id is null or b.visible);

revoke all on public.peluang_feed, public.event_feed, public.story_feed, public.banner_feed from anon, authenticated;
-- service_role is named too: new hosted projects no longer grant anything on public objects by default.
grant select on public.peluang_feed, public.event_feed, public.story_feed, public.banner_feed to anon, authenticated, service_role;

-- Directory search: keyword (full-text, prefix), industry, area, city, service type, promo and distance (PostGIS).
-- Also serves the business page and saved lists through p_ids.
-- ponytail: one page of 200 rows, add keyset paging when the directory outgrows it.
create function public.search_businesses(
  p_q          text default null,
  p_category   text default null,
  p_area       text default null, -- an area name, or 'Luar Jabodetabek'
  p_city       text default null,
  p_service    public.service_type default null,
  p_promo_only boolean default false,
  p_lat        double precision default null,
  p_lng        double precision default null,
  p_radius_km  double precision default null,
  p_ids        uuid[] default null
) returns table (
  id uuid, owner_id uuid, name text, description text, category text, category_other text,
  service_type public.service_type, links text[], image_path text, online_only boolean,
  owner_name text, batch_lp int, batch_ib int, batch_ia int,
  perk text, locations jsonb, distance_km double precision, created_at timestamptz
)
language sql stable security definer set search_path = public, extensions, pg_temp as $$
  with me as (
    select case when p_lat is not null and p_lng is not null
                then st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography end as pt
  ),
  term as (select private.tsq(p_q) as q, nullif(trim(p_q), '') as raw)
  select b.id, b.owner_id,
         coalesce(nullif(trim(b.name), ''), o.full_name),
         b.description, b.category, b.category_other, b.service_type, b.links, b.image_path,
         b.online_only or loc.items is null, -- no location left to show: appear as online
         coalesce(o.nickname, o.full_name), o.batch_lp, o.batch_ib, o.batch_ia,
         pm.title,
         coalesce(loc.items, '[]'::jsonb),
         loc.dist_m / 1000.0,
         b.created_at
  from businesses b
  join profiles o on o.id = b.owner_id
  cross join me
  cross join term
  left join promos pm on pm.business_id = b.id and pm.active and pm.status = 'approved'
                     and (pm.valid_until is null or pm.valid_until >= (now() at time zone 'Asia/Jakarta')::date)
  left join lateral (
    select jsonb_agg(jsonb_build_object('id', l.id, 'label', l.label, 'address', l.address, 'city', l.city,
                                        'area', l.area, 'mode', l.mode, 'lat', l.lat, 'lng', l.lng)
                     order by l.created_at) as items,
           min(st_distance(l.geog, me.pt)) as dist_m,
           -- Makassar has its own entry in the list and is also part of Sulawesi (areaMatches in constants.ts)
           bool_or(l.area = p_area or (p_area = 'Luar Jabodetabek' and l.area <> 'Jabodetabek')
                   or (p_area = 'Sulawesi' and l.area = 'Makassar')) as area_ok,
           bool_or(l.city ilike p_city) as city_ok,
           bool_or(st_dwithin(l.geog, me.pt, p_radius_km * 1000)) as near_ok,
           string_agg(l.city || ' ' || l.area, ' ') as places
    from locations l
    where l.business_id = b.id and not b.online_only
  ) loc on true
  where b.visible
    and (p_ids is null or b.id = any (p_ids))
    and (p_category is null or b.category = p_category)
    and (p_service is null or coalesce(b.service_type, 'keduanya') in (p_service, 'keduanya')) -- no type chosen: show under both
    and (not coalesce(p_promo_only, false) or pm.id is not null)
    and (p_area is null or coalesce(loc.area_ok, false))
    and (p_city is null or coalesce(loc.city_ok, false))
    and (p_radius_km is null or me.pt is null or coalesce(loc.near_ok, false))
    -- One document per listing: its own text plus the names and places a result shows ("kopi bandung" matches).
    and (term.raw is null
         or (b.fts || to_tsvector('simple', regexp_replace(concat_ws(' ', coalesce(o.nickname, o.full_name),
                      case when nullif(trim(b.name), '') is null then o.full_name end, -- only where it is the public name
                      'LP ' || o.batch_lp, 'IA ' || o.batch_ia, 'IB ' || o.batch_ib, loc.places), '[^[:alnum:]]+', ' ', 'g'))) @@ term.q)
  order by loc.dist_m nulls last, ts_rank(b.fts, term.q) desc nulls last, b.created_at desc
  limit 200
$$;

-- ponytail: naive counter, the client dedupes per browser session. Move to a per-day table if abuse shows up.
create function public.track_view(p_business uuid) returns void
language sql security definer set search_path = public, pg_temp as
$$ update businesses set views = views + 1 where id = p_business and visible and owner_id is distinct from auth.uid() $$;

-- ───────────────────────────── Member RPC ─────────────────────────────

-- Saves the onboarding form. With p_submit it asks staff to verify (or auto-approves in demo mode).
-- p_programs are the programs the person ticked. A program given a batch number counts as ticked too.
create function public.save_profile(
  p_full_name text default null,
  p_nickname  text default null,
  p_phone     text default null,
  p_lp        int default null,
  p_ib        int default null,
  p_ia        int default null,
  p_submit    boolean default false,
  p_programs  text[] default null
) returns public.profiles
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  uid    uuid := auth.uid();
  me     public.profiles;
  picked text[];
begin
  select * into me from profiles where id = uid for update;
  if not found then raise exception 'Masuk dulu ya.' using errcode = '28000'; end if;
  if least(p_lp, p_ib, p_ia) < 1 then
    raise exception 'Angkatan diisi dengan angka mulai dari 1. Kosongkan saja kalau lupa nomornya.';
  end if;
  if not coalesce(p_programs, '{}') <@ array['IB', 'IA', 'LP'] then
    raise exception 'Program yang bisa dipilih: IB, IA, atau LP.';
  end if;
  select coalesce(array_agg(program order by ord), '{}') into picked
  from unnest(array['IB', 'IA', 'LP']) with ordinality as known (program, ord)
  where program = any (coalesce(p_programs, '{}'))
     or (program = 'IB' and p_ib is not null) or (program = 'IA' and p_ia is not null) or (program = 'LP' and p_lp is not null);

  if nullif(trim(p_phone), '') is not null then
    insert into private.profile_contact (user_id, phone_enc) values (uid, private.enc(trim(p_phone)))
    on conflict (user_id) do update set phone_enc = excluded.phone_enc;
  end if;

  -- Programs and batch numbers are what staff verify, so they lock once a request is in.
  update profiles set
    full_name = coalesce(nullif(trim(p_full_name), ''), full_name),
    nickname  = coalesce(nullif(trim(p_nickname), ''), nickname),
    programs  = case when me.verification in ('draft', 'rejected') then picked else programs end,
    batch_lp  = case when me.verification in ('draft', 'rejected') then p_lp else batch_lp end,
    batch_ib  = case when me.verification in ('draft', 'rejected') then p_ib else batch_ib end,
    batch_ia  = case when me.verification in ('draft', 'rejected') then p_ia else batch_ia end
  where id = uid
  returning * into me;

  if p_submit and me.verification in ('draft', 'rejected') then
    if me.full_name = '' or me.nickname is null
       or not exists (select 1 from private.profile_contact where user_id = uid) then
      raise exception 'Lengkapi nama, nama panggilan, dan nomor WhatsApp dulu ya.';
    end if;
    if cardinality(me.programs) = 0 then
      raise exception 'Pilih dulu program yang kamu ikuti: IB, IA, atau LP.';
    end if;
    if 'LP' = any (me.programs) and me.batch_lp is null then
      raise exception 'Angkatan LP wajib diisi kalau kamu memilih LP.';
    end if;
    update profiles set
      verification = (case when (select auto_approve from settings) then 'approved' else 'pending' end)::verification_status,
      verification_note = null
    where id = uid
    returning * into me;
    if me.verification = 'approved' then -- Auto Approve is on: no staff member decided this, and the log says so
      insert into audit_log (action, target_kind, target_id) values ('auto_approved', 'profiles', uid);
    end if;
  end if;
  return me;
end $$;

-- The member's own phone, to prefill the form.
create function public.my_phone() returns text
language sql stable security definer set search_path = public, pg_temp as
$$ select private.dec(phone_enc) from private.profile_contact where user_id = auth.uid() $$;

create function public.set_business_contact(p_business uuid, p_contact text) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not owns_business(p_business) then
    raise exception 'Bisnis tidak ditemukan.' using errcode = '42501';
  end if;
  if nullif(trim(p_contact), '') is null then raise exception 'Kontak bisnis wajib diisi.'; end if;
  insert into private.business_contact (business_id, contact_enc) values (p_business, private.enc(trim(p_contact)))
  on conflict (business_id) do update set contact_enc = excluded.contact_enc;
end $$;

-- The owner's consent to publish. A moderator's approval is the second half.
create function public.submit_business(p_business uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare b public.businesses;
begin
  select * into b from businesses where id = p_business and owner_id = auth.uid();
  if not found then raise exception 'Bisnis tidak ditemukan.' using errcode = '42501'; end if;
  if not is_graduate() then
    raise exception 'Tunggu verifikasi lulusan dari staf dulu ya, baru bisnis bisa dikirim untuk ditinjau.';
  end if;
  if b.status not in ('draft', 'rejected') then raise exception 'Bisnis ini sudah dikirim.'; end if;
  if b.description = '' or cardinality(b.links) = 0
     or not exists (select 1 from private.business_contact where business_id = p_business) then
    raise exception 'Lengkapi deskripsi, tautan, dan kontak bisnis dulu ya.';
  end if;
  if not b.online_only and not exists (select 1 from locations where business_id = p_business) then
    raise exception 'Tambahkan minimal satu lokasi, atau pilih "Online saja".';
  end if;
  -- "Auto Approve Bisnis" (demo): while the switch is on, the owner's consent is enough.
  if (select auto_approve_business from settings) then
    update businesses set status = 'approved', consent_at = now(), review_note = null where id = p_business;
    insert into audit_log (action, target_kind, target_id) values ('auto_approved', 'businesses', p_business); -- no staff member decided this
  else
    update businesses set status = 'pending', consent_at = now(), review_note = null where id = p_business;
  end if;
end $$;

-- "Lihat kontak": verified graduates only, and the owner can see who opened it.
create function public.view_contact(p_business uuid) returns text
language plpgsql security definer set search_path = public, pg_temp as $$
declare b public.businesses;
begin
  select * into b from businesses where id = p_business;
  if not found then raise exception 'Bisnis tidak ditemukan.'; end if;
  if b.owner_id = auth.uid() or is_staff() then
    null; -- owner and staff leave no trace
  elsif is_graduate() and b.visible then
    insert into contact_views (business_id, viewer_id) values (p_business, auth.uid())
    on conflict (business_id, viewer_id) do update set created_at = now();
  else
    raise exception 'Kontak hanya untuk lulusan terverifikasi.' using errcode = '42501';
  end if;
  return (select private.dec(contact_enc) from private.business_contact where business_id = p_business);
end $$;

-- The promo code behind a card's perk. Null when the caller may not see it.
create function public.promo_code(p_business uuid) returns text
language sql stable security definer set search_path = public, pg_temp as $$
  select pm.code
  from promos pm
  join businesses b on b.id = pm.business_id
  where pm.business_id = p_business
    and (b.owner_id = auth.uid() or is_staff()
         or (is_graduate() and b.visible and pm.active and pm.status = 'approved'
             and (pm.valid_until is null or pm.valid_until >= (now() at time zone 'Asia/Jakarta')::date)))
$$;

-- Hubungkan: a short request to a business, or an answer to a Peluang.
create function public.connect(p_message text, p_business uuid default null, p_peluang uuid default null) returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_to       uuid;
  v_business uuid := p_business;
  v_id       uuid;
begin
  if not is_graduate() then
    raise exception 'Hubungkan khusus lulusan terverifikasi.' using errcode = '42501';
  end if;
  if length(trim(coalesce(p_message, ''))) < 10 then
    raise exception 'Ceritakan singkat apa yang kamu cari (minimal 10 karakter).';
  end if;
  if p_peluang is not null then
    select f.owner_id, f.business_id into v_to, v_business from peluang_feed f where f.id = p_peluang;
  elsif p_business is not null then
    select b.owner_id into v_to from businesses b where b.id = p_business and b.visible;
  end if;
  if v_to is null then raise exception 'Tujuan tidak ditemukan atau sudah tidak tayang.'; end if;
  if v_to = auth.uid() then raise exception 'Ini milikmu sendiri.'; end if;
  insert into connections (from_id, to_id, business_id, peluang_id, message)
  values (auth.uid(), v_to, v_business, p_peluang, trim(p_message))
  returning id into v_id;
  return v_id;
exception when unique_violation then -- connections_one_open
  raise exception 'Permintaanmu sebelumnya masih menunggu jawaban.';
end $$;

-- The owner accepts or declines. It is between the two members: staff take no part (connections_read).
-- (The status 'intro', an introduction through staff, is no longer given.)
create function public.respond_connection(p_id uuid, p_action text) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  c  public.connections;
  st public.connection_status := (case p_action when 'accept' then 'accepted' when 'decline' then 'declined' end)::public.connection_status;
begin
  select * into c from connections where id = p_id for update;
  if not found or st is null then raise exception 'Permintaan tidak ditemukan.'; end if;
  if not (c.to_id = auth.uid() and c.status in ('pending', 'intro') and (st <> 'accepted' or is_graduate())) then
    raise exception 'Permintaan ini tidak bisa diubah.' using errcode = '42501';
  end if;
  update connections set status = st, responded_at = now() where id = p_id;
end $$;

-- The caller's requests, both directions. Contact details appear only once a request is accepted.
create function public.my_connections() returns table (
  id uuid, incoming boolean, status public.connection_status, message text, created_at timestamptz,
  other_id uuid, other_name text, other_lp int,
  business_id uuid, business_name text, peluang_id uuid, peluang_title text,
  other_phone text, other_email text, business_contact text
)
language sql stable security definer set search_path = public, pg_temp as $$
  select c.id, c.to_id = auth.uid(), c.status, c.message, c.created_at,
         o.id, coalesce(o.nickname, o.full_name), o.batch_lp,
         c.business_id, coalesce(nullif(trim(b.name), ''), bo.full_name), c.peluang_id, pl.title,
         case when c.status = 'accepted' then private.dec(pc.phone_enc) end,
         case when c.status = 'accepted' then u.email::text end,
         case when c.status = 'accepted' and c.from_id = auth.uid() then private.dec(bc.contact_enc) end
  from connections c
  join profiles o on o.id = case when c.to_id = auth.uid() then c.from_id else c.to_id end
  left join businesses b on b.id = c.business_id
  left join profiles bo on bo.id = b.owner_id
  left join peluang pl on pl.id = c.peluang_id
  left join private.profile_contact pc on pc.user_id = o.id
  left join auth.users u on u.id = o.id
  left join private.business_contact bc on bc.business_id = c.business_id
  where auth.uid() in (c.from_id, c.to_id)
  order by c.created_at desc
$$;

-- Free seats go to the waiting list, oldest first, and never past the capacity. Callers hold the event row lock.
-- A seat can also free up without a cancellation (an account is deleted, staff change the capacity); the list is
-- then settled on the next RSVP or cancellation.
create function private.fill_seats(p_event uuid) returns void
language sql security definer set search_path = '' as $$
  update public.rsvps r set status = 'going'
  where r.event_id = p_event and r.user_id in (
    select w.user_id from public.rsvps w
    where w.event_id = p_event and w.status = 'waitlist'
    order by w.created_at
    limit (select case when e.capacity is not null
                       then greatest(e.capacity - (select count(*) from public.rsvps g
                                                   where g.event_id = p_event and g.status = 'going'), 0) end
           from public.events e where e.id = p_event))
$$;

-- RSVP with a capacity limit and a waiting list. The event row is locked so two people cannot take the last seat.
create function public.rsvp(p_event uuid) returns public.rsvp_status
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  ev public.events;
  st public.rsvp_status;
  n  int;
begin
  if not is_graduate() then raise exception 'RSVP khusus lulusan terverifikasi.' using errcode = '42501'; end if;
  select * into ev from events where id = p_event and status = 'approved' for update;
  if not found then raise exception 'Acara tidak ditemukan.'; end if;
  if ev.starts_at < now() then raise exception 'Acara ini sudah lewat.'; end if;
  perform private.fill_seats(p_event); -- a seat freed by a deleted account or a new capacity goes to the waiting list first
  select r.status into st from rsvps r where r.event_id = p_event and r.user_id = auth.uid();
  if found then return st; end if;
  select count(*) into n from rsvps r where r.event_id = p_event and r.status = 'going';
  st := (case when ev.capacity is null or n < ev.capacity then 'going' else 'waitlist' end)::public.rsvp_status;
  insert into rsvps (event_id, user_id, status) values (p_event, auth.uid(), st);
  return st;
end $$;

-- Cancelling a seat hands it to the waiting list.
create function public.cancel_rsvp(p_event uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform 1 from events where id = p_event for update;
  delete from rsvps where event_id = p_event and user_id = auth.uid();
  perform private.fill_seats(p_event);
end $$;

-- An owner agrees to (or withdraws from) a story about their business.
create function public.story_consent(p_story uuid, p_agree boolean, p_version text default null) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  update stories s set
    agree_a = case when owns_business(s.business_a) then p_agree else s.agree_a end,
    agree_b = case when owns_business(s.business_b) then p_agree else s.agree_b end
  where s.id = p_story and (owns_business(s.business_a) or owns_business(s.business_b))
    and (not p_agree or s.version = p_version); -- agreeing is for the text the owner was shown; withdrawing always works
  if not found then
    raise exception 'Cerita tidak ditemukan, atau isinya baru saja diubah. Muat ulang lalu baca lagi sebelum menyetujui.'
      using errcode = '42501';
  end if;
end $$;

-- ───────────────────────────── Staff RPC ─────────────────────────────

create function public.verify_graduate(p_user uuid, p_approve boolean, p_note text default null) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not is_staff() then raise exception 'Khusus staf.' using errcode = '42501'; end if;
  -- A member who was sent back may save their data half-filled. Approving takes what asking for it takes.
  if p_approve and exists (select 1 from profiles where id = p_user and verification <> 'draft'
                           and (cardinality(programs) = 0 or ('LP' = any (programs) and batch_lp is null))) then
    raise exception 'Datanya belum lengkap: belum ada program yang dipilih, atau LP tanpa nomor angkatan. Minta orangnya mengirim ulang datanya dulu.';
  end if;
  update profiles set
    verification = (case when p_approve then 'approved' else 'rejected' end)::verification_status,
    verification_note = case when p_approve then null else p_note end -- other graduates can read approved profiles
  where id = p_user and verification <> 'draft';
  if not found then raise exception 'Pengguna tidak ditemukan atau belum mengirim data.'; end if;
  if p_approve is not true then
    -- Withdrawing a graduate takes their published content down and clears what was still in flight.
    -- Queued items become 'rejected', so they go through a normal review if the person is verified again.
    update businesses set status = (case status when 'approved' then 'suspended' else 'rejected' end)::review_status, review_note = p_note
    where owner_id = p_user and status in ('approved', 'pending');
    update peluang set status = (case status when 'approved' then 'suspended' else 'rejected' end)::review_status, review_note = p_note
    where owner_id = p_user and status in ('approved', 'pending');
    update events set status = (case status when 'approved' then 'suspended' else 'rejected' end)::review_status, review_note = p_note
    where host_id = p_user and status in ('approved', 'pending');
    update connections set status = 'declined', responded_at = now() where from_id = p_user and status in ('pending', 'intro');
  end if;
  insert into audit_log (actor_id, action, target_kind, target_id, note)
  values (auth.uid(), case when p_approve then 'approved' else 'rejected' end, 'profiles', p_user, p_note);
end $$;

-- "Auto Approve Graduates Request" (demo): approves everyone waiting, and every new request from then on.
create function public.set_auto_approve(p_on boolean) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not is_staff() then raise exception 'Khusus staf.' using errcode = '42501'; end if;
  update settings set auto_approve = p_on where id;
  if p_on then -- one log row per person, so the log can say who became a graduate this way
    with done as (
      update profiles set verification = 'approved', verification_note = null where verification = 'pending' returning id
    )
    insert into audit_log (actor_id, action, target_kind, target_id)
    select auth.uid(), 'auto_approved', 'profiles', id from done;
  end if;
  insert into audit_log (actor_id, action, target_kind, note)
  values (auth.uid(), 'auto_approve', 'settings', case when p_on then 'on' else 'off' end);
end $$;

-- "Auto Approve Bisnis" (demo): approves every listing waiting, and every new one from then on (submit_business).
create function public.set_auto_approve_business(p_on boolean) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not is_staff() then raise exception 'Khusus staf.' using errcode = '42501'; end if;
  update settings set auto_approve_business = p_on where id;
  if p_on then -- the audit trigger logs each one as approved by the staff member who flipped the switch
    update businesses b set status = 'approved', review_note = null
    where b.status = 'pending' and b.consent_at is not null
      and exists (select 1 from profiles o where o.id = b.owner_id and o.verification = 'approved');
  end if;
  insert into audit_log (actor_id, action, target_kind, note)
  values (auth.uid(), 'auto_approve_business', 'settings', case when p_on then 'on' else 'off' end);
end $$;

-- "Auto Approve Peluang" (demo): approves every Peluang waiting, and every new one from then on (z_auto_approve).
create function public.set_auto_approve_peluang(p_on boolean) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not is_staff() then raise exception 'Khusus staf.' using errcode = '42501'; end if;
  update settings set auto_approve_peluang = p_on where id;
  if p_on then -- the audit trigger logs each one as approved by the staff member who flipped the switch
    update peluang p set status = 'approved', review_note = null
    where p.status = 'pending'
      and exists (select 1 from profiles o where o.id = p.owner_id and (o.verification = 'approved' or o.role = 'staff'));
  end if;
  insert into audit_log (actor_id, action, target_kind, note)
  values (auth.uid(), 'auto_approve_peluang', 'settings', case when p_on then 'on' else 'off' end);
end $$;

-- "Auto Approve Promo" (demo): approves every promo waiting, and every new one from then on (z_auto_approve).
create function public.set_auto_approve_promo(p_on boolean) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not is_staff() then raise exception 'Khusus staf.' using errcode = '42501'; end if;
  update settings set auto_approve_promo = p_on where id;
  if p_on then -- the audit trigger logs each one as approved by the staff member who flipped the switch
    update promos set status = 'approved', review_note = null where status = 'pending';
  end if;
  insert into audit_log (actor_id, action, target_kind, note)
  values (auth.uid(), 'auto_approve_promo', 'settings', case when p_on then 'on' else 'off' end);
end $$;

-- Approve, reject, suspend or reinstate anything that is reviewed. The audit trigger records it.
create function public.moderate(p_kind text, p_id uuid, p_action text, p_note text default null) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  tbl text := case p_kind when 'business' then 'businesses' when 'peluang' then 'peluang' when 'promo' then 'promos'
                          when 'event' then 'events' end;
  st  public.review_status := (case p_action when 'approve' then 'approved' when 'reinstate' then 'approved'
                                             when 'reject' then 'rejected' when 'suspend' then 'suspended' end)::public.review_status;
  n   int;
begin
  if not is_staff() then raise exception 'Khusus staf.' using errcode = '42501'; end if;
  if tbl is null or st is null then raise exception 'Aksi tidak dikenal.'; end if;
  if p_kind = 'business' and st = 'approved' and not exists (select 1 from businesses where id = p_id and consent_at is not null) then
    raise exception 'Pemilik belum mengirim bisnis ini untuk ditinjau.';
  end if;
  -- Publishing needs a verified owner: what went down with its owner's verification must not come back while the
  -- person is still unverified. Staff hosts are exempt.
  if st = 'approved' and exists (
    select 1
    from (select owner_id as person from businesses where p_kind = 'business' and id = p_id
          union all select owner_id from peluang where p_kind = 'peluang' and id = p_id
          union all select host_id from events where p_kind = 'event' and id = p_id) t
    join profiles pr on pr.id = t.person
    where pr.verification <> 'approved' and pr.role <> 'staff') then
    raise exception 'Pemilik atau tuan rumahnya belum jadi lulusan terverifikasi. Setujui dulu orangnya di Verifikasi.';
  end if;
  execute format('update public.%I set status = $1, review_note = $2 where id = $3', tbl) using st, p_note, p_id;
  get diagnostics n = row_count;
  if n = 0 then raise exception 'Data tidak ditemukan.'; end if;
end $$;

-- Members with their private contact details, for verification and privacy requests.
create function public.staff_users() returns table (
  id uuid, role public.user_role, full_name text, nickname text, programs text[], batch_lp int, batch_ib int, batch_ia int,
  verification public.verification_status, verification_note text, created_at timestamptz, email text, phone text
)
language sql stable security definer set search_path = public, pg_temp as $$
  select p.id, p.role, p.full_name, p.nickname, p.programs, p.batch_lp, p.batch_ib, p.batch_ia,
         p.verification, p.verification_note, p.created_at, u.email::text, private.dec(pc.phone_enc)
  from profiles p
  join auth.users u on u.id = p.id
  left join private.profile_contact pc on pc.user_id = p.id
  where is_staff()
  order by p.created_at desc
$$;

create function public.staff_overview() returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  select case when is_staff() then jsonb_build_object(
    'members',            (select count(*) from profiles where role = 'member'),
    'graduates',          (select count(*) from profiles where role = 'member' and verification = 'approved'),
    'graduates_pending',  (select count(*) from profiles where role = 'member' and verification = 'pending'),
    'businesses_live',    (select count(*) from businesses where visible),
    'businesses_pending', (select count(*) from businesses where status = 'pending'),
    'businesses_suspended', (select count(*) from businesses where status = 'suspended'),
    'businesses_total',   (select count(*) from businesses),
    'peluang_pending',    (select count(*) from peluang where status = 'pending'),
    'promos_pending',     (select count(*) from promos where status = 'pending'),
    'events_pending',     (select count(*) from events where status = 'pending'),
    'events_upcoming',    (select count(*) from events where status = 'approved' and starts_at >= now()),
    'reports_open',       (select count(*) from reports where resolved_at is null),
    'intros',             (select count(*) from connections where status = 'intro'),
    'privacy_open',       (select count(*) from privacy_requests where handled_at is null),
    'connections_week',   (select count(*) from connections where created_at > now() - interval '7 days'),
    'signups_week',       (select count(*) from profiles where role = 'member' and created_at > now() - interval '7 days')
  ) end
$$;

-- The audit screen: the latest staff actions with the actor's name and, while it still exists, the name of what was
-- acted on. Names are looked up when the log is read and never stored, so a deleted account leaves no name behind.
create function public.audit_feed(p_limit int default 100) returns table (
  id bigint, action text, target_kind text, note text, created_at timestamptz, actor_name text, target_name text
)
language sql stable security definer set search_path = public, pg_temp as $$
  select a.id, a.action, a.target_kind, a.note, a.created_at,
         coalesce(nullif(p.nickname, ''), p.full_name),
         case a.target_kind
           when 'profiles'   then (select t.full_name from profiles t where t.id = a.target_id)
           when 'businesses' then (select coalesce(nullif(btrim(b.name), ''), o.full_name)
                                   from businesses b join profiles o on o.id = b.owner_id where b.id = a.target_id)
           when 'peluang'    then (select t.title from peluang t where t.id = a.target_id)
           when 'promos'     then (select t.title from promos t where t.id = a.target_id)
           when 'events'     then (select t.title from events t where t.id = a.target_id)
           when 'banners'    then (select t.title from banners t where t.id = a.target_id)
           when 'stories'    then (select t.title from stories t where t.id = a.target_id)
           when 'reports'    then (select coalesce(nullif(btrim(b.name), ''), g.title)
                                   from reports r left join businesses b on b.id = r.business_id
                                   left join peluang g on g.id = r.peluang_id where r.id = a.target_id)
           when 'privacy_requests' then (select u.full_name from privacy_requests r join profiles u on u.id = r.user_id
                                         where r.id = a.target_id)
           when 'connections' then (select f.full_name || ' dan ' || t.full_name
                                    from connections c join profiles f on f.id = c.from_id join profiles t on t.id = c.to_id
                                    where c.id = a.target_id)
         end
  from audit_log a left join profiles p on p.id = a.actor_id
  where is_staff()
  order by a.created_at desc, a.id desc
  limit least(greatest(coalesce(p_limit, 100), 1), 500)
$$;

-- Privacy request: everything stored about one person, as JSON.
create function public.export_user_data(p_user uuid) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare result jsonb;
begin
  if not is_staff() then raise exception 'Khusus staf.' using errcode = '42501'; end if;
  select jsonb_build_object(
    'profil',     (select to_jsonb(p) from profiles p where p.id = p_user),
    'email',      (select u.email from auth.users u where u.id = p_user),
    'whatsapp',   (select private.dec(pc.phone_enc) from private.profile_contact pc where pc.user_id = p_user),
    'bisnis',     (select coalesce(jsonb_agg((to_jsonb(b) - 'fts') || jsonb_build_object(
                     'kontak', (select private.dec(bc.contact_enc) from private.business_contact bc where bc.business_id = b.id),
                     'lokasi', (select coalesce(jsonb_agg(to_jsonb(l) - 'geog'), '[]') from locations l where l.business_id = b.id),
                     'promo',  (select to_jsonb(pm) from promos pm where pm.business_id = b.id),
                     'iklan',  (select coalesce(jsonb_agg(to_jsonb(n)), '[]') from banners n where n.business_id = b.id),
                     'cerita', (select coalesce(jsonb_agg(to_jsonb(sy)), '[]') from stories sy where b.id in (sy.business_a, sy.business_b)))), '[]')
                   from businesses b where b.owner_id = p_user),
    'peluang',    (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from peluang x where x.owner_id = p_user),
    'koneksi',    (select coalesce(jsonb_agg(to_jsonb(c)), '[]') from connections c where p_user in (c.from_id, c.to_id)),
    'tersimpan',  (select coalesce(jsonb_agg(to_jsonb(s)), '[]') from saves s where s.user_id = p_user),
    'rsvp',       (select coalesce(jsonb_agg(to_jsonb(r)), '[]') from rsvps r where r.user_id = p_user),
    'kontak_dibuka', (select coalesce(jsonb_agg(to_jsonb(v)), '[]') from contact_views v where v.viewer_id = p_user),
    'laporan',    (select coalesce(jsonb_agg(to_jsonb(r)), '[]') from reports r where r.reporter_id = p_user),
    'acara',      (select coalesce(jsonb_agg(to_jsonb(e)), '[]') from events e where e.host_id = p_user),
    'permintaan_privasi', (select coalesce(jsonb_agg(to_jsonb(q)), '[]') from privacy_requests q where q.user_id = p_user),
    'pembayaran', (select coalesce(jsonb_agg(to_jsonb(y)), '[]') from payments y where y.user_id = p_user)
  ) into result;
  insert into audit_log (actor_id, action, target_kind, target_id) values (auth.uid(), 'export', 'profiles', p_user);
  return result;
end $$;

-- Privacy request: real deletion. Cascades remove every row; payments keep the amount without the person, and the
-- audit_forget triggers blank what staff wrote about them. The caller removes the stored files through the Storage
-- API first: the person's own folder, and the pictures staff added to what goes with the account (ads for their
-- businesses, stories about them, events they host). While one of those files is still stored, the account stays.
create function public.delete_account(p_user uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not is_staff() then raise exception 'Khusus staf.' using errcode = '42501'; end if;
  if exists (select 1 from profiles where id = p_user and role = 'staff') then
    raise exception 'Akun staf tidak bisa dihapus dari sini.';
  end if;
  if exists (
    select 1 from storage.objects o
    where o.bucket_id = 'media'
      and (o.name like p_user::text || '/%'
           or o.name in (select n.image_path from banners n join businesses b on b.id = n.business_id where b.owner_id = p_user)
           or o.name in (select s.image_path from stories s join businesses b on b.id in (s.business_a, s.business_b)
                         where b.owner_id = p_user)
           or o.name in (select e.image_path from events e where e.host_id = p_user))) then
    raise exception 'File milik akun ini masih tersimpan. Hapus dulu filenya, lalu ulangi.';
  end if;
  -- Supabase Auth keeps its own log of sign-ups and logins, with name and email. Cleared where this role may.
  if to_regclass('auth.audit_log_entries') is not null and has_table_privilege('auth.audit_log_entries', 'DELETE') then
    delete from auth.audit_log_entries
    where payload ->> 'actor_id' = p_user::text or payload -> 'traits' ->> 'user_id' = p_user::text;
  end if;
  delete from auth.users where id = p_user;
  if not found then raise exception 'Akun tidak ditemukan.'; end if;
  insert into audit_log (actor_id, action, target_kind, target_id) values (auth.uid(), 'delete', 'profiles', p_user);
end $$;

-- Signed-in only. search_businesses, track_view and the role helpers stay callable by everyone.
do $$
declare f text;
begin
  foreach f in array array['save_profile', 'my_phone', 'set_business_contact', 'submit_business', 'view_contact',
                           'promo_code', 'connect', 'respond_connection', 'my_connections', 'rsvp', 'cancel_rsvp',
                           'story_consent', 'verify_graduate', 'set_auto_approve', 'set_auto_approve_business', 'set_auto_approve_peluang', 'set_auto_approve_promo', 'moderate', 'staff_users',
                           'staff_overview', 'audit_feed', 'export_user_data', 'delete_account'] loop
    execute format('revoke execute on function public.%I from public, anon', f);
    execute format('grant execute on function public.%I to authenticated, service_role', f);
  end loop;
end $$;

-- ───────────────────────────── Storage ─────────────────────────────
-- One public bucket. Files live under the uploader's user id: {uid}/{file}.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('media', 'media', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- A story's photo, and the picture of an ad for a business, sit in the folder of the staff member who put them up.
-- Both go when the business is deleted by its owner, so that owner may remove the file too (the Storage API needs
-- read and delete for that).
create function private.listing_file_of_mine(path text) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from stories s join businesses b on b.id in (s.business_a, s.business_b)
                 where s.image_path = path and b.owner_id = auth.uid())
      or exists (select 1 from banners n join businesses b on b.id = n.business_id
                 where n.image_path = path and b.owner_id = auth.uid())
$$;

create policy aw_media_read on storage.objects for select to authenticated
  using (bucket_id = 'media' and ((storage.foldername(name))[1] = (select auth.uid())::text or public.is_staff()
                                  or private.listing_file_of_mine(name)));
create policy aw_media_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'media' and (storage.foldername(name))[1] = (select auth.uid())::text
              and array_length(storage.foldername(name), 1) = 1); -- flat: {uid}/{file}, so one listing finds every file
create policy aw_media_delete on storage.objects for delete to authenticated
  using (bucket_id = 'media' and ((storage.foldername(name))[1] = (select auth.uid())::text or public.is_staff()
                                  or private.listing_file_of_mine(name)));
