"use client";

// Small pieces the staff screens share.

import { ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { REVIEW_LABELS } from "../../_lib/constants";
import { pesan } from "../../_lib/format";
import { supabase } from "../../_lib/supabase";
import type { Enums } from "../../_lib/types";
import { Button, Empty, Field, Sheet, Textarea, toast } from "../ui";

// staff_overview(): one number per queue or activity.
export type Overview = Record<string, number>;

export type Status = Enums<"review_status">;
export type Person = { full_name: string; nickname: string | null; batch_lp?: number | null } | null;

export const personName = (p: Person) => (p ? p.nickname || p.full_name || "Tanpa nama" : "Akun terhapus");
export const personLabel = (p: Person) => personName(p) + (p?.batch_lp ? ` · LP ${p.batch_lp}` : "");

export type ModerateKind = "business" | "peluang" | "promo" | "event";
export type ModerateAction = "approve" | "reject" | "suspend" | "reinstate";

const DONE: Record<ModerateAction, string> = {
  approve: "Disetujui.",
  reject: "Ditolak.",
  suspend: "Ditangguhkan. Hilang dari semua halaman publik.",
  reinstate: "Dipulihkan dan tayang lagi.",
};

// Approve, reject, suspend or reinstate. The database records who did it in the audit log.
export async function moderate(kind: ModerateKind, id: string, action: ModerateAction, note?: string) {
  const { error } = await supabase.rpc("moderate", { p_kind: kind, p_id: id, p_action: action, p_note: note || undefined });
  toast(error ? pesan(error) : DONE[action], error ? "error" : "ok");
  return !error;
}

// Asks for the reason before a rejection or suspension. The owner sees this note.
export function NoteSheet({
  open,
  onClose,
  title,
  confirmLabel,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  confirmLabel: string;
  onConfirm: (note: string) => Promise<unknown>;
}) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  // One sheet serves a whole list: a reason typed for one person must not be waiting in the box for the next.
  useEffect(() => {
    if (!open) setNote("");
  }, [open]);
  return (
    <Sheet open={open} onClose={onClose} title={title}>
      <Field label="Alasan" hint="Ditampilkan ke pemiliknya, jadi tulis dengan jelas apa yang perlu diperbaiki.">
        <Textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} rows={3} autoFocus />
      </Field>
      <div className="mt-5 grid grid-cols-2 gap-3">
        <Button variant="secondary" onClick={onClose}>
          Batal
        </Button>
        <Button
          variant="danger"
          loading={busy}
          disabled={note.trim().length < 3}
          onClick={async () => {
            setBusy(true);
            await onConfirm(note.trim());
            setBusy(false);
            setNote("");
          }}
        >
          {confirmLabel}
        </Button>
      </div>
    </Sheet>
  );
}

export function SectionTitle({ title, children, action }: { title: string; children?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 className="h-card text-xl">{title}</h2>
        {children && <p className="mt-0.5 max-w-xl text-[13px] text-ink-soft">{children}</p>}
      </div>
      {action}
    </div>
  );
}

// Which review state to list. Most work happens in "Menunggu tinjauan".
export function StatusFilter({ value, onChange }: { value: Status; onChange: (status: Status) => void }) {
  return (
    <div className="mb-1 flex flex-wrap gap-x-4 text-[13px]">
      {(["pending", "approved", "suspended", "rejected"] as Status[]).map((status) => (
        <button
          key={status}
          type="button"
          aria-pressed={value === status}
          onClick={() => onChange(status)}
          className={"tap py-2.5 " + (value === status ? "font-semibold text-maroon underline underline-offset-4" : "text-ink-soft hover:text-maroon")}
        >
          {REVIEW_LABELS[status]}
        </button>
      ))}
    </div>
  );
}

// The reason given with a rejection or a suspension, on the item's card: the next staff member needs it before
// deciding again.
export function ReviewNote({ note }: { note: string | null }) {
  return note ? <p className="mt-2 rounded-xl bg-red-soft px-3 py-2 text-[13px] text-red">Catatan: {note}</p> : null;
}

// The decision buttons for one item, by its current state.
export function Decide({ kind, id, status, onDone }: { kind: ModerateKind; id: string; status: Status; onDone: () => void }) {
  const [asking, setAsking] = useState<"reject" | "suspend" | null>(null);
  const [busy, setBusy] = useState(false);
  const run = async (action: "approve" | "reinstate") => {
    setBusy(true);
    if (await moderate(kind, id, action)) onDone();
    setBusy(false);
  };
  return (
    <div className="flex flex-wrap gap-2">
      {(status === "pending" || status === "rejected") && (
        <Button size="sm" loading={busy} onClick={() => run("approve")}>
          Setujui
        </Button>
      )}
      {status === "pending" && (
        <Button size="sm" variant="secondary" onClick={() => setAsking("reject")}>
          Tolak
        </Button>
      )}
      {status === "approved" && (
        <Button size="sm" variant="danger" onClick={() => setAsking("suspend")}>
          Tangguhkan
        </Button>
      )}
      {status === "suspended" && (
        <Button size="sm" loading={busy} onClick={() => run("reinstate")}>
          Pulihkan
        </Button>
      )}
      <NoteSheet
        open={!!asking}
        onClose={() => setAsking(null)}
        title={asking === "suspend" ? "Tangguhkan" : "Tolak"}
        confirmLabel={asking === "suspend" ? "Tangguhkan" : "Tolak"}
        onConfirm={async (note) => {
          const ok = await moderate(kind, id, asking!, note);
          setAsking(null);
          if (ok) onDone();
        }}
      />
    </div>
  );
}

export function QueueEmpty({ status }: { status: Status }) {
  return (
    <Empty icon={<ShieldCheck className="h-6 w-6" />} title={status === "pending" ? "Antrean kosong" : "Tidak ada data"}>
      {status === "pending" ? "Tidak ada yang menunggu tinjauan." : "Belum ada yang berstatus ini."}
    </Empty>
  );
}
