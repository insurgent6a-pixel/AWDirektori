"use client";

// Staff console at /staff. Not signed in as staff: the same login form as /masuk, in staff mode.

import { ChevronRight, LogOut } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { LoginForm } from "../_components/login-form";
import { Breadcrumbs, Container } from "../_components/shell";
import { AcaraStaf } from "../_components/staff/acara";
import { Audit } from "../_components/staff/audit";
import { BannerStaf } from "../_components/staff/banner";
import { CeritaStaf } from "../_components/staff/cerita";
import { AkunStaf, BisnisStaf } from "../_components/staff/direktori";
import { Moderasi } from "../_components/staff/moderasi";
import { Privasi } from "../_components/staff/privasi";
import { Ringkasan } from "../_components/staff/ringkasan";
import { STAFF_BAR, STAFF_SECTIONS as SECTIONS, staffChanged, useStaffOverview } from "../_components/staff/shared";
import { Verifikasi } from "../_components/staff/verifikasi";
import { Button, Card, Failed, Skeleton } from "../_components/ui";
import { useAuth } from "../_lib/auth";
import { cn } from "../_lib/format";

export default function StaffPage() {
  const { user, profile, isStaff, loading, failed, refresh, signOut } = useAuth();
  const params = useSearchParams();
  const section = SECTIONS.find((s) => s.key === params.get("tab")) ?? SECTIONS[0];
  // Phones: the bottom bar holds the first sections, and "Lainnya" opens this menu of the rest.
  const more = params.get("tab") === "lainnya";
  // Refetched on every section change, so the queue badges stay current.
  const overview = useStaffOverview(isStaff, section.key);

  // Only the first load shows the skeleton. After that, "loading" means someone is signing in through the form below,
  // and the form has to stay on screen to show its progress and, for a member's account, its refusal.
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!loading) setReady(true);
  }, [loading]);
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
      <Breadcrumbs items={[{ label: "Beranda", href: "/" }, { label: "Staf", href: "/staff" }, { label: more ? "Lainnya" : section.label }]} />

      {/* Phones move between sections with the bottom bar (BottomBar in shell.tsx); the side list is for wider screens. */}
      <div className="mt-4 grid grid-cols-[minmax(0,1fr)] items-start gap-6 md:grid-cols-[13rem_minmax(0,1fr)]">
        <nav aria-label="Konsol staf" className="hidden min-w-0 md:sticky md:top-24 md:block">
          <ul className="flex flex-col gap-1.5">
            {SECTIONS.map(({ key, label, icon: Icon, queue }) => {
              const active = !more && key === section.key;
              const waiting = overview.data && queue ? queue(overview.data) : 0;
              return (
                <li key={key} className="shrink-0">
                  <Link
                    href={`/staff?tab=${key}`}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "tap flex items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-sm font-medium whitespace-nowrap",
                      active ? "bg-maroon text-white" : "text-ink hover:bg-blush",
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
          <div className="mt-3">
            <Button variant="ghost" size="sm" onClick={signOut}>
              <LogOut className="h-4 w-4" /> Keluar
            </Button>
          </div>
        </nav>

        {more ? (
          <div className="rise min-w-0">
            <h2 className="h-card text-xl">Lainnya</h2>
            <Card className="mt-4 divide-y divide-line">
              {SECTIONS.slice(STAFF_BAR).map(({ key, label, icon: Icon, queue }) => {
                const waiting = overview.data && queue ? queue(overview.data) : 0;
                return (
                  <Link key={key} href={`/staff?tab=${key}`} className="tap-soft flex items-center gap-3 p-4 text-sm font-medium hover:bg-page">
                    <Icon className="h-5 w-5 text-maroon" />
                    {label}
                    {waiting > 0 && <span className="rounded-full bg-maroon px-1.5 text-[11px] leading-5 font-semibold text-white">{waiting}</span>}
                    <ChevronRight className="ml-auto h-4 w-4 text-ink-soft" />
                  </Link>
                );
              })}
            </Card>
            <div className="mt-6">
              <Button variant="ghost" size="sm" onClick={signOut}>
                <LogOut className="h-4 w-4" /> Keluar
              </Button>
            </div>
          </div>
        ) : (
          <div key={section.key} className="rise min-w-0">
            {overview.error && (
              <div className="mb-4">
                <Failed query={overview} />
              </div>
            )}
            {section.key === "ringkasan" && !overview.error && <Ringkasan overview={overview.data} />}
            {section.key === "verifikasi" && <Verifikasi onChanged={staffChanged} />}
            {section.key === "moderasi" && <Moderasi overview={overview.data} onChanged={staffChanged} />}
            {section.key === "acara" && <AcaraStaf onChanged={staffChanged} />}
            {section.key === "akun" && <AkunStaf />}
            {section.key === "bisnis" && <BisnisStaf />}
            {section.key === "cerita" && <CeritaStaf />}
            {section.key === "banner" && <BannerStaf />}
            {section.key === "privasi" && <Privasi onChanged={staffChanged} />}
            {section.key === "audit" && <Audit />}
          </div>
        )}
      </div>
    </Container>
  );
}
