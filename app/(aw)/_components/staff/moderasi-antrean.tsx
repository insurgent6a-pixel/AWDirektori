"use client";

// The smaller moderation queues: Peluang, Promo and member reports.

import { Flag } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useAuth } from "../../_lib/auth";
import { PELUANG_KINDS, REVIEW_LABELS, REVIEW_TONES } from "../../_lib/constants";
import { tanggal } from "../../_lib/format";
import { useQuery } from "../../_lib/hooks";
import { supabase } from "../../_lib/supabase";
import type { Enums } from "../../_lib/types";
import { Badge, Button, Card, Empty, Failed, Skeleton, toast } from "../ui";
import { AutoApprove, Decide, moderate, NoteSheet, type Person, personLabel, QueueEmpty, ReviewNote, type Status, StatusFilter } from "./shared";

type QueueProps = { onChanged: () => void };
type Named = { id: string; name: string | null } | null;

// Every queue below renders <Failed> first, so a query error never looks like an empty queue.
function Loading() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-28" />
      <Skeleton className="h-28" />
    </div>
  );
}

// ── Peluang ─────────────────────────────────────────────────────────

type PeluangRow = {
  id: string;
  kind: Enums<"peluang_kind">;
  title: string;
  description: string;
  area: string | null;
  deadline: string | null;
  status: Status;
  review_note: string | null;
  created_at: string;
  owner: Person;
  business: Named;
};

export function PeluangQueue({ onChanged }: QueueProps) {
  const [status, setStatus] = useState<Status>("pending");
  const list = useQuery(
    () =>
      supabase
        .from("peluang")
        .select("id, kind, title, description, area, deadline, status, review_note, created_at, owner:profiles!peluang_owner_id_fkey(full_name, nickname, batch_lp), business:businesses(id, name)")
        .eq("status", status)
        .order("created_at")
        .overrideTypes<PeluangRow[], { merge: false }>(),
    [status],
  );
  const done = () => (list.reload(), onChanged());
  return (
    <>
      <div className="-mt-2 mb-3">
        <AutoApprove
          setting="auto_approve_peluang"
          title="Auto Approve Peluang"
          onChanged={done}
          warning="Semua Peluang yang sedang menunggu langsung tayang. Selama menyala, setiap Peluang baru dari lulusan terverifikasi juga langsung tayang tanpa ditinjau. Yang sudah tayang hanya bisa ditangguhkan satu per satu."
        >
          Untuk demo. Selama menyala, setiap Peluang dari lulusan terverifikasi langsung tayang, termasuk yang sedang menunggu saat ini.
        </AutoApprove>
      </div>
      <StatusFilter value={status} onChange={setStatus} />
      <Failed query={list} />
      {list.loading && !list.data ? (
        <Loading />
      ) : !list.data?.length ? (
        <QueueEmpty status={status} />
      ) : (
        <div className="space-y-3">
          {list.data.map((p) => (
            <Card key={p.id} className="p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="gold">{PELUANG_KINDS[p.kind]}</Badge>
                <Badge tone={REVIEW_TONES[p.status]}>{REVIEW_LABELS[p.status]}</Badge>
              </div>
              <h3 className="mt-2 font-semibold">{p.title}</h3>
              <p className="mt-0.5 text-[13px] text-ink-soft">
                {personLabel(p.owner)}
                {p.business ? ` · ${p.business.name || "bisnis tanpa nama"}` : " · tanpa bisnis"} · {p.area ?? "di mana saja"}
                {p.deadline ? ` · sampai ${tanggal(p.deadline)}` : ""}
              </p>
              <p className="body-copy mt-2 text-[13px] whitespace-pre-line">{p.description}</p>
              <ReviewNote note={p.review_note} />
              <div className="mt-3 border-t border-line pt-3">
                <Decide kind="peluang" id={p.id} status={p.status} onDone={done} />
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}

// ── Promo ───────────────────────────────────────────────────────────

type PromoRow = { id: string; title: string; code: string; valid_until: string | null; active: boolean; status: Status; review_note: string | null; business: Named };

export function PromoQueue({ onChanged }: QueueProps) {
  const [status, setStatus] = useState<Status>("pending");
  const list = useQuery(
    () =>
      supabase
        .from("promos")
        .select("id, title, code, valid_until, active, status, review_note, business:businesses(id, name)")
        .eq("status", status)
        .order("created_at")
        .overrideTypes<PromoRow[], { merge: false }>(),
    [status],
  );
  const done = () => (list.reload(), onChanged());
  return (
    <>
      <div className="-mt-2 mb-3">
        <AutoApprove
          setting="auto_approve_promo"
          title="Auto Approve Promo"
          onChanged={done}
          warning="Semua promo yang sedang menunggu langsung tayang. Selama menyala, setiap promo baru juga langsung tayang tanpa ditinjau. Yang sudah tayang hanya bisa ditangguhkan satu per satu."
        >
          Untuk demo. Selama menyala, setiap promo langsung tayang di kartu bisnisnya, termasuk yang sedang menunggu saat ini.
        </AutoApprove>
      </div>
      <StatusFilter value={status} onChange={setStatus} />
      <Failed query={list} />
      {list.loading && !list.data ? (
        <Loading />
      ) : !list.data?.length ? (
        <QueueEmpty status={status} />
      ) : (
        <div className="space-y-3">
          {list.data.map((p) => (
            <Card key={p.id} className="p-4">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-semibold">{p.title}</h3>
                <Badge tone={REVIEW_TONES[p.status]}>{REVIEW_LABELS[p.status]}</Badge>
                {!p.active && <Badge tone="gray">Disembunyikan pemilik</Badge>}
              </div>
              <p className="mt-1 text-[13px] text-ink-soft">
                {p.business?.name || "Bisnis tanpa nama"} · kode <b className="font-semibold text-ink">{p.code}</b>
                {p.valid_until ? ` · berlaku sampai ${tanggal(p.valid_until)}` : ""}
              </p>
              <ReviewNote note={p.review_note} />
              <div className="mt-3 border-t border-line pt-3">
                <Decide kind="promo" id={p.id} status={p.status} onDone={done} />
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}

// ── Laporan ─────────────────────────────────────────────────────────

type ReportRow = {
  id: string;
  reason: string;
  created_at: string;
  reporter: Person;
  business: { id: string; name: string | null; status: Status } | null;
  peluang: { id: string; title: string; status: Status } | null;
};

export function LaporanQueue({ onChanged }: QueueProps) {
  const { user } = useAuth();
  const [suspending, setSuspending] = useState<ReportRow | null>(null);
  const [busy, setBusy] = useState<string | null>(null); // a double tap must not act twice
  const list = useQuery(
    () =>
      supabase
        .from("reports")
        .select(
          "id, reason, created_at, reporter:profiles!reports_reporter_id_fkey(full_name, nickname, batch_lp), business:businesses(id, name, status), peluang:peluang(id, title, status)",
        )
        .is("resolved_at", null)
        .order("created_at")
        .overrideTypes<ReportRow[], { merge: false }>(),
    [],
  );

  const resolve = async (id: string) => {
    setBusy(id);
    const { error } = await supabase.from("reports").update({ resolved_at: new Date().toISOString(), resolved_by: user!.id }).eq("id", id);
    setBusy(null);
    if (error) return toast("Belum tersimpan. Coba lagi ya.", "error");
    toast("Laporan ditandai selesai.");
    list.reload();
    onChanged();
  };

  if (list.error) return <Failed query={list} />;
  if (list.loading && !list.data) return <Loading />;
  if (!list.data?.length) {
    return (
      <Empty icon={<Flag className="h-6 w-6" />} title="Tidak ada laporan terbuka">
        Laporan dari anggota tentang bisnis atau peluang muncul di sini.
      </Empty>
    );
  }
  return (
    <div className="space-y-3">
      {list.data.map((r) => {
        const live = r.business ? r.business.status === "approved" : r.peluang?.status === "approved";
        return (
          <Card key={r.id} className="p-4">
            <p className="text-[13px] text-ink-soft">
              {personLabel(r.reporter)} melaporkan{" "}
              {r.business ? (
                <Link href={`/bisnis/${r.business.id}`} className="tap -my-2.5 inline-block py-2.5 font-semibold text-maroon hover:underline">
                  {r.business.name || "bisnis tanpa nama"}
                </Link>
              ) : (
                <b className="font-semibold text-ink">peluang “{r.peluang?.title}”</b>
              )}{" "}
              · {tanggal(r.created_at)}
            </p>
            <p className="body-copy mt-2 rounded-xl bg-page px-3.5 py-3 text-sm whitespace-pre-line">{r.reason}</p>
            <div className="mt-3 flex flex-wrap gap-2 border-t border-line pt-3">
              <Button size="sm" loading={busy === r.id} onClick={() => resolve(r.id)}>
                Tandai selesai
              </Button>
              {live && (
                <Button size="sm" variant="danger" onClick={() => setSuspending(r)}>
                  Tangguhkan {r.business ? "bisnis" : "peluang"}
                </Button>
              )}
            </div>
          </Card>
        );
      })}
      <NoteSheet
        open={!!suspending}
        onClose={() => setSuspending(null)}
        title="Tangguhkan"
        confirmLabel="Tangguhkan"
        onConfirm={async (note) => {
          const r = suspending!;
          const ok = r.business ? await moderate("business", r.business.id, "suspend", note) : await moderate("peluang", r.peluang!.id, "suspend", note);
          setSuspending(null);
          if (ok) await resolve(r.id);
        }}
      />
    </div>
  );
}
