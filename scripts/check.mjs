// Proves the data-layer rules of BUILD.md through the real API, as real users.
//   npm run check   (local stack up, migration applied)
//   node --env-file=<file with a hosted project's URL and keys> scripts/check.mjs   (the same, against that project)
// Each step is named after the rule it proves; steps run in dependency order, not in numeric order.
// Everything this run creates is removed at the end, so it is safe next to seed data. A run that was killed half-way
// leaves its rows behind; the next run clears those first.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, opts); // service role: users, ground truth, cleanup
const anon = createClient(url, anonKey, opts);

const run = Date.now().toString(36); // tags everything this run creates
const DENIED = '42501'; // a missing grant, RLS, or an RPC that says no
const TABLES = ['profiles', 'businesses', 'locations', 'promos', 'peluang', 'connections', 'contact_views', 'saves', 'events',
  'rsvps', 'stories', 'banners', 'reports', 'privacy_requests', 'audit_log', 'settings', 'payments'];
const people = { staff: 'Sari Staf', ana: 'Ana Wijaya', budi: 'Budi Santoso', cici: 'Cici Lestari', dodi: 'Dodi Pratama', eko: 'Eko Saputra' };
const id = {}, email = {}, phone = {}, client = {}; // per person
const files = []; // storage paths to remove
const contact = `wa.me/62811${run}`; // the business contact of ana's first listing
// Ground truth the API cannot reach (the private and auth schemas), read from the local stack's own database.
// Those assertions are skipped without docker, and against a hosted project (its database is not that container).
const psql = (sql) => execFileSync('docker', ['exec', '-i', 'awdirektori-db-1', 'psql', '-U', 'postgres', '-h', '127.0.0.1', '-d', 'postgres', '-At', '-c', sql], { encoding: 'utf8', stdio: 'pipe' });
const hasPsql = /^https?:\/\/(localhost|127\.0\.0\.1)[:/]/.test(url) && (() => { try { psql('select 1'); return true; } catch { return false; } })();

let total = 0, failed = 0;
const step = async (name, fn) => {
  total++;
  try {
    console.log(`${(await fn()) === 'skipped' ? '- skipped' : '✓'} ${name}`);
  } catch (e) {
    failed++;
    const line = e.stack?.match(/check\.mjs:(\d+)/)?.[1];
    console.log(`✗ ${name}\n    ${line ? `line ${line}: ` : ''}${String(e.message).replaceAll('\n', '\n    ')}`);
  }
};

// Removes what one run created: its content by the run tag, then its users (which cascades to all their rows).
async function cleanup(tag, ids) {
  await admin.from('audit_log').delete().in('actor_id', ids); // before the actors go: actor_id would turn null
  await admin.from('audit_log').delete().in('target_id', ids); // rows with no actor: approvals by the Auto Approve switch
  for (const t of ['events', 'banners', 'stories']) await admin.from(t).delete().like('title', `%${tag}%`);
  await admin.from('payments').delete().in('user_id', ids);
  for (const uid of ids) {
    const { data: left } = await admin.storage.from('media').list(uid);
    if (left?.length) await admin.storage.from('media').remove(left.map((f) => `${uid}/${f.name}`));
    await admin.auth.admin.deleteUser(uid);
  }
}

// Leftovers of a run that never reached its cleanup (the process was stopped): check-<tag>-<name>@check.awdirektori.test.
{
  const { data: all } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const stale = new Map();
  for (const u of all?.users ?? []) {
    const tag = /^check-([a-z0-9]+)-[a-z]+@check\.awdirektori\.test$/.exec(u.email ?? '')?.[1];
    if (tag) stale.set(tag, [...(stale.get(tag) ?? []), u.id]);
  }
  for (const [tag, ids] of stale) {
    await cleanup(tag, ids);
    console.log(`cleared the leftovers of an unfinished run (${tag}, ${ids.length} users)`);
  }
}

const SWITCHES = { auto_approve: false, auto_approve_business: false, auto_approve_peluang: false, auto_approve_promo: false };
const { data: settings } = await admin.from('settings').select(Object.keys(SWITCHES).join()).single().throwOnError();

try {
  await admin.from('settings').update(SWITCHES).eq('id', true).throwOnError(); // start from the normal flow
  for (const n of Object.keys(people)) {
    email[n] = `check-${run}-${n}@check.awdirektori.test`;
    phone[n] = `0811-${run}-${n}`;
    // sign-up is open, so the metadata is the visitor's own words: only full_name may be used
    const made = await admin.auth.admin.createUser({ email: email[n], password: run + run, email_confirm: true, user_metadata: { full_name: people[n], role: 'staff', verification: 'approved' } });
    if (made.error) throw made.error;
    id[n] = made.data.user.id;
    client[n] = createClient(url, anonKey, opts);
    const signedIn = await client[n].auth.signInWithPassword({ email: email[n], password: run + run });
    if (signedIn.error) throw signedIn.error;
  }
  await admin.from('profiles').update({ role: 'staff' }).eq('id', id.staff).throwOnError();
  const { staff, ana, budi, cici, dodi, eko } = client;
  // ana, budi, cici, eko become verified graduates; dodi never does.
  let kopi, kelas, batik, need, job, meetup, workshop, news, ad, story; // ids shared between steps

  await step('2 sign-up creates a profile: member, draft, full_name from metadata (which cannot grant a role)', async () => {
    const { data } = await dodi.from('profiles').select().single().throwOnError(); // single: sees no one else
    assert.deepEqual([data.id, data.role, data.verification, data.full_name], [id.dodi, 'member', 'draft', people.dodi]);
  });

  await step('3 onboarding: save and continue later; a program must be chosen (IB, IA or LP); LP needs its batch number, IB and IA do not; role, verification, programs and batches are locked', async () => {
    for (const n of ['ana', 'budi', 'cici', 'dodi', 'eko']) {
      const { data } = await client[n].rpc('save_profile', { p_nickname: people[n].split(' ')[0], p_phone: phone[n] }).throwOnError();
      assert.equal(data.verification, 'draft', n);
    }
    // asking for verification: not with nothing chosen, not with LP chosen but its number missing; only the three programs exist
    assert.match((await ana.rpc('save_profile', { p_submit: true })).error?.message, /Pilih dulu program/);
    assert.match((await ana.rpc('save_profile', { p_programs: ['LP'], p_submit: true })).error?.message, /Angkatan LP wajib/);
    assert.match((await ana.rpc('save_profile', { p_programs: ['IB', 'LP'], p_ib: 3, p_submit: true })).error?.message, /Angkatan LP wajib/);
    assert.match((await ana.rpc('save_profile', { p_programs: ['GLP'] })).error?.message, /IB, IA, atau LP/);
    // a draft may hold LP without its number until it is sent (the refused requests above saved nothing)
    const { data: draft } = await ana.rpc('save_profile', { p_programs: ['LP'] }).throwOnError();
    assert.deepEqual([draft.verification, draft.programs, draft.batch_lp], ['draft', ['LP'], null]);
    // IB and IA go without a number; a number given for a program counts as choosing it; what is not sent again is dropped
    const { data: light } = await budi.rpc('save_profile', { p_programs: ['IA', 'IB'] }).throwOnError();
    assert.deepEqual([light.programs, light.batch_ib, light.batch_ia, light.batch_lp], [['IB', 'IA'], null, null, null]);
    const { data: numbered } = await budi.rpc('save_profile', { p_programs: ['IB'], p_ia: 6 }).throwOnError();
    assert.deepEqual([numbered.programs, numbered.batch_ia], [['IB', 'IA'], 6]);
    const { data: cleared } = await budi.rpc('save_profile', {}).throwOnError();
    assert.deepEqual([cleared.programs, cleared.batch_ia], [[], null]);
    assert.equal((await admin.from('profiles').update({ batch_ia: 5 }).eq('id', id.budi)).error?.code, '23514'); // the table agrees: no number without its program
    // IB and IA, without a number for either, are enough to ask (staff send it back, so budi asks again with his numbers in step 4)
    const { data: ib } = await budi.rpc('save_profile', { p_programs: ['IB', 'IA'], p_submit: true }).throwOnError();
    assert.deepEqual([ib.verification, ib.programs, ib.batch_ib, ib.batch_ia, ib.batch_lp], ['pending', ['IB', 'IA'], null, null, null]);
    await staff.rpc('verify_graduate', { p_user: id.budi, p_approve: false, p_note: 'Nomor angkatannya menyusul' }).throwOnError();
    const { data: sent } = await ana.rpc('save_profile', { p_lp: 12, p_submit: true }).throwOnError();
    assert.deepEqual([sent.verification, sent.programs, sent.batch_lp, sent.batch_ib, sent.batch_ia], ['pending', ['LP'], 12, null, null]);
    for (const patch of [{ role: 'staff' }, { verification: 'approved' }, { programs: ['IB'] }, { batch_lp: 1 }])
      assert.equal((await ana.from('profiles').update(patch).eq('id', id.ana)).error?.code, DENIED, JSON.stringify(patch));
    const { data: later } = await ana.rpc('save_profile', { p_lp: 99, p_ib: 7, p_programs: ['IA'] }).throwOnError();
    assert.deepEqual([later.role, later.verification, later.programs, later.batch_lp, later.batch_ib], ['member', 'pending', ['LP'], 12, null]);
  });

  await step('4 verify_graduate: staff only; reject with a note, approve; a half-filled profile cannot be approved; an approval note goes to the audit log, not the profile', async () => {
    assert.equal((await ana.rpc('verify_graduate', { p_user: id.ana, p_approve: true })).error?.code, DENIED);
    // budi was sent back in step 3. What he saves without asking again may be half-filled, and that cannot be approved.
    for (const half of [{ p_programs: ['LP'] }, {}]) {
      await budi.rpc('save_profile', half).throwOnError();
      assert.match((await staff.rpc('verify_graduate', { p_user: id.budi, p_approve: true })).error?.message, /belum lengkap/, JSON.stringify(half));
    }
    assert.equal((await budi.from('profiles').select('verification').eq('id', id.budi).single().throwOnError()).data.verification, 'rejected');
    await staff.rpc('verify_graduate', { p_user: id.ana, p_approve: false, p_note: 'Angkatan LP belum cocok' }).throwOnError();
    const { data: me } = await ana.from('profiles').select().eq('id', id.ana).single().throwOnError();
    assert.deepEqual([me.verification, me.verification_note], ['rejected', 'Angkatan LP belum cocok']);
    await ana.rpc('save_profile', { p_lp: 13, p_submit: true }).throwOnError(); // fixes the batch and asks again
    await budi.rpc('save_profile', { p_lp: 9, p_ib: 4, p_ia: 6, p_submit: true }).throwOnError();
    for (const n of ['ana', 'budi']) {
      await staff.rpc('verify_graduate', { p_user: id[n], p_approve: true, p_note: `Cocok: ${n}` }).throwOnError();
      const { data } = await client[n].from('profiles').select('verification, verification_note').eq('id', id[n]).single().throwOnError();
      assert.deepEqual(data, { verification: 'approved', verification_note: null }, n);
      const { data: log } = await staff.from('audit_log').select('note').match({ action: 'approved', target_id: id[n] }).throwOnError();
      assert.deepEqual(log, [{ note: `Cocok: ${n}` }], n);
    }
  });

  await step('5 auto approve: staff only; on approves the queue and every new request; off restores review; the console counts members only', async () => {
    const ask = { p_lp: 21, p_submit: true };
    assert.equal((await cici.rpc('save_profile', ask).throwOnError()).data.verification, 'pending');
    assert.equal((await ana.rpc('set_auto_approve', { p_on: true })).error?.code, DENIED);
    assert.equal((await ana.from('settings').update({ auto_approve: true }).eq('id', true)).error?.code, DENIED);
    // "on" approves everyone waiting, the seed's members included: note them and put them straight back
    const { data: others } = await admin.from('profiles').select('id').eq('verification', 'pending').neq('id', id.cici).throwOnError();
    try {
      await staff.rpc('set_auto_approve', { p_on: true }).throwOnError();
      assert.equal((await cici.from('profiles').select('verification').eq('id', id.cici).single().throwOnError()).data.verification, 'approved');
      assert.equal((await eko.rpc('save_profile', ask).throwOnError()).data.verification, 'approved');
      // the log names each person approved this way: the queue under the staff member who flipped the switch, a new request under nobody
      const { data: auto } = await staff.from('audit_log').select('target_id, actor_id').eq('action', 'auto_approved').in('target_id', [id.cici, id.eko]).throwOnError();
      assert.deepEqual(auto.map((r) => `${r.target_id} by ${r.actor_id}`).sort(), [`${id.cici} by ${id.staff}`, `${id.eko} by null`].sort());
    } finally {
      await staff.rpc('set_auto_approve', { p_on: false });
      if (others.length) await admin.from('profiles').update({ verification: 'pending' }).in('id', others.map((p) => p.id));
    }
    assert.equal((await dodi.rpc('save_profile', ask).throwOnError()).data.verification, 'pending');
    // a staff account that fills in the form is not a graduate in waiting
    assert.equal((await staff.rpc('save_profile', { p_nickname: people.staff, p_phone: phone.staff, p_lp: 1, p_submit: true }).throwOnError()).data.verification, 'pending');
    const { count } = await admin.from('profiles').select('*', { count: 'exact', head: true }).match({ role: 'member', verification: 'pending' }).throwOnError();
    assert.equal((await staff.rpc('staff_overview').throwOnError()).data.graduates_pending, count);
  });

  await step('6 business life cycle: drafts, locked review state, http links, submit rules, approval, live edits, on/off, more listings and branches', async () => {
    // any member keeps a draft, but only a verified graduate can send it for review
    const { data: draft } = await dodi.from('businesses')
      .insert({ owner_id: id.dodi, name: 'Toko Dodi', description: 'Oleh-oleh khas', category: 'Lainnya', links: ['https://example.com/dodi'], online_only: true })
      .select().single().throwOnError();
    assert.equal(draft.status, 'draft');
    await dodi.rpc('set_business_contact', { p_business: draft.id, p_contact: 'wa.me/dodi' }).throwOnError();
    assert.match((await dodi.rpc('submit_business', { p_business: draft.id })).error?.message, /verifikasi/);
    // publishing needs the owner's consent first: staff cannot approve a listing its owner never sent
    assert.match((await staff.rpc('moderate', { p_kind: 'business', p_id: draft.id, p_action: 'approve' })).error?.message, /belum mengirim/);
    assert.equal((await anon.rpc('search_businesses', { p_ids: [draft.id] }).throwOnError()).data.length, 0);

    const { data: b } = await ana.from('businesses')
      .insert({ owner_id: id.ana, name: 'Kopi Check', description: 'Biji kopi sangrai segar', category: 'Food & Beverage', service_type: 'produk', links: ['https://example.com/kopi'] })
      .select().single().throwOnError();
    kopi = b.id;
    for (const patch of [{ status: 'approved' }, { consent_at: new Date().toISOString() }, { views: 999 }, { owner_id: id.budi }])
      assert.equal((await ana.from('businesses').update(patch).eq('id', kopi)).error?.code, DENIED, JSON.stringify(patch));
    for (const row of [{ owner_id: id.ana, status: 'approved' }, { owner_id: id.budi }]) // born approved, or someone else's
      assert.equal((await ana.from('businesses').insert({ ...row, category: 'Lainnya' })).error?.code, DENIED, JSON.stringify(row));
    for (const links of [[null], ['javascript:alert(1)'], ['https://example.com/ok', 'ftp://example.com/x']]) // rendered as <a href>: http(s) only
      assert.equal((await ana.from('businesses').update({ links }).eq('id', kopi)).error?.code, '23514', JSON.stringify(links));

    // submit needs a contact, a description, links, and a location (or online only)
    const submit = { p_business: kopi };
    assert.match((await ana.rpc('submit_business', submit)).error?.message, /Lengkapi/, 'no contact');
    await ana.rpc('set_business_contact', { p_business: kopi, p_contact: contact }).throwOnError();
    for (const [gap, fix] of [[{ description: '' }, { description: b.description }], [{ links: [] }, { links: b.links }]]) {
      await ana.from('businesses').update(gap).eq('id', kopi).throwOnError();
      assert.match((await ana.rpc('submit_business', submit)).error?.message, /Lengkapi/, JSON.stringify(gap));
      await ana.from('businesses').update(fix).eq('id', kopi).throwOnError();
    }
    assert.match((await ana.rpc('submit_business', submit)).error?.message, /lokasi/);
    await ana.from('locations').insert({ business_id: kopi, label: 'Toko', address: 'Jl. Kemang Raya 1', city: 'Jakarta Selatan', area: 'Jabodetabek', lat: -6.2607, lng: 106.8106 }).throwOnError();
    await ana.rpc('submit_business', submit).throwOnError();
    const { data: sent } = await ana.from('businesses').select('status, consent_at').eq('id', kopi).single().throwOnError();
    assert(sent.status === 'pending' && sent.consent_at);

    // pending is not public; approval publishes; an owner edit is live at once
    assert.equal((await anon.rpc('search_businesses', { p_ids: [kopi] }).throwOnError()).data.length, 0);
    await staff.rpc('moderate', { p_kind: 'business', p_id: kopi, p_action: 'approve' }).throwOnError();
    await ana.from('businesses').update({ description: 'Biji kopi sangrai segar, kirim se-Indonesia' }).eq('id', kopi).throwOnError();
    const { data: live } = await anon.rpc('search_businesses', { p_ids: [kopi] }).throwOnError();
    assert.equal(live[0]?.description, 'Biji kopi sangrai segar, kirim se-Indonesia');
    for (const [active, shown] of [[false, 0], [true, 1]]) { // the owner's switch
      await ana.from('businesses').update({ active }).eq('id', kopi).throwOnError();
      assert.equal((await anon.rpc('search_businesses', { p_ids: [kopi] }).throwOnError()).data.length, shown, `active=${active}`);
    }

    // a second listing by the same owner (no business name, online only: no location needed), and a second branch on the first
    const { data: k } = await ana.from('businesses')
      .insert({ owner_id: id.ana, description: 'Kelas desain logo lewat video', category: 'Edukasi', service_type: 'keduanya', links: ['https://example.com/kelas'], online_only: true })
      .select().single().throwOnError();
    kelas = k.id;
    await ana.rpc('set_business_contact', { p_business: kelas, p_contact: 'wa.me/kelas' }).throwOnError();
    await ana.rpc('submit_business', { p_business: kelas }).throwOnError();
    await staff.rpc('moderate', { p_kind: 'business', p_id: kelas, p_action: 'approve' }).throwOnError();
    await ana.from('locations').insert({ business_id: kopi, label: 'Cabang', city: 'Bogor', area: 'Jabodetabek', lat: -6.5971, lng: 106.806 }).throwOnError();
    const { data: both } = await anon.rpc('search_businesses', { p_ids: [kopi, kelas] }).throwOnError();
    assert.equal(both.length, 2);
    assert.equal(both.find((r) => r.id === kopi).locations.length, 2);
    assert.equal(both.find((r) => r.id === kelas).name, people.ana); // no business name: the owner's name is shown
  });

  await step('8 contacts: verified graduates only; the owner sees who opened them and leaves no trace', async () => {
    const see = { p_business: kopi };
    assert.equal((await anon.rpc('view_contact', see)).error?.code, DENIED);
    assert.equal((await dodi.rpc('view_contact', see)).error?.code, DENIED);
    assert.equal((await budi.rpc('view_contact', see).throwOnError()).data, contact);
    assert.equal((await ana.rpc('view_contact', see).throwOnError()).data, contact);
    const { data: opened } = await ana.from('contact_views').select('viewer_id, profiles(full_name)').eq('business_id', kopi).throwOnError();
    assert.deepEqual(opened, [{ viewer_id: id.budi, profiles: { full_name: people.budi } }]);
  });

  await step('8 contacts are stored encrypted (psql)', async () => {
    if (!hasPsql) return 'skipped';
    const hex = psql(`select encode(contact_enc, 'hex') from private.business_contact where business_id = '${kopi}'
                      union all select encode(phone_enc, 'hex') from private.profile_contact where user_id = '${id.ana}'`).trim().split(/\s+/);
    assert.equal(hex.length, 2); // both rows are there
    const stored = Buffer.from(hex.join(''), 'hex');
    assert(stored.length > 0 && !stored.includes(contact) && !stored.includes(phone.ana));
  });

  await step('9 location privacy: area mode rounds to 2 decimals and drops the address; online only hides locations', async () => {
    const { data: b } = await budi.from('businesses')
      .insert({ owner_id: id.budi, name: 'Batik Check', description: 'Batik tulis rumahan', category: 'Fashion & Aksesoris', service_type: 'jasa', links: ['https://example.com/batik'] })
      .select().single().throwOnError();
    batik = b.id;
    const { data: loc } = await budi.from('locations')
      .insert({ business_id: batik, address: 'Jl. Rahasia 7', city: 'Makassar', area: 'Makassar', mode: 'area', lat: -5.147665, lng: 119.432731 })
      .select().single().throwOnError();
    assert.deepEqual([loc.lat, loc.lng, loc.address], [-5.15, 119.43, null]);
    const { data: moved } = await budi.from('locations').update({ lat: -5.151234, address: 'Jl. Rahasia 8' }).eq('id', loc.id).select().single().throwOnError();
    assert.deepEqual([moved.lat, moved.address], [-5.15, null]); // on update too
    await budi.rpc('set_business_contact', { p_business: batik, p_contact: 'wa.me/batik' }).throwOnError();
    await budi.rpc('submit_business', { p_business: batik }).throwOnError();
    await staff.rpc('moderate', { p_kind: 'business', p_id: batik, p_action: 'approve' }).throwOnError();
    await ana.from('locations').insert({ business_id: kelas, address: 'Rumah', city: 'Depok', area: 'Jabodetabek', lat: -6.4, lng: 106.82 }).throwOnError();
    const { data: found } = await anon.rpc('search_businesses', { p_ids: [batik, kelas] }).throwOnError();
    const pin = found.find((r) => r.id === batik).locations[0];
    assert.deepEqual([pin.lat, pin.lng, pin.address], [-5.15, 119.43, null]);
    assert.deepEqual(found.find((r) => r.id === kelas).locations, []);
  });

  await step('10 search: keyword prefix, owner nickname but no hidden full name, city, category, area, Luar Jabodetabek, service type, distance, p_ids', async () => {
    const ours = [kopi, kelas, batik]; // every query is scoped to our own listings, so seed data cannot interfere
    for (const [args, want] of [
      [{ p_q: 'kop' }, [kopi]],
      [{ p_q: 'budi' }, [batik]], // the owner's nickname
      [{ p_q: 'LP 13' }, [kopi, kelas]], // the owner's batch, of whichever program: ana is LP 13, budi LP 9, IB 4 and IA 6
      [{ p_q: 'IA 6' }, [batik]],
      [{ p_q: 'IB 4' }, [batik]],
      [{ p_q: 'wijaya' }, [kelas]], // ana's full name: shown on her nameless listing, hidden behind 'Kopi Check'
      [{ p_city: 'bogor' }, [kopi]],
      [{ p_category: 'Fashion & Aksesoris' }, [batik]],
      [{ p_area: 'Jabodetabek' }, [kopi]],
      [{ p_area: 'Luar Jabodetabek' }, [batik]],
      [{ p_area: 'Sulawesi' }, [batik]], // batik is in Makassar, which is part of Sulawesi
      [{ p_service: 'produk' }, [kopi, kelas]], // 'keduanya' matches both service types
      [{ p_service: 'jasa' }, [kelas, batik]],
      [{ p_lat: -6.2607, p_lng: 106.8106, p_radius_km: 100 }, [kopi]],
      [{ p_ids: [batik] }, [batik]],
    ]) {
      const { data } = await anon.rpc('search_businesses', { p_ids: ours, ...args }).throwOnError();
      assert.deepEqual(data.map((r) => r.id).sort(), [...want].sort(), JSON.stringify(args));
    }
    // a listing whose owner chose no service type shows under both
    await budi.from('businesses').update({ service_type: null }).eq('id', batik).throwOnError();
    const { data: untyped } = await anon.rpc('search_businesses', { p_ids: ours, p_service: 'produk' }).throwOnError();
    assert.deepEqual(untyped.map((r) => r.id).sort(), [...ours].sort(), 'no service type');
    await budi.from('businesses').update({ service_type: 'jasa' }).eq('id', batik).throwOnError();
    // nearest first, with the distance; online only has none and comes last
    const { data: near } = await anon.rpc('search_businesses', { p_ids: ours, p_lat: -6.2607, p_lng: 106.8106 }).throwOnError();
    assert.deepEqual(near.map((r) => r.id), [kopi, batik, kelas]);
    assert(near[0].distance_km < 1 && near[1].distance_km > 1300 && near[1].distance_km < 1500 && near[2].distance_km === null);
    const { data: far } = await anon.rpc('search_businesses', { p_ids: ours, p_lat: -5.15, p_lng: 119.43 }).throwOnError();
    assert.deepEqual(far.map((r) => r.id), [batik, kopi, kelas]);
  });

  await step('11 peluang: graduates only, with or without a business; review, on/off and deadline gate the feed; a rejected one returns to the queue when its owner corrects it', async () => {
    const wanted = { kind: 'supplier', title: 'Cari supplier kain mori', description: 'Butuh 100 meter per bulan' };
    assert.equal((await dodi.from('peluang').insert({ ...wanted, owner_id: id.dodi })).error?.code, DENIED);
    assert.equal((await budi.from('peluang').insert({ ...wanted, owner_id: id.budi, status: 'approved' })).error?.code, DENIED); // born approved
    const { data: a } = await budi.from('peluang').insert({ ...wanted, owner_id: id.budi }).select().single().throwOnError();
    const { data: b } = await ana.from('peluang')
      .insert({ owner_id: id.ana, business_id: kopi, kind: 'karyawan', title: 'Cari barista', description: 'Untuk cabang Bogor' })
      .select().single().throwOnError();
    [need, job] = [a.id, b.id];
    assert.deepEqual([a.status, b.status], ['pending', 'pending']);
    assert.equal((await budi.from('peluang').update({ status: 'approved' }).eq('id', need)).error?.code, DENIED);
    assert.equal((await anon.from('peluang_feed').select('id').in('id', [need, job]).throwOnError()).data.length, 0);
    for (const p of [need, job]) await staff.rpc('moderate', { p_kind: 'peluang', p_id: p, p_action: 'approve' }).throwOnError();
    // rejected with a reason: the owner reads it and the feed drops it; the owner's correction puts it back in the queue
    await staff.rpc('moderate', { p_kind: 'peluang', p_id: need, p_action: 'reject', p_note: 'Belum jelas kebutuhannya' }).throwOnError();
    assert.deepEqual((await budi.from('peluang').select('status, review_note').eq('id', need).single().throwOnError()).data, { status: 'rejected', review_note: 'Belum jelas kebutuhannya' });
    assert.equal((await anon.from('peluang_feed').select('id').eq('id', need).throwOnError()).data.length, 0);
    await budi.from('peluang').update({ description: 'Butuh 100 meter kain mori per bulan, kirim ke Makassar' }).eq('id', need).throwOnError();
    assert.deepEqual((await budi.from('peluang').select('status, review_note').eq('id', need).single().throwOnError()).data, { status: 'pending', review_note: null });
    await staff.rpc('moderate', { p_kind: 'peluang', p_id: need, p_action: 'approve' }).throwOnError();
    for (const [patch, shown] of [[{}, 2], [{ active: false }, 1], [{ active: true, deadline: '2020-01-01' }, 1], [{ deadline: null }, 2]]) {
      if (Object.keys(patch).length) await budi.from('peluang').update(patch).eq('id', need).throwOnError();
      assert.equal((await anon.from('peluang_feed').select('id').in('id', [need, job]).throwOnError()).data.length, shown, JSON.stringify(patch));
    }
  });

  await step('5 auto approve for listings, Peluang and promos: staff only; on approves the queue and whatever is sent next, a corrected Peluang included; off restores review', async () => {
    const listing = async () => { // an online-only listing of Ana's, ready to send
      const { data } = await ana.from('businesses')
        .insert({ owner_id: id.ana, name: `Auto ${run}`, description: 'Demo', category: 'Lainnya', links: ['https://example.com/auto'], online_only: true })
        .select().single().throwOnError();
      await ana.rpc('set_business_contact', { p_business: data.id, p_contact: 'wa.me/auto' }).throwOnError();
      return data.id;
    };
    const ask = async () => (await budi.from('peluang').insert({ owner_id: id.budi, kind: 'vendor', title: `Auto ${run}`, description: 'Demo' }).select('id, status').single().throwOnError()).data;
    const statusOf = async (table, row) => (await admin.from(table).select('status').eq('id', row).single().throwOnError()).data.status;
    const perk = async (business) => (await ana.from('promos').insert({ business_id: business, title: 'Diskon demo', code: `AUTO-${run}` }).select('id, status').single().throwOnError()).data;
    const fns = ['set_auto_approve_business', 'set_auto_approve_peluang', 'set_auto_approve_promo'];
    for (const fn of fns) assert.equal((await ana.rpc(fn, { p_on: true })).error?.code, DENIED, fn);
    assert.equal((await ana.from('settings').update({ auto_approve_peluang: true }).eq('id', true)).error?.code, DENIED);

    const [queuedB, nextB] = [await listing(), await listing()];
    await ana.rpc('submit_business', { p_business: queuedB }).throwOnError();
    const queuedP = await ask();
    const queuedPerk = await perk(queuedB);
    assert.deepEqual([await statusOf('businesses', queuedB), queuedP.status, queuedPerk.status], ['pending', 'pending', 'pending']);
    const mine = [queuedB, nextB, queuedP.id, queuedPerk.id];
    // "on" approves everything waiting, the seed's rows included: note them and put them straight back
    const others = {};
    for (const table of ['businesses', 'peluang', 'promos'])
      others[table] = (await admin.from(table).select('id').eq('status', 'pending').throwOnError()).data.map((r) => r.id).filter((r) => !mine.includes(r));
    try {
      for (const fn of fns) await staff.rpc(fn, { p_on: true }).throwOnError();
      assert.deepEqual([await statusOf('businesses', queuedB), await statusOf('peluang', queuedP.id), await statusOf('promos', queuedPerk.id)], ['approved', 'approved', 'approved']);
      await ana.rpc('submit_business', { p_business: nextB }).throwOnError();
      const nextP = await ask();
      const nextPerk = await perk(nextB);
      mine.push(nextP.id, nextPerk.id);
      assert.deepEqual([await statusOf('businesses', nextB), nextP.status, nextPerk.status], ['approved', 'approved', 'approved']);
      assert.equal((await anon.rpc('search_businesses', { p_ids: [nextB] }).throwOnError()).data[0]?.perk, 'Diskon demo');
      assert.equal((await anon.rpc('search_businesses', { p_ids: [nextB] }).throwOnError()).data.length, 1);
      assert.equal((await anon.from('peluang_feed').select('id').eq('id', nextP.id).throwOnError()).data.length, 1);
      await staff.rpc('moderate', { p_kind: 'peluang', p_id: nextP.id, p_action: 'reject', p_note: 'Kurang jelas' }).throwOnError();
      await budi.from('peluang').update({ description: 'Demo, lebih jelas' }).eq('id', nextP.id).throwOnError();
      assert.equal(await statusOf('peluang', nextP.id), 'approved');
      // the log: the queue under the staff member who flipped the switch, what came after under nobody
      const { data: log } = await staff.from('audit_log').select('action, target_id, actor_id').in('target_id', mine).in('action', ['approved', 'auto_approved']).throwOnError();
      assert.deepEqual([...new Set(log.map((r) => `${r.action} ${r.target_id} by ${r.actor_id}`))].sort(), [
        `approved ${queuedB} by ${id.staff}`, `approved ${queuedP.id} by ${id.staff}`, `approved ${queuedPerk.id} by ${id.staff}`,
        `auto_approved ${nextB} by null`, `auto_approved ${nextP.id} by null`, `auto_approved ${nextPerk.id} by null`,
      ].sort());
    } finally {
      for (const fn of fns) await staff.rpc(fn, { p_on: false });
      for (const [table, rows] of Object.entries(others)) if (rows.length) await admin.from(table).update({ status: 'pending' }).in('id', rows);
    }
    const later = await ask();
    assert.equal(later.status, 'pending');
    // leave nothing for the later steps to count
    await admin.from('peluang').delete().in('id', [...mine, later.id]).throwOnError();
    await admin.from('businesses').delete().in('id', mine).throwOnError();
    await admin.from('audit_log').delete().in('target_id', mine).throwOnError();
  });

  await step('12 Hubungkan: graduates only; contact details open to both sides on acceptance, not before; decline; staff take no part and see no request', async () => {
    const hi = { p_message: 'Halo, saya ingin pesan kopi untuk acara kantor.', p_business: kopi };
    assert.equal((await dodi.rpc('connect', hi)).error?.code, DENIED);
    assert.match((await ana.rpc('connect', hi)).error?.message, /milikmu/);
    assert.match((await budi.rpc('connect', { ...hi, p_message: 'Halo kak' })).error?.message, /minimal 10/);
    const { data: req } = await budi.rpc('connect', hi).throwOnError();
    assert.match((await budi.rpc('connect', hi)).error?.message, /menunggu/); // duplicate while pending
    const { data: answer } = await cici.rpc('connect', { p_message: hi.p_message, p_peluang: need }).throwOnError();
    assert.equal((await cici.from('connections').select('to_id').eq('id', answer).single().throwOnError()).data.to_id, id.budi);

    // only the owner answers: not a bystander, not the requester (nor by a direct write), not staff (no intro asked)
    assert.equal((await cici.from('connections').select().eq('id', req).throwOnError()).data.length, 0);
    for (const n of ['cici', 'budi', 'staff'])
      assert.equal((await client[n].rpc('respond_connection', { p_id: req, p_action: 'accept' })).error?.code, DENIED, n);
    assert.equal((await budi.from('connections').update({ status: 'accepted' }).eq('id', req)).error?.code, DENIED);
    // [who looks, other side's phone, other side's email, business contact]
    for (const [status, sides] of [
      ['pending', [[budi, null, null, null], [ana, null, null, null]]],
      ['accepted', [[budi, phone.ana, email.ana, contact], [ana, phone.budi, email.budi, null]]],
    ]) {
      if (status === 'accepted') await ana.rpc('respond_connection', { p_id: req, p_action: 'accept' }).throwOnError();
      for (const [who, ...details] of sides) {
        const row = (await who.rpc('my_connections').throwOnError()).data.find((r) => r.id === req);
        assert.deepEqual([row.status, row.other_phone, row.other_email, row.business_contact], [status, ...details]);
      }
    }

    const { data: no } = await cici.rpc('connect', hi).throwOnError();
    await ana.rpc('respond_connection', { p_id: no, p_action: 'decline' }).throwOnError();
    const declined = (await cici.rpc('my_connections').throwOnError()).data.find((r) => r.id === no);
    assert.deepEqual([declined.status, declined.other_phone, declined.business_contact], ['declined', null, null]);

    // an introduction through staff is no longer on offer, and staff cannot read a request
    assert.match((await budi.rpc('respond_connection', { p_id: answer, p_action: 'intro' })).error?.message, /tidak ditemukan/);
    assert.equal((await staff.from('connections').select('id').in('id', [req, answer]).throwOnError()).data.length, 0);
    await budi.rpc('respond_connection', { p_id: answer, p_action: 'accept' }).throwOnError();
    assert.equal((await admin.from('connections').select('status').eq('id', answer).single().throwOnError()).data.status, 'accepted');
  });

  await step('12 Hubungkan: the same request sent several times at once (a double tap) leaves one pending request', async () => {
    const six = (fn, args) => Promise.all(Array.from({ length: 6 }, () => eko.rpc(fn, args)));
    await six('is_graduate'); // opens six connections, so the six requests below really overlap
    await six('connect', { p_message: 'Halo, mau tanya soal biji kopinya.', p_business: kopi });
    const { data } = await admin.from('connections').select('id').match({ from_id: id.eko, business_id: kopi }).throwOnError();
    assert.equal(data.length, 1);
  });

  await step('13 promo: reviewed, one per business; the perk shows in search (and promo-only search) until its last day, the code only to graduates; a rejected one returns to the queue when its owner corrects it', async () => {
    const promo = { business_id: kopi, title: 'Diskon 15% untuk sesama lulusan', code: `GLP-${run}` };
    assert.equal((await ana.from('promos').insert({ ...promo, status: 'approved' })).error?.code, DENIED);
    const { data: p } = await ana.from('promos').insert(promo).select().single().throwOnError();
    assert.equal(p.status, 'pending');
    assert.equal((await ana.from('promos').insert(promo)).error?.code, '23505'); // one per business
    assert.equal((await anon.rpc('search_businesses', { p_ids: [kopi] }).throwOnError()).data[0].perk, null); // pending: no perk
    await staff.rpc('moderate', { p_kind: 'promo', p_id: p.id, p_action: 'approve' }).throwOnError();
    for (const [active, perk, code] of [[true, promo.title, promo.code], [false, null, null], [true, promo.title, promo.code]]) {
      await ana.from('promos').update({ active }).eq('id', p.id).throwOnError();
      assert.equal((await anon.rpc('search_businesses', { p_ids: [kopi] }).throwOnError()).data[0].perk, perk, `active=${active}`);
      assert.equal((await budi.rpc('promo_code', { p_business: kopi }).throwOnError()).data, code, `active=${active}`);
    }
    for (const [valid_until, perk, code] of [['2020-01-01', null, null], [null, promo.title, promo.code]]) { // past its last day: no perk, no code
      await ana.from('promos').update({ valid_until }).eq('id', p.id).throwOnError();
      assert.equal((await anon.rpc('search_businesses', { p_ids: [kopi] }).throwOnError()).data[0].perk, perk, `valid_until=${valid_until}`);
      assert.equal((await budi.rpc('promo_code', { p_business: kopi }).throwOnError()).data, code, `valid_until=${valid_until}`);
    }
    // rejected with a reason: the owner reads it and the perk leaves the card; the owner's correction puts it back in the queue
    await staff.rpc('moderate', { p_kind: 'promo', p_id: p.id, p_action: 'reject', p_note: 'Kodenya kurang jelas' }).throwOnError();
    assert.deepEqual((await ana.from('promos').select('status, review_note').eq('id', p.id).single().throwOnError()).data, { status: 'rejected', review_note: 'Kodenya kurang jelas' });
    assert.equal((await anon.rpc('search_businesses', { p_ids: [kopi] }).throwOnError()).data[0].perk, null);
    await ana.from('promos').update({ code: promo.code }).eq('id', p.id).throwOnError(); // saving the form again is the correction
    assert.deepEqual((await ana.from('promos').select('status, review_note').eq('id', p.id).single().throwOnError()).data, { status: 'pending', review_note: null });
    await staff.rpc('moderate', { p_kind: 'promo', p_id: p.id, p_action: 'approve' }).throwOnError();
    assert.equal((await dodi.rpc('promo_code', { p_business: kopi }).throwOnError()).data, null); // unverified
    assert.equal((await anon.rpc('promo_code', { p_business: kopi })).error?.code, DENIED);
    const { data: deals } = await anon.rpc('search_businesses', { p_ids: [kopi, kelas, batik], p_promo_only: true }).throwOnError();
    assert.deepEqual(deals.map((r) => r.id), [kopi]);
  });

  await step('14 events: staff publish, graduates propose; RSVP with capacity, waiting list and promotion', async () => {
    const base = { kind: 'meetup', starts_at: new Date(Date.now() + 7 * 864e5).toISOString(), venue: 'Kopi Check', city: 'Jakarta Selatan' };
    const { data: m } = await staff.from('events').insert({ ...base, title: `Meetup ${run}`, capacity: 2 }).select().single().throwOnError();
    meetup = m.id;
    assert.equal(m.status, 'approved');
    assert.equal((await dodi.from('events').insert({ ...base, title: `Usul ${run}`, host_id: id.dodi })).error?.code, DENIED);
    const { data: w } = await budi.from('events').insert({ ...base, kind: 'workshop', title: `Workshop ${run}`, host_id: id.budi }).select().single().throwOnError();
    assert.deepEqual([w.status, w.host_id], ['pending', id.budi]);
    workshop = w.id;
    assert.equal((await staff.from('events').insert({ ...base, title: `Titip ${run}`, host_id: id.dodi })).error?.code, DENIED); // nor can staff publish one in a member's name
    assert.deepEqual((await anon.from('event_feed').select('id').in('id', [meetup, w.id]).throwOnError()).data, [{ id: meetup }]);
    await staff.rpc('moderate', { p_kind: 'event', p_id: w.id, p_action: 'approve' }).throwOnError();
    assert.equal((await anon.from('event_feed').select('id').in('id', [meetup, w.id]).throwOnError()).data.length, 2);

    const seat = { p_event: meetup };
    assert.equal((await dodi.rpc('rsvp', seat)).error?.code, DENIED);
    const got = [];
    for (const who of [ana, budi, cici, eko, ana, cici]) got.push((await who.rpc('rsvp', seat).throwOnError()).data); // the last two ask again
    assert.deepEqual(got, ['going', 'going', 'waitlist', 'waitlist', 'going', 'waitlist']);
    assert.equal((await eko.from('rsvps').update({ status: 'going' }).eq('event_id', meetup)).error?.code, DENIED); // no jumping the queue by a direct write
    const { data: full } = await anon.from('event_feed').select('going, waitlist').eq('id', meetup).single().throwOnError();
    assert.deepEqual(full, { going: 2, waitlist: 2 });
    await ana.rpc('cancel_rsvp', seat).throwOnError(); // frees a seat: cici is first in line, eko keeps waiting
    const { data: seats } = await admin.from('rsvps').select('user_id, status').eq('event_id', meetup).order('created_at').throwOnError();
    assert.deepEqual(seats, [{ user_id: id.budi, status: 'going' }, { user_id: id.cici, status: 'going' }, { user_id: id.eko, status: 'waitlist' }]);
    const { data: after } = await anon.from('event_feed').select('going, waitlist').eq('id', meetup).single().throwOnError();
    assert.deepEqual(after, { going: 2, waitlist: 1 });
  });

  await step('15 stories: staff write; public only while both owners agree; a new text asks both again', async () => {
    const text = { title: `Kolaborasi ${run}`, body: 'Kopi Check memakai kemasan dari Batik Check.', business_a: kopi, business_b: batik };
    assert.equal((await ana.from('stories').insert({ ...text, created_by: id.ana })).error?.code, DENIED);
    const { data: s } = await staff.from('stories').insert({ ...text, created_by: id.staff }).select().single().throwOnError();
    story = s.id;
    assert.equal((await cici.rpc('story_consent', { p_story: story, p_agree: true, p_version: s.version })).error?.code, DENIED); // not an owner
    // [who, agrees?, published?]: one yes is not enough, a withdrawal unpublishes
    for (const [who, agree, shown] of [[ana, true, 0], [budi, true, 1], [budi, false, 0], [budi, true, 1]]) {
      await who.rpc('story_consent', { p_story: story, p_agree: agree, p_version: s.version }).throwOnError();
      assert.equal((await anon.from('story_feed').select('id').eq('id', story).throwOnError()).data.length, shown);
    }
    const { data: edited } = await staff.from('stories').update({ body: `${text.body} Edisi kedua.` }).eq('id', story).select().single().throwOnError();
    assert.deepEqual([edited.agree_a, edited.agree_b], [false, false]);
    assert.equal((await anon.from('story_feed').select('id').eq('id', story).throwOnError()).data.length, 0);
    // an owner agrees to the text they were shown: the stamp of the old text is refused
    assert.equal((await ana.rpc('story_consent', { p_story: story, p_agree: true, p_version: s.version })).error?.code, DENIED);
    for (const who of [ana, budi]) await who.rpc('story_consent', { p_story: story, p_agree: true, p_version: edited.version }).throwOnError(); // published again for step 7
  });

  await step('16 saves: a business and a peluang; no duplicates; own rows only', async () => {
    for (const target of [{ business_id: kopi }, { peluang_id: need }]) {
      await cici.from('saves').insert({ user_id: id.cici, ...target }).throwOnError();
      assert.equal((await cici.from('saves').insert({ user_id: id.cici, ...target })).error?.code, '23505');
    }
    assert.equal((await cici.from('saves').insert({ user_id: id.budi, business_id: kelas })).error?.code, DENIED);
    assert.equal((await cici.from('saves').select().throwOnError()).data.length, 2);
    assert.equal((await budi.from('saves').select().throwOnError()).data.length, 0);
  });

  await step('17 reports and privacy requests: members file, only staff close; export is staff only', async () => {
    const now = new Date().toISOString();
    const { data: report } = await cici.from('reports').insert({ reporter_id: id.cici, business_id: kopi, reason: 'Tautan tidak bisa dibuka' }).select().single().throwOnError();
    const { data: request } = await budi.from('privacy_requests').insert({ user_id: id.budi, kind: 'export' }).select().single().throwOnError();
    for (const [table, row, filer, done] of [
      ['reports', report, cici, { resolved_at: now, resolved_by: id.staff }],
      ['privacy_requests', request, budi, { handled_at: now, handled_by: id.staff }],
    ]) {
      assert.equal((await filer.from(table).update(done).eq('id', row.id).select().throwOnError()).data.length, 0, `${table}: member`);
      assert.equal((await staff.from(table).update(done).eq('id', row.id).select().throwOnError()).data.length, 1, `${table}: staff`);
    }
    assert.equal((await budi.rpc('export_user_data', { p_user: id.budi })).error?.code, DENIED);
    const { data: all } = await staff.rpc('export_user_data', { p_user: id.budi }).throwOnError();
    assert.deepEqual([all.profil.id, all.email, all.whatsapp, all.bisnis.map((x) => [x.id, x.kontak])], [id.budi, email.budi, phone.budi, [[batik, 'wa.me/batik']]]);
  });

  // BUILD.md says staff "review ... ads". The owner settled what that means on 2 Oct 2026: members never submit an
  // ad, staff put every banner and ad up themselves. So there is no review step to prove here.
  await step('18 banners are staff\'s alone: an announcement or an ad for a business, live at once and switched off or on by staff; a member can neither put one up, change it nor remove it, and reads only the ads for their own business', async () => {
    const { data: n } = await staff.from('banners').insert({ title: `Pengumuman ${run}`, body: 'Gathering akbar bulan depan', created_by: id.staff }).select().single().throwOnError();
    news = n.id;
    const mine = { title: `Iklan ${run}`, link_url: 'https://example.com/kopi', business_id: kopi };
    // a member cannot put a banner up: not an ad for their own business, not one for someone else's, not an announcement
    assert.equal((await ana.from('banners').insert({ ...mine, created_by: id.ana })).error?.code, DENIED);
    assert.equal((await budi.from('banners').insert({ ...mine, created_by: id.budi })).error?.code, DENIED);
    assert.equal((await ana.from('banners').insert({ title: `Kabar ${run}`, created_by: id.ana })).error?.code, DENIED);
    // staff put the ad up for the business, and both banners are live at once
    const { data: a } = await staff.from('banners').insert({ ...mine, created_by: id.staff }).select().single().throwOnError();
    ad = a.id;
    const live = async () => (await anon.from('banner_feed').select('id').in('id', [news, ad]).order('created_at').throwOnError()).data.map((r) => r.id);
    assert.deepEqual(await live(), [news, ad]);
    // the owner of the advertised business reads that ad (deleting the business has to find its picture); nobody else reads banners
    assert.deepEqual((await ana.from('banners').select('id').in('id', [news, ad]).throwOnError()).data, [{ id: ad }]);
    assert.deepEqual((await budi.from('banners').select('id').in('id', [news, ad]).throwOnError()).data, []);
    // and can neither change nor remove it: the row is untouched
    assert.deepEqual((await ana.from('banners').update({ title: 'Punya saya' }).eq('id', ad).select().throwOnError()).data, []);
    assert.deepEqual((await ana.from('banners').delete().eq('id', ad).select().throwOnError()).data, []);
    assert.deepEqual((await admin.from('banners').select('title, active').eq('id', ad).single().throwOnError()).data, { title: `Iklan ${run}`, active: true });
    // staff switch a banner off and on; there is nothing to review, so moderate() does not know banners
    await staff.from('banners').update({ active: false }).eq('id', ad).throwOnError();
    assert.deepEqual(await live(), [news]);
    await staff.from('banners').update({ active: true }).eq('id', ad).throwOnError();
    assert.deepEqual(await live(), [news, ad]);
    assert.match((await staff.rpc('moderate', { p_kind: 'banner', p_id: ad, p_action: 'approve' })).error?.message ?? '', /Aksi tidak dikenal/);
    // and staff remove one (the console's "Hapus banner")
    const { data: once } = await staff.from('banners').insert({ title: `Sekali pakai ${run}`, created_by: id.staff }).select('id').single().throwOnError();
    assert.deepEqual((await staff.from('banners').delete().eq('id', once.id).select('id').throwOnError()).data, [{ id: once.id }]);
  });

  await step('7 suspension hides the listing with its peluang, perk, story and ad at once; the peluang cannot be detached; reinstate restores; staff only', async () => {
    for (const [action, shown] of [['suspend', 0], ['reinstate', 1]]) {
      await staff.rpc('moderate', { p_kind: 'business', p_id: kopi, p_action: action, p_note: 'Cek rutin' }).throwOnError();
      if (!shown) { // the owner can neither reinstate it nor move the peluang off the suspended listing
        assert.equal((await ana.rpc('moderate', { p_kind: 'business', p_id: kopi, p_action: 'reinstate' })).error?.code, DENIED);
        assert.equal((await ana.from('peluang').update({ business_id: null }).eq('id', job)).error?.code, DENIED);
      }
      assert.deepEqual({
        search: (await anon.rpc('search_businesses', { p_ids: [kopi] }).throwOnError()).data.length,
        perk: (await anon.rpc('search_businesses', { p_ids: [kopi], p_promo_only: true }).throwOnError()).data.length,
        code: (await budi.rpc('promo_code', { p_business: kopi }).throwOnError()).data ? 1 : 0,
        peluang: (await anon.from('peluang_feed').select('id').eq('id', job).throwOnError()).data.length,
        story: (await anon.from('story_feed').select('id').eq('id', story).throwOnError()).data.length,
        ad: (await anon.from('banner_feed').select('id').eq('id', ad).throwOnError()).data.length,
      }, { search: shown, perk: shown, code: shown, peluang: shown, story: shown, ad: shown }, action);
    }
  });

  await step('1 anonymous: search works; base tables and member/staff RPC are closed (an unverified member sees only their own rows)', async () => {
    assert.equal((await anon.rpc('search_businesses', { p_q: 'kop', p_ids: [kopi] }).throwOnError()).data.length, 1);
    for (const t of TABLES) { // all but payments have rows by now
      const { data, error } = await anon.from(t).select().limit(1);
      assert(error ? error.code === DENIED : data.length === 0, t);
      assert.equal((await dodi.from(t).select().throwOnError()).data.length, { profiles: 1, businesses: 1 }[t] ?? 0, `dodi: ${t}`);
    }
    assert.deepEqual([(await dodi.rpc('staff_users').throwOnError()).data, (await dodi.rpc('staff_overview').throwOnError()).data], [[], null]); // the staff reads give a member nothing
    for (const [fn, args] of Object.entries({
      connect: { p_message: 'Halo, boleh kenalan?', p_business: kopi },
      view_contact: { p_business: kopi },
      save_profile: { p_full_name: 'Anonim' },
      moderate: { p_kind: 'business', p_id: kopi, p_action: 'suspend' },
      staff_users: {},
    })) assert.equal((await anon.rpc(fn, args)).error?.code, DENIED, fn);
  });

  await step('20 audit log: staff actions are recorded with the actor; the feed names actor and target; members cannot read it', async () => {
    const { data: log } = await staff.from('audit_log').select().eq('actor_id', id.staff).throwOnError();
    for (const [action, kind, target] of [
      ['approved', 'businesses', kopi], ['suspended', 'businesses', kopi], // moderation
      ['rejected', 'profiles', id.ana], ['approved', 'profiles', id.ana], // verification
      ['auto_approve', 'settings', null],
      ['insert', 'events', meetup], ['insert', 'banners', news], ['insert', 'stories', story], ['update', 'stories', story],
    ]) assert(log.some((r) => r.action === action && r.target_kind === kind && r.target_id === target), `${action} ${kind}`);
    assert.equal((await ana.from('audit_log').select().throwOnError()).data.length, 0);
    const { data: feed } = await staff.rpc('audit_feed', { p_limit: 500 }).throwOnError();
    for (const [action, kind, name] of [['suspended', 'businesses', 'Kopi Check'], ['approved', 'profiles', people.ana], ['insert', 'events', `Meetup ${run}`]])
      assert(feed.some((r) => r.action === action && r.target_kind === kind && r.target_name === name && r.actor_name === people.staff), `feed: ${action} ${kind}`);
    assert.deepEqual((await ana.rpc('audit_feed').throwOnError()).data, []);
  });

  await step('21 statistics: track_view counts visitors, not the owner', async () => {
    for (const who of [anon, budi, ana]) await who.rpc('track_view', { p_business: kopi }).throwOnError();
    assert.equal((await ana.from('businesses').select('views').eq('id', kopi).single().throwOnError()).data.views, 2);
  });

  await step('22 storage: images only, in your own folder; the public URL serves the file; a listing image must be your own file; a story photo and the picture of an ad, kept in the staff folder, can be removed by the owner of the business', async () => {
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
    const [own, other, text] = [`${id.ana}/check-${run}.png`, `${id.budi}/check-${run}.png`, `${id.ana}/check-${run}.txt`];
    files.push(own, other, text);
    const image = { contentType: 'image/png' };
    assert((await ana.storage.from('media').upload(other, png, image)).error, "another member's folder");
    assert((await anon.storage.from('media').upload(own, png, image)).error, 'anonymous');
    assert((await ana.storage.from('media').upload(text, 'halo', { contentType: 'text/plain' })).error, 'not an image');
    assert.ifError((await ana.storage.from('media').upload(own, png, image)).error);
    const { publicUrl } = anon.storage.from('media').getPublicUrl(own).data;
    const served = await fetch(publicUrl);
    assert.equal(served.status, 200);
    assert.deepEqual(Buffer.from(await served.arrayBuffer()), png);
    // image columns take a path in the member's own folder: not someone else's file, not an external URL
    for (const [image_path, code] of [[other, DENIED], ['https://example.com/x.png', '23514'], [own, undefined]])
      assert.equal((await ana.from('businesses').update({ image_path }).eq('id', kelas)).error?.code, code, image_path);
    assert.equal((await ana.storage.from('media').remove([own])).data?.length, 1);
    // Gone from storage at once. A hosted project's CDN goes on answering at the address it has already served for
    // up to a minute (measured: 45 to 60 seconds), so the proof is an address it has to ask storage for.
    assert.notEqual((await fetch(`${publicUrl}?fresh=${run}`)).status, 200);
    // a story's photo sits in the writer's (staff) folder: the owner of either business may remove it, nobody else
    const photo = `${id.staff}/check-${run}-story.png`;
    files.push(photo);
    assert.ifError((await staff.storage.from('media').upload(photo, png, image)).error);
    await staff.from('stories').update({ image_path: photo }).eq('id', story).throwOnError();
    // (the bystander is dodi, who owns a business of his own: owning any business must not be enough)
    assert.equal((await dodi.storage.from('media').remove([photo])).data?.length ?? 0, 0, 'the owner of another business');
    assert.equal((await ana.storage.from('media').remove([photo])).data?.length, 1, 'an owner');
    // the same for the picture of an ad staff put up for a business: that business's owner may remove it, nobody else
    const adPhoto = `${id.staff}/check-${run}-ad.png`;
    files.push(adPhoto);
    assert.ifError((await staff.storage.from('media').upload(adPhoto, png, image)).error);
    await staff.from('banners').update({ image_path: adPhoto }).eq('id', ad).throwOnError();
    assert.equal((await dodi.storage.from('media').remove([adPhoto])).data?.length ?? 0, 0, 'the owner of another business');
    assert.equal((await ana.storage.from('media').remove([adPhoto])).data?.length, 1, 'the owner of the advertised business');
  });

  await step('4 rejecting an approved graduate suspends their live listing, peluang and hosted event; staff cannot put them back while the owner is unverified', async () => {
    for (const [rejected, status, shown] of [[false, 'approved', 1], [true, 'suspended', 0]]) {
      if (rejected) await staff.rpc('verify_graduate', { p_user: id.budi, p_approve: false, p_note: 'Bukan lulusan LP' }).throwOnError();
      assert.equal((await budi.from('businesses').select('status').eq('id', batik).single().throwOnError()).data.status, status);
      assert.equal((await budi.from('peluang').select('status').eq('id', need).single().throwOnError()).data.status, status);
      assert.equal((await anon.rpc('search_businesses', { p_ids: [batik] }).throwOnError()).data.length, shown);
      assert.equal((await anon.from('peluang_feed').select('id').eq('id', need).throwOnError()).data.length, shown);
      assert.equal((await budi.from('events').select('status').eq('id', workshop).single().throwOnError()).data.status, status);
      assert.equal((await anon.from('event_feed').select('id').eq('id', workshop).throwOnError()).data.length, shown);
    }
    for (const [kind, target] of [['business', batik], ['peluang', need], ['event', workshop]])
      assert.match((await staff.rpc('moderate', { p_kind: kind, p_id: target, p_action: 'reinstate' })).error?.message, /belum jadi lulusan terverifikasi/, kind);
    assert.equal((await anon.rpc('search_businesses', { p_ids: [batik] }).throwOnError()).data.length, 0);
  });

  await step('19 deletion is real: a listing takes its data and its ad with it; staff remove the person and their files, and the account stays while a picture that goes with it is still stored; payments keep the amount without the person; the logs forget them', async () => {
    for (const deleted of [false, true]) { // before: the rows are there; after: gone
      if (deleted) await ana.from('businesses').delete().eq('id', kopi).throwOnError();
      for (const t of ['locations', 'promos', 'contact_views', 'connections', 'banners']) {
        const { count } = await admin.from(t).select('*', { count: 'exact', head: true }).eq('business_id', kopi).throwOnError();
        assert.equal(count > 0, !deleted, t);
      }
    }
    // eko: a listing with a branch, a save, a waiting-list seat, a delete request, a stored file and a payment
    const { data: b } = await eko.from('businesses').insert({ owner_id: id.eko, name: 'Trip Check', category: 'Travel' }).select().single().throwOnError();
    await eko.from('locations').insert({ business_id: b.id, city: 'Denpasar', area: 'Bali & Nusa Tenggara', lat: -8.65, lng: 115.22 }).throwOnError();
    await eko.from('saves').insert({ user_id: id.eko, business_id: batik }).throwOnError();
    await eko.from('privacy_requests').insert({ user_id: id.eko, kind: 'delete' }).throwOnError();
    const photo = `${id.eko}/check-${run}.png`;
    files.push(photo);
    assert.ifError((await eko.storage.from('media').upload(photo, 'x', { contentType: 'image/png' })).error);
    // an ad staff put up for the listing: its picture sits in the staff folder, and goes with the listing all the same
    const adFile = `${id.staff}/check-${run}-eko-ad.png`;
    files.push(adFile);
    assert.ifError((await staff.storage.from('media').upload(adFile, 'x', { contentType: 'image/png' })).error);
    await staff.from('banners').insert({ title: `Iklan Eko ${run}`, business_id: b.id, image_path: adFile, created_by: id.staff }).throwOnError();
    const { data: paid } = await admin.from('payments').insert({ user_id: id.eko, amount: 150000, purpose: 'ad' }).select().single().throwOnError();
    assert.equal((await admin.from('payments').insert({ user_id: id.eko, amount: 1, purpose: 'Iklan atas nama Eko Saputra' })).error?.code, '23514'); // a code, not a sentence
    // what staff wrote about the person and about their listing
    await staff.rpc('moderate', { p_kind: 'business', p_id: b.id, p_action: 'reject', p_note: 'Foto Eko kurang jelas' }).throwOnError();
    await staff.rpc('verify_graduate', { p_user: id.eko, p_approve: false, p_note: 'Nama Eko Saputra tidak ada di daftar LP 21' }).throwOnError();
    const about = () => admin.from('audit_log').select('note').in('target_id', [id.eko, b.id]).not('note', 'is', null).throwOnError();
    assert.equal((await about()).data.length, 2);
    assert.equal((await eko.rpc('delete_account', { p_user: id.eko })).error?.code, DENIED); // not self-service
    assert.match((await staff.rpc('delete_account', { p_user: id.staff })).error?.message, /Akun staf/);
    // staff clear the person's stored files through the Storage API first (SQL cannot), then delete the account
    assert.deepEqual((await staff.storage.from('media').list(id.eko)).data?.map((f) => `${id.eko}/${f.name}`), [photo]);
    assert.equal((await staff.storage.from('media').remove([photo])).data?.length, 1);
    // the folder is empty, but the picture of the ad for the listing is still stored: the account stays until it is gone too
    assert.match((await staff.rpc('delete_account', { p_user: id.eko })).error?.message ?? '', /masih tersimpan/);
    assert.equal((await staff.storage.from('media').remove([adFile])).data?.length, 1);
    await staff.rpc('delete_account', { p_user: id.eko }).throwOnError();
    assert((await admin.auth.admin.getUserById(id.eko)).error, 'auth user is gone');
    for (const [t, col, value] of [['profiles', 'id', id.eko], ['businesses', 'owner_id', id.eko], ['locations', 'business_id', b.id], ['banners', 'business_id', b.id],
      ['saves', 'user_id', id.eko], ['rsvps', 'user_id', id.eko], ['privacy_requests', 'user_id', id.eko]]) {
      const { count } = await admin.from(t).select('*', { count: 'exact', head: true }).eq(col, value).throwOnError();
      assert.equal(count, 0, t);
    }
    const { data: kept } = await admin.from('payments').select('user_id, amount, purpose').eq('id', paid.id).single().throwOnError();
    assert.deepEqual(kept, { user_id: null, amount: 150000, purpose: 'ad' });
    await admin.from('payments').delete().eq('id', paid.id).throwOnError(); // no longer tied to a user, so the cleanup would not find it
    assert.equal((await about()).data.length, 0, 'the audit log forgets the reasons');
    if (hasPsql) assert.equal(psql(`select count(*) from auth.audit_log_entries where payload::text like '%${id.eko}%' or payload::text like '%${email.eko}%'`).trim(), '0', "Supabase Auth's own log");
  });
} finally {
  // Cleanup, also after a crash: only what this run created. Deleting a user cascades to all their rows.
  const ids = Object.values(id);
  if (files.length) await admin.storage.from('media').remove(files);
  await cleanup(run, ids);
  await admin.from('settings').update(settings).eq('id', true);
  const { count } = await admin.from('profiles').select('*', { count: 'exact', head: true }).in('id', ids);
  if (count) { failed++; console.log(`✗ cleanup left ${count} of its users behind`); }
}

console.log(`\n${total} steps, ${failed} failed`);
process.exitCode = failed ? 1 : 0;
