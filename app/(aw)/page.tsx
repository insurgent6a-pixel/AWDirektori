"use client";

// Direktori home: the banner, shortcuts, search with map and list, then what is happening (peluang, perks, acara).

import {
  BookOpen,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clapperboard,
  Cpu,
  GraduationCap,
  Handshake,
  HeartPulse,
  LocateFixed,
  type LucideIcon,
  Palette,
  Plane,
  Search,
  Shapes,
  Shirt,
  Sparkle,
  Store,
  Tag,
  TicketPercent,
  Utensils,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { BusinessRow, EventCard, PeluangCard } from "./_components/cards";
import MapView from "./_components/map";
import { Breadcrumbs, Container, usePasangBisnis } from "./_components/shell";
import { Badge, Button, Card, Chip, Failed, IconButton, Media, Select, Skeleton, Tabs, toast } from "./_components/ui";
import { useAuth } from "./_lib/auth";
import { AREAS, areaMatches, CATEGORIES, LUAR_JABODETABEK, SERVICE_TYPES } from "./_lib/constants";
import { cn, scrollBehavior } from "./_lib/format";
import { useQuery, useUrlFilters } from "./_lib/hooks";
import { bannerFeed, eventFeed, myRsvps, peluangFeed, searchBusinesses } from "./_lib/queries";
import type { Banner, Business, Enums } from "./_lib/types";

const SHORTCUTS: { href: string; label: string; icon: LucideIcon; gold?: boolean }[] = [
  { href: "#jelajah", label: "Jelajahi bisnis", icon: Store },
  { href: "/peluang", label: "Peluang", icon: Handshake },
  { href: "/lulusan", label: "Lulusan", icon: GraduationCap, gold: true },
  { href: "/acara", label: "Acara", icon: CalendarDays },
  { href: "/lulusan?promo=1", label: "Promo", icon: TicketPercent },
  { href: "/acara#cerita", label: "Cerita", icon: BookOpen, gold: true },
];

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  "Food & Beverage": Utensils,
  "Fashion & Aksesoris": Shirt,
  "Beauty, Health & Wellness": HeartPulse,
  "Art, Craft & Creative": Palette,
  Edukasi: GraduationCap,
  Teknologi: Cpu,
  Entertainment: Clapperboard,
  Travel: Plane,
  Lainnya: Shapes,
};

const MAIN_AREAS = ["Jabodetabek", "Makassar", LUAR_JABODETABEK];
const RADII = [5, 10, 25, 50];
const PHONE_ROWS = 3; // phones list this many businesses and offer the rest; a desktop list scrolls beside the map
const NONE: Business[] = [];
const inArea = (b: Business, area: string) => b.locations.some((l) => areaMatches(area, l.area));

export default function DirektoriPage() {
  const router = useRouter();
  const { user, profile } = useAuth();
  const pasangBisnis = usePasangBisnis();

  // Filters live in the URL, so a search can be shared and the back button works. Only the typing is local.
  const { params, setFilter, q, setQ, term } = useUrlFilters("/");
  const category = params.get("kategori") ?? "";
  const area = params.get("area") ?? "";
  const city = params.get("kota") ?? "";
  const service = (params.get("jenis") ?? "") as Enums<"service_type"> | "";
  const promoOnly = params.get("promo") === "1";

  const [near, setNear] = useState<{ lat: number; lng: number } | null>(null);
  const [radius, setRadius] = useState(25);
  const [view, setView] = useState<"daftar" | "peta">("daftar");
  const [active, setActive] = useState<string | null>(null);

  // The whole directory once (counts, industries, cities, perks), then a filtered search only when a filter is on.
  const all = useQuery(() => searchBusinesses(), []);
  const filtered = !!(term || category || area || city || service || promoOnly || near);
  const search = useQuery(
    filtered
      ? () =>
          searchBusinesses({ q: term, category, area, city, service: service || undefined, promoOnly, near: near ? { ...near, radiusKm: radius } : undefined })
      : null,
    [term, category, area, city, service, promoOnly, near, radius, filtered],
  );
  // While a new filter's first answer is on its way the map keeps the pins it had (the list shows skeletons), so it
  // does not zoom out to all of Indonesia and back.
  const results = (filtered ? (search.data ?? (search.loading ? all.data : null)) : all.data) ?? NONE;
  const loading = all.loading || (filtered && search.loading && !search.data);
  const failed = !!(all.error || search.error);
  // The search whose full list a phone has opened. A new search starts short again. Kept for the browser session, so
  // Back from a business page finds the list the way it was left.
  const listKey = [term, category, area, city, service, promoOnly, near?.lat, near?.lng, radius].join("|");
  const [opened, setOpened] = useState<string | null>(null);
  useEffect(() => {
    try {
      setOpened(sessionStorage.getItem("aw:daftar"));
    } catch {} // storage is closed (a private window): the list just starts short
  }, []);
  const allRows = opened === listKey;
  const openList = () => {
    try {
      sessionStorage.setItem("aw:daftar", listKey);
    } catch {}
    setOpened(listKey);
    // The button goes away with the press: hand keyboard and screen-reader focus to the first row it brought.
    const first = results[PHONE_ROWS]?.id;
    requestAnimationFrame(() => document.querySelector<HTMLElement>(`#row-${first} a`)?.focus());
  };

  const banners = useQuery(bannerFeed, []);
  const peluang = useQuery(peluangFeed, []);
  const events = useQuery(() => eventFeed(), []);
  const rsvps = useQuery(user ? () => myRsvps(user.id) : null, [user?.id]);

  const pins = useMemo(
    () =>
      results.flatMap((b) =>
        b.locations.map((l) => ({
          id: b.id,
          lat: l.lat,
          lng: l.lng,
          title: b.name,
          subtitle: `${b.category} · ${l.city}`,
          href: `/bisnis/${b.id}`,
          approximate: l.mode === "area",
        })),
      ),
    [results],
  );
  const directory = all.data ?? NONE;
  const cities = useMemo(() => {
    const counts = new Map<string, number>();
    for (const b of directory) for (const c of new Set(b.locations.map((l) => l.city))) counts.set(c, (counts.get(c) ?? 0) + 1);
    return [...counts].sort((a, b) => b[1] - a[1]).slice(0, 12);
  }, [directory]);
  const perks = directory.filter((b) => b.perk);

  const [locating, setLocating] = useState(false); // a phone can take seconds to find itself: say so on the chip
  const locate = () => {
    if (near) return setNear(null);
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setLocating(false);
        setNear({ lat: coords.latitude, lng: coords.longitude });
      },
      () => {
        setLocating(false);
        toast("Lokasi belum bisa dibaca. Izinkan akses lokasi di browser dulu ya.", "error");
      },
    );
  };
  const reset = () => {
    setQ("");
    setNear(null);
    router.replace("/", { scroll: false });
  };
  const selectPin = (id: string) => {
    setActive(id);
    document.getElementById(`row-${id}`)?.scrollIntoView({ block: "nearest", behavior: scrollBehavior() });
  };
  const browse = (changes: Record<string, string | null>) => {
    setFilter(changes);
    document.getElementById("jelajah")?.scrollIntoView({ behavior: scrollBehavior() });
  };

  return (
    <>
      <div className="wash">
        <Container className="pt-5 pb-8 md:pt-6">
          <Breadcrumbs items={[{ label: "Beranda", href: "/" }, { label: "Direktori" }]} />

          {/* The slot is held while the banners load, so the shortcuts and the search box do not drop a moment later. */}
          {banners.loading ? <Skeleton className={cn("mt-4", BANNER_SHAPE)} /> : !!banners.data?.length && <Banners banners={banners.data} />}

          {/* Shortcuts: one line on every screen. On a phone six columns leave about 50px each, so the tiles shrink a step. */}
          <nav aria-label="Pintasan" className="mt-3 rounded-2xl border border-line bg-surface px-1.5 py-4 shadow-card sm:px-4 sm:py-5">
            <ul className="grid grid-cols-6">
              {SHORTCUTS.map(({ href, label, icon: Icon, gold }, i) => (
                <li key={label} className="rise" style={{ "--i": i } as React.CSSProperties}>
                  <Link
                    href={href}
                    className="tap flex flex-col items-center gap-1.5 text-center text-[11px] leading-tight font-medium hover:text-maroon max-[359px]:text-[10px] sm:gap-2 sm:text-[13px]"
                  >
                    <span className={cn("grid h-11 w-11 place-items-center rounded-2xl shadow-card sm:h-12 sm:w-12", gold ? "bg-gold-soft text-gold" : "bg-blush text-maroon")}>
                      <Icon className="h-5 w-5 sm:h-[22px] sm:w-[22px]" strokeWidth={1.8} />
                    </span>
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <p className="mt-8 flex items-center gap-2 text-[13px] font-semibold text-maroon">
            <Sparkle className="h-4 w-4 fill-current" />
            {profile?.nickname ? `Hai, ${profile.nickname}! Mau cari apa hari ini?` : "Direktori lulusan AsiaWorks"}
          </p>
          {/* Smaller than the other pages' headlines: one line on desktop, as in the reference. */}
          <h1 className="h-display mt-2 text-[length:clamp(1.75rem,0.9rem+2vw,2.5rem)]">
            Temukan mitra bisnis di antara <span className="accent squiggle">lulusan AsiaWorks.</span>
          </h1>

          <form
            role="search"
            onSubmit={(e) => {
              e.preventDefault();
              (document.activeElement as HTMLElement | null)?.blur();
              document.getElementById("jelajah")?.scrollIntoView({ behavior: scrollBehavior() });
            }}
            className="mt-6 flex items-center gap-2 rounded-2xl border border-line bg-surface p-1.5 pl-4 shadow-raised focus-within:border-maroon"
          >
            <Search className="h-[18px] w-[18px] shrink-0 text-maroon" />
            <input
              type="search"
              enterKeyHint="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Cari bisnis, layanan, atau kota"
              aria-label="Cari bisnis, layanan, atau kota"
              className="h-11 min-w-0 flex-1 bg-transparent text-ellipsis outline-none placeholder:text-ink-soft max-[380px]:placeholder:text-sm [&:placeholder-shown::-webkit-search-cancel-button]:hidden"
            />
            {/* Phones: the short label leaves the placeholder room to show in full. */}
            <Button type="submit">
              <span>
                Cari<span className="max-sm:hidden"> bisnis</span>
              </span>
            </Button>
          </form>
        </Container>
      </div>

      <Container className="py-6">
        <section id="jelajah" className="scroll-mt-20">
          <div className="no-scrollbar -mx-4 -my-1.5 flex gap-2 overflow-x-auto px-4 py-1.5 sm:mx-0 sm:flex-wrap sm:px-0">
            <Chip active={!!near} disabled={locating} onClick={locate}>
              <LocateFixed className="h-3.5 w-3.5" /> {locating ? "Mencari..." : "Dekat saya"}
            </Chip>
            <Chip active={!area} onClick={() => setFilter({ area: null })}>
              Semua wilayah <Count n={directory.length} />
            </Chip>
            {MAIN_AREAS.map((a) => (
              <Chip key={a} active={area === a} onClick={() => setFilter({ area: area === a ? null : a })}>
                {a} <Count n={directory.filter((b) => inArea(b, a)).length} />
              </Chip>
            ))}
          </div>

          {near && (
            <div className="rise mt-3 flex flex-wrap items-center gap-2 text-[13px]">
              <span className="text-ink-soft">Dalam radius</span>
              {RADII.map((km) => (
                <Chip key={km} active={radius === km} onClick={() => setRadius(km)}>
                  {km} km
                </Chip>
              ))}
            </div>
          )}

          <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-[1fr_1fr_1fr_auto]">
            <Select
              compact
              value={MAIN_AREAS.includes(area) ? "" : area}
              onChange={(e) => setFilter({ area: e.target.value || null })}
              aria-label="Wilayah lain di Indonesia"
            >
              <option value="">Wilayah lain</option>
              {AREAS.filter((a) => !MAIN_AREAS.includes(a)).map((a) => (
                <option key={a}>{a}</option>
              ))}
            </Select>
            <Select compact value={category} onChange={(e) => setFilter({ kategori: e.target.value || null })} aria-label="Kategori">
              <option value="">Kategori</option>
              {CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </Select>
            <Select compact value={service} onChange={(e) => setFilter({ jenis: e.target.value || null })} aria-label="Jenis layanan">
              <option value="">Produk & jasa</option>
              <option value="produk">{SERVICE_TYPES.produk}</option>
              <option value="jasa">{SERVICE_TYPES.jasa}</option>
            </Select>
            <button
              type="button"
              aria-pressed={promoOnly}
              onClick={() => setFilter({ promo: promoOnly ? null : "1" })}
              className={cn(
                "tap flex h-10 items-center justify-center gap-1.5 rounded-xl border px-3.5 text-[13px] font-semibold",
                promoOnly ? "border-gold bg-gold text-white" : "border-blush-line bg-blush text-maroon hover:border-maroon/40",
              )}
            >
              <Tag className="h-4 w-4" /> GLP Perk
            </button>
          </div>

          {(city || filtered) && (
            <p className="mt-3 flex flex-wrap items-center gap-2 text-[13px] text-ink-soft">
              {city && (
                <Chip active onClick={() => setFilter({ kota: null })} title="Hapus filter kota">
                  Kota: {city} ×
                </Chip>
              )}
              <button type="button" onClick={reset} className="tap -my-2.5 py-2.5 font-semibold text-maroon underline-offset-4 hover:underline">
                Hapus semua filter
              </button>
            </p>
          )}

          <Tabs
            className="mt-4 lg:hidden"
            items={[
              { value: "daftar", label: "Daftar Bisnis" },
              { value: "peta", label: "Peta" },
            ]}
            value={view}
            onChange={setView}
          />

          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[1.7fr_1fr]">
            {/* min-w-0 on both columns: without it a long row would stretch the list past its share of the grid */}
            <div className={cn("relative min-w-0", view === "peta" ? "block" : "hidden lg:block")}>
              <MapView pins={pins} activeId={active} onSelect={selectPin} className="h-[26rem] shadow-card lg:h-[34rem]" />
              {!loading && !failed && pins.length === 0 && (
                <p className="absolute top-3 left-3 z-[500] max-w-[70%] rounded-xl bg-surface/95 px-3.5 py-2.5 text-[13px] shadow-raised">
                  {filtered ? "Belum ada bisnis di area ini. Ubah filter atau hapus pencarian." : "Belum ada bisnis di peta."}
                </p>
              )}
            </div>

            <Card className={cn("min-w-0 flex-col lg:flex lg:h-[34rem]", view === "daftar" ? "flex" : "hidden")}>
              <div className="border-b border-line p-4">
                <h2 className="h-card">Daftar bisnis</h2>
                <p className="mt-0.5 text-[12px] text-ink-soft" aria-live="polite">
                  {loading ? "Memuat..." : failed ? "Belum bisa dimuat" : `${results.length} bisnis lulusan terverifikasi${area ? ` di ${area}` : ""}`}
                </p>
              </div>
              {/* A scroll box only where it has a height (lg up). On phones the list is as tall as its rows, and a
                  contained box with nothing to scroll would swallow the swipe that should move the page. */}
              <div className="flex-1 space-y-2 p-3 lg:overflow-y-auto lg:overscroll-contain">
                {failed ? (
                  <Failed query={all.error ? all : search} />
                ) : loading ? (
                  [0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-24" />)
                ) : results.length === 0 ? (
                  <div className="px-3 py-10 text-center">
                    <p className="h-card">{filtered ? "Belum ada yang cocok" : "Belum ada bisnis tayang"}</p>
                    <p className="body-copy mt-1 text-sm">
                      {filtered ? "Coba kata kunci lain, atau longgarkan filternya." : "Jadi lulusan pertama yang memasang bisnis di sini."}
                    </p>
                    {filtered ? (
                      <Button variant="secondary" size="sm" className="mt-4" onClick={reset}>
                        Hapus filter
                      </Button>
                    ) : (
                      <Button size="sm" className="mt-4" href={pasangBisnis}>
                        Pasang bisnis
                      </Button>
                    )}
                  </div>
                ) : (
                  <>
                    {results.map((b, i) => (
                      <div key={b.id} id={`row-${b.id}`} className={cn(i >= PHONE_ROWS && !allRows && "max-lg:hidden")}>
                        <BusinessRow business={b} active={active === b.id} onActivate={() => setActive(b.id)} index={i} />
                      </div>
                    ))}
                    {results.length > PHONE_ROWS && !allRows && (
                      <Button variant="secondary" size="sm" full className="lg:hidden" onClick={openList}>
                        Tampilkan {results.length - PHONE_ROWS} bisnis lainnya
                      </Button>
                    )}
                  </>
                )}
              </div>
              <Link href="/lulusan" className="tap rounded-b-2xl border-t border-line p-3.5 text-center text-[13px] font-semibold text-maroon hover:bg-page">
                Lihat semua sebagai kartu
              </Link>
            </Card>
          </div>
        </section>

        {/* Browse by industry or by city */}
        <section className="mt-12 md:mt-16">
          <h2 className="h-section text-center">Lagi butuh apa hari ini?</h2>
          <p className="body-copy mx-auto mt-2 max-w-md text-center text-sm">Jelajahi bisnis lulusan menurut kategori atau kotanya.</p>
          <ul className="mt-6 grid grid-cols-3 gap-2.5 md:grid-cols-5 lg:grid-cols-9">
            {CATEGORIES.map((c, i) => {
              const Icon = CATEGORY_ICONS[c];
              return (
                <li key={c} className="rise" style={{ "--i": i } as React.CSSProperties}>
                  <button
                    type="button"
                    onClick={() => browse({ kategori: c })}
                    className="tap flex h-full w-full flex-col items-center gap-2 rounded-2xl border border-line bg-surface px-2 py-4 text-center shadow-card hover:border-maroon/40"
                  >
                    <span className="grid h-10 w-10 place-items-center rounded-xl bg-blush text-maroon">
                      <Icon className="h-5 w-5" strokeWidth={1.8} />
                    </span>
                    <span className="text-[12px] leading-tight font-medium">{c}</span>
                    <span className="mt-auto text-[11px] text-ink-soft">{directory.filter((b) => b.category === c).length} bisnis</span>
                  </button>
                </li>
              );
            })}
          </ul>
          {cities.length > 0 && (
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              {cities.map(([name, n]) => (
                <Chip key={name} active={city === name} onClick={() => browse({ kota: city === name ? null : name })}>
                  {name} <Count n={n} />
                </Chip>
              ))}
            </div>
          )}
        </section>

        {/* What is happening: peluang, perks, acara */}
        {!!peluang.data?.length && (
          <section className="mt-12 md:mt-16">
            <SectionHead eyebrow="Peluang terbaru" title="Bukan cuma cari bisnis. Cari teman membangun." href="/peluang" link="Lihat semua peluang" />
            <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {peluang.data.slice(0, 3).map((p, i) => (
                <PeluangCard key={p.id} peluang={p} index={i} />
              ))}
            </div>
          </section>
        )}

        {perks.length > 0 && (
          <section className="mt-12 md:mt-16">
            <SectionHead eyebrow="GLP Perk" title="Promo khusus sesama lulusan" href="/lulusan?promo=1" link="Lihat semua promo" />
            <Card className="mt-5 divide-y divide-line">
              {perks.slice(0, 5).map((b) => (
                <Link key={b.id} href={`/bisnis/${b.id}`} className="tap-soft flex items-center gap-4 p-4 hover:bg-page">
                  <Media path={b.image_path} name={b.name} className="h-12 w-12 shrink-0 rounded-xl [&_span]:text-base" />
                  <span className="min-w-0 flex-1">
                    <span className="line-clamp-2 text-sm leading-snug font-semibold">{b.perk}</span>
                    <span className="block truncate text-[13px] text-ink-soft">
                      {b.name} · {b.owner_name}
                    </span>
                  </span>
                  <Badge tone="gold">Lihat</Badge>
                </Link>
              ))}
            </Card>
          </section>
        )}

        {!!events.data?.length && (
          <section className="mt-12 md:mt-16">
            <SectionHead eyebrow="Bertemu, belajar, terhubung" title="Acara mendatang" href="/acara" link="Lihat semua acara" />
            <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {events.data.slice(0, 3).map((event, i) => (
                <EventCard
                  key={event.id}
                  event={event}
                  rsvp={rsvps.data?.get(event.id) ?? null}
                  onChanged={() => (events.reload(), rsvps.reload())}
                  index={i}
                />
              ))}
            </div>
          </section>
        )}
      </Container>

      <section className="mt-12 bg-sunken py-14 text-center md:mt-16 md:py-20">
        <Container>
          <p className="eyebrow">Perluas jangkauanmu</p>
          <h2 className="h-section mx-auto mt-3 max-w-xl">Lagi membangun sesuatu? Pasang di direktori.</h2>
          <p className="body-copy mx-auto mt-3 max-w-xl text-sm">
            Biar bisnismu ditemukan publik dan sesama lulusan. Gratis, dan kamu bisa menyalakan atau mematikannya kapan saja.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Button href={pasangBisnis} size="lg">
              <Store className="h-4 w-4" /> Pasang bisnis
            </Button>
          </div>
          <p className="mt-4 text-[12px] text-ink-soft">Khusus lulusan AsiaWorks: Basic, Advanced, dan Leadership Program.</p>
        </Container>
      </section>
    </>
  );
}

const Count = ({ n }: { n: number }) => <span className="opacity-75">{n}</span>;

function SectionHead({ eyebrow, title, href, link }: { eyebrow: string; title: string; href: string; link: string }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h2 className="h-section mt-1">{title}</h2>
      </div>
      <Link href={href} className="tap -my-2.5 inline-flex min-h-10 items-center text-[13px] font-semibold text-maroon underline-offset-4 hover:underline">
        {link}
      </Link>
    </div>
  );
}

// The banner at the top, the way a shop's front page does it: one big banner that slides. Staff put up its
// announcements and ads; the newest is first. A finger swipes it; a mouse has no sideways scroll, so it gets the two arrows.
// One wide shape on every screen (3:1, a little lower on a desktop), so a banner picture is never cut at its sides.
const BANNER_SHAPE = "aspect-[3/1] w-full lg:aspect-[3.4/1]";
const SLIDE_EVERY = 5000; // ms a banner stays before the next one comes by itself
// An arrow sits on the banner: a ring in white with a dark edge shows on the dark backdrop and on a bright picture.
// Hidden only where a finger swipes instead (a narrow desktop window keeps them).
const ARROW = "absolute top-1/2 -translate-y-1/2 hover:text-maroon focus-visible:outline-white focus-visible:shadow-[0_0_0_6px_rgb(28_24_24/0.55)] max-sm:pointer-coarse:hidden";

function Banners({ banners }: { banners: Banner[] }) {
  const rail = useRef<HTMLDivElement>(null);
  const [at, setAt] = useState(0);
  const slide = (direction: 1 | -1) => {
    const el = rail.current;
    if (!el) return;
    const next = (at + direction + banners.length) % banners.length; // past the last one it starts over
    el.scrollTo({ left: next * el.clientWidth, behavior: scrollBehavior() });
  };
  // Like a shop's banner it moves on by itself, until the person takes over: pointing at it or focusing it holds it,
  // and sliding it by hand stops it for good. Never for people who asked their device for less motion.
  const [auto, setAuto] = useState(true);
  const held = useRef(false);
  useEffect(() => {
    if (!auto || banners.length < 2 || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = setInterval(() => !held.current && slide(1), SLIDE_EVERY);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- restarts with every slide, so each banner gets its full time
  }, [auto, at, banners.length]);
  const hold = (on: boolean) => () => void (held.current = on);
  return (
    <section aria-label="Banner" className="relative mt-4" onMouseEnter={hold(true)} onMouseLeave={hold(false)} onFocus={hold(true)} onBlur={hold(false)}>
      <div
        ref={rail}
        onScroll={(e) => setAt(Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth))}
        onPointerDown={() => setAuto(false)}
        className="no-scrollbar flex snap-x snap-mandatory overflow-x-auto rounded-2xl shadow-raised"
      >
        {banners.map((banner) => (
          <BannerCard key={banner.id} banner={banner} />
        ))}
      </div>
      {banners.length > 1 && (
        <>
          <IconButton label="Banner sebelumnya" floating onClick={() => (setAuto(false), slide(-1))} className={cn(ARROW, "left-3")}>
            <ChevronLeft className="h-4 w-4" />
          </IconButton>
          <IconButton label="Banner berikutnya" floating onClick={() => (setAuto(false), slide(1))} className={cn(ARROW, "right-3")}>
            <ChevronRight className="h-4 w-4" />
          </IconButton>
          {/* Where the slider is. Decoration only: sliding is by swipe, by the arrows, or by itself. */}
          <span aria-hidden className="pointer-events-none absolute inset-x-0 bottom-1.5 flex justify-center gap-1.5 sm:bottom-2.5">
            {banners.map((banner, i) => (
              <span key={banner.id} className={cn("h-1.5 w-1.5 rounded-full bg-white transition-opacity duration-300", i === at ? "opacity-100" : "opacity-40")} />
            ))}
          </span>
        </>
      )}
    </section>
  );
}

// A banner without a picture: the brand's maroon for an announcement, its gold for an ad. Layered light, with grain.
const BACKDROPS = {
  maroon:
    "bg-maroon-deep bg-[radial-gradient(90%_70%_at_85%_0%,rgb(139_26_26/0.95),transparent_70%),radial-gradient(70%_60%_at_0%_100%,rgb(138_106_47/0.4),transparent_70%)]",
  gold: "bg-[#4a3713] bg-[radial-gradient(90%_70%_at_85%_0%,rgb(165_128_60/0.95),transparent_70%),radial-gradient(70%_60%_at_0%_100%,rgb(111_20_20/0.55),transparent_70%)]",
};

// One slide. With a picture, the picture is the banner, as on a shop's front page: nothing is laid over it but its
// label, and its title is what a screen reader says. Without a picture, the words are the banner.
function BannerCard({ banner }: { banner: Banner }) {
  const href = banner.link_url ?? (banner.business_id ? `/bisnis/${banner.business_id}` : null);
  const ad = !!banner.business_id;
  // The picture file may be gone (removed from storage while the banner stayed): then the words are the banner again.
  const [broken, setBroken] = useState(false);
  const pictured = !!banner.image_path && !broken;
  const classes = cn("aw-banner group relative isolate flex shrink-0 snap-start flex-col justify-end overflow-hidden text-white", BANNER_SHAPE);
  // The focus ring is drawn inside the banner (the slider would clip one drawn around it), white with a dark edge so it
  // shows on the dark backdrop and on a bright picture alike.
  const pressable =
    "tap-soft focus-visible:outline-hidden focus-visible:after:pointer-events-none focus-visible:after:absolute focus-visible:after:inset-2 focus-visible:after:rounded-xl focus-visible:after:border-2 focus-visible:after:border-white focus-visible:after:shadow-[0_0_0_2px_rgb(28_24_24/0.75)] focus-visible:after:content-['']";
  const body = (
    <>
      {pictured ? (
        <span className="absolute inset-0 -z-10">
          {/* eager: a slide waiting off to the side has its picture ready when it comes by */}
          <Media
            path={banner.image_path}
            name={banner.title}
            eager
            onError={() => setBroken(true)}
            className="h-full w-full [&_img]:transition-transform [&_img]:duration-700 [&_img]:ease-out group-hover:[&_img]:scale-[1.03] motion-reduce:[&_img]:transition-none"
          />
        </span>
      ) : (
        <>
          <span className={cn("grain absolute inset-0 -z-10", BACKDROPS[ad ? "gold" : "maroon"])} />
          {/* Where the arrows show (from sm, and for any mouse) the words start to the right of the left one. */}
          <span className="block px-4 pb-4 pointer-fine:px-16 sm:px-16 sm:pb-7 lg:pb-8">
            <span className="line-clamp-2 max-w-2xl text-[17px] leading-tight font-bold tracking-tight text-balance sm:text-[1.75rem] lg:text-4xl">
              {banner.title}
            </span>
            {banner.body && <span className="mt-1.5 line-clamp-2 max-w-xl text-sm leading-snug text-white/85 max-sm:hidden lg:mt-2.5 lg:text-[15px]">{banner.body}</span>}
          </span>
        </>
      )}
      {href && <span className="absolute inset-0 -z-10 bg-white opacity-0 transition-opacity duration-300 group-hover:opacity-10" />}
      <Badge tone={ad ? "gold" : "maroon"} className="absolute top-3 left-3 pointer-fine:left-16 sm:top-5 sm:left-16 lg:top-7">
        {ad ? "Iklan" : "Pengumuman"}
      </Badge>
    </>
  );
  if (!href) return <div className={classes}>{body}</div>;
  return /^https?:\/\//i.test(href) ? (
    <a href={href} target="_blank" rel="noopener noreferrer" className={cn(classes, pressable)}>
      {body}
    </a>
  ) : (
    <Link href={href} className={cn(classes, pressable)}>
      {body}
    </Link>
  );
}
