"use client";

// Site chrome: header, the mobile bottom bar, footer, breadcrumbs and the page hero.

import {
  Building2,
  CalendarDays,
  ChevronRight,
  CircleUserRound,
  Compass,
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
import { Avatar, Button } from "./ui";

type NavItem = { href: string; label: string; icon: LucideIcon; badge?: number };

// The main AsiaWorks site (training programmes, schedule, registration). The directory lives on its own subdomain.
const MAIN_SITE = "https://asiaworks.id";
const MAIN_LINKS = [
  { href: `${MAIN_SITE}/`, label: "Situs AsiaWorks" },
  { href: `${MAIN_SITE}/#programmes`, label: "Program training" },
  { href: `${MAIN_SITE}/#schedule`, label: "Jadwal training" },
  { href: `${MAIN_SITE}/#contact`, label: "Kontak" },
];

export const NAV: NavItem[] = [
  { href: "/direktori", label: "Direktori", icon: Compass },
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
    <Link href="/direktori" className="tap inline-flex items-center hover:opacity-80" aria-label="AsiaWorks Direktori">
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
              const active = path.startsWith(item.href);
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

// Mobile navigation lives at the bottom, within thumb reach. Inside the dashboard it switches to the dashboard's tabs.
// Sticky, not fixed: it is the last thing on the page, so it never covers the footer's last row.
export function BottomBar() {
  const path = usePathname();
  const params = useSearchParams();
  const { user, isStaff } = useAuth();
  const inDashboard = path.startsWith("/akun");
  // The last item: the way in for a visitor, and the way back to their own area for a member or for staff.
  const home = !user ? { href: "/masuk", label: "Masuk" } : isStaff ? { href: "/staff", label: "Konsol" } : { href: "/akun", label: "Dasbor" };

  const pending = usePendingRequests(inDashboard);
  const [tapped, setTapped] = useState<string | null>(null); // the pill pops for a tap, not for every page load

  if (isBare(path)) return null;

  const tab = params.get("tab") ?? "peluang";
  const items: (NavItem & { active: boolean })[] = inDashboard
    ? DASHBOARD_NAV.map((item) => ({
        ...item,
        active: item.tab === tab,
        badge: item.tab === "koneksi" ? pending : undefined,
      }))
    : [
        ...NAV.map((item) => ({ ...item, active: path.startsWith(item.href) })),
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

export function Footer() {
  const path = usePathname();
  const pasangBisnis = usePasangBisnis();
  if (isBare(path) || path.startsWith("/akun")) return null;
  return (
    // Dark, with rounded top corners, as the footer of asiaworks.id.
    <footer className="mt-14 rounded-t-[28px] bg-gradient-to-b from-ink to-navy text-white/60 md:mt-20 md:rounded-t-[36px]">
      <Container className="grid grid-cols-1 gap-10 py-12 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div>
          <Wordmark dark />
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-white/55">
            Direktori bisnis lulusan AsiaWorks. Tempat lulusan saling menemukan, bekerja sama, dan tumbuh bareng.
          </p>
        </div>
        <FooterLinks title="Jelajahi" links={NAV.map(({ href, label }) => ({ href, label }))} />
        <FooterLinks
          title="Untuk lulusan"
          links={[
            { href: pasangBisnis, label: "Pasang bisnis" },
            { href: "/masuk", label: "Masuk" },
            { href: "/staff", label: "Masuk staf" },
          ]}
        />
        <FooterLinks title="AsiaWorks" links={MAIN_LINKS} />
      </Container>
      <Container>
        <p className="border-t border-white/10 py-5 text-[13px] text-white/45">
          © {new Date().getFullYear()} Komunitas lulusan{" "}
          <a href={MAIN_SITE} className="hover:text-brass">
            AsiaWorks
          </a>
        </p>
      </Container>
    </footer>
  );
}

function FooterLinks({ title, links }: { title: string; links: { href: string; label: string }[] }) {
  return (
    <div>
      {/* Heading + short gold bar, as on asiaworks.id */}
      <p className="text-[11px] font-bold tracking-[0.22em] text-white uppercase">{title}</p>
      <span aria-hidden="true" className="mt-3 block h-0.5 w-7 rounded-sm bg-brass" />
      <ul className="mt-2 text-sm text-white/65">
        {links.map((link) => (
          <li key={link.href}>
            <Link href={link.href} className="tap inline-flex min-h-10 items-center hover:text-brass md:min-h-8">
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
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
