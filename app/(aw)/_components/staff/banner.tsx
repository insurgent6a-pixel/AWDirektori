"use client";

// The banner at the top of the Direktori page. Only staff put one up: an announcement, or an ad for one business.

import { ImagePlus, Megaphone, Pencil, Plus, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { useAuth } from "../../_lib/auth";
import { withHttps } from "../../_lib/format";
import { useQuery } from "../../_lib/hooks";
import { removeImages, uploadImage } from "../../_lib/storage";
import { supabase } from "../../_lib/supabase";
import type { Tables } from "../../_lib/types";
import { Badge, Button, Card, ConfirmSheet, Empty, Failed, Field, IconButton, Input, Media, Notice, Select, Sheet, Skeleton, Textarea, Toggle, toast } from "../ui";
import { SectionTitle } from "./shared";

type BannerRow = Tables<"banners"> & { business: { id: string; name: string | null; visible: boolean } | null };
type Option = { id: string; name: string | null; owner: { full_name: string; nickname: string | null } | null };

export function BannerStaf() {
  const list = useQuery(
    () =>
      supabase
        .from("banners")
        .select("*, business:businesses(id, name, visible)")
        .order("created_at", { ascending: false })
        .overrideTypes<BannerRow[], { merge: false }>(),
    [],
  );
  // The banner form. `banner` is the one being changed (null: a new one); it stays set while the sheet slides away.
  const [form, setForm] = useState<{ open: boolean; banner: BannerRow | null }>({ open: false, banner: null });
  const [removing, setRemoving] = useState<BannerRow | null>(null);
  const create = () => setForm({ open: true, banner: null });
  // While the list reloads after a save its rows are still the old ones. Editing or deleting from one of those would
  // write old text back, or leave the new picture behind, so those two taps wait for the fresh rows.
  const fresh = !list.loading;

  const setActive = async (id: string, active: boolean) => {
    const { error } = await supabase.from("banners").update({ active }).eq("id", id);
    if (error) return toast("Belum tersimpan. Coba lagi ya.", "error"), false; // false: the switch goes back
    toast(active ? "Banner ditayangkan." : "Banner disembunyikan.");
    list.reload();
  };

  return (
    <section>
      <SectionTitle
        title="Banner"
        action={
          <Button onClick={create}>
            <Plus className="h-4 w-4" /> Banner baru
          </Button>
        }
      >
        Tampil paling atas di halaman Direktori dan langsung tayang. Bisa berupa pengumuman, atau iklan untuk satu bisnis.
      </SectionTitle>

      <div className="mt-4 space-y-3">
        <Failed query={list} />
        {list.loading && !list.data ? (
          <Skeleton className="h-32" />
        ) : !list.data?.length ? (
          <Empty icon={<Megaphone className="h-6 w-6" />} title="Belum ada banner" action={<Button onClick={create}>Buat banner</Button>}>
            Umumkan acara, kabar komunitas, atau pasang iklan sebuah bisnis untuk semua pengunjung.
          </Empty>
        ) : (
          list.data.map((b) => (
            <Card key={b.id} className="flex flex-wrap items-center gap-x-4 gap-y-3 p-4">
              {b.image_path && <Media path={b.image_path} name={b.title} className="h-16 w-24 shrink-0 rounded-xl" />}
              {/* basis-40: on a phone the text keeps a readable width and the controls drop to a row of their own */}
              <div className="min-w-0 flex-1 basis-40">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={b.business ? "gold" : "maroon"}>{b.business ? "Iklan" : "Pengumuman"}</Badge>
                  {/* why a banner that is switched on does not show: an ad goes down with its business */}
                  {b.business && !b.business.visible && <Badge tone="gray">Bisnisnya sedang tidak tayang</Badge>}
                </div>
                <h3 className="mt-1.5 line-clamp-2 font-semibold">{b.title}</h3>
                <p className="truncate text-[13px] text-ink-soft">
                  {b.business ? `Untuk ${b.business.name || "bisnis tanpa nama"}` : (b.body ?? "")}
                  {b.link_url ? ` · ${b.link_url}` : ""}
                </p>
              </div>
              <div className="ml-auto flex items-center gap-3">
                <Toggle checked={b.active} onChange={(on) => setActive(b.id, on)} label={b.active ? "Sembunyikan banner" : "Tayangkan banner"} />
                <IconButton label="Ubah banner" onClick={() => fresh && setForm({ open: true, banner: b })}>
                  <Pencil className="h-4 w-4" />
                </IconButton>
                <IconButton label="Hapus banner" onClick={() => fresh && setRemoving(b)}>
                  <Trash2 className="h-4 w-4 text-red" />
                </IconButton>
              </div>
            </Card>
          ))
        )}
      </div>

      <Sheet open={form.open} onClose={() => setForm({ ...form, open: false })} title={form.banner ? "Ubah banner" : "Banner baru"}>
        <BannerForm
          key={form.banner?.id ?? "new"}
          banner={form.banner}
          onDone={() => {
            setForm({ ...form, open: false });
            list.reload();
          }}
        />
      </Sheet>

      <ConfirmSheet
        open={!!removing}
        onClose={() => setRemoving(null)}
        title="Hapus banner ini?"
        confirmLabel="Hapus"
        onConfirm={async () => {
          await removeImages([removing!.image_path]);
          const { error } = await supabase.from("banners").delete().eq("id", removing!.id);
          if (error) throw new Error("Belum terhapus. Coba lagi ya.");
          setRemoving(null);
          toast("Banner dihapus.");
          list.reload();
        }}
      >
        “{removing?.title}” akan dihapus permanen.
      </ConfirmSheet>
    </section>
  );
}

// A new banner (banner = null), or a change to one. Choosing a business makes it an ad for that business.
function BannerForm({ banner, onDone }: { banner: BannerRow | null; onDone: () => void }) {
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
        .or(banner?.business_id ? `status.eq.approved,id.eq.${banner.business_id}` : "status.eq.approved") // an edited ad keeps its business
        .order("name")
        .overrideTypes<Option[], { merge: false }>(),
    [],
  );
  const label = (b: Option) => `${b.name?.trim() || b.owner?.full_name || "Tanpa nama"} (${b.owner?.nickname || b.owner?.full_name || "?"})`;

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const link = String(form.get("link_url")).trim();
    setBusy(true);
    setError(null);
    try {
      const uploaded = file ? await uploadImage(file, user!.id) : null;
      const values = {
        title: String(form.get("title")).trim(),
        body: String(form.get("body")).trim() || null,
        // A path such as /acara stays inside the site; anything else is treated as a web address.
        link_url: !link ? null : link.startsWith("/") ? link : withHttps(link),
        image_path: uploaded ?? banner?.image_path ?? null,
        business_id: String(form.get("business_id") ?? "") || null,
      };
      const { error } = banner
        ? await supabase.from("banners").update(values).eq("id", banner.id).select("id").single() // single: a banner deleted meanwhile is an error, not a silent no-op
        : await supabase.from("banners").insert({ ...values, created_by: user!.id });
      if (error) {
        removeImages([uploaded]).catch(() => {});
        throw new Error("Banner belum tersimpan. Periksa tautannya lalu coba lagi ya.");
      }
      if (uploaded && banner) removeImages([banner.image_path]).catch(() => {}); // the picture this one replaces
      toast(banner ? "Banner diperbarui." : "Banner tayang.");
      onDone();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="Judul">
        <Input name="title" defaultValue={banner?.title} required maxLength={80} placeholder="Temu lulusan Jakarta, 24 Oktober" />
      </Field>
      <Field label="Keterangan" optional>
        <Textarea name="body" defaultValue={banner?.body ?? ""} maxLength={200} rows={3} />
      </Field>
      <Field label="Iklan untuk bisnis" optional hint="Pilih bisnisnya kalau banner ini iklan. Bannernya berlabel Iklan dan ikut turun selama bisnis itu tidak tayang.">
        {/* key: the saved choice shows once the list of businesses has loaded */}
        <Select name="business_id" defaultValue={banner?.business_id ?? ""} key={options.data?.length}>
          <option value="">Bukan iklan (pengumuman)</option>
          {options.data?.map((b) => (
            <option key={b.id} value={b.id}>
              {label(b)}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Tautan" optional hint="Halaman di situs ini (misalnya /acara) atau alamat web. Iklan tanpa tautan membuka halaman bisnisnya.">
        <Input name="link_url" defaultValue={banner?.link_url ?? ""} autoCapitalize="none" placeholder="/acara" />
      </Field>
      <div>
        <Button variant="secondary" size="sm" onClick={() => fileInput.current?.click()}>
          <ImagePlus className="h-4 w-4" /> {file ? file.name.slice(0, 28) : banner?.image_path ? "Ganti gambar" : "Pilih gambar (opsional)"}
        </Button>
        <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        <p className="mt-1.5 text-[12px] text-ink-soft">Gambarnya tampil penuh sebagai banner, jadi tulis pesannya di gambar. Ukuran yang pas 1200 × 400; di layar lebar tepi atas dan bawahnya terpotong sedikit. Tanpa gambar, judulnya yang tampil (keterangan ikut tampil di layar lebar).</p>
      </div>
      {error && <Notice>{error}</Notice>}
      <Failed query={options} />
      {/* not before the businesses are here: saving with the list still empty would turn an ad into an announcement */}
      <Button type="submit" size="lg" full loading={busy} disabled={!options.data}>
        {banner ? "Simpan perubahan" : "Tayangkan"}
      </Button>
    </form>
  );
}
