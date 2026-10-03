// Brings the answers of the Google Form "Graduates Database (Expo)" into the directory: one account per email, one
// listing per row. The form counts as the owner's consent, so people arrive verified and listings live.
//   node --env-file=<env file> scripts/import.mjs "<answers.csv>"           prints the plan, writes nothing
//   node --env-file=<env file> scripts/import.mjs "<answers.csv>" --write   does it
// Safe to re-run with a newer export: an email that already has an account is left alone.
// Nobody is mailed. Each person sets a password with "Lupa kata sandi" on /masuk.
// Keep the CSV out of the repository: it holds phone numbers.
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const LATEST = { lp: 200, ia: 204, ib: 210 }; // a higher number is a typing mistake
const NOTE = 'Impor formulir Expo';
const CATEGORY = { // the form's spelling -> CATEGORIES in constants.ts
  'Food & Beverage': 'Food & Beverage', 'Fashion & Accesoris': 'Fashion & Aksesoris', 'Beauty/health/wellness': 'Beauty, Health & Wellness',
  'Art/Craft/Creative': 'Art, Craft & Creative', Edukasi: 'Edukasi', Technologi: 'Teknologi', Entertainment: 'Entertainment', Travel: 'Travel',
};
// Answers a rule cannot read. A bare word is only a link when someone confirmed which site it is on.
const LINK_FIXES = {
  BagusBEyourself: 'https://instagram.com/BagusBEyourself',
  Nak_muai_camp: 'https://instagram.com/Nak_muai_camp',
  'www.thetalaw co.id': 'https://www.thetalaw.co.id',
};

// ───────────────────────────── Reading the answers ─────────────────────────────

function parseCsv(text) { // quoted fields hold commas, quotes ("") and line breaks
  const rows = [[]];
  let field = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; } else if (c === '"') quoted = false; else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { rows.at(-1).push(field); field = ''; }
    else if (c === '\n') { rows.at(-1).push(field); field = ''; rows.push([]); }
    else if (c !== '\r') field += c;
  }
  rows.at(-1).push(field);
  return rows.filter((r) => r.some((f) => f.trim()));
}

function batches(answer) { // "IA177/GLP171" -> { ia: 177, lp: 171 }
  const found = {};
  for (const [, program, n] of answer.matchAll(/(IB|IA|LP)\s*(\d+)/gi)) found[program.toLowerCase()] = +n;
  return found;
}

function links(answer) {
  return answer.split(/[,|]/).map((s) => s.trim()).filter(Boolean).map((s) => {
    if (LINK_FIXES[s]) return LINK_FIXES[s];
    if (/^https?:\/\/\S+$/i.test(s)) return s;
    const handle = s.match(/^(?:@|ig\s*:\s*)([\w.]+)$/i) ?? s.match(/^([\w.]+)\s*\(ig\)$/i);
    if (handle) return `https://instagram.com/${handle[1]}`;
    const tiktok = s.match(/^([\w.]+)\s*\(tiktok\)$/i);
    if (tiktok) return `https://www.tiktok.com/@${tiktok[1]}`;
    if (/^[\w-]+(\.[\w-]+)+(\/\S*)?$/.test(s)) return `https://${s}`; // lemone.id, instagram.com/lomotostudio
    return null;
  });
}

assert.deepEqual(batches('IA177/GLP171'), { ia: 177, lp: 171 });
assert.deepEqual(batches('Umum'), {});
assert.deepEqual(links('Kacamobilidn (ig) | solusikacamobil (tiktok)'), ['https://instagram.com/Kacamobilidn', 'https://www.tiktok.com/@solusikacamobil']);
assert.deepEqual(links('Ig: syarafina.food'), ['https://instagram.com/syarafina.food']);
assert.deepEqual(links('lemone.id'), ['https://lemone.id']);
assert.deepEqual(links('PKUA'), [null]);

const [file, write] = [process.argv[2], process.argv.includes('--write')];
if (!file) throw new Error('Usage: node --env-file=<env file> scripts/import.mjs "<answers.csv>" [--write]');
const [, ...answers] = parseCsv(readFileSync(file, 'utf8'));

const people = new Map(); // by email: the first row describes the person, every row is a listing
const skipped = [];
for (const [, fullName, nick, phone, contact, mail, batch, name, link, category, other, description] of answers.map((r) => r.map((f) => f.trim()))) {
  const email = mail.toLowerCase();
  const b = batches(batch);
  const high = Object.keys(b).filter((k) => b[k] > LATEST[k]);
  if (!Object.keys(b).length || high.length) { skipped.push(`${fullName} <${email}>: angkatan "${batch}"`); continue; }
  if (!people.has(email)) people.set(email, { email, fullName, nick, phone, ...b, listings: [] });
  const urls = links(link);
  const notes = [];
  if (urls.includes(null) || !urls.length) notes.push(`draft, no usable link in "${link}"`);
  const usable = contact.replace(/\D/g, '').length >= 8 || contact.includes('@'); // a number or an address, not "Lomoto Studio"
  if (!usable) notes.push(`business contact "${contact}" replaced by the personal number`);
  people.get(email).listings.push({
    name: name || null, description, links: urls.filter(Boolean), draft: urls.includes(null) || !urls.length || !description,
    category: CATEGORY[category] ?? 'Lainnya', other: CATEGORY[category] ? null : other || null, contact: usable ? contact : phone, notes,
  });
}

// ───────────────────────────── The plan ─────────────────────────────

for (const p of people.values()) {
  console.log(`\n${p.fullName} (${p.nick}) <${p.email}>  ${['lp', 'ib', 'ia'].filter((k) => p[k]).map((k) => `${k.toUpperCase()} ${p[k]}`).join(', ')}`);
  for (const l of p.listings) {
    console.log(`  ${l.draft ? 'DRAFT' : 'LIVE '} ${l.name ?? '(no business name: the owner\'s name shows)'} · ${l.category}${l.other ? ` (${l.other})` : ''}`);
    console.log(`        ${l.links.join('  ') || '(no link)'}`);
    for (const n of l.notes) console.log(`        ! ${n}`);
  }
}
const all = [...people.values()].flatMap((p) => p.listings);
console.log(`\n${people.size} people, ${all.length} listings (${all.filter((l) => !l.draft).length} live, ${all.filter((l) => l.draft).length} draft).`);
if (skipped.length) console.log(`Left out, no program and batch to verify:\n  ${skipped.join('\n  ')}`);

if (!write) {
  console.log('\nNothing was written. Add --write to do it.');
} else {
  // ───────────────────────────── Writing ─────────────────────────────
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const opts = { auth: { persistSession: false, autoRefreshToken: false } };
  const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, opts);
  const must = ({ data, error }) => { if (error) throw error; return data; };

  const taken = new Set();
  for (let page = 1; ; page++) {
    const batch = must(await admin.auth.admin.listUsers({ page, perPage: 200 })).users;
    if (!batch.length) break;
    for (const u of batch) taken.add(u.email?.toLowerCase());
  }

  const made = [], failed = [];
  for (const p of people.values()) {
    if (taken.has(p.email)) { console.log(`exists, left alone: ${p.email}`); continue; }
    let uid;
    try {
      // A password nobody knows. The person's own steps (profile, listing, consent) run as that person, through
      // the same calls the app makes, so every rule in the database applies. Staff's two approvals are the form's.
      const password = randomBytes(24).toString('base64url');
      uid = must(await admin.auth.admin.createUser({ email: p.email, password, email_confirm: true, user_metadata: { full_name: p.fullName } })).user.id;
      const me = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, opts);
      must(await me.auth.signInWithPassword({ email: p.email, password }));
      await me.rpc('save_profile', { p_full_name: p.fullName, p_nickname: p.nick, p_phone: p.phone, p_lp: p.lp, p_ib: p.ib, p_ia: p.ia, p_submit: true }).throwOnError();
      await admin.from('profiles').update({ verification: 'approved' }).eq('id', uid).throwOnError();
      await admin.from('audit_log').insert({ action: 'approved', target_kind: 'profiles', target_id: uid, note: NOTE }).throwOnError();
      for (const l of p.listings) {
        const { data: row } = await me.from('businesses').insert({
          owner_id: uid, name: l.name, description: l.description, category: l.category, category_other: l.other, links: l.links,
          online_only: true, // the form asks for no address; the owner adds one in Dasbor
        }).select('id').single().throwOnError();
        await me.rpc('set_business_contact', { p_business: row.id, p_contact: l.contact }).throwOnError();
        if (l.draft) continue;
        await me.rpc('submit_business', { p_business: row.id }).throwOnError();
        await admin.from('businesses').update({ status: 'approved' }).eq('id', row.id).throwOnError();
        await admin.from('audit_log').insert({ action: 'approved', target_kind: 'businesses', target_id: row.id, note: NOTE }).throwOnError();
        made.push(row.id);
      }
      console.log(`imported: ${p.email}`);
    } catch (e) {
      failed.push(`${p.email}: ${e.message}`);
      if (uid) await admin.auth.admin.deleteUser(uid); // no half-made account: its rows go with it, and a re-run starts clean
    }
  }

  // Self-check: a visitor finds every listing that was meant to go live.
  const anon = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, opts);
  const seen = made.length ? (await anon.rpc('search_businesses', { p_ids: made }).throwOnError()).data.length : 0;
  console.log(`\nLive listings made: ${made.length}, visible to a visitor: ${seen}.`);
  if (failed.length) console.log(`Failed, nothing kept for these:\n  ${failed.join('\n  ')}`);
  if (failed.length || seen !== made.length) process.exitCode = 1;
}
