"use client";

// Verify graduates: approve or reject sign-ups. Graduate status only ever comes from this screen
// (or from the demo switch at the top, which approves everything).

import { Check, UserCheck, X } from "lucide-react";
import { useState } from "react";
import { VERIFICATION_LABELS } from "../../_lib/constants";
import { pesan, programLabels, tanggal, waLink } from "../../_lib/format";
import { useQuery } from "../../_lib/hooks";
import { supabase } from "../../_lib/supabase";
import type { Enums } from "../../_lib/types";
import { Avatar, Badge, Button, Card, Chip, ConfirmSheet, Empty, Failed, SearchInput, Skeleton, Toggle, toast } from "../ui";
import { NoteSheet, SectionTitle } from "./shared";

type Status = Enums<"verification_status">;
type Member = {
  id: string;
  role: Enums<"user_role">;
  full_name: string;
  nickname: string | null;
  programs: string[];
  batch_lp: number | null;
  batch_ib: number | null;
  batch_ia: number | null;
  verification: Status;
  verification_note: string | null;
  created_at: string;
  email: string | null;
  phone: string | null;
};

const TONES = { draft: "gray", pending: "amber", approved: "green", rejected: "red" } as const;
const FILTERS: Status[] = ["pending", "approved", "rejected", "draft"];

export function Verifikasi({ onChanged }: { onChanged: () => void }) {
  const users = useQuery(() => supabase.rpc("staff_users").overrideTypes<Member[], { merge: false }>(), []);
  const settings = useQuery<{ auto_approve: boolean }>(() => supabase.from("settings").select("auto_approve").single(), []);
  const [status, setStatus] = useState<Status>("pending");
  const [q, setQ] = useState("");
  const [rejecting, setRejecting] = useState<Member | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  // The open "turn Auto Approve on?" question. It is called with the answer, which the switch is waiting for.
  const [answer, setAnswer] = useState<((on: boolean) => void) | null>(null);

  const members = (users.data ?? []).filter((u) => u.role === "member");
  const waiting = members.filter((u) => u.verification === "pending").length;
  const needle = q.trim().toLowerCase();
  const list = members.filter(
    (u) => u.verification === status && (!needle || [u.full_name, u.nickname, u.email, ...programLabels(u)].some((t) => t?.toLowerCase().includes(needle))),
  );

  const decide = async (member: Member, approve: boolean, note?: string) => {
    setBusy(member.id);
    const { error } = await supabase.rpc("verify_graduate", { p_user: member.id, p_approve: approve, p_note: note });
    setBusy(null);
    if (error) return toast(pesan(error), "error");
    toast(approve ? `${member.nickname || member.full_name} sekarang lulusan terverifikasi.` : "Ditolak. Alasannya terlihat oleh yang bersangkutan.");
    users.reload();
    onChanged();
  };

  const setAuto = async (on: boolean) => {
    const { error } = await supabase.rpc("set_auto_approve", { p_on: on });
    if (error) throw new Error(pesan(error));
    toast(on ? "Auto Approve menyala. Semua yang menunggu sudah disetujui." : "Auto Approve dimatikan.");
    settings.reload();
    users.reload();
    onChanged();
  };

  return (
    <section>
      <SectionTitle title="Verifikasi lulusan">Cocokkan nama dan angkatan dengan data pelatihan, lalu setujui atau tolak.</SectionTitle>

      <div className="mt-4 flex items-start justify-between gap-4 rounded-2xl border border-blush-line bg-blush p-4">
        <div>
          <p className="font-semibold text-maroon">Auto Approve Graduates Request</p>
          <p className="mt-1 text-[13px] text-maroon/80">
            Untuk demo. Selama menyala, setiap permintaan verifikasi lulusan langsung disetujui, termasuk yang sedang menunggu saat ini.
          </p>
        </div>
        <Toggle
          checked={!!settings.data?.auto_approve}
          // On approves the whole waiting list, which cannot be taken back in one go: it asks first, and the switch waits
          // for the answer. false puts the switch back.
          onChange={(on) =>
            on ? new Promise<boolean>((resolve) => setAnswer(() => resolve)) : setAuto(false).catch((e: Error) => (toast(e.message, "error"), false))
          }
          label="Auto Approve Graduates Request"
          disabled={settings.loading || !settings.data} // not read yet, or the read failed: its position is unknown
        />
      </div>
      {settings.error && (
        <div className="mt-3">
          <Failed query={settings} />
        </div>
      )}

      <div className="no-scrollbar -mx-4 mt-2.5 -mb-1.5 flex gap-2 overflow-x-auto px-4 py-1.5 sm:mx-0 sm:px-0">
        {FILTERS.map((s) => (
          <Chip key={s} active={status === s} onClick={() => setStatus(s)}>
            {VERIFICATION_LABELS[s]} <span className="opacity-75">{members.filter((u) => u.verification === s).length}</span>
          </Chip>
        ))}
      </div>
      <SearchInput className="mt-3" value={q} onChange={setQ} placeholder="Cari nama, email, atau LP" />

      <div className="mt-4 space-y-3">
        <Failed query={users} />
        {users.loading && !users.data ? (
          [0, 1].map((i) => <Skeleton key={i} className="h-32" />)
        ) : list.length === 0 ? (
          <Empty icon={<UserCheck className="h-6 w-6" />} title={status === "pending" ? "Antrean kosong" : "Tidak ada data"}>
            {status === "pending" ? "Semua permintaan verifikasi sudah ditangani." : "Belum ada anggota dengan status ini."}
          </Empty>
        ) : (
          list.map((u) => (
            <Card key={u.id} className="p-4">
              <div className="flex items-start gap-3">
                <Avatar name={u.nickname || u.full_name} />
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 font-semibold">
                    {u.full_name || "Tanpa nama"}
                    {u.nickname && <span className="font-normal text-ink-soft">({u.nickname})</span>}
                    <Badge tone={TONES[u.verification]}>{VERIFICATION_LABELS[u.verification]}</Badge>
                  </p>
                  <p className="mt-1 flex flex-wrap gap-x-2 gap-y-1">
                    {/* what the person chose on the form: LP always comes with its number, IB and IA may come without */}
                    {u.programs.length === 0 && <Badge tone="gray">Program belum dipilih</Badge>}
                    {programLabels(u).map((label) => (
                      <Badge key={label} tone={label.startsWith("LP") ? "maroon" : "gray"}>
                        {/\d/.test(label) ? label : `${label} tanpa nomor`}
                      </Badge>
                    ))}
                  </p>
                  <p className="mt-1 flex flex-wrap items-center gap-x-4 text-[13px] text-ink-soft">
                    {u.email && <a href={`mailto:${u.email}`} className="tap-soft inline-flex min-h-10 items-center hover:text-maroon">{u.email}</a>}
                    {u.phone && (
                      <a href={waLink(u.phone)} target="_blank" rel="noopener noreferrer" className="tap-soft inline-flex min-h-10 items-center hover:text-maroon">
                        WhatsApp {u.phone}
                      </a>
                    )}
                    <span>Mendaftar {tanggal(u.created_at)}</span>
                  </p>
                  {u.verification_note && <p className="mt-2 rounded-xl bg-red-soft px-3 py-2 text-[13px] text-red">Catatan: {u.verification_note}</p>}
                </div>
              </div>
              {u.verification !== "draft" && (
                <div className="mt-3 flex flex-wrap gap-2 border-t border-line pt-3">
                  {u.verification !== "approved" && (
                    <Button size="sm" loading={busy === u.id} onClick={() => decide(u, true)}>
                      <Check className="h-4 w-4" /> Setujui
                    </Button>
                  )}
                  {u.verification !== "rejected" && (
                    <Button size="sm" variant="secondary" onClick={() => setRejecting(u)}>
                      <X className="h-4 w-4" /> {u.verification === "approved" ? "Cabut verifikasi" : "Tolak"}
                    </Button>
                  )}
                </div>
              )}
            </Card>
          ))
        )}
      </div>

      <NoteSheet
        open={!!rejecting}
        onClose={() => setRejecting(null)}
        title={rejecting?.verification === "approved" ? "Cabut verifikasi" : "Tolak verifikasi"}
        confirmLabel={rejecting?.verification === "approved" ? "Cabut" : "Tolak"}
        onConfirm={async (note) => {
          // Withdrawing an approved graduate also suspends their live listings, peluang and hosted events (done by the database).
          await decide(rejecting!, false, note);
          setRejecting(null);
        }}
      />

      <ConfirmSheet
        open={!!answer}
        onClose={() => {
          answer?.(false);
          setAnswer(null);
        }}
        onConfirm={async () => {
          const asked = answer;
          await setAuto(true); // a failure shows inside the sheet, and the switch keeps waiting
          asked?.(true);
          // Only this question is over. The sheet can be closed while the request runs and the switch tapped again:
          // that newer question keeps its own answer.
          setAnswer((now: typeof answer) => (now === asked ? null : now));
        }}
        title="Nyalakan Auto Approve?"
        confirmLabel="Nyalakan"
      >
        {waiting > 0 && `${waiting} orang yang sedang menunggu langsung disetujui. `}
        Selama menyala, setiap pendaftar baru juga langsung jadi lulusan terverifikasi, tanpa dicek nama dan angkatannya. Yang sudah disetujui hanya bisa
        dicabut satu per satu.
      </ConfirmSheet>
    </section>
  );
}
