"use client";

// Staff console at /staff. Not signed in as staff: the same login form as /masuk, in staff mode.

import { BookOpen, CalendarDays, LayoutGrid, LockKeyhole, LogOut, type LucideIcon, Megaphone, ScrollText, ShieldCheck, UserCheck } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { LoginForm } from "../_components/login-form";
import { Breadcrumbs, Container } from "../_components/shell";
import { AcaraStaf } from "../_components/staff/acara";
import { Audit } from "../_components/staff/audit";
import { BannerStaf } from "../_components/staff/banner";
import { CeritaStaf } from "../_components/staff/cerita";
import { Moderasi } from "../_components/staff/moderasi";
import { Privasi } from "../_components/staff/privasi";
import { Ringkasan } from "../_components/staff/ringkasan";
import type { Overview } from "../_components/staff/shared";
import { Verifikasi } from "../_components/staff/verifikasi";
import { Button, Failed, Skeleton, useKeepInView } from "../_components/ui";
import { useAuth } from "../_lib/auth";
import { cn } from "../_lib/format";
import { useQuery } from "../_lib/hooks";
import { supabase } from "../_lib/supabase";

const SECTIONS: { key: string; label: string; icon: LucideIcon; queue?: (o: Overview) => number }[] = [
  { key: "ringkasan", label: "Ringkasan", icon: LayoutGrid },
  { key: "verifikasi", label: "Verifikasi", icon: UserCheck, queue: (o) => o.graduates_pending },
  {
    key: "moderasi",
    label: "Moderasi",
    icon: ShieldCheck,
    queue: (o) => o.businesses_pending + o.peluang_pending + o.promos_pending + o.reports_open + o.intros,
  },
  { key: "acara", label: "Acara", icon: CalendarDays, queue: (o) => o.events_pending },
  { key: "cerita", label: "Cerita", icon: BookOpen },
  { key: "banner", label: "Banner", icon: Megaphone },
  { key: "privasi", label: "Privasi", icon: LockKeyhole, queue: (o) => o.privacy_open },
  { key: "audit", label: "Log audit", icon: ScrollText },
];

export default function StaffPage() {
  const { user, profile, isStaff, loading, failed, refresh, signOut } = useAuth();
  const params = useSearchParams();
  const section = SECTIONS.find((s) => s.key === params.get("tab")) ?? SECTIONS[0];
  // Refetched on every section change, so the queue badges stay current.
  const overview = useQuery<Overview>(
    isStaff ? async () => supabase.rpc("staff_overview").then(({ data, error }) => ({ data: data as Overview | null, error })) : null,
    [isStaff, section.key],
  );

  // Only the first load shows the skeleton. After that, "loading" means someone is signing in through the form below,
  // and the form has to stay on screen to show its progress and, for a member's account, its refusal.
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!loading) setReady(true);
  }, [loading]);
  // Phones: the section strip scrolls sideways; keep the open section in view (again once the badges have loaded).
  const strip = useKeepInView<HTMLUListElement>([section.key, overview.data, ready, isStaff]);
  if (!ready) {
    return (
      <Container className="py-10">
        <Skeleton className="h-72" />
      </Container>
    );
  }
  // The profile could not be read, and without it nobody looks like staff: offer a retry, not the login form.
  if (user && !profile && failed) {
    return (
      <Container className="py-10">
        <Failed query={{ error: "profile", reload: refresh }} />
      </Container>
    );
  }
  if (!user || !isStaff) return <LoginForm staff />;

  return (
    <Container className="py-5 md:py-8">
      <Breadcrumbs items={[{ label: "Beranda", href: "/direktori" }, { label: "Staf", href: "/staff" }, { label: section.label }]} />

      {/* minmax(0, 1fr): the tab strip scrolls sideways on phones instead of stretching the whole page. */}
      <div className="mt-4 grid grid-cols-[minmax(0,1fr)] items-start gap-6 md:grid-cols-[13rem_minmax(0,1fr)]">
        <nav aria-label="Konsol staf" className="min-w-0 md:sticky md:top-24">
          <ul ref={strip} className="no-scrollbar -mx-4 -my-1.5 flex gap-1.5 overflow-x-auto px-4 py-1.5 md:mx-0 md:flex-col md:px-0">
            {SECTIONS.map(({ key, label, icon: Icon, queue }) => {
              const active = key === section.key;
              const waiting = overview.data && queue ? queue(overview.data) : 0;
              return (
                <li key={key} className="shrink-0">
                  <Link
                    href={`/staff?tab=${key}`}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "tap flex items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-sm font-medium whitespace-nowrap",
                      active ? "bg-maroon text-white" : "bg-surface text-ink hover:bg-blush md:bg-transparent",
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {label}
                    {waiting > 0 && (
                      <span className={cn("ml-auto rounded-full px-1.5 text-[11px] leading-5 font-semibold", active ? "bg-white text-maroon" : "bg-maroon text-white")}>
                        {waiting}
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
          <div className="mt-3 hidden md:block">
            <Button variant="ghost" size="sm" onClick={signOut}>
              <LogOut className="h-4 w-4" /> Keluar
            </Button>
          </div>
        </nav>

        <div key={section.key} className="rise min-w-0">
          {overview.error && (
            <div className="mb-4">
              <Failed query={overview} />
            </div>
          )}
          {section.key === "ringkasan" && !overview.error && <Ringkasan overview={overview.data} />}
          {section.key === "verifikasi" && <Verifikasi onChanged={overview.reload} />}
          {section.key === "moderasi" && <Moderasi overview={overview.data} onChanged={overview.reload} />}
          {section.key === "acara" && <AcaraStaf onChanged={overview.reload} />}
          {section.key === "cerita" && <CeritaStaf />}
          {section.key === "banner" && <BannerStaf />}
          {section.key === "privasi" && <Privasi onChanged={overview.reload} />}
          {section.key === "audit" && <Audit />}
          <div className="mt-8 md:hidden">
            <Button variant="ghost" size="sm" onClick={signOut}>
              <LogOut className="h-4 w-4" /> Keluar
            </Button>
          </div>
        </div>
      </div>
    </Container>
  );
}
