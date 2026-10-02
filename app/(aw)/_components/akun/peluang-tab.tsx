"use client";

// Dashboard: the member's own Peluang. Create, edit, switch on/off, delete. New ones wait for staff review.

import { Handshake, Pencil, Plus, Trash2, Users } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "../../_lib/auth";
import { AREAS, PELUANG_KINDS } from "../../_lib/constants";
import { localInput, reviewBadge, sisaHari } from "../../_lib/format";
import { useQuery } from "../../_lib/hooks";
import { supabase } from "../../_lib/supabase";
import type { Enums, Tables } from "../../_lib/types";
import { stagger } from "../cards";
import { Badge, Button, Card, ConfirmSheet, Empty, Failed, Field, IconButton, Input, Notice, Select, Sheet, Skeleton, Textarea, Toggle, toast } from "../ui";

type Row = Tables<"peluang">;
type Kind = Enums<"peluang_kind">;

export function PeluangTab() {
  const { user, isGraduate } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const uid = user!.id;

  const list = useQuery(() => supabase.from("peluang").select("*").eq("owner_id", uid).order("created_at", { ascending: false }), [uid]);
  // Who answered each peluang (answers arrive as Hubungkan requests).
  const answers = useQuery(() => supabase.from("connections").select("peluang_id").eq("to_id", uid).not("peluang_id", "is", null), [uid]);
  const [editing, setEditing] = useState<Row | "new" | null>(null);
  const [removing, setRemoving] = useState<Row | null>(null);

  // "Pasang peluang" buttons elsewhere link here with ?baru=1.
  useEffect(() => {
    if (params.get("baru") !== "1") return;
    if (isGraduate) setEditing("new");
    router.replace("/akun?tab=peluang", { scroll: false });
  }, [params, isGraduate, router]);

  const setActive = async (row: Row, active: boolean) => {
    const { error } = await supabase.from("peluang").update({ active }).eq("id", row.id);
    if (error) return toast("Belum tersimpan. Coba lagi ya.", "error"), false; // false: the switch goes back
    toast(active ? "Peluang dinyalakan." : "Peluang dimatikan. Isinya tetap tersimpan.");
    list.reload();
  };

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="h-card text-xl">Peluang saya</h2>
          <p className="text-[13px] text-ink-soft">Kebutuhan yang kamu pasang untuk dijawab lulusan lain.</p>
        </div>
        <Button onClick={() => setEditing("new")} disabled={!isGraduate}>
          <Plus className="h-4 w-4" /> Pasang peluang
        </Button>
      </div>

      <div className="mt-4 space-y-3">
        <Failed query={list} />
        {list.loading && !list.data ? (
          [0, 1].map((i) => <Skeleton key={i} className="h-28" />)
        ) : !list.data?.length ? (
          <Empty icon={<Handshake className="h-6 w-6" />} title="Belum ada peluang">
            {isGraduate
              ? "Butuh supplier, mitra, vendor, konsultan, freelancer, atau karyawan? Pasang di sini, boleh walau belum punya bisnis."
              : "Setelah datamu diverifikasi staf, kamu bisa memasang kebutuhanmu di sini."}
          </Empty>
        ) : (
          list.data.map((row, i) => {
            const count = answers.data?.filter((a) => a.peluang_id === row.id).length ?? 0;
            const badge = reviewBadge(row.status, row.active, row.deadline);
            return (
              <Card key={row.id} className="rise p-4" style={stagger(i)}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone="gold">{PELUANG_KINDS[row.kind]}</Badge>
                      <Badge tone={badge.tone}>{badge.label}</Badge>
                      {row.deadline && <Badge tone="gray">{sisaHari(row.deadline)}</Badge>}
                    </div>
                    <h3 className="mt-2 font-semibold">{row.title}</h3>
                    <p className="mt-1 line-clamp-2 text-[13px] text-ink-soft">{row.description}</p>
                  </div>
                  <Toggle checked={row.active} onChange={(on) => setActive(row, on)} label={row.active ? "Matikan peluang" : "Nyalakan peluang"} />
                </div>
                {row.review_note && (row.status === "rejected" || row.status === "suspended") && (
                  <p className="mt-3 rounded-xl bg-red-soft px-3 py-2 text-[13px] text-red">Catatan staf: {row.review_note}</p>
                )}
                <div className="mt-3 flex items-center justify-between gap-3 border-t border-line pt-3">
                  <Button variant="ghost" size="sm" href="/akun?tab=koneksi" className="-ml-3.5">
                    <Users className="h-4 w-4" /> {count} lulusan berminat
                  </Button>
                  <div className="flex gap-2">
                    <IconButton label="Ubah peluang" onClick={() => setEditing(row)}>
                      <Pencil className="h-4 w-4" />
                    </IconButton>
                    <IconButton label="Hapus peluang" onClick={() => setRemoving(row)}>
                      <Trash2 className="h-4 w-4 text-red" />
                    </IconButton>
                  </div>
                </div>
              </Card>
            );
          })
        )}
      </div>

      <Sheet open={!!editing} onClose={() => setEditing(null)} title={editing === "new" ? "Pasang peluang" : "Ubah peluang"}>
        {editing && (
          <PeluangForm
            row={editing === "new" ? null : editing}
            onDone={() => {
              setEditing(null);
              list.reload();
            }}
          />
        )}
      </Sheet>

      <ConfirmSheet
        open={!!removing}
        onClose={() => setRemoving(null)}
        title="Hapus peluang ini?"
        confirmLabel="Hapus"
        onConfirm={async () => {
          const { error } = await supabase.from("peluang").delete().eq("id", removing!.id);
          if (error) throw new Error("Belum terhapus. Coba lagi ya.");
          setRemoving(null);
          toast("Peluang dihapus.");
          list.reload();
        }}
      >
        “{removing?.title}” dan semua jawaban yang masuk akan dihapus permanen.
      </ConfirmSheet>
    </section>
  );
}

function PeluangForm({ row, onDone }: { row: Row | null; onDone: () => void }) {
  const { user, isGraduate } = useAuth();
  // Only businesses that are public now: a peluang on a hidden business would be approved and still never show.
  const mine = useQuery(() => supabase.from("businesses").select("id, name").eq("owner_id", user!.id).eq("visible", true), [user!.id]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const text = (name: string) => String(form.get(name) ?? "").trim();
    const values = {
      kind: text("kind") as Kind,
      title: text("title"),
      description: text("description"),
      area: text("area") || null,
      deadline: text("deadline") || null,
    };
    setBusy(true);
    setError(null);
    const { error } = row
      ? await supabase.from("peluang").update(values).eq("id", row.id)
      : await supabase.from("peluang").insert({ ...values, owner_id: user!.id, business_id: text("business_id") || null });
    setBusy(false);
    if (error) return setError("Peluang belum tersimpan. Periksa isiannya lalu coba lagi ya.");
    toast(
      !row
        ? "Peluang terkirim. Tayang setelah ditinjau staf."
        : row.status === "rejected" && isGraduate
          ? "Perubahan tersimpan dan dikirim lagi untuk ditinjau."
          : row.status === "approved"
            ? "Perubahan tersimpan dan langsung tayang."
            : "Perubahan tersimpan.",
    );
    onDone();
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="Kamu mencari apa?">
        <Select name="kind" defaultValue={row?.kind ?? "supplier"} required>
          {(Object.keys(PELUANG_KINDS) as Kind[]).map((k) => (
            <option key={k} value={k}>
              {PELUANG_KINDS[k]}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Judul">
        <Input name="title" defaultValue={row?.title} required maxLength={120} placeholder="Cari supplier biji kopi untuk 3 gerai" />
      </Field>
      <Field label="Ceritakan kebutuhannya" hint="Apa yang dicari, untuk kapan, dan syarat pentingnya.">
        <Textarea name="description" defaultValue={row?.description} required maxLength={800} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Wilayah" optional>
          <Select name="area" defaultValue={row?.area ?? ""}>
            <option value="">Di mana saja</option>
            {AREAS.map((a) => (
              <option key={a}>{a}</option>
            ))}
          </Select>
        </Field>
        <Field label="Batas waktu" optional>
          <Input name="deadline" type="date" defaultValue={row?.deadline ?? ""} min={localInput(new Date()).slice(0, 10)} />
        </Field>
      </div>
      {!row && (
        <Field label="Atas nama bisnis" hint="Pilihannya bisnis yang sedang tayang. Tidak bisa diubah setelah dipasang.">
          <Select name="business_id" defaultValue="">
            <option value="">Tanpa bisnis (atas nama pribadi)</option>
            {mine.data?.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name || "Bisnis tanpa nama"}
              </option>
            ))}
          </Select>
        </Field>
      )}
      {error && <Notice>{error}</Notice>}
      <Button type="submit" size="lg" full loading={busy}>
        {row ? "Simpan perubahan" : "Kirim untuk ditinjau"}
      </Button>
    </form>
  );
}
