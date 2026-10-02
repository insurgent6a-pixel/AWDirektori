"use client";

// Site chrome: header, the mobile bottom bar, footer, breadcrumbs and the page hero.

import {
  Building2,
  CalendarDays,
  ChevronRight,
  CircleUserRound,
  Compass,
  Ellipsis,
  GraduationCap,
  Handshake,
  Link2,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "../_lib/auth";
import { cn } from "../_lib/format";
import { useQuery } from "../_lib/hooks";
import { supabase } from "../_lib/supabase";
import { STAFF_BAR, STAFF_SECTIONS, useStaffOverview } from "./staff/shared";
import { Avatar, Button } from "./ui";

type NavItem = { href: string; label: string; icon: LucideIcon; badge?: number };

// The main AsiaWorks site (training programmes, schedule, registration). The directory lives on its own subdomain.
const MAIN_SITE = "https://asiaworks.id";
// The main site's menu (Footer → NAVIGASI in its App.jsx); its pages are #hash routes.
const MAIN_NAV = [
  { href: `${MAIN_SITE}/`, label: "Home" },
  { href: `${MAIN_SITE}/#programmes`, label: "Program" },
  { href: `${MAIN_SITE}/#schedule`, label: "Jadwal" },
  { href: `${MAIN_SITE}/#trainers`, label: "Trainer" },
  { href: `${MAIN_SITE}/#testimonials`, label: "Testimoni" },
  { href: `${MAIN_SITE}/#gallery`, label: "Galeri" },
  { href: `${MAIN_SITE}/#about`, label: "Tentang Kami" },
  { href: `${MAIN_SITE}/#contact`, label: "Kontak" },
  { href: `${MAIN_SITE}/#kebijakan`, label: "Kebijakan Refund" },
];
// Office WhatsApp — keep in sync with OFFICE_WA in the main site's App.jsx.
const OFFICE_WA = "6281219978707";
const OFFICE_WA_LABEL = "+62 812-1997-8707";
// Social accounts with the main site's icon paths (24×24).
const SOCIAL = [
  {
    name: "Instagram",
    handle: "@asiaworksid",
    url: "https://www.instagram.com/asiaworksid?igsh=dzY3ZmtlY2tma3Fh",
    icon: "M12 2.2c3.2 0 3.6 0 4.85.07 1.17.05 1.8.25 2.23.41.56.22.96.48 1.38.9.42.42.68.82.9 1.38.16.42.36 1.06.41 2.23.06 1.27.07 1.65.07 4.85s0 3.58-.07 4.85c-.05 1.17-.25 1.8-.41 2.23-.22.56-.48.96-.9 1.38-.42.42-.82.68-1.38.9-.42.16-1.06.36-2.23.41-1.27.06-1.65.07-4.85.07s-3.58 0-4.85-.07c-1.17-.05-1.8-.25-2.23-.41a3.7 3.7 0 0 1-1.38-.9 3.7 3.7 0 0 1-.9-1.38c-.16-.42-.36-1.06-.41-2.23C2.2 15.6 2.2 15.2 2.2 12s0-3.58.07-4.85c.05-1.17.25-1.8.41-2.23.22-.56.48-.96.9-1.38.42-.42.82-.68 1.38-.9.42-.16 1.06-.36 2.23-.41C8.4 2.2 8.8 2.2 12 2.2Zm0 1.8c-3.15 0-3.5 0-4.74.07-.9.04-1.38.19-1.7.31-.43.17-.74.37-1.06.69-.32.32-.52.63-.69 1.06-.12.32-.27.8-.31 1.7C3.43 8.5 3.43 8.85 3.43 12s0 3.5.07 4.74c.04.9.19 1.38.31 1.7.17.43.37.74.69 1.06.32.32.63.52 1.06.69.32.12.8.27 1.7.31 1.24.07 1.59.07 4.74.07s3.5 0 4.74-.07c.9-.04 1.38-.19 1.7-.31.43-.17.74-.37 1.06-.69.32-.32.52-.63.69-1.06.12-.32.27-.8.31-1.7.07-1.24.07-1.59.07-4.74s0-3.5-.07-4.74c-.04-.9-.19-1.38-.31-1.7a2.85 2.85 0 0 0-.69-1.06 2.85 2.85 0 0 0-1.06-.69c-.32-.12-.8-.27-1.7-.31C15.5 4 15.15 4 12 4Zm0 3.06A4.94 4.94 0 1 1 12 16.94 4.94 4.94 0 0 1 12 7.06Zm0 1.8A3.14 3.14 0 1 0 12 15.14 3.14 3.14 0 0 0 12 8.86Zm5.14-2.99a1.15 1.15 0 1 1 0 2.3 1.15 1.15 0 0 1 0-2.3Z",
  },
  {
    name: "Facebook",
    handle: "AsiaWorksID",
    url: "https://facebook.com/AsiaWorksID",
    icon: "M22 12a10 10 0 1 0-11.56 9.88v-6.99H7.9V12h2.54V9.8c0-2.5 1.49-3.89 3.78-3.89 1.09 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.77-1.63 1.56V12h2.78l-.44 2.89h-2.34v6.99A10 10 0 0 0 22 12Z",
  },
  {
    name: "YouTube",
    handle: "@AsiaworksIndonesia",
    url: "https://www.youtube.com/@AsiaworksIndonesia",
    icon: "M23.5 6.19a3.02 3.02 0 0 0-2.12-2.14C19.5 3.55 12 3.55 12 3.55s-7.5 0-9.38.5A3.02 3.02 0 0 0 .5 6.19C0 8.07 0 12 0 12s0 3.93.5 5.81a3.02 3.02 0 0 0 2.12 2.14c1.88.5 9.38.5 9.38.5s7.5 0 9.38-.5a3.02 3.02 0 0 0 2.12-2.14C24 15.93 24 12 24 12s0-3.93-.5-5.81ZM9.55 15.57V8.43L15.82 12l-6.27 3.57Z",
  },
];

export const NAV: NavItem[] = [
  { href: "/", label: "Direktori", icon: Compass },
  { href: "/peluang", label: "Peluang", icon: Handshake },
  { href: "/acara", label: "Acara", icon: CalendarDays },
  { href: "/lulusan", label: "Lulusan", icon: GraduationCap },
];

// The member dashboard's own tabs: /akun?tab=...
export const DASHBOARD_TABS = ["peluang", "bisnis", "koneksi", "akun"] as const;
export type DashboardTab = (typeof DASHBOARD_TABS)[number];
const DASHBOARD_NAV: (NavItem & { tab: DashboardTab })[] = [
  { tab: "peluang", href: "/akun?tab=peluang", label: "Peluang", icon: Handshake },
  { tab: "bisnis", href: "/akun?tab=bisnis", label: "Bisnis", icon: Building2 },
  { tab: "koneksi", href: "/akun?tab=koneksi", label: "Koneksi", icon: Link2 },
  { tab: "akun", href: "/akun?tab=akun", label: "Akun", icon: CircleUserRound },
];

// Sign-in, sign-up and the staff console run without the public chrome.
const isBare = (path: string) => ["/masuk", "/daftar", "/staff"].some((p) => path.startsWith(p));

// The home is "/", which every path starts with: it is active on itself and on a business page.
const isActive = (path: string, href: string) => (href === "/" ? path === "/" || path.startsWith("/bisnis") : path.startsWith(href));

// Where "Pasang bisnis" leads: sign-up for a visitor, the new-business form in the dashboard for a member.
export function usePasangBisnis() {
  const { user, isStaff } = useAuth();
  return user && !isStaff ? "/akun?tab=bisnis&baru=1" : "/daftar";
}

export function Container({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("mx-auto w-full max-w-6xl px-4 sm:px-6", className)}>{children}</div>;
}

// The AsiaWorks wordmark as on asiaworks.id (<Wordmark> in the main site's App.jsx, same numbers): tracked Cinzel
// capitals "ASIA" + an oversized maroon "W" + "ORKS", over a gold rule with "DIREKTORI" as the plaque line.
// The W's margins are measured on the Cinzel glyphs so both gaps (A–W, W–O) equal the gaps between the other letters.
export function Wordmark({ dark = false }: { dark?: boolean }) {
  return (
    <Link href="/" className="tap inline-flex items-center hover:opacity-80" aria-label="AsiaWorks Direktori">
      <span className="font-brand inline-flex flex-col text-[17px] leading-none font-bold">
        <span className={cn("inline-flex items-baseline whitespace-nowrap", dark ? "text-white" : "text-ink")}>
          <span className="tracking-[0.16em]">ASIA</span>
          <span
            className={cn(
              "relative top-[0.0485em] mr-[0.012em] -ml-[0.145em] inline-block text-[1.65em]",
              dark ? "text-maroon-bright" : "text-maroon",
            )}
          >
            W
          </span>
          <span className="tracking-[0.16em]">ORKS</span>
        </span>
        <span className="mt-[0.18em] flex items-center gap-[0.35em]">
          <span aria-hidden="true" className="h-px flex-1 rounded-sm bg-gradient-to-r from-brass to-brass/35" />
          <span className="pl-[0.34em] text-[0.48em] font-semibold tracking-[0.34em] text-brass">DIREKTORI</span>
        </span>
      </span>
    </Link>
  );
}

export function Header() {
  const path = usePathname();
  const { user, profile, isStaff, loading } = useAuth();
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-surface/90 pt-[env(safe-area-inset-top,0px)] backdrop-blur-md">
      <Container className="flex h-16 items-center justify-between gap-3 lg:gap-6">
        <Wordmark />
        {!isBare(path) && (
          <nav aria-label="Utama" className="hidden items-center gap-1 md:flex">
            {NAV.map((item) => {
              const active = isActive(path, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "tap relative rounded-lg px-2 py-2 text-sm font-medium lg:px-3",
                    active ? "text-maroon" : "text-ink hover:bg-page",
                  )}
                >
                  {item.label}
                  {active && <span className="rise absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-maroon lg:inset-x-3" />}
                </Link>
              );
            })}
          </nav>
        )}
        <div className={cn("flex items-center gap-2", loading && "invisible")}>
          {/* Back to the main site; on phones the footer carries it. */}
          <a href={MAIN_SITE} className="tap hidden rounded-lg px-3 py-2 text-sm font-medium text-ink-soft hover:bg-page hover:text-ink lg:block">
            asiaworks.id
          </a>
          {!user ? (
            <>
              {/* No link to the page you are already on. */}
              {path !== "/masuk" && (
                <Link href="/masuk" className="tap hidden rounded-lg px-3 py-2 text-sm font-medium hover:bg-page sm:block">
                  Masuk
                </Link>
              )}
              {path !== "/daftar" && (
                <Button href="/daftar" size="sm">
                  Pasang bisnis
                </Button>
              )}
            </>
          ) : (
            <Link
              href={isStaff ? "/staff" : "/akun"}
              className="tap flex items-center gap-2 rounded-full border border-line bg-surface py-1 pr-3.5 pl-1 text-sm font-medium whitespace-nowrap shadow-card hover:bg-page"
            >
              <Avatar name={profile?.nickname || profile?.full_name || "A"} className="h-8 w-8" />
              {/* On the narrowest phones the name beside it leaves room for one word only. */}
              {isStaff ? (
                <span>
                  Konsol<span className="max-[379px]:hidden"> staf</span>
                </span>
              ) : (
                "Dasbor"
              )}
            </Link>
          )}
        </div>
      </Container>
    </header>
  );
}

// Hubungkan requests waiting for this member's answer: the number on the Koneksi tab (bottom bar and desktop tabs).
// The Koneksi tab announces every answer with an "aw:koneksi" event, so the number drops at once.
export function usePendingRequests(on = true) {
  const { user } = useAuth();
  const pending = useQuery(
    user && on ? () => supabase.from("connections").select("id").eq("to_id", user.id).eq("status", "pending") : null,
    [user?.id, on],
  );
  useEffect(() => {
    window.addEventListener("aw:koneksi", pending.reload);
    return () => window.removeEventListener("aw:koneksi", pending.reload);
  }, [pending.reload]);
  return pending.data?.length;
}

// Mobile navigation lives at the bottom, within thumb reach. Inside the dashboard it switches to the dashboard's tabs,
// and inside the staff console to the console's sections (the first few, the rest under "Lainnya").
// Sticky, not fixed: it is the last thing on the page, so it never covers the footer's last row.
export function BottomBar() {
  const path = usePathname();
  const params = useSearchParams();
  const { user, isStaff } = useAuth();
  const inDashboard = path.startsWith("/akun");
  // The last item: the way in for a visitor, and the way back to their own area for a member or for staff.
  const home = !user ? { href: "/masuk", label: "Masuk" } : isStaff ? { href: "/staff", label: "Konsol" } : { href: "/akun", label: "Dasbor" };

  const inConsole = path.startsWith("/staff") && isStaff; // not the staff login form
  const pending = usePendingRequests(inDashboard);
  const overview = useStaffOverview(inConsole, params.get("tab") ?? "").data;
  const [tapped, setTapped] = useState<string | null>(null); // the pill pops for a tap, not for every page load

  if (isBare(path) && !inConsole) return null;

  const tab = params.get("tab") ?? "peluang";
  const waiting = (sections: typeof STAFF_SECTIONS) => (overview ? sections.reduce((n, s) => n + (s.queue?.(overview) ?? 0), 0) : 0);
  const more = STAFF_SECTIONS.slice(STAFF_BAR);
  const section = params.get("tab") === "lainnya" ? "lainnya" : (STAFF_SECTIONS.find((s) => s.key === params.get("tab")) ?? STAFF_SECTIONS[0]).key;
  const items: (NavItem & { active: boolean })[] = inConsole
    ? [
        ...STAFF_SECTIONS.slice(0, STAFF_BAR).map((s) => ({ href: `/staff?tab=${s.key}`, label: s.label, icon: s.icon, active: s.key === section, badge: waiting([s]) })),
        { href: "/staff?tab=lainnya", label: "Lainnya", icon: Ellipsis, active: section === "lainnya" || more.some((s) => s.key === section), badge: waiting(more) },
      ]
    : inDashboard
      ? DASHBOARD_NAV.map((item) => ({
          ...item,
          active: item.tab === tab,
          badge: item.tab === "koneksi" ? pending : undefined,
        }))
      : [
          ...NAV.map((item) => ({ ...item, active: isActive(path, item.href) })),
          { ...home, icon: CircleUserRound, active: false },
        ];

  return (
    <nav
      aria-label="Navigasi bawah"
      className="sticky bottom-0 z-40 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom,0px)] shadow-float backdrop-blur-md md:hidden"
    >
      <ul className="mx-auto grid max-w-md" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
        {items.map(({ href, label, icon: Icon, active, badge }) => (
          <li key={href}>
            <Link
              href={href}
              aria-current={active ? "page" : undefined}
              onClick={() => setTapped(href)}
              className={cn(
                "tap flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium",
                active ? "text-maroon" : "text-ink-soft",
              )}
            >
              <span className={cn("relative grid h-8 w-14 place-items-center rounded-full", active && "bg-blush", active && tapped === href && "animate-pop")}>
                <Icon className="h-[22px] w-[22px]" strokeWidth={active ? 2.2 : 1.8} />
                {!!badge && (
                  <span className="absolute -top-0.5 right-1.5 min-w-4 rounded-full bg-maroon px-1 text-center text-[10px] leading-4 text-white">
                    {badge}
                  </span>
                )}
              </span>
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

// The footer of asiaworks.id, rebuilt here (Footer in the main site's App.jsx): next step, brand, social, office,
// navigation, the giant outlined wordmark and the copyright bar. The main site's links open asiaworks.id.
export function Footer() {
  const path = usePathname();
  const pasangBisnis = usePasangBisnis();
  if (isBare(path) || path.startsWith("/akun")) return null;
  return (
    <footer className="relative mt-14 overflow-hidden rounded-t-[28px] bg-gradient-to-b from-ink to-navy text-white/60 md:mt-20 md:rounded-t-[36px]">
      {/* soft maroon + gold glows for depth */}
      <div aria-hidden="true" className="pointer-events-none absolute -top-30 -right-20 h-105 w-105 rounded-full bg-[radial-gradient(circle,rgb(139_26_26/0.33),transparent_65%)]" />
      <div aria-hidden="true" className="pointer-events-none absolute -bottom-40 -left-15 h-95 w-95 rounded-full bg-[radial-gradient(circle,rgb(201_168_76/0.25),transparent_65%)]" />

      {/* Next step: the footer opens with the main action, as on asiaworks.id */}
      <Container className="relative max-w-[1400px]">
        <div className="grid grid-cols-1 items-center gap-8 border-b border-white/10 pt-12 pb-10 md:grid-cols-2 md:pt-20 md:pb-16">
          <div>
            <p className="flex items-center gap-3 text-[0.6875rem] font-bold tracking-[0.2em] text-brass uppercase">
              <span aria-hidden="true" className="h-px w-8 bg-brass" />
              Langkah berikutnya
            </p>
            <p className="mt-4 text-[clamp(2.4rem,6vw,4.6rem)] leading-[0.95] font-black tracking-[-0.03em] text-white">
              Siap untuk <span className="text-brass">melangkah?</span>
            </p>
            <p className="mt-5 max-w-[520px] text-base leading-[1.8] text-white/70">
              Apa yang Anda temukan di sini mengubah segalanya di luar sana. Mulai dari Basic Training — tidak perlu
              pengalaman apa pun.
            </p>
          </div>
          <div className="rounded-3xl border border-white/12 bg-white/5 p-5 md:p-7">
            <p className="text-[clamp(1.3rem,3vw,1.7rem)] leading-[1.1] font-black tracking-[-0.02em] text-white">
              Lihat jadwal Basic Training berikutnya di asiaworks.id.
            </p>
            <div className="mt-5 flex flex-wrap gap-2.5">
              <a href={`${MAIN_SITE}/#schedule`} className={cn(PILL, "bg-brass text-ink hover:brightness-105")}>
                LIHAT JADWAL <span aria-hidden="true">→</span>
              </a>
              <a href={`${MAIN_SITE}/#contact`} className={cn(PILL, "border border-white/45 text-white hover:bg-white/10")}>
                HUBUNGI KAMI
              </a>
            </div>
          </div>
        </div>
      </Container>

      <Container className="relative grid max-w-[1400px] grid-cols-1 gap-10 pt-10 pb-8 sm:grid-cols-2 lg:grid-cols-[1.1fr_1fr_1fr_1.5fr] md:pt-16">
        {/* Brand */}
        <div className="max-w-[300px]">
          <Wordmark dark />
          <p className="mt-4 mb-4 text-[0.8rem] font-extrabold tracking-[0.08em] text-brass uppercase">works in progress</p>
          <p className="text-sm leading-[1.75] text-white/55">
            Direktori bisnis lulusan AsiaWorks. Tempat lulusan saling menemukan, bekerja sama, dan tumbuh bareng.
          </p>
        </div>

        {/* Follow us */}
        <div>
          <FooterHeading>Ikuti kami</FooterHeading>
          {SOCIAL.map(({ name, handle, url, icon }) => (
            <a
              key={name}
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="tap mb-2.5 flex w-fit items-center gap-3 rounded-full border border-white/8 bg-white/4 py-1.5 pr-3.5 pl-1.5 hover:border-brass/40"
            >
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-brass/35 bg-white/6">
                <svg width="18" height="18" viewBox="0 0 24 24" className="fill-brass" aria-hidden="true">
                  <path d={icon} />
                </svg>
              </span>
              <span>
                <span className="block text-[0.82rem] font-bold text-white">{name}</span>
                <span className="block text-[0.72rem] text-white/50">{handle}</span>
              </span>
            </a>
          ))}
        </div>

        {/* Office */}
        <div>
          <FooterHeading>Office</FooterHeading>
          <a href="https://maps.app.goo.gl/L5NTSyhyw9sDuYSFA?g_st=ic" target="_blank" rel="noopener noreferrer" className="block text-[0.85rem] leading-[1.85]">
            <span className="mb-0.5 block font-bold text-brass">AsiaWorks Learning Center</span>
            <span className="block">Lantai 2</span>
            <span className="block">Jl. Kemang Raya No. 14B</span>
            <span className="block">Bangka, Mampang Prapatan</span>
            <span className="block">Jakarta Selatan</span>
            <span className="mt-2.5 inline-flex items-center gap-1.5 border-b border-brass pb-px text-[0.8rem] text-brass">
              <svg width="13" height="13" viewBox="0 0 24 24" className="fill-brass" aria-hidden="true">
                <path d="M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7Zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5Z" />
              </svg>
              Lihat di Google Maps
            </span>
          </a>
          <a
            href={`https://wa.me/${OFFICE_WA}?text=${encodeURIComponent("Halo AsiaWorks, saya ingin bertanya.")}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex items-center gap-2 text-[0.85rem] font-bold text-white hover:text-brass"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" className="fill-brass" aria-hidden="true">
              <path d="M6 3h12a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3h-8l-5 4v-4.2A3 3 0 0 1 3 14V6a3 3 0 0 1 3-3Z" />
            </svg>
            WhatsApp {OFFICE_WA_LABEL}
          </a>
        </div>

        {/* Navigation: the directory's own pages, then the main site's */}
        <div className="grid grid-cols-2 gap-x-4">
          <div>
            <FooterHeading>Direktori</FooterHeading>
            <FooterLinkList
              links={[
                ...NAV.map(({ href, label }) => ({ href, label })),
                { href: pasangBisnis, label: "Pasang bisnis" },
                { href: "/masuk", label: "Masuk" },
                { href: "/staff", label: "Masuk staf" },
              ]}
            />
          </div>
          <div>
            <FooterHeading>AsiaWorks</FooterHeading>
            <FooterLinkList links={MAIN_NAV} />
          </div>
        </div>
      </Container>

      {/* giant outlined wordmark bleeding off the bottom edge — decorative only */}
      <div aria-hidden="true" className="relative mt-4 h-[clamp(3.2rem,9vw,8.5rem)] overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 text-[clamp(4.2rem,12vw,11.5rem)] leading-[0.8] font-black tracking-[-0.03em] whitespace-nowrap text-transparent select-none [-webkit-text-stroke:1px_rgb(255_255_255/0.16)]">
          ASIAWORKS
        </div>
      </div>

      <div className="relative border-t border-white/9">
        <Container className="flex max-w-[1400px] flex-wrap items-center justify-between gap-4 py-4 text-xs tracking-[0.04em] text-white/45">
          <span>
            © {new Date().getFullYear()} AsiaWorks Indonesia. All Rights Reserved. ·{" "}
            <a href={`${MAIN_SITE}/#kebijakan`} className="text-white/70 underline underline-offset-3 hover:text-brass">
              Kebijakan Pembatalan &amp; Pengembalian Dana
            </a>
          </span>
          <button
            type="button"
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            className="tap rounded-full border border-white/14 bg-white/6 px-3.5 py-1.5 text-[0.72rem] font-bold tracking-[0.08em] text-white"
          >
            KE ATAS ↑
          </button>
        </Container>
      </div>
    </footer>
  );
}

const PILL = "tap inline-flex items-center gap-2 rounded-full px-5 py-3 text-[0.78rem] font-extrabold tracking-[0.08em]";

// Heading + short gold bar, as on asiaworks.id
function FooterHeading({ children }: { children: React.ReactNode }) {
  return (
    <>
      <p className="text-[0.72rem] font-bold tracking-[0.22em] text-white uppercase">{children}</p>
      <span aria-hidden="true" className="mt-4 mb-3.5 block h-0.5 w-7 rounded-sm bg-brass" />
    </>
  );
}

function FooterLinkList({ links }: { links: { href: string; label: string }[] }) {
  return (
    <ul className="text-[0.85rem] font-medium text-white/62">
      {links.map((link) => (
        <li key={link.href + link.label}>
          <Link href={link.href} className="inline-flex min-h-9 items-center transition hover:translate-x-1 hover:text-white md:min-h-7">
            {link.label}
          </Link>
        </li>
      ))}
    </ul>
  );
}

// Every page starts with these. The last crumb is the current page.
export function Breadcrumbs({ items }: { items: { label: string; href?: string }[] }) {
  return (
    <nav aria-label="Breadcrumb">
      {/* Links are 40px tall for thumbs; the negative margin keeps the row's spacing. A long last crumb ends in "…". */}
      <ol className="-mx-1 -my-2.5 flex items-center gap-1.5 overflow-x-clip px-1 text-[12px] font-medium whitespace-nowrap text-ink-soft">
        {items.map((item, i) => (
          <li key={i} className={cn("flex items-center gap-1.5", item.href ? "shrink-0" : "min-w-0")}>
            {i > 0 && <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-60" />}
            {item.href ? (
              <Link href={item.href} className="tap inline-flex h-10 items-center hover:text-maroon">
                {item.label}
              </Link>
            ) : (
              <span aria-current="page" className="truncate leading-10 font-semibold text-maroon">
                {item.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

// The top of a listing page: breadcrumbs, a headline with its maroon half, intro and one action.
export function PageHero({
  crumbs,
  title,
  accent,
  children,
  action,
  aside,
}: {
  crumbs: { label: string; href?: string }[];
  title: string;
  accent?: string;
  children?: React.ReactNode;
  action?: React.ReactNode;
  aside?: React.ReactNode;
}) {
  return (
    <section className="wash border-b border-line">
      <Container className="py-8 md:py-12">
        <Breadcrumbs items={crumbs} />
        <div className="mt-6 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div className="max-w-2xl">
            <h1 className="h-display rise">
              {title} {accent && <span className="accent">{accent}</span>}
            </h1>
            {children && (
              <p className="body-copy rise mt-4 max-w-xl" style={{ "--i": 1 } as React.CSSProperties}>
                {children}
              </p>
            )}
          </div>
          {(action || aside) && (
            <div className="rise shrink-0" style={{ "--i": 2 } as React.CSSProperties}>
              {aside ?? action}
            </div>
          )}
        </div>
      </Container>
    </section>
  );
}
