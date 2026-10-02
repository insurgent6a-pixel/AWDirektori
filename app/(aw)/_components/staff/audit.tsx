"use client";

// Audit log: who did what, to what. Rows are written by the database itself (triggers and staff RPC), never by this
// screen. audit_feed() adds the names when the log is read; a row about something deleted simply shows no name.

import { ScrollText } from "lucide-react";
import { useEffect, useState } from "react";
import { jam, tanggal } from "../../_lib/format";
import { useQuery } from "../../_lib/hooks";
import { supabase } from "../../_lib/supabase";
import { Button, Card, Empty, Failed, Skeleton } from "../ui";
import { SectionTitle } from "./shared";

const ACTIONS: Record<string, string> = {
  approved: "menyetujui",
  auto_approved: "menyetujui", // by the Auto Approve switch, not by a person
  rejected: "menolak",
  suspended: "menangguhkan",
  pending: "mengembalikan ke antrean",
  insert: "membuat",
  update: "mengubah",
  delete: "menghapus",
  export: "mengekspor data",
  "intro.accepted": "memperkenalkan",
  "intro.declined": "menutup perkenalan",
};
const TARGETS: Record<string, string> = {
  businesses: "bisnis",
  peluang: "peluang",
  promos: "promo",
  events: "acara",
  banners: "banner",
  stories: "cerita",
  reports: "laporan",
  privacy_requests: "permintaan privasi",
  profiles: "lulusan",
  connections: "koneksi",
  settings: "pengaturan",
};
// ponytail: the screen stops at the latest 500 rows, audit_feed's own ceiling. Add a date filter when the log outgrows it.
const MOST = 500;

// `limit` under 100 is the short list on the overview; the full screen starts at 100 and can ask for more.
export function Audit({ limit = 100, title = "Log audit" }: { limit?: number; title?: string }) {
  const [shown, setShown] = useState(limit);
  const log = useQuery(() => supabase.rpc("audit_feed", { p_limit: shown }), [shown]);
  // From the press until its answer. (`loading` alone turns true one render late, and the button would blink.)
  const [asked, setAsked] = useState(false);
  useEffect(() => {
    if (!log.loading) setAsked(false);
  }, [log.loading]);
  const busy = asked || log.loading;
  const full = limit >= 100 && (busy || (log.data?.length ?? 0) >= shown); // the last answer was full: there may be more

  return (
    <section>
      <SectionTitle title={title}>{limit >= 100 ? "Tindakan staf, yang terbaru di atas." : undefined}</SectionTitle>
      <Failed query={log} />
      {log.loading && !log.data ? (
        <Skeleton className="mt-4 h-48" />
      ) : !log.data?.length ? (
        <Empty icon={<ScrollText className="h-6 w-6" />} title="Belum ada aktivitas">
          Setiap persetujuan, penolakan, dan perubahan oleh staf tercatat di sini.
        </Empty>
      ) : (
        <>
          <Card className="mt-4 divide-y divide-line">
            {log.data.map((row) => (
              <div key={row.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-4 py-3 text-sm">
                <p className="min-w-0">
                  <b className="font-semibold">{row.action === "auto_approved" ? "Auto Approve" : (row.actor_name ?? "Akun terhapus")}</b>{" "}
                  {row.action === "auto_approve" ? (
                    <span className="text-ink-soft">{row.note === "on" ? "menyalakan" : "mematikan"} Auto Approve</span>
                  ) : (
                    <>
                      <span className="text-ink-soft">
                        {ACTIONS[row.action] ?? row.action} {TARGETS[row.target_kind ?? ""] ?? row.target_kind ?? ""}
                      </span>
                      {row.target_name && <span className="font-medium"> {row.target_name}</span>}
                      {row.note && <span className="text-ink-soft">: “{row.note}”</span>}
                    </>
                  )}
                </p>
                <time className="shrink-0 text-[12px] text-ink-soft">
                  {tanggal(row.created_at)}, {jam(row.created_at)}
                </time>
              </div>
            ))}
          </Card>
          {full &&
            (busy || shown < MOST ? (
              <Button
                variant="secondary"
                full
                className="mt-3"
                loading={busy}
                onClick={() => {
                  setAsked(true);
                  setShown(shown + 100);
                }}
              >
                Tampilkan lagi
              </Button>
            ) : (
              <p className="mt-3 text-center text-[13px] text-ink-soft">Ini {MOST} tindakan terakhir. Yang lebih lama tetap tersimpan di database.</p>
            ))}
        </>
      )}
    </section>
  );
}
