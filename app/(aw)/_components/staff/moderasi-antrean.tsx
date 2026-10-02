"use client";

// The smaller moderation queues: Peluang, Promo, member reports and introduction requests.

import { Flag, UserRoundSearch } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useAuth } from "../../_lib/auth";
import { PELUANG_KINDS, REVIEW_LABELS, REVIEW_TONES } from "../../_lib/constants";
import { pesan, tanggal, waLink } from "../../_lib/format";
import { useQuery } from "../../_lib/hooks";
import { supabase } from "../../_lib/supabase";
import type { Enums } from "../../_lib/types";
import { Badge, Button, Card, Empty, Failed, Skeleton, toast } from "../ui";
import { Decide, moderate, NoteSheet, type Person, personLabel, QueueEmpty, ReviewNote, type Status, StatusFilter } from "./shared";

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

// ── Perkenalan ──────────────────────────────────────────────────────

type Party = { id: string; full_name: string; nickname: string | null; batch_lp: number | null } | null;
type IntroRow = { id: string; message: string; created_at: string; from: Party; to: Party; business: Named; peluang: { title: string } | null };
type Contact = { id: string; email: string | null; phone: string | null };

// The owner asked AsiaWorks to introduce them. Staff reach out to both, then mark it done (which opens the contacts).
export function PerkenalanQueue({ onChanged }: QueueProps) {
  const list = useQuery(
    () =>
      supabase
        .from("connections")
        .select(
          "id, message, created_at, from:profiles!connections_from_id_fkey(id, full_name, nickname, batch_lp), to:profiles!connections_to_id_fkey(id, full_name, nickname, batch_lp), business:businesses(id, name), peluang:peluang(title)",
        )
        .eq("status", "intro")
        .order("created_at")
        .overrideTypes<IntroRow[], { merge: false }>(),
    [],
  );
  const contacts = useQuery(() => supabase.rpc("staff_users").overrideTypes<Contact[], { merge: false }>(), []);
  const contactOf = (p: Party) => contacts.data?.find((c) => c.id === p?.id);
  const [busy, setBusy] = useState<string | null>(null); // a double tap must not act twice

  const close = async (id: string, action: "accept" | "decline") => {
    setBusy(id + action);
    const { error } = await supabase.rpc("respond_connection", { p_id: id, p_action: action });
    setBusy(null);
    if (error) return toast(pesan(error), "error");
    toast(action === "accept" ? "Ditandai sudah dikenalkan. Kontak keduanya saling terbuka." : "Permintaan ditutup.");
    list.reload();
    onChanged();
  };

  if (list.error) return <Failed query={list} />;
  if (list.loading && !list.data) return <Loading />;
  if (!list.data?.length) {
    return (
      <Empty icon={<UserRoundSearch className="h-6 w-6" />} title="Tidak ada permintaan perkenalan">
        Saat pemilik bisnis meminta AsiaWorks memperkenalkan mereka dengan seorang lulusan, permintaannya muncul di sini.
      </Empty>
    );
  }
  return (
    <div className="space-y-3">
      {list.data.map((c) => (
        <Card key={c.id} className="p-4">
          <p className="text-sm">
            <b className="font-semibold">{personLabel(c.to)}</b> minta dikenalkan dengan <b className="font-semibold">{personLabel(c.from)}</b>
          </p>
          <p className="mt-0.5 text-[13px] text-ink-soft">
            {c.peluang ? `Peluang “${c.peluang.title}”` : `Bisnis ${c.business?.name || "tanpa nama"}`} · {tanggal(c.created_at)}
          </p>
          <p className="body-copy mt-2 rounded-xl bg-page px-3.5 py-3 text-sm whitespace-pre-line">{c.message}</p>
          <ul className="mt-3 grid grid-cols-1 gap-2 text-[13px] sm:grid-cols-2">
            {[c.to, c.from].map((party) => {
              const contact = contactOf(party);
              return (
                <li key={party?.id} className="rounded-xl border border-line p-3">
                  <p className="font-semibold">{personLabel(party)}</p>
                  {contact?.phone && (
                    <a href={waLink(contact.phone)} target="_blank" rel="noopener noreferrer" className="tap-soft block py-2.5 text-maroon hover:underline">
                      WhatsApp {contact.phone}
                    </a>
                  )}
                  {contact?.email && (
                    <a href={`mailto:${contact.email}`} className="tap-soft block py-2.5 text-maroon hover:underline">
                      {contact.email}
                    </a>
                  )}
                </li>
              );
            })}
          </ul>
          <div className="mt-3 flex flex-wrap gap-2 border-t border-line pt-3">
            <Button size="sm" loading={busy === c.id + "accept"} disabled={busy === c.id + "decline"} onClick={() => close(c.id, "accept")}>
              Sudah dikenalkan
            </Button>
            <Button size="sm" variant="secondary" loading={busy === c.id + "decline"} disabled={busy === c.id + "accept"} onClick={() => close(c.id, "decline")}>
              Tutup tanpa perkenalan
            </Button>
          </div>
        </Card>
      ))}
    </div>
  );
}
