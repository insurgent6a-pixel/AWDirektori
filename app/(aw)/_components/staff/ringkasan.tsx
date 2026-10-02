"use client";

// Staff overview: listings, queues and recent activity at a glance.

import Link from "next/link";
import { Card, Skeleton } from "../ui";
import { Audit } from "./audit";
import { type Overview, SectionTitle } from "./shared";

const QUEUES: [key: string, label: string, tab: string][] = [
  ["graduates_pending", "Lulusan menunggu verifikasi", "verifikasi"],
  ["businesses_pending", "Bisnis menunggu tinjauan", "moderasi"],
  ["peluang_pending", "Peluang menunggu tinjauan", "moderasi&antrean=peluang"],
  ["promos_pending", "Promo menunggu tinjauan", "moderasi&antrean=promo"],
  ["reports_open", "Laporan dari anggota", "moderasi&antrean=laporan"],
  ["intros", "Permintaan perkenalan", "moderasi&antrean=perkenalan"],
  ["events_pending", "Usulan acara", "acara"],
  ["privacy_open", "Permintaan privasi", "privasi"],
];

const TOTALS: [key: string, label: string][] = [
  ["businesses_live", "Bisnis tayang"],
  ["businesses_total", "Semua bisnis"],
  ["businesses_suspended", "Ditangguhkan"],
  ["graduates", "Lulusan terverifikasi"],
  ["members", "Akun anggota"],
  ["events_upcoming", "Acara mendatang"],
  ["signups_week", "Pendaftar 7 hari terakhir"],
  ["connections_week", "Permintaan Hubungkan 7 hari terakhir"],
];

export function Ringkasan({ overview }: { overview: Overview | null }) {
  if (!overview) return <Skeleton className="h-96" />;
  return (
    <div className="space-y-8">
      <section>
        <SectionTitle title="Antrean">Yang menunggu tindakan staf. Ketuk untuk membukanya.</SectionTitle>
        <ul className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {QUEUES.map(([key, label, tab]) => {
            const n = overview[key] ?? 0;
            return (
              <li key={key}>
                <Link
                  href={`/staff?tab=${tab}`}
                  className={
                    "tap-soft flex items-center justify-between gap-3 rounded-2xl border p-4 shadow-card " +
                    (n > 0 ? "border-blush-line bg-blush hover:border-maroon/40" : "border-line bg-surface hover:border-maroon/40")
                  }
                >
                  <span className="text-sm font-medium">{label}</span>
                  <span className={"text-2xl font-semibold tracking-tight " + (n > 0 ? "text-maroon" : "text-ink-soft")}>{n}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      <section>
        <SectionTitle title="Direktori saat ini" />
        <dl className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {TOTALS.map(([key, label]) => (
            <Card key={key} className="p-4">
              <dd className="text-2xl font-semibold tracking-tight">{overview[key] ?? 0}</dd>
              <dt className="mt-1 text-[12px] text-ink-soft">{label}</dt>
            </Card>
          ))}
        </dl>
      </section>

      <Audit limit={8} title="Aktivitas terbaru" />
    </div>
  );
}
