"use client";

// Extras of one listing: the GLP Perk (promo + code) and consent for collaboration stories.

import { Tag } from "lucide-react";
import { useState } from "react";
import { pesan, reviewBadge } from "../../_lib/format";
import { useQuery } from "../../_lib/hooks";
import { supabase } from "../../_lib/supabase";
import type { Enums, Tables } from "../../_lib/types";
import { Badge, Button, Card, ConfirmSheet, Failed, Field, Input, Media, Notice, Toggle, toast } from "../ui";

// The reason staff gave when they rejected or suspended something. The owner needs it to know what to fix.
function StaffNote({ status, note }: { status: Enums<"review_status">; note: string | null }) {
  if (!note || (status !== "rejected" && status !== "suspended")) return null;
  return <p className="mt-3 rounded-xl bg-red-soft px-3 py-2 text-[13px] text-red">Catatan staf: {note}</p>;
}

// ── GLP Perk ────────────────────────────────────────────────────────

// One deal per listing for fellow graduates. The title shows on the card; the code only opens for verified graduates.
export function PromoSection({ businessId }: { businessId: string }) {
  const promo = useQuery<Tables<"promos">>(() => supabase.from("promos").select("*").eq("business_id", businessId).maybeSingle(), [businessId]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [removing, setRemoving] = useState(false);
  const row = promo.data;
  const badge = row && reviewBadge(row.status, row.active, row.valid_until);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const values = {
      title: String(form.get("title")).trim(),
      code: String(form.get("code")).trim().toUpperCase(),
      valid_until: String(form.get("valid_until")) || null,
    };
    setBusy(true);
    setError(null);
    const { error } = row
      ? await supabase.from("promos").update(values).eq("id", row.id)
      : await supabase.from("promos").insert({ ...values, business_id: businessId });
    setBusy(false);
    if (error) return setError("Promo belum tersimpan. Coba lagi ya.");
    toast(!row ? "Promo terkirim. Tampil di kartu bisnis setelah ditinjau staf." : row.status === "rejected" ? "Promo diperbarui dan dikirim lagi untuk ditinjau." : "Promo diperbarui.");
    promo.reload();
  };
  const setActive = async (active: boolean) => {
    const { error } = await supabase.from("promos").update({ active }).eq("id", row!.id);
    if (error) return toast("Belum tersimpan. Coba lagi ya.", "error"), false; // false: the switch goes back
    toast(active ? "GLP Perk ditampilkan di kartu bisnis." : "GLP Perk disembunyikan.");
    promo.reload();
  };
  const remove = async () => {
    const { error } = await supabase.from("promos").delete().eq("id", row!.id);
    if (error) throw new Error("Belum terhapus. Coba lagi ya.");
    setRemoving(false);
    toast("Promo dihapus.");
    promo.reload();
  };

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between gap-3">
        <h3 className="h-card flex items-center gap-2">
          <Tag className="h-4 w-4 text-gold" /> GLP Perk
        </h3>
        {badge && <Badge tone={badge.tone}>{badge.label}</Badge>}
      </div>
      <p className="body-copy mt-1 text-[13px]">Promo untuk sesama lulusan. Judulnya tampil di kartu bisnis, kodenya hanya bisa dibuka lulusan terverifikasi.</p>

      {/* A failed read must not look like "no promo yet": saving then would try to add a second one. */}
      {promo.error ? (
        <div className="mt-4">
          <Failed query={promo} />
        </div>
      ) : (
        <>
          {row && <StaffNote status={row.status} note={row.review_note} />}
          {row && (
            <label className="mt-4 flex items-center justify-between gap-4 rounded-xl bg-page p-3.5 text-sm font-semibold">
              Tampilkan di kartu bisnis
              <Toggle checked={row.active} onChange={setActive} label="Tampilkan GLP Perk" />
            </label>
          )}

          {/* key remounts the form with the saved values once they load */}
          <form key={row?.id ?? "new"} onSubmit={submit} className="mt-4 space-y-4">
            <Field label="Penawaran">
              <Input name="title" defaultValue={row?.title} required maxLength={80} placeholder="Diskon 15% untuk sesama lulusan" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Kode promo">
                <Input name="code" defaultValue={row?.code} required maxLength={24} autoCapitalize="characters" placeholder="LULUSAN15" />
              </Field>
              <Field label="Berlaku sampai" optional>
                <Input name="valid_until" type="date" defaultValue={row?.valid_until ?? ""} />
              </Field>
            </div>
            {error && <Notice>{error}</Notice>}
            <div className="flex gap-2">
              <Button type="submit" variant="secondary" loading={busy || promo.loading}>
                {row ? "Simpan promo" : "Ajukan promo"}
              </Button>
              {row && (
                <Button variant="ghost" onClick={() => setRemoving(true)}>
                  Hapus
                </Button>
              )}
            </div>
          </form>
        </>
      )}

      <ConfirmSheet open={removing} onClose={() => setRemoving(false)} onConfirm={remove} title="Hapus promo ini?" confirmLabel="Hapus">
        “{row?.title}” dan kode promonya akan dihapus dari kartu bisnismu.
      </ConfirmSheet>
    </Card>
  );
}

// ── Cerita ──────────────────────────────────────────────────────────

// Staff write the story. It is public only while both owners agree, and either can withdraw.
export function StoriesSection({ businessId }: { businessId: string }) {
  const stories = useQuery(
    () =>
      supabase
        .from("stories")
        .select("id, title, body, image_path, business_a, agree_a, agree_b, version")
        .or(`business_a.eq.${businessId},business_b.eq.${businessId}`)
        .order("created_at", { ascending: false }),
    [businessId],
  );
  // What is really public right now: both agreed and both businesses are visible.
  const feed = useQuery(() => supabase.from("story_feed").select("id"), [businessId]);
  if (stories.error) return <Failed query={stories} />;
  if (!stories.data?.length) return null;
  const live = new Set(feed.data?.map((row) => row.id));

  // Agreeing names the version of the text shown here, so nobody agrees to wording they have not read.
  const consent = async (id: string, agree: boolean, version: string | null) => {
    const { error } = await supabase.rpc("story_consent", { p_story: id, p_agree: agree, p_version: version ?? undefined });
    stories.reload();
    feed.reload();
    if (error) return toast(pesan(error), "error");
    toast(agree ? "Terima kasih. Cerita tayang begitu kedua pemilik setuju." : "Persetujuan ditarik. Cerita tidak lagi tayang.");
  };

  return (
    <Card className="p-5">
      <h3 className="h-card">Cerita kolaborasi</h3>
      <p className="body-copy mt-1 text-[13px]">Ditulis staf AsiaWorks tentang kolaborasi bisnismu. Hanya tayang kalau kamu dan pemilik bisnis satunya sama-sama setuju.</p>
      <ul className="mt-3 space-y-3">
        {stories.data.map((s) => {
          const mine = s.business_a === businessId ? s.agree_a : s.agree_b;
          const agreed = s.agree_a && s.agree_b;
          return (
            <li key={s.id} className="rounded-xl border border-line p-4">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-semibold">{s.title}</p>
                <Badge tone={agreed && live.has(s.id) ? "green" : "amber"}>
                  {agreed ? (live.has(s.id) ? "Tayang" : "Belum tayang") : mine ? "Menunggu pemilik satunya" : "Menunggu persetujuanmu"}
                </Badge>
              </div>
              {agreed && !feed.loading && !live.has(s.id) && (
                <p className="mt-1 text-[12px] text-ink-soft">Kalian berdua sudah setuju. Cerita tayang begitu kedua bisnis sama-sama tayang.</p>
              )}
              {/* The photo is part of what the owner agrees to. */}
              {s.image_path && <Media path={s.image_path} name={s.title} className="mt-3 aspect-[16/10] rounded-xl" />}
              <p className="body-copy mt-2 text-[13px] whitespace-pre-line">{s.body}</p>
              <Button size="sm" variant={mine ? "secondary" : "primary"} className="mt-3" onClick={() => consent(s.id, !mine, s.version)}>
                {mine ? "Tarik persetujuan" : "Setuju ditayangkan"}
              </Button>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
