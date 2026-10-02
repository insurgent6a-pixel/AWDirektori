-- Upgrade for a database that was made from 20261001000000_init.sql before 3 October 2026.
-- (Such a database has no column settings.auto_approve_peluang. A database made from the migration as it is now
-- needs nothing.)
--
-- What it brings: two demo switches in the staff console (Moderasi), "Auto Approve Bisnis" and "Auto Approve Peluang".
-- While one is on, a listing or a Peluang from a verified graduate goes live at once instead of waiting for review.
-- Both start switched off.
--
-- Run it once: paste the whole file into the SQL Editor of the Supabase project and press Run.
-- It is safe to run a second time, and nothing is deleted.

begin;

alter table public.settings add column if not exists auto_approve_business boolean not null default false;
alter table public.settings add column if not exists auto_approve_peluang boolean not null default false;

-- The owner's consent to publish. A moderator's approval is the second half.
create or replace function public.submit_business(p_business uuid) returns void
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

-- "Auto Approve Peluang" (demo): while the switch is on, a Peluang that would wait for review goes live at once.
-- The owner must be a verified graduate, as for an approval by staff (moderate).
create or replace function private.auto_approve_peluang() returns trigger
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
drop trigger if exists z_auto_approve on public.peluang;
create trigger z_auto_approve before insert or update on public.peluang
  for each row execute function private.auto_approve_peluang();

-- "Auto Approve Bisnis" (demo): approves every listing waiting, and every new one from then on (submit_business).
create or replace function public.set_auto_approve_business(p_on boolean) returns void
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
create or replace function public.set_auto_approve_peluang(p_on boolean) returns void
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

revoke execute on function public.set_auto_approve_business, public.set_auto_approve_peluang from public, anon;
grant execute on function public.set_auto_approve_business, public.set_auto_approve_peluang to authenticated, service_role;

commit;

notify pgrst, 'reload schema';
