-- Upgrade for a database that already ran 2026-10-03-b-auto-approve-promo-direct-connections.sql.
-- (Such a database has no view graduate_feed. A database made from the migration as it is now needs nothing.)
--
-- What it brings:
-- 1. Hubungkan is open to every signed-in member, verified as a graduate or not. Staff accounts still take no part.
--    The owner sees who is asking and accepts or declines, as before.
-- 2. The "Profil lulusan" popup is public: a visitor who taps an owner's name sees the person's full name, nickname,
--    programs and batch numbers. Only verified graduates with a live business or an open Peluang are shown.
--
-- Run it once: paste the whole file into the SQL Editor of the Supabase project and press Run.
-- It is safe to run a second time, and nothing is deleted.

begin;

-- Hubungkan: a short request to a business, or an answer to a Peluang.
create or replace function public.connect(p_message text, p_business uuid default null, p_peluang uuid default null) returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_to       uuid;
  v_business uuid := p_business;
  v_id       uuid;
begin
  -- Any signed-in member may ask, verified or not: the owner sees who is asking and decides. Staff take no part.
  if auth.uid() is null or is_staff() then
    raise exception 'Hubungkan hanya untuk akun anggota.' using errcode = '42501';
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

-- The person behind a public listing or Peluang, for the "Profil lulusan" popup. Only verified graduates who already
-- show something on the site: signing up, or being verified, alone puts nobody here.
create or replace view public.graduate_feed as
select p.id, p.full_name, p.nickname, p.programs, p.batch_lp, p.batch_ib, p.batch_ia
from public.profiles p
where p.verification = 'approved'
  and (exists (select 1 from public.businesses b where b.owner_id = p.id and b.visible)
       or exists (select 1 from public.peluang_feed f where f.owner_id = p.id));

revoke all on public.graduate_feed from anon, authenticated;
grant select on public.graduate_feed to anon, authenticated, service_role;

commit;

notify pgrst, 'reload schema';
