"use client";

// Small pieces the staff screens share.

import { BookOpen, CalendarDays, LayoutGrid, LockKeyhole, type LucideIcon, Megaphone, ScrollText, ShieldCheck, Store, UserCheck, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { REVIEW_LABELS } from "../../_lib/constants";
import { pesan } from "../../_lib/format";
import { useQuery } from "../../_lib/hooks";
import { supabase } from "../../_lib/supabase";
import type { Enums } from "../../_lib/types";
import { Button, ConfirmSheet, Empty, Failed, Field, Sheet, Textarea, Toggle, toast } from "../ui";

// staff_overview(): one number per queue or activity.
export type Overview = Record<string, number>;

// The console's sections, with what is waiting in each. Phones show the first STAFF_BAR of them in the bottom bar
// and the rest under "Lainnya".
export const STAFF_SECTIONS: { key: string; label: string; icon: LucideIcon; queue?: (o: Overview) => number }[] = [
  { key: "ringkasan", label: "Ringkasan", icon: LayoutGrid },
  { key: "verifikasi", label: "Verifikasi", icon: UserCheck, queue: (o) => o.graduates_pending },
  { key: "moderasi", label: "Moderasi", icon: ShieldCheck, queue: (o) => o.businesses_pending + o.peluang_pending + o.promos_pending + o.reports_open },
  { key: "acara", label: "Acara", icon: CalendarDays, queue: (o) => o.events_pending },
  { key: "akun", label: "Akun", icon: Users },
  { key: "bisnis", label: "Bisnis", icon: Store },
  { key: "cerita", label: "Cerita", icon: BookOpen },
  { key: "banner", label: "Banner", icon: Megaphone },
  { key: "privasi", label: "Privasi", icon: LockKeyhole, queue: (o) => o.privacy_open },
  { key: "audit", label: "Log audit", icon: ScrollText },
];
export const STAFF_BAR = 4;

// The queue numbers, for the console page and for the phone bottom bar. staffChanged() makes both count again.
// ponytail: each reader calls staff_overview itself; share one store if a third reader appears.
export function useStaffOverview(on: boolean, key?: string) {
  const overview = useQuery<Overview>(
    on ? async () => supabase.rpc("staff_overview").then(({ data, error }) => ({ data: data as Overview | null, error })) : null,
    [on, key],
  );
  useEffect(() => {
    window.addEventListener("aw:staf", overview.reload);
    return () => window.removeEventListener("aw:staf", overview.reload);
  }, [overview.reload]);
  return overview;
}
export const staffChanged = () => window.dispatchEvent(new Event("aw:staf"));

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

// A demo switch: while it is on, the database approves by itself what would wait for staff, starting with whatever
// is in the queue. That cannot be taken back in one go, so "on" asks first and the switch waits for the answer.
export function AutoApprove({
  setting,
  title,
  children,
  warning,
  onChanged,
}: {
  setting: "auto_approve" | "auto_approve_business" | "auto_approve_peluang" | "auto_approve_promo";
  title: string;
  children: React.ReactNode;
  warning: React.ReactNode;
  onChanged: () => void;
}) {
  const settings = useQuery(() => supabase.from("settings").select("auto_approve, auto_approve_business, auto_approve_peluang, auto_approve_promo").single(), []);
  // The open "turn it on?" question. It is called with the answer, which the switch is waiting for.
  const [answer, setAnswer] = useState<((on: boolean) => void) | null>(null);

  const set = async (on: boolean) => {
    const { error } = await supabase.rpc(`set_${setting}`, { p_on: on });
    if (error) throw new Error(pesan(error));
    toast(on ? `${title} menyala. Semua yang menunggu sudah disetujui.` : `${title} dimatikan.`);
    settings.reload();
    onChanged();
  };

  return (
    <>
      <div className="mt-4 flex items-start justify-between gap-4 rounded-2xl border border-blush-line bg-blush p-4">
        <div>
          <p className="font-semibold text-maroon">{title}</p>
          <p className="mt-1 text-[13px] text-maroon/80">{children}</p>
        </div>
        <Toggle
          checked={!!settings.data?.[setting]}
          // false puts the switch back.
          onChange={(on) => (on ? new Promise<boolean>((resolve) => setAnswer(() => resolve)) : set(false).catch((e: Error) => (toast(e.message, "error"), false)))}
          label={title}
          disabled={settings.loading || !settings.data} // not read yet, or the read failed: its position is unknown
        />
      </div>
      {settings.error && (
        <div className="mt-3">
          <Failed query={settings} />
        </div>
      )}
      <ConfirmSheet
        open={!!answer}
        onClose={() => {
          answer?.(false);
          setAnswer(null);
        }}
        onConfirm={async () => {
          const asked = answer;
          await set(true); // a failure shows inside the sheet, and the switch keeps waiting
          asked?.(true);
          // Only this question is over. The sheet can be closed while the request runs and the switch tapped again:
          // that newer question keeps its own answer.
          setAnswer((now: typeof answer) => (now === asked ? null : now));
        }}
        title={`Nyalakan ${title}?`}
        confirmLabel="Nyalakan"
      >
        {warning}
      </ConfirmSheet>
    </>
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
