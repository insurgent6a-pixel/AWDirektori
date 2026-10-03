-- Upgrade for a database that already ran 2026-10-03-auto-approve-bisnis-peluang.sql.
-- (Such a database has no column settings.auto_approve_promo. A database made from the migration as it is now
-- needs nothing.)
--
-- What it brings:
-- 1. The demo switch "Auto Approve Promo" in the staff console (Moderasi, Promo). While it is on, a promo goes live
--    at once instead of waiting for review. It starts switched off.
-- 2. Hubungkan is between the two members only. An owner can no longer hand a request to staff for an introduction,
--    requests that were waiting for one go back to the owner to answer, and staff cannot read requests any more.
--
-- Run it once: paste the whole file into the SQL Editor of the Supabase project and press Run.
-- It is safe to run a second time, and nothing is deleted.

begin;

alter table public.settings add column if not exists auto_approve_promo boolean not null default false;

-- As with staff's approval, the perk still shows only while its business is public.
create or replace function private.auto_approve_promo() returns trigger
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
-- "z": triggers of one event run in name order, and this one must see what resubmit_on_edit put back in the queue.
drop trigger if exists z_auto_approve on public.promos;
create trigger z_auto_approve before insert or update on public.promos
  for each row execute function private.auto_approve_promo();

create or replace function public.set_auto_approve_promo(p_on boolean) returns void
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

revoke execute on function public.set_auto_approve_promo from public, anon;
grant execute on function public.set_auto_approve_promo to authenticated, service_role;

-- The owner accepts or declines. It is between the two members: staff take no part (connections_read).
-- (The status 'intro', an introduction through staff, is no longer given.)
create or replace function public.respond_connection(p_id uuid, p_action text) returns void
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

update public.connections set status = 'pending' where status = 'intro';

drop policy if exists connections_read on public.connections;
create policy connections_read on public.connections for select to authenticated
  using ((select auth.uid()) in (from_id, to_id)); -- between the two members: staff do not see requests

commit;

notify pgrst, 'reload schema';
