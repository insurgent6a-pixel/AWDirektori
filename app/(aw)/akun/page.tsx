"use client";

// Member dashboard: Peluang, Bisnis, Koneksi, Akun. Tabs on desktop, the bottom bar on phones (see shell.tsx).

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { AkunTab } from "../_components/akun/akun-tab";
import { BisnisTab } from "../_components/akun/bisnis-tab";
import { KoneksiTab } from "../_components/akun/koneksi-tab";
import { PeluangTab } from "../_components/akun/peluang-tab";
import { Breadcrumbs, Container, DASHBOARD_TABS, type DashboardTab, usePendingRequests } from "../_components/shell";
import { Badge, Button, Failed, Notice, Skeleton, Tabs } from "../_components/ui";
import { useAuth } from "../_lib/auth";
import { VERIFICATION_LABELS } from "../_lib/constants";

const LABELS: Record<DashboardTab, string> = { peluang: "Peluang", bisnis: "Bisnis", koneksi: "Koneksi", akun: "Akun" };

export default function AkunPage() {
  const { user, profile, loading, failed, refresh, isStaff } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const requested = params.get("tab") as DashboardTab | null;
  const tab = requested && DASHBOARD_TABS.includes(requested) ? requested : "peluang";
  const pending = usePendingRequests();

  useEffect(() => {
    if (loading) return;
    if (!user) router.replace(`/masuk?next=${encodeURIComponent(`/akun?${params}`)}`);
    else if (isStaff) router.replace("/staff");
  }, [loading, user, isStaff, router, params]);

  // The profile could not be read: offer a retry instead of a skeleton that never ends.
  if (!loading && user && !profile && failed) {
    return (
      <Container className="py-8">
        <Failed query={{ error: "profile", reload: refresh }} />
      </Container>
    );
  }
  if (loading || !user || !profile || isStaff) {
    return (
      <Container className="space-y-4 py-8">
        <Skeleton className="h-10 w-56" />
        <Skeleton className="h-64" />
      </Container>
    );
  }

  const status = profile.verification;
  return (
    <Container className="pt-5 pb-10 md:py-8">
      <Breadcrumbs items={[{ label: "Beranda", href: "/" }, { label: "Dasbor", href: "/akun" }, { label: LABELS[tab] }]} />

      <header className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="h-section">Hai, {profile.nickname || profile.full_name || "lulusan"}</h1>
        <Badge tone={status === "approved" ? "green" : status === "pending" ? "amber" : status === "rejected" ? "red" : "gray"}>
          {VERIFICATION_LABELS[status]}
        </Badge>
      </header>

      {status === "draft" && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-blush-line bg-blush p-4">
          <p className="text-sm text-maroon">Data lulusan kamu belum lengkap. Lengkapi dulu supaya staf bisa memverifikasi.</p>
          <Button href="/daftar" size="sm">
            Lengkapi data
          </Button>
        </div>
      )}
      {status === "pending" && (
        <div className="mt-4">
          <Notice tone="amber">
            Data kamu sedang diverifikasi staf AsiaWorks. Sambil menunggu, kamu sudah bisa menyiapkan bisnis. Peluang, Hubungkan, dan RSVP
            terbuka setelah disetujui.
          </Notice>
        </div>
      )}
      {status === "rejected" && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-red-soft p-4">
          <p className="text-sm text-red">
            Staf meminta data kamu diperbaiki{profile.verification_note ? `: ${profile.verification_note}` : "."}
          </p>
          <Button href="/daftar" size="sm">
            Perbaiki data
          </Button>
        </div>
      )}

      {/* Phones use the bottom bar for these tabs. */}
      <div className="mt-5 hidden max-w-lg md:block">
        <Tabs
          items={DASHBOARD_TABS.map((value) => ({ value, label: LABELS[value], count: value === "koneksi" ? pending : undefined }))}
          value={tab}
          onChange={(next) => router.replace(`/akun?tab=${next}`, { scroll: false })}
        />
      </div>

      <div key={tab} className="mt-5">
        {tab === "peluang" && <PeluangTab />}
        {tab === "bisnis" && <BisnisTab />}
        {tab === "koneksi" && <KoneksiTab />}
        {tab === "akun" && <AkunTab />}
      </div>
    </Container>
  );
}
