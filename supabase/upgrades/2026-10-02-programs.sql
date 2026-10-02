-- Upgrade for a database that was made from 20261001000000_init.sql before 2 October 2026.
-- (Such a database has no column profiles.programs. A database made from the migration as it is now needs nothing.)
--
-- What it brings: on the sign-up form a member chooses the programs they finished (IB, IA, LP). LP needs its batch
-- number; IB and IA may go without one. Everyone who already gave a batch number keeps it, with its program chosen.
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

commit;

notify pgrst, 'reload schema';
