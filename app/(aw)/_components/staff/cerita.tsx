"use client";

// Staff write collaboration stories between two businesses. A story is public only while both owners agree.

import { BookOpen, Check, Hourglass, ImagePlus, Pencil, Plus, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { useAuth } from "../../_lib/auth";
import { useQuery } from "../../_lib/hooks";
import { removeImages, uploadImage } from "../../_lib/storage";
import { supabase } from "../../_lib/supabase";
import type { Tables } from "../../_lib/types";
import { Badge, Button, Card, ConfirmSheet, Empty, Failed, Field, IconButton, Input, Notice, Select, Sheet, Skeleton, Textarea, toast } from "../ui";
import { type Person, SectionTitle } from "./shared";

type Named = { id: string; name: string | null } | null;
type StoryRow = Tables<"stories"> & { a: Named; b: Named };
type Option = { id: string; name: string | null; owner: Person };

const nameOf = (b: Named) => b?.name?.trim() || "Bisnis tanpa nama";

export function CeritaStaf() {
  const list = useQuery(
    () =>
      supabase
        .from("stories")
        .select("*, a:businesses!stories_business_a_fkey(id, name), b:businesses!stories_business_b_fkey(id, name)")
        .order("created_at", { ascending: false })
        .overrideTypes<StoryRow[], { merge: false }>(),
    [],
  );
  // What is really public right now: both owners agreed and both businesses are visible.
  const feed = useQuery(() => supabase.from("story_feed").select("id"), []);
  const live = new Set(feed.data?.map((row) => row.id));
  const reload = () => {
    list.reload();
    feed.reload();
  };
  const [editing, setEditing] = useState<StoryRow | "new" | null>(null);
  const [removing, setRemoving] = useState<StoryRow | null>(null);

  return (
    <section>
      <SectionTitle
        title="Cerita kolaborasi"
        action={
          <Button onClick={() => setEditing("new")}>
            <Plus className="h-4 w-4" /> Tulis cerita
          </Button>
        }
      >
        Setelah ditulis, kedua pemilik bisnis diminta setuju lewat dasbor mereka. Salah satu boleh menarik persetujuan kapan saja.
      </SectionTitle>

      <div className="mt-4 space-y-3">
        <Failed query={list} />
        {list.loading && !list.data ? (
          <Skeleton className="h-40" />
        ) : !list.data?.length ? (
          <Empty icon={<BookOpen className="h-6 w-6" />} title="Belum ada cerita">
            Tulis kisah kolaborasi antara dua bisnis lulusan untuk ditampilkan di halaman Acara.
          </Empty>
        ) : (
          list.data.map((s) => (
            <Card key={s.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <h3 className="font-semibold">{s.title}</h3>
                  <Badge tone={live.has(s.id) ? "green" : "amber"}>
                    {live.has(s.id) ? "Tayang" : s.agree_a && s.agree_b ? "Disetujui, bisnisnya sedang tidak tayang" : "Menunggu persetujuan"}
                  </Badge>
                </div>
                <div className="flex shrink-0 gap-2">
                  <IconButton label="Ubah cerita" onClick={() => setEditing(s)}>
                    <Pencil className="h-4 w-4" />
                  </IconButton>
                  <IconButton label="Hapus cerita" onClick={() => setRemoving(s)}>
                    <Trash2 className="h-4 w-4 text-red" />
                  </IconButton>
                </div>
              </div>
              {/* Under the title row, so the buttons do not squeeze them on a phone. */}
              <p className="mt-2 flex flex-wrap gap-2 text-[13px]">
                <Consent name={nameOf(s.a)} agreed={s.agree_a} />
                <Consent name={nameOf(s.b)} agreed={s.agree_b} />
              </p>
              <p className="body-copy mt-2 line-clamp-3 text-[13px]">{s.body}</p>
            </Card>
          ))
        )}
      </div>

      <Sheet open={!!editing} onClose={() => setEditing(null)} title={editing === "new" ? "Tulis cerita" : "Ubah cerita"}>
        {editing && (
          <StoryForm
            story={editing === "new" ? null : editing}
            onDone={() => {
              setEditing(null);
              reload();
            }}
          />
        )}
      </Sheet>

      <ConfirmSheet
        open={!!removing}
        onClose={() => setRemoving(null)}
        title="Hapus cerita ini?"
        confirmLabel="Hapus"
        onConfirm={async () => {
          await removeImages([removing!.image_path]);
          const { error } = await supabase.from("stories").delete().eq("id", removing!.id);
          if (error) throw new Error("Belum terhapus. Coba lagi ya.");
          setRemoving(null);
          toast("Cerita dihapus.");
          reload();
        }}
      >
        “{removing?.title}” akan dihapus permanen.
      </ConfirmSheet>
    </section>
  );
}

function Consent({ name, agreed }: { name: string; agreed: boolean }) {
  const Icon = agreed ? Check : Hourglass;
  return (
    <span className={"inline-flex items-center gap-1 rounded-xl px-2.5 py-0.5 " + (agreed ? "bg-green-soft text-green" : "bg-sunken text-ink-soft")}>
      <Icon className="h-3 w-3" /> {name}: {agreed ? "setuju" : "belum setuju"}
    </span>
  );
}

function StoryForm({ story, onDone }: { story: StoryRow | null; onDone: () => void }) {
  const { user } = useAuth();
  const fileInput = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const options = useQuery(
    () =>
      supabase
        .from("businesses")
        .select("id, name, owner:profiles!businesses_owner_id_fkey(full_name, nickname)")
        .or(story ? `status.eq.approved,id.in.(${story.business_a},${story.business_b})` : "status.eq.approved") // an edited story keeps its own two
        .order("name")
        .overrideTypes<Option[], { merge: false }>(),
    [],
  );
  const label = (b: Option) => `${b.name?.trim() || b.owner?.full_name || "Tanpa nama"} (${b.owner?.nickname || b.owner?.full_name || "?"})`;

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const text = (name: string) => String(form.get(name) ?? "").trim();
    if (text("business_a") === text("business_b")) return setError("Pilih dua bisnis yang berbeda.");
    setBusy(true);
    setError(null);
    try {
      const image_path = file ? await uploadImage(file, user!.id) : (story?.image_path ?? null);
      const values = { title: text("title"), body: text("body"), business_a: text("business_a"), business_b: text("business_b"), image_path };
      const { error } = story
        ? await supabase.from("stories").update(values).eq("id", story.id)
        : await supabase.from("stories").insert({ ...values, created_by: user!.id });
      if (error) {
        if (file) removeImages([image_path]).catch(() => {}); // the upload that now belongs to nothing
        throw new Error("Cerita belum tersimpan. Coba lagi ya.");
      }
      if (file && story?.image_path) removeImages([story.image_path]).catch(() => {}); // the replaced image
      toast(story ? "Cerita diperbarui. Kedua pemilik diminta setuju lagi." : "Cerita tersimpan. Menunggu persetujuan kedua pemilik.");
      onDone();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      {story && <Notice tone="amber">Mengubah isi cerita membatalkan persetujuan yang sudah ada. Kedua pemilik akan diminta setuju lagi.</Notice>}
      <Field label="Judul">
        <Input name="title" defaultValue={story?.title} required maxLength={120} />
      </Field>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {(["business_a", "business_b"] as const).map((field, i) => (
          <Field key={field} label={i === 0 ? "Bisnis pertama" : "Bisnis kedua"}>
            <Select name={field} defaultValue={story?.[field] ?? ""} required key={options.data?.length}>
              <option value="" disabled>
                Pilih bisnis
              </option>
              {options.data?.map((b) => (
                <option key={b.id} value={b.id}>
                  {label(b)}
                </option>
              ))}
            </Select>
          </Field>
        ))}
      </div>
      <Field label="Ceritanya" hint="Apa yang mereka kerjakan bersama, dan apa hasilnya.">
        <Textarea name="body" defaultValue={story?.body} required rows={7} maxLength={2000} />
      </Field>
      <div>
        <Button variant="secondary" size="sm" onClick={() => fileInput.current?.click()}>
          <ImagePlus className="h-4 w-4" /> {file ? file.name.slice(0, 28) : story?.image_path ? "Ganti gambar" : "Pilih gambar (opsional)"}
        </Button>
        <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
      </div>
      {error && <Notice>{error}</Notice>}
      <Button type="submit" size="lg" full loading={busy}>
        {story ? "Simpan perubahan" : "Simpan cerita"}
      </Button>
    </form>
  );
}
