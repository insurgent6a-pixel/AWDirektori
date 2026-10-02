# AsiaWorks Direktori

A business directory for graduates of AsiaWorks training. Graduates list their businesses, the public searches and
browses them, and graduates find each other to work together. The interface is in Bahasa Indonesia.

Built as one Next.js app (React, TypeScript, Tailwind) that talks straight to Supabase from the browser. There is no
server code of our own: every permission is enforced inside Postgres, so the app stays small and light.

| Route | What it is |
|---|---|
| `/` | Home: banner, shortcuts, search with map and list, browse by industry or city, latest Peluang, perks, events |
| `/bisnis/[id]` | A business page |
| `/peluang` | Partner requests posted by graduates |
| `/acara` | Events with RSVP, collaboration stories, "offer to host" |
| `/lulusan` | Meet Graduates: every live business as a card |
| `/daftar` | Sign-up in three short steps |
| `/masuk` | Member login |
| `/akun` | Member dashboard: Peluang, Bisnis, Koneksi, Akun |
| `/staff` | Staff login and console |

The banner on the home page is one slider, newest first. Only staff put a banner up, from the console: an announcement,
or an ad for one business (members cannot submit ads). It moves on every five seconds until someone slides it by hand. A banner with a picture shows only the picture, so its message belongs
in the picture: 1200 × 400 fits (wide screens trim a little off the top and bottom). A banner without one shows its
title and text on a brand backdrop.

## Run it locally

Needs Node 20+ and Docker.

```bash
npm install
cp .env.example .env.local   # then put in the local values shown below
npm run db:up                # local Supabase: Postgres, Auth, REST, Storage on http://localhost:54321
npm run db:apply             # tables, rules and functions
npm run seed                 # optional: demo businesses, events, members
npm run dev                  # http://localhost:3000
```

Local values for `.env.local`: the URL is `http://localhost:54321`, and the two keys are the `x-anon-key` and
`x-service-key` lines at the top of `supabase/local/docker-compose.yml` (Supabase's public demo keys, local only).

After seeding, every demo account uses the password `asiaworks123`:

- Staff: `staf@demo.awdirektori.test` (sign in at `/staff`)
- Member: `lulusan@demo.awdirektori.test` (sign in at `/masuk`)

`npm run db:reset` wipes the local database and applies the schema again.

## Put it on hosted Supabase

1. Create a new Supabase project. Use a project of its own: the schema creates tables such as `profiles` and `events`.
2. Open the SQL Editor, paste all of `supabase/migrations/20261001000000_init.sql`, run it once.
3. Authentication settings:
   - Turn off "Confirm email", or connect your own SMTP. Supabase's built-in mail only sends a few messages per hour,
     and staff verify every graduate by hand anyway.
   - Set the Site URL to your domain and allow `https://your-domain/masuk` and `https://your-domain/daftar` as redirect
     URLs (used by "Lupa kata sandi" and email confirmation).
4. Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` where the site is hosted.
5. Make the first staff account: sign up at `/daftar` (the first step is enough), then run this in the SQL Editor and
   sign in at `/staff`:

   ```sql
   update public.profiles set role = 'staff'
   where id = (select id from auth.users where email = 'you@example.com');
   ```

**A project that already has the schema.** The migration file always holds the whole, current schema, for a new
project. When the schema changes after a project was set up, the change is also in `supabase/upgrades/`, one file per
change, named by date. Paste the files that are newer than your project into the SQL Editor, oldest first. Each is
safe to run twice and deletes nothing.

**Check the rules on the hosted project.** Put the project's URL, anon key and service role key in a file of its own
(for example `.env.hosted`, same three names as `.env.local`; keep it private) and run
`node --env-file=.env.hosted scripts/check.mjs`. It signs up its own test accounts, proves each rule through the API
and removes everything it made. One step is skipped there, because it reads the database directly.

**Deleted pictures on hosted Supabase.** A deleted picture is gone from storage at once. Supabase's CDN can go on
answering at the picture's direct address for up to a minute, and the browser of someone who already opened it keeps
its own copy for up to an hour.

## Add it to an existing Next.js site

The whole feature is one folder, `app/(aw)`. It is a route group, so it adds the routes above without changing any
existing one, and it brings its own layout (fonts, session, header, bottom bar).

The host site needs the Next.js App Router and Tailwind CSS 4.

1. Copy `app/(aw)` into the site's `app` folder.
2. In the site's global stylesheet, after `@import "tailwindcss";`, add `@import "./(aw)/_lib/theme.css";`.
   The file only adds tokens and utilities with their own names. It does not reset Tailwind's defaults.
   A site that does not build with Tailwind 4 yet installs it first (`npm i -D tailwindcss @tailwindcss/postcss`,
   plus the PostCSS plugin as in this project's `postcss.config.mjs`).
3. Install what it uses: `npm i @supabase/supabase-js leaflet lucide-react` and `npm i -D @types/leaflet`.
4. Add the two `NEXT_PUBLIC_SUPABASE_*` variables and run the SQL file on the Supabase project.

Things to know when merging:

- `app/(aw)/layout.tsx` renders the directory's own header and footer. A site with its own header can drop
  `<Header />` and `<Footer />` from that file (keep `<BottomBar />`, it is the phone navigation). Those two hold the
  only desktop links to the four pages, Masuk and Dasbor, so add those links to the site's own header.
- If a route name such as `/acara` is taken, rename that folder inside `app/(aw)`, then search `app/(aw)` for the old
  path and replace it. The paths are written out in the links of about twenty files, not in one place.
- The directory's home is `app/(aw)/page.tsx`, at `/`. A site with its own home page moves that file into a folder
  (say `app/(aw)/direktori/`) and replaces the `"/"` links in `app/(aw)` with the new path.
- `app/not-found.tsx` belongs to this demo project, not to the folder. A host site keeps its own.
- A React site that is not on Next.js needs more than a copy. The routes are App Router folders (`page.tsx`,
  `layout.tsx`, `[id]`), about twenty files import `next/link`, `next/navigation` or `next/font`, and the Supabase keys
  are read from `process.env.NEXT_PUBLIC_*`. The components themselves are plain client components, so the work is
  mapping the routes to the host's router and swapping those imports and the two variable names.

## Where things are

```
app/(aw)/
  layout.tsx            fonts, session provider, header, footer, bottom bar
  _lib/                 supabase client, session, queries, formatting, image upload, design tokens (theme.css)
  _components/          ui kit, site chrome, map, cards, member actions, login form
  _components/akun/     dashboard tabs
  _components/staff/    staff console sections
  page.tsx              the home page
  bisnis/[id]/ peluang/ acara/ lulusan/ daftar/ masuk/ akun/ staff/   one page.tsx each
supabase/
  migrations/20261001000000_init.sql   the whole database: tables, RLS, grants, feeds, RPC, storage rules
  local/                               Docker Compose for a local Supabase
scripts/
  check.mjs             proves the rules below through the real API (npm run check)
  seed.mjs              demo data through the real flows (npm run seed)
serve.mjs, screenshot.mjs              design workflow: dev server on :3000 and page screenshots
```

## Who can do what

Roles: visitor (no account), member (signed up), graduate (member whose program and batch staff approved), staff.
The browser only holds the anon key, so these rules live in the SQL file, not in the UI.

- **Visitors** read only through `search_businesses()` and the `*_feed` views. Each of those checks that the listing
  is approved, has the owner's consent, and is switched on, so a suspended or switched-off listing disappears from
  search, the map, Peluang, promos, stories and ads at once.
- **Publishing needs two things**: the owner's consent (`submit_business`) and a moderator's approval (`moderate`).
  Status columns cannot be written directly; column grants leave them out. `moderate` also refuses to publish a
  listing, a Peluang or a hosted event while its owner is not a verified graduate. For a demo, staff can switch on
  "Auto Approve Bisnis" and "Auto Approve Peluang" (Moderasi): what a verified graduate sends then goes live at
  once, and the audit log says so.
- **Banners are staff's**. Members cannot add, change or remove one. An ad is a banner staff tied to a business: it
  carries the label "Iklan", opens that business's page unless it has a link of its own, and is off the home page
  while the business is not public.
- **Graduate status** only comes from staff (`verify_graduate`), or from the demo switch "Auto Approve Graduates
  Request" in the staff console. Withdrawing it takes that person's listings, Peluang and hosted events down.
- **Programs**. On the sign-up form a member chooses the programs they finished (IB, IA, LP, any of them) and asks
  for verification with at least one. LP needs its batch number; IB and IA may go without. Programs and batch
  numbers lock once the request is in (`save_profile`).
- **Contacts are private**. The phone number and the business contact are stored encrypted (pgcrypto, key in
  Supabase Vault) in a schema the API cannot reach. A graduate gets a business contact through "Lihat kontak", which
  records who looked, or through an accepted Hubungkan request, which opens both sides' contacts. The email address
  is the login: it is held by Supabase Auth in `auth.users`, not encrypted by this app, and reaches another member
  only on an accepted Hubungkan request.
- **Location can be approximate**. In `area` mode the database rounds the point to about 1 km before storing it.
  "Online saja" hides every location.
- **Deletion is real**. Deleting a listing or an account removes the rows (cascades) and the stored files. A payment
  row keeps the amount, its date and a fixed code for what was sold; `user_id` becomes null. The audit log keeps that
  something was done and drops the reason staff typed. Delete accounts from the staff console (Privasi): that route
  also removes the stored files and the person's entries in Supabase Auth's own log, which a deletion from the
  Supabase dashboard does not.
- **Staff actions are logged** in `audit_log` by database triggers and staff RPC, and so is every approval made by
  the Auto Approve switch, one row per person.

`npm run check` exercises all of this as real users and fails loudly if a rule stops holding.

## Deliberate shortcuts

Marked with `ponytail:` in the code. Fine for the 35 to 100 people this serves, with the upgrade path noted.

- `search_businesses` returns one page of 200 rows. Add keyset paging when the directory outgrows it.
- Peluang and Acara are filtered in the browser after one fetch. Move to a search RPC past a few hundred rows.
- Page views are a plain counter, deduplicated per browser session.
- The audit log screen shows the latest 500 actions. Older rows stay in `audit_log`; add a date filter when needed.
- Pages render in the browser. For search-engine indexing of business pages, fetch in a server component.
- Payments are switched off: no provider is connected and no screen asks for money (staff put ads up by hand). The
  `payments` table and its rules are in place. To switch on, connect a provider and let its server-side webhook
  insert into `payments` (`purpose` takes a fixed code, `'ad'` today); browsers have no insert right there on purpose.
