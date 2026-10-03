"use client";

// Dashboard: the member's business listings. Create, edit (live at once), switch on/off, send for review,
// see statistics, delete for good. One member can own several listings.

import { ArrowLeft, Eye, ImagePlus, MessageCircle, Phone, Plus, Store, Trash2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "../../_lib/auth";
import { CATEGORIES, SERVICE_TYPES } from "../../_lib/constants";
import { pesan, reviewBadge, tanggal, validLink, withHttps } from "../../_lib/format";
import { useQuery } from "../../_lib/hooks";
import { removeImages, uploadImage } from "../../_lib/storage";
import { supabase } from "../../_lib/supabase";
import type { Enums, Tables } from "../../_lib/types";
import { stagger } from "../cards";
import { Avatar, Badge, Button, Card, ConfirmSheet, Empty, Failed, Field, Input, Media, Notice, Select, Skeleton, Textarea, Toggle, toast } from "../ui";
import { PromoSection, StoriesSection } from "./bisnis-ekstra";
import { LocationsSection } from "./bisnis-lokasi";

type Biz = Tables<"businesses">;
type Viewer = { business_id: string; created_at: string; viewer: { full_name: string; nickname: string | null; batch_lp: number | null } | null };

const displayName = (b: Biz) => b.name?.trim() || "Bisnis tanpa nama";

function StatusBadge({ business }: { business: Biz }) {
  const badge = reviewBadge(business.status, business.active);
  return <Badge tone={badge.tone}>{badge.label}</Badge>;
}

export function BisnisTab() {
  const { user } = useAuth();
  const uid = user!.id;
  const list = useQuery(() => supabase.from("businesses").select("*").eq("owner_id", uid).order("created_at"), [uid]);
  // Who opened the contact, and how many Hubungkan requests each listing received.
  const viewers = useQuery(
    () =>
      supabase
        .from("contact_views")
        .select("business_id, created_at, viewer:profiles!contact_views_viewer_id_fkey(full_name, nickname, batch_lp)")
        .order("created_at", { ascending: false })
        .overrideTypes<Viewer[], { merge: false }>(),
    [uid],
  );
  const requests = useQuery(() => supabase.from("connections").select("business_id").eq("to_id", uid).not("business_id", "is", null), [uid]);
  const [editing, setEditing] = useState<string | "new" | null>(null);

  // "Pasang bisnis" buttons elsewhere link here with ?baru=1.
  const router = useRouter();
  const params = useSearchParams();
  useEffect(() => {
    if (params.get("baru") !== "1") return;
    setEditing("new");
    router.replace("/akun?tab=bisnis", { scroll: false });
  }, [params, router]);

  const reload = () => {
    list.reload();
    viewers.reload();
  };
  const current = list.data?.find((b) => b.id === editing);

  if (editing === "new") {
    return (
      <Shell title="Bisnis baru" onBack={() => setEditing(null)}>
        <Card className="p-5">
          <BusinessForm
            business={null}
            onSaved={(id) => {
              list.reload();
              setEditing(id);
              toast("Tersimpan sebagai draf. Tambahkan lokasi, lalu kirim.");
            }}
          />
        </Card>
      </Shell>
    );
  }

  if (current) {
    const opened = (viewers.data ?? []).filter((v) => v.business_id === current.id);
    const asked = (requests.data ?? []).filter((r) => r.business_id === current.id).length;
    return (
      <Shell title={displayName(current)} onBack={() => setEditing(null)}>
        <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
          {/* Phones: one column in the order of the work. The two wrappers dissolve into the grid and "Status tayang"
              moves up to sit right under the locations, so sending for review is not below the optional extras. */}
          <div className="contents lg:block lg:space-y-5">
            <Card className="-order-2 p-5">
              <h3 className="h-card mb-4">Profil bisnis</h3>
              <BusinessForm
                business={current}
                onSaved={() => {
                  reload();
                  toast(current.visible ? "Perubahan tersimpan dan langsung tayang." : "Perubahan tersimpan.");
                }}
              />
            </Card>
            <div className="-order-2">
              <LocationsSection business={current} onChanged={reload} />
            </div>
            <PromoSection businessId={current.id} />
            <StoriesSection businessId={current.id} />
          </div>
          <div className="contents lg:sticky lg:top-24 lg:block lg:space-y-5">
            <PublishCard business={current} onChanged={reload} />
            <Card className="p-5">
              <h3 className="h-card">Statistik</h3>
              <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
                <Stat icon={<Eye className="h-4 w-4" />} label="Dilihat" value={current.views} />
                <Stat icon={<Phone className="h-4 w-4" />} label="Buka kontak" value={opened.length} />
                <Stat icon={<MessageCircle className="h-4 w-4" />} label="Permintaan" value={asked} />
              </dl>
              <p className="mt-4 text-[12px] font-medium tracking-wide text-ink-soft uppercase">Yang membuka kontak</p>
              {opened.length === 0 ? (
                <p className="mt-1.5 text-[13px] text-ink-soft">Belum ada lulusan yang membuka kontak bisnismu.</p>
              ) : (
                <ul className="mt-2 space-y-2.5">
                  {opened.map((v) => {
                    const name = v.viewer?.nickname || v.viewer?.full_name || "Lulusan";
                    return (
                      <li key={v.created_at + name} className="flex items-center gap-3 text-sm">
                        <Avatar name={name} className="h-8 w-8" />
                        <span className="min-w-0 flex-1 truncate font-medium">
                          {name}
                          {v.viewer?.batch_lp ? <span className="font-normal text-ink-soft"> · LP {v.viewer.batch_lp}</span> : null}
                        </span>
                        <span className="shrink-0 text-[12px] text-ink-soft">{tanggal(v.created_at)}</span>
                      </li>
                    );
                  })}
                </ul>
              )}
              {asked > 0 && (
                <Button href="/akun?tab=koneksi" variant="secondary" size="sm" full className="mt-4">
                  Lihat permintaan Hubungkan
                </Button>
              )}
            </Card>
            <DeleteCard
              business={current}
              onDeleted={() => {
                setEditing(null);
                reload();
              }}
            />
          </div>
        </div>
      </Shell>
    );
  }

  // Just saved, or the list is still loading: the listing being opened is not in it yet.
  if (editing) return <Skeleton className="h-64" />;

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="h-card text-xl">Bisnis saya</h2>
          <p className="text-[13px] text-ink-soft">Punya beberapa cabang? Cukup satu bisnis dengan beberapa lokasi.</p>
        </div>
        <Button onClick={() => setEditing("new")}>
          <Plus className="h-4 w-4" /> Pasang bisnis
        </Button>
      </div>

      <div className="mt-4 space-y-3">
        <Failed query={list} />
        {list.loading && !list.data ? (
          [0, 1].map((i) => <Skeleton key={i} className="h-32" />)
        ) : !list.data?.length ? (
          <Empty icon={<Store className="h-6 w-6" />} title="Belum ada bisnis" action={<Button onClick={() => setEditing("new")}>Pasang bisnis pertama</Button>}>
            Pasang bisnismu supaya ditemukan publik dan sesama lulusan. Kamu bisa menyalakan dan mematikannya kapan saja.
          </Empty>
        ) : (
          list.data.map((b, i) => (
            <Card key={b.id} className="rise p-4" style={stagger(i)}>
              <div className="flex items-start gap-4">
                <Media path={b.image_path} name={displayName(b)} className="h-16 w-16 shrink-0 rounded-xl [&_span]:text-xl" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="truncate font-semibold">{displayName(b)}</h3>
                    <StatusBadge business={b} />
                  </div>
                  <p className="mt-0.5 truncate text-[13px] text-ink-soft">{b.category}</p>
                  <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-ink-soft">
                    <span>{b.views} kali dilihat</span>
                    <span>{(viewers.data ?? []).filter((v) => v.business_id === b.id).length} buka kontak</span>
                    <span>{(requests.data ?? []).filter((r) => r.business_id === b.id).length} permintaan</span>
                  </p>
                </div>
                {/* The switch only means something once the listing is approved. */}
                {b.status === "approved" && <ActiveToggle business={b} onChanged={list.reload} />}
              </div>
              <div className="mt-3 flex gap-2 border-t border-line pt-3">
                <Button size="sm" onClick={() => setEditing(b.id)}>
                  Kelola
                </Button>
                {b.visible && (
                  <Button size="sm" variant="secondary" href={`/bisnis/${b.id}`}>
                    Lihat halaman
                  </Button>
                )}
              </div>
            </Card>
          ))
        )}
      </div>
    </section>
  );
}

function Shell({ title, onBack, children }: { title: string; onBack: () => void; children: React.ReactNode }) {
  return (
    <section className="rise">
      <button type="button" onClick={onBack} className="tap -my-2.5 inline-flex items-center gap-1.5 py-2.5 text-[13px] font-semibold text-maroon underline-offset-2 hover:underline">
        <ArrowLeft className="h-4 w-4" /> Semua bisnis
      </button>
      <h2 className="h-card mt-2 mb-4 text-xl">{title}</h2>
      {children}
    </section>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="rounded-xl bg-page px-2 py-3">
      <dd className="text-2xl font-semibold tracking-tight">{value}</dd>
      <dt className="mt-1 flex items-center justify-center gap-1 text-[11px] text-ink-soft">
        {icon} {label}
      </dt>
    </div>
  );
}

// The on/off switch. Off removes the listing from search, the map and public pages at once and keeps its content.
function ActiveToggle({ business, onChanged }: { business: Biz; onChanged: () => void }) {
  return (
    <Toggle
      checked={business.active}
      label={business.active ? "Matikan bisnis" : "Nyalakan bisnis"}
      onChange={async (active) => {
        const { error } = await supabase.from("businesses").update({ active }).eq("id", business.id);
        if (error) return toast("Belum tersimpan. Coba lagi ya.", "error"), false; // false: the switch goes back
        toast(active ? "Bisnis dinyalakan lagi." : "Bisnis dimatikan. Isinya tetap tersimpan.");
        onChanged();
      }}
    />
  );
}

// Publishing needs the owner's consent and a moderator's approval. This card is the owner's half.
function PublishCard({ business, onChanged }: { business: Biz; onChanged: () => void }) {
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { status } = business;

  const submit = async () => {
    setBusy(true);
    setError(null);
    const { error } = await supabase.rpc("submit_business", { p_business: business.id });
    setBusy(false);
    if (error) return setError(pesan(error));
    // With staff's Auto Approve Bisnis on, the database approves it at once.
    const { data } = await supabase.from("businesses").select("status").eq("id", business.id).single();
    toast(data?.status === "approved" ? "Terkirim. Bisnismu langsung tayang." : "Terkirim. Bisnismu tayang setelah disetujui staf.");
    onChanged();
  };

  return (
    <Card className="-order-1 p-5">
      <div className="flex items-center justify-between gap-3">
        <h3 className="h-card">Status tayang</h3>
        <StatusBadge business={business} />
      </div>

      {status === "approved" && (
        <label className="mt-4 flex items-start justify-between gap-4">
          <span className="text-sm">
            <b className="block font-semibold">{business.active ? "Sedang tayang" : "Sedang dimatikan"}</b>
            <span className="text-[13px] text-ink-soft">
              Matikan untuk menghilangkan bisnis dari pencarian, peta, dan halaman publik. Isinya tetap tersimpan dan bisa dinyalakan lagi kapan saja.
            </span>
          </span>
          <ActiveToggle business={business} onChanged={onChanged} />
        </label>
      )}
      {status === "pending" && (
        <div className="mt-4">
          <Notice tone="amber">Sedang ditinjau staf. Kamu tetap bisa mengubah isinya.</Notice>
        </div>
      )}
      {status === "suspended" && (
        <div className="mt-4">
          <Notice>Ditangguhkan staf{business.review_note ? `: ${business.review_note}` : "."} Hubungi staf AsiaWorks untuk menayangkannya lagi.</Notice>
        </div>
      )}
      {(status === "draft" || status === "rejected") && (
        <div className="mt-4 space-y-3">
          {status === "rejected" && <Notice>Staf meminta perbaikan{business.review_note ? `: ${business.review_note}` : "."}</Notice>}
          <p className="text-[13px] text-ink-soft">Lengkapi profil, kontak, dan lokasi (atau pilih Online saja), lalu kirim.</p>
          <label className="flex items-start gap-3 text-sm">
            <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 accent-maroon" />
            Saya setuju bisnis ini ditampilkan untuk publik di direktori.
          </label>
          {error && <Notice>{error}</Notice>}
          <Button full loading={busy} disabled={!agree} onClick={submit}>
            Kirim
          </Button>
        </div>
      )}
    </Card>
  );
}

function DeleteCard({ business, onDeleted }: { business: Biz; onDeleted: () => void }) {
  const [open, setOpen] = useState(false);
  const remove = async () => {
    // Deletion is real: the stored files go first, then the row (which cascades to everything attached).
    // Ads staff put up for this business and stories about it go with the business (cascade), so their pictures go
    // too. Those files sit in the folder of the staff member who added them; the storage rules let the business's
    // owner remove them.
    const [ads, stories] = await Promise.all([
      supabase.from("banners").select("image_path").eq("business_id", business.id),
      supabase.from("stories").select("image_path").or(`business_a.eq.${business.id},business_b.eq.${business.id}`),
    ]);
    if (ads.error || stories.error) throw new Error("Belum terhapus. Coba lagi ya.");
    await removeImages([business.image_path, ...ads.data.map((row) => row.image_path), ...stories.data.map((row) => row.image_path)]);
    const { error } = await supabase.from("businesses").delete().eq("id", business.id);
    if (error) throw new Error("Belum terhapus. Coba lagi ya.");
    setOpen(false);
    toast("Bisnis dihapus permanen.");
    onDeleted();
  };
  return (
    <>
      <Button variant="danger" full onClick={() => setOpen(true)}>
        <Trash2 className="h-4 w-4" /> Hapus bisnis ini
      </Button>
      <ConfirmSheet open={open} onClose={() => setOpen(false)} onConfirm={remove} title="Hapus bisnis ini?" confirmLabel="Hapus permanen">
        “{displayName(business)}” beserta lokasi, promo, iklan, peluang yang dipasang atas nama bisnis ini, cerita kolaborasi, statistik,
        permintaan Hubungkan, dan fotonya akan dihapus permanen. Kalau hanya ingin menyembunyikannya, cukup matikan bisnisnya.
      </ConfirmSheet>
    </>
  );
}

// Profile fields. Used for a new listing (business = null) and for editing.
function BusinessForm({ business, onSaved }: { business: Biz | null; onSaved: (id: string) => void }) {
  const { user } = useAuth();
  const uid = user!.id;
  const fileInput = useRef<HTMLInputElement>(null);
  const [category, setCategory] = useState(business?.category ?? "");
  const [links, setLinks] = useState<string[]>(business?.links.length ? business.links : [""]);
  const [contact, setContact] = useState("");
  const [savedContact, setSavedContact] = useState("");
  const [imagePath, setImagePath] = useState(business?.image_path ?? null);
  const [busy, setBusy] = useState<"save" | "image" | null>(null);
  const [error, setError] = useState<string | null>(null);

  // The owner reads their own contact without leaving a trace in the statistics.
  useEffect(() => {
    if (!business) return;
    supabase.rpc("view_contact", { p_business: business.id }).then(({ data }) => {
      setContact(data ?? "");
      setSavedContact(data ?? "");
    });
  }, [business?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const pickImage = async (file: File | undefined) => {
    if (!file) return;
    setBusy("image");
    setError(null);
    try {
      const path = await uploadImage(file, uid);
      if (business) {
        const { error } = await supabase.from("businesses").update({ image_path: path }).eq("id", business.id);
        if (error) {
          removeImages([path]).catch(() => {}); // the upload that now belongs to nothing
          throw new Error("Foto belum tersimpan. Coba lagi ya.");
        }
        onSaved(business.id);
      }
      removeImages([imagePath]).catch(() => {}); // the photo this one replaces (also on a draft not saved yet)
      setImagePath(path);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const text = (name: string) => String(form.get(name) ?? "").trim();
    const values = {
      name: text("name") || null,
      description: text("description"),
      category,
      category_other: category === "Lainnya" ? text("category_other") || null : null,
      service_type: (text("service_type") || null) as Enums<"service_type"> | null,
      links: links.map((l) => l.trim()).filter(Boolean).map(withHttps),
      image_path: imagePath,
    };
    if (!values.links.every(validLink)) return setError("Tulis alamat lengkapnya ya, contoh: instagram.com/namabisnis");
    setBusy("save");
    setError(null);
    const saved = business
      ? await supabase.from("businesses").update(values).eq("id", business.id).select("id").single()
      : await supabase.from("businesses").insert({ ...values, owner_id: uid }).select("id").single();
    if (saved.error) {
      setBusy(null);
      return setError("Belum tersimpan. Periksa tautannya (contoh: instagram.com/namabisnis) lalu coba lagi ya.");
    }
    if (contact.trim() !== savedContact) {
      const { error } = await supabase.rpc("set_business_contact", { p_business: saved.data.id, p_contact: contact });
      if (error) {
        setBusy(null);
        if (business) return setError(pesan(error));
        // A new listing: its draft exists now. Move on to editing it, since saving here again would add a second draft.
        onSaved(saved.data.id);
        return toast("Kontak bisnisnya belum tersimpan. Isi lagi di profil bisnis ya.", "error");
      }
      setSavedContact(contact.trim());
    }
    setBusy(null);
    onSaved(saved.data.id);
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="flex items-center gap-4">
        <Media path={imagePath} name={business?.name || "Bisnis"} className="h-20 w-28 shrink-0 rounded-xl [&_span]:text-2xl" />
        <div>
          <Button variant="secondary" size="sm" loading={busy === "image"} onClick={() => fileInput.current?.click()}>
            <ImagePlus className="h-4 w-4" /> {imagePath ? "Ganti foto" : "Unggah foto"}
          </Button>
          <p className="mt-1.5 text-[12px] text-ink-soft">JPG atau PNG. Foto diperkecil otomatis supaya ringan.</p>
          <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" hidden
            onChange={(e) => {
              pickImage(e.target.files?.[0]);
              e.target.value = ""; // so choosing the same file again (after a failed upload) still fires
            }}
          />
        </div>
      </div>
      <Field label="Nama bisnis" optional hint="Kalau dikosongkan, nama kamu yang tampil.">
        <Input name="name" defaultValue={business?.name ?? ""} maxLength={80} placeholder="Kopi Titik Temu" />
      </Field>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Kategori bisnis">
          <Select value={category} onChange={(e) => setCategory(e.target.value)} required>
            <option value="" disabled>
              Pilih kategori
            </option>
            {CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </Select>
        </Field>
        <Field label="Jenis layanan" optional>
          <Select name="service_type" defaultValue={business?.service_type ?? ""}>
            <option value="">Belum dipilih</option>
            {Object.entries(SERVICE_TYPES).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      {category === "Lainnya" && (
        <Field label="Sebutkan kategorinya" optional>
          <Input name="category_other" defaultValue={business?.category_other ?? ""} maxLength={60} />
        </Field>
      )}
      <Field label="Deskripsi singkat" hint="Apa yang kamu tawarkan, dan untuk siapa.">
        <Textarea name="description" defaultValue={business?.description} required maxLength={600} />
      </Field>
      <Field label="Kontak bisnis" hint="WhatsApp atau email bisnis. Tersimpan terenkripsi dan hanya terlihat oleh sesama lulusan.">
        <Input value={contact} onChange={(e) => setContact(e.target.value)} required placeholder="0812 3456 7890" />
      </Field>
      <div>
        <span className="mb-1.5 block text-[13px] font-medium">Media sosial, marketplace, atau website</span>
        <div className="space-y-2">
          {links.map((link, i) => (
            <Input
              key={i}
              value={link}
              onChange={(e) => setLinks(links.map((l, j) => (j === i ? e.target.value : l)))}
              required={i === 0}
              inputMode="url"
              autoCapitalize="none"
              placeholder={["instagram.com/namabisnis", "tokopedia.com/namabisnis", "www.namabisnis.com"][i]}
              aria-label={`Tautan ${i + 1}`}
            />
          ))}
        </div>
        {links.length < 3 && (
          <button type="button" onClick={() => setLinks([...links, ""])} className="tap -mb-2.5 inline-flex items-center gap-1 py-2.5 text-[13px] font-semibold text-maroon underline-offset-2 hover:underline">
            <Plus className="h-3.5 w-3.5" /> Tambah tautan
          </button>
        )}
      </div>
      {error && <Notice>{error}</Notice>}
      <Button type="submit" size="lg" full loading={busy === "save"}>
        {business ? "Simpan perubahan" : "Simpan sebagai draf"}
      </Button>
    </form>
  );
}
