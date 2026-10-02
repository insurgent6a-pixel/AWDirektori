"use client";

// Dashboard: profile, saved items, the member's RSVPs and event proposals, privacy requests and sign-out.

import { Bookmark, Download, LogOut, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "../../_lib/auth";
import { VERIFICATION_LABELS } from "../../_lib/constants";
import { hari, jam, pesan, programLabels, reviewBadge } from "../../_lib/format";
import { useQuery } from "../../_lib/hooks";
import { eventFeed, myRsvps, peluangFeed, searchBusinesses } from "../../_lib/queries";
import { supabase } from "../../_lib/supabase";
import type { Enums } from "../../_lib/types";
import { SaveButton } from "../actions";
import { BusinessRow } from "../cards";
import { Avatar, Badge, Button, Card, ConfirmSheet, Failed, Field, Input, Notice, Sheet, toast } from "../ui";

export function AkunTab() {
  const { user, profile, signOut, isSaved } = useAuth();
  const uid = user!.id;
  const [editing, setEditing] = useState(false);
  const [asking, setAsking] = useState<Enums<"privacy_kind"> | null>(null);

  const saves = useQuery(() => supabase.from("saves").select("business_id, peluang_id").eq("user_id", uid), [uid]);
  const businessIds = (saves.data ?? []).flatMap((s) => (s.business_id ? [s.business_id] : []));
  const peluangIds = new Set((saves.data ?? []).flatMap((s) => (s.peluang_id ? [s.peluang_id] : [])));
  const savedBusinesses = useQuery(businessIds.length ? () => searchBusinesses({ ids: businessIds }) : null, [businessIds.join()]);
  const peluang = useQuery(peluangIds.size ? peluangFeed : null, [peluangIds.size]);
  // isSaved keeps the lists honest right after something is un-saved here. Emptiness is judged from what is shown:
  // a saved business that was switched off, or a saved peluang past its deadline, is no longer in these lists.
  const shownBusinesses = (savedBusinesses.data ?? []).filter((b) => isSaved("business", b.id));
  const shownPeluang = (peluang.data ?? []).filter((p) => peluangIds.has(p.id) && isSaved("peluang", p.id));
  const savedLoading = saves.loading || savedBusinesses.loading || peluang.loading;
  const nothingSaved = !savedLoading && !saves.error && shownBusinesses.length + shownPeluang.length === 0;

  const rsvps = useQuery(() => myRsvps(uid), [uid]);
  const events = useQuery(() => eventFeed(), []);
  const myEvents = (events.data ?? []).filter((e) => rsvps.data?.has(e.id));
  // Events this member offered to host: where each one stands and, when staff said no, why.
  const proposals = useQuery(
    () => supabase.from("events").select("id, title, starts_at, city, status, review_note").eq("host_id", uid).order("starts_at", { ascending: false }),
    [uid],
  );

  const requests = useQuery(
    () => supabase.from("privacy_requests").select("id, kind, created_at, handled_at").eq("user_id", uid).order("created_at", { ascending: false }),
    [uid],
  );
  const open = (kind: Enums<"privacy_kind">) => requests.data?.some((r) => r.kind === kind && !r.handled_at);

  const ask = async () => {
    const { error } = await supabase.from("privacy_requests").insert({ user_id: uid, kind: asking! });
    if (error) throw new Error("Permintaan belum terkirim. Coba lagi ya.");
    setAsking(null);
    toast("Permintaan terkirim. Staf AsiaWorks akan memprosesnya.");
    requests.reload();
  };

  if (!profile) return null;

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
      <div className="space-y-5">
        <Card className="rise p-5">
          <div className="flex items-center gap-4">
            <Avatar name={profile.nickname || profile.full_name} className="h-14 w-14" />
            <div className="min-w-0">
              <p className="truncate font-semibold">{profile.full_name}</p>
              <p className="truncate text-[13px] text-ink-soft">{user!.email}</p>
            </div>
          </div>
          <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <Info label="Nama panggilan">{profile.nickname ?? "Belum diisi"}</Info>
            <Info label="Status">{VERIFICATION_LABELS[profile.verification]}</Info>
            <div className="col-span-2">
              <Info label="Program AsiaWorks">{programLabels(profile).join(", ") || "Belum dipilih"}</Info>
            </div>
          </dl>
          <div className="mt-5 grid grid-cols-2 gap-2">
            <Button variant="secondary" onClick={() => setEditing(true)}>
              <Pencil className="h-4 w-4" /> Ubah profil
            </Button>
            <Button
              variant="secondary"
              onClick={async () => {
                await signOut();
                // A full navigation: the dashboard's own "not signed in" guard would otherwise send them to the login page.
                window.location.assign("/");
              }}
            >
              <LogOut className="h-4 w-4" /> Keluar
            </Button>
          </div>
        </Card>

        <Card className="rise p-5" style={{ "--i": 1 } as React.CSSProperties}>
          <h2 className="h-card">Privasi data</h2>
          <p className="body-copy mt-1 text-[13px]">Data kamu, hak kamu. Permintaan di bawah ini diproses staf AsiaWorks.</p>
          {/* Without the list of earlier requests the buttons cannot know what is already being processed. */}
          {requests.error ? (
            <div className="mt-4">
              <Failed query={requests} />
            </div>
          ) : (
            <div className="mt-4 space-y-2">
              <Button variant="secondary" full disabled={requests.loading || open("export")} onClick={() => setAsking("export")}>
                <Download className="h-4 w-4" /> {open("export") ? "Salinan data sedang disiapkan" : "Minta salinan data saya"}
              </Button>
              <Button variant="danger" full disabled={requests.loading || open("delete")} onClick={() => setAsking("delete")}>
                <Trash2 className="h-4 w-4" /> {open("delete") ? "Penghapusan akun sedang diproses" : "Minta hapus akun"}
              </Button>
              {open("delete") && <p className="text-[12px] text-ink-soft">Berubah pikiran? Kabari staf AsiaWorks sebelum akunnya dihapus, permintaannya bisa ditutup.</p>}
            </div>
          )}
        </Card>
      </div>

      <div className="space-y-5">
        <Card className="rise p-5" style={{ "--i": 2 } as React.CSSProperties}>
          <h2 className="h-card">Tersimpan</h2>
          {saves.error && (
            <div className="mt-3">
              <Failed query={saves} />
            </div>
          )}
          {nothingSaved ? (
            <p className="body-copy mt-2 flex items-start gap-2.5 text-[13px]">
              <Bookmark className="mt-0.5 h-4 w-4 shrink-0 text-maroon" />
              Belum ada yang disimpan. Ketuk ikon penanda di kartu bisnis atau peluang untuk menyimpannya di sini.
            </p>
          ) : (
            <div className="mt-3 space-y-2">
              {shownBusinesses.map((b) => (
                <BusinessRow key={b.id} business={b} />
              ))}
              {shownPeluang.map((p) => (
                <div key={p.id} className="flex items-center gap-3 rounded-xl border border-line p-3">
                  <Link href="/peluang" className="tap-soft min-w-0 flex-1 hover:text-maroon">
                    <p className="truncate text-sm font-semibold">{p.title}</p>
                    <p className="truncate text-[12px] text-ink-soft">Peluang dari {p.owner_name}</p>
                  </Link>
                  <SaveButton kind="peluang" id={p.id} />
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="rise p-5" style={{ "--i": 3 } as React.CSSProperties}>
          <h2 className="h-card">Acara saya</h2>
          {myEvents.length === 0 ? (
            <p className="body-copy mt-2 text-[13px]">
              Belum ada RSVP.{" "}
              <Link href="/acara" className="tap -my-2.5 inline-block py-2.5 font-semibold text-maroon hover:underline">
                Lihat agenda acara
              </Link>
            </p>
          ) : (
            <ul className="mt-3 divide-y divide-line">
              {myEvents.map((e) => (
                <li key={e.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{e.title}</p>
                    <p className="truncate text-[12px] text-ink-soft">
                      {hari(e.starts_at)}, {jam(e.starts_at)} · {e.city}
                    </p>
                  </div>
                  <Badge tone={rsvps.data?.get(e.id) === "going" ? "green" : "amber"}>
                    {rsvps.data?.get(e.id) === "going" ? "Terdaftar" : "Daftar tunggu"}
                  </Badge>
                </li>
              ))}
            </ul>
          )}

          {!!proposals.data?.length && (
            <>
              <p className="mt-5 text-[11px] font-medium tracking-wide text-ink-soft uppercase">Acara yang kamu usulkan</p>
              <ul className="mt-2 divide-y divide-line">
                {proposals.data.map((e) => {
                  const badge = reviewBadge(e.status);
                  return (
                    <li key={e.id} className="py-3 first:pt-0 last:pb-0">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold">{e.title}</p>
                          <p className="truncate text-[12px] text-ink-soft">
                            {hari(e.starts_at)} · {e.city}
                          </p>
                        </div>
                        <Badge tone={badge.tone}>{badge.label}</Badge>
                      </div>
                      {e.review_note && (e.status === "rejected" || e.status === "suspended") && (
                        <p className="mt-2 rounded-xl bg-red-soft px-3 py-2 text-[13px] text-red">Catatan staf: {e.review_note}</p>
                      )}
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </Card>
      </div>

      <Sheet open={editing} onClose={() => setEditing(false)} title="Ubah profil">
        <ProfileForm onDone={() => setEditing(false)} />
      </Sheet>

      <ConfirmSheet
        open={!!asking}
        onClose={() => setAsking(null)}
        onConfirm={ask}
        title={asking === "delete" ? "Minta hapus akun?" : "Minta salinan data?"}
        confirmLabel="Kirim permintaan"
      >
        {asking === "delete"
          ? "Staf akan menghapus akun kamu beserta semua bisnis, peluang, koneksi, dan file yang kamu unggah. Ini permanen dan tidak bisa dibatalkan."
          : "Staf akan menyiapkan salinan semua data yang tersimpan tentang kamu dan mengirimkannya ke email kamu."}
      </ConfirmSheet>
    </div>
  );
}

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[11px] font-medium tracking-wide text-ink-soft uppercase">{label}</dt>
      <dd className="mt-0.5 font-medium">{children}</dd>
    </div>
  );
}

// Name, nickname and phone can change any time. Programs and batch numbers are locked once sent for verification.
function ProfileForm({ onDone }: { onDone: () => void }) {
  const { profile, refresh } = useAuth();
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase.rpc("my_phone").then(({ data }) => data && setPhone(data));
  }, []);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setBusy(true);
    setError(null);
    const { error } = await supabase.rpc("save_profile", {
      p_full_name: String(form.get("full_name")),
      p_nickname: String(form.get("nickname")),
      p_phone: phone,
      p_programs: profile?.programs,
      p_lp: profile?.batch_lp ?? undefined,
      p_ib: profile?.batch_ib ?? undefined,
      p_ia: profile?.batch_ia ?? undefined,
    });
    setBusy(false);
    if (error) return setError(pesan(error));
    await refresh();
    toast("Profil tersimpan.");
    onDone();
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="Nama lengkap">
        <Input name="full_name" defaultValue={profile?.full_name} required />
      </Field>
      <Field label="Nama panggilan">
        <Input name="nickname" defaultValue={profile?.nickname ?? ""} required />
      </Field>
      <Field label="No HP (WhatsApp) pribadi">
        <Input value={phone} onChange={(e) => setPhone(e.target.value)} type="tel" inputMode="tel" placeholder="0812 3456 7890" />
      </Field>
      <p className="text-[13px] text-ink-soft">Angkatan tidak bisa diubah setelah dikirim untuk verifikasi. Hubungi staf AsiaWorks kalau ada yang keliru.</p>
      {error && <Notice>{error}</Notice>}
      <Button type="submit" size="lg" full loading={busy}>
        Simpan
      </Button>
    </form>
  );
}
