"use client";

// Locations of one listing: several branches, each with a map pin. A location can be approximate (an area instead
// of a point), or the whole listing can hide its locations and appear as online only.

import { ChevronRight, MapPin, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { AREAS } from "../../_lib/constants";
import { useQuery } from "../../_lib/hooks";
import { supabase } from "../../_lib/supabase";
import type { Tables } from "../../_lib/types";
import MapView from "../map";
import { Badge, Button, Card, ConfirmSheet, Failed, Field, IconButton, Input, Notice, Select, Sheet, Toggle, toast } from "../ui";

type Biz = Tables<"businesses">;
type Loc = Tables<"locations">;

// Common cities and the region each belongs to. Choosing one fills in Wilayah, so a business in Depok or Makassar
// lands under the same filter as its neighbours (the owner can still change it).
const CITY_AREAS: Record<string, string> = {
  "Jakarta Selatan": "Jabodetabek",
  "Jakarta Pusat": "Jabodetabek",
  "Jakarta Barat": "Jabodetabek",
  "Jakarta Timur": "Jabodetabek",
  "Jakarta Utara": "Jabodetabek",
  Tangerang: "Jabodetabek",
  "Tangerang Selatan": "Jabodetabek",
  Bekasi: "Jabodetabek",
  Depok: "Jabodetabek",
  Bogor: "Jabodetabek",
  Makassar: "Makassar",
  Bandung: "Jawa Barat & Banten",
  Surabaya: "Jawa Timur",
  Yogyakarta: "Jawa Tengah & DIY",
  Semarang: "Jawa Tengah & DIY",
  Denpasar: "Bali & Nusa Tenggara",
  Medan: "Sumatera",
  Palembang: "Sumatera",
  Balikpapan: "Kalimantan",
  Manado: "Sulawesi",
};
const CITIES = Object.keys(CITY_AREAS);

export function LocationsSection({ business, onChanged }: { business: Biz; onChanged: () => void }) {
  const list = useQuery(() => supabase.from("locations").select("*").eq("business_id", business.id).order("created_at"), [business.id]);
  const [editing, setEditing] = useState<Loc | "new" | null>(null);
  const [removing, setRemoving] = useState<Loc | null>(null);

  const setOnline = async (online_only: boolean) => {
    const { error } = await supabase.from("businesses").update({ online_only }).eq("id", business.id);
    if (error) return toast("Belum tersimpan. Coba lagi ya.", "error"), false; // false: the switch goes back
    toast(online_only ? "Lokasi disembunyikan. Bisnis tampil sebagai online." : "Lokasi ditampilkan lagi.");
    onChanged();
  };
  const remove = async () => {
    const { error } = await supabase.from("locations").delete().eq("id", removing!.id);
    if (error) throw new Error("Belum terhapus. Coba lagi ya.");
    setRemoving(null);
    toast("Lokasi dihapus.");
    list.reload();
    onChanged();
  };

  // No location yet: one big action, the pin on the map. "Online saja" is the way out for a business without a place.
  const empty = !list.loading && !list.error && !list.data?.length;

  return (
    <Card className="p-5">
      <div className="flex min-h-9 items-center justify-between gap-3">
        <h3 className="h-card">Lokasi</h3>
        {!empty && (
          <Button size="sm" variant="secondary" onClick={() => setEditing("new")}>
            <Plus className="h-4 w-4" /> Tambah lokasi
          </Button>
        )}
      </div>

      {list.error && (
        <div className="mt-3">
          <Failed query={list} />
        </div>
      )}
      {list.data?.length ? (
        <ul className="mt-3 space-y-2">
          {list.data.map((l) => (
            <li key={l.id} className="flex items-center gap-3 rounded-xl border border-line p-3">
              <MapPin className="h-4 w-4 shrink-0 text-maroon" />
              <div className="min-w-0 flex-1 text-sm">
                <p className="flex flex-wrap items-center gap-2 font-semibold">
                  {l.label || l.city}
                  {l.mode === "area" && <Badge tone="gray">Perkiraan area</Badge>}
                </p>
                <p className="truncate text-[13px] text-ink-soft">
                  {l.address ? `${l.address}, ` : ""}
                  {l.city} · {l.area}
                </p>
              </div>
              <IconButton label="Ubah lokasi" onClick={() => setEditing(l)}>
                <Pencil className="h-4 w-4" />
              </IconButton>
              <IconButton label="Hapus lokasi" onClick={() => setRemoving(l)}>
                <Trash2 className="h-4 w-4 text-red" />
              </IconButton>
            </li>
          ))}
        </ul>
      ) : (
        empty && (
          <button
            type="button"
            onClick={() => setEditing("new")}
            className="tap mt-3 flex w-full items-center gap-4 rounded-2xl bg-maroon p-5 text-left text-white shadow-button hover:bg-maroon-dark"
          >
            <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-white text-maroon">
              <MapPin className="h-7 w-7" />
            </span>
            <span className="min-w-0 flex-1">
              <b className="block text-lg leading-snug font-semibold">Taruh pin di peta</b>
              <span className="mt-0.5 block text-[13px] text-white/85">Ketuk di sini, lalu tandai lokasi bisnismu supaya muncul di peta dan di pencarian terdekat.</span>
            </span>
            <ChevronRight className="h-6 w-6 shrink-0" />
          </button>
        )
      )}

      {empty && <p className="mt-5 text-[13px] text-ink-soft">Bisnismu tidak punya tempat? Pilih ini saja:</p>}
      <label className="mt-2 flex items-start justify-between gap-4 rounded-xl bg-page p-3.5">
        <span className="text-sm">
          <b className="block font-semibold">Online saja</b>
          <span className="text-[13px] text-ink-soft">Sembunyikan semua lokasi. Bisnis tampil sebagai online dan tidak muncul di peta.</span>
        </span>
        <Toggle checked={business.online_only} onChange={setOnline} label="Online saja" />
      </label>

      <Sheet open={!!editing} onClose={() => setEditing(null)} title={editing === "new" ? "Tambah lokasi" : "Ubah lokasi"}>
        {editing && (
          <LocationForm
            businessId={business.id}
            location={editing === "new" ? null : editing}
            onDone={() => {
              setEditing(null);
              list.reload();
              onChanged();
            }}
          />
        )}
      </Sheet>

      <ConfirmSheet open={!!removing} onClose={() => setRemoving(null)} onConfirm={remove} title="Hapus lokasi ini?" confirmLabel="Hapus">
        “{removing?.label || removing?.city}” akan dihapus dari bisnismu dan dari peta.
      </ConfirmSheet>
    </Card>
  );
}

function LocationForm({ businessId, location, onDone }: { businessId: string; location: Loc | null; onDone: () => void }) {
  const [pin, setPin] = useState(location ? { lat: location.lat, lng: location.lng } : null);
  const [approximate, setApproximate] = useState(location?.mode === "area");
  const [area, setArea] = useState(location?.area ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!pin) return setError("Taruh pin di peta dulu ya.");
    const form = new FormData(e.currentTarget);
    const text = (name: string) => String(form.get(name) ?? "").trim();
    // In approximate mode the database rounds the point to about 1 km and drops the address.
    const values = {
      label: text("label") || null,
      address: approximate ? null : text("address") || null,
      city: text("city"),
      area,
      mode: approximate ? ("area" as const) : ("exact" as const),
      lat: pin.lat,
      lng: pin.lng,
    };
    setBusy(true);
    setError(null);
    const { error } = location
      ? await supabase.from("locations").update(values).eq("id", location.id)
      : await supabase.from("locations").insert({ ...values, business_id: businessId });
    setBusy(false);
    if (error) return setError("Lokasi belum tersimpan. Coba lagi ya.");
    toast("Lokasi tersimpan.");
    onDone();
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <MapView pick={pin} onPick={setPin} className="h-64" />
      <label className="flex items-start justify-between gap-4 rounded-xl bg-page p-3.5">
        <span className="text-sm">
          <b className="block font-semibold">Tampilkan perkiraan area saja</b>
          <span className="text-[13px] text-ink-soft">Cocok untuk bisnis rumahan. Peta hanya menunjukkan area sekitar 1 km, bukan titik persisnya.</span>
        </span>
        <Toggle checked={approximate} onChange={setApproximate} label="Perkiraan area" />
      </label>
      <Field label="Nama lokasi" optional>
        <Input name="label" defaultValue={location?.label ?? ""} placeholder="Cabang Kemang" maxLength={60} />
      </Field>
      {!approximate && (
        <Field label="Alamat" optional>
          <Input name="address" defaultValue={location?.address ?? ""} placeholder="Jl. Kemang Raya No. 10" maxLength={160} />
        </Field>
      )}
      <div className="grid grid-cols-2 gap-3">
        <Field label="Kota">
          <Input
            name="city"
            defaultValue={location?.city}
            required
            list="aw-cities"
            placeholder="Jakarta Selatan"
            onChange={(e) => {
              const known = CITY_AREAS[e.target.value.trim()];
              if (known) setArea(known);
            }}
          />
          <datalist id="aw-cities">
            {CITIES.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </Field>
        <Field label="Wilayah">
          <Select value={area} onChange={(e) => setArea(e.target.value)} required>
            <option value="" disabled>
              Pilih wilayah
            </option>
            {AREAS.map((a) => (
              <option key={a}>{a}</option>
            ))}
          </Select>
        </Field>
      </div>
      <p className="text-[13px] text-ink-soft">Bogor, Depok, Tangerang, dan Bekasi masuk Jabodetabek. Makassar punya pilihannya sendiri.</p>
      {error && <Notice>{error}</Notice>}
      <Button type="submit" size="lg" full loading={busy}>
        Simpan lokasi
      </Button>
    </form>
  );
}
