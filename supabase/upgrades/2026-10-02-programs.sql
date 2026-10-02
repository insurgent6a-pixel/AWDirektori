-- Upgrade for a database that was made from 20261001000000_init.sql before 2 October 2026.
-- (Such a database has no column profiles.programs. A database made from the migration as it is now needs nothing.)
--
-- What it brings: on the sign-up form a member chooses the programs they finished (IB, IA, LP). LP needs its batch
-- number; IB and IA may go without one. Everyone who already gave a batch number keeps it, with its program chosen.
-- Staff cannot approve a profile that has no program, or LP without its number. Search also finds "IA 12" and "IB 7".
--
-- Run it once: paste the whole file into the SQL Editor of the Supabase project and press Run.
-- It is safe to run a second time, and nothing is deleted.

begin;

alter table public.profiles add column if not exists programs text[] not null default '{}' check (programs <@ array['IB', 'IA', 'LP']);

-- everyone who gave a batch number for a program had chosen it
update public.profiles set programs = array_remove(array[
  case when batch_ib is not null then 'IB' end, case when batch_ia is not null then 'IA' end, case when batch_lp is not null then 'LP' end], null)
where programs = '{}' and (batch_lp is not null or batch_ib is not null or batch_ia is not null);

do $$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.profiles'::regclass and conname = 'profiles_batch_of_a_chosen_program') then
    alter table public.profiles add constraint profiles_batch_of_a_chosen_program check (
      (batch_lp is null or 'LP' = any (programs)) and (batch_ib is null or 'IB' = any (programs)) and (batch_ia is null or 'IA' = any (programs)));
  end if;
end $$;

drop function if exists public.save_profile(text, text, text, int, int, int, boolean);
drop function if exists public.save_profile(text, text, text, int, int, int, boolean, text[]);
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

drop function if exists public.staff_users();
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

revoke execute on function public.save_profile, public.staff_users from public, anon;
grant execute on function public.save_profile, public.staff_users to authenticated, service_role;

create or replace function public.verify_graduate(p_user uuid, p_approve boolean, p_note text default null) returns void
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

create or replace function public.search_businesses(
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

commit;

notify pgrst, 'reload schema';
