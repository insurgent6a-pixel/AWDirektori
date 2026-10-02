"use client";

// Meet Graduates: every live business as a card, with the person behind it.

import { Store, Tag, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { BusinessCard } from "../_components/cards";
import { Container, PageHero, usePasangBisnis } from "../_components/shell";
import { Button, Card, Chip, Empty, Notice, SearchInput, Select, Skeleton, toast } from "../_components/ui";
import { AREAS, CATEGORIES, LUAR_JABODETABEK } from "../_lib/constants";
import { useQuery, useUrlFilters } from "../_lib/hooks";
import { searchBusinesses } from "../_lib/queries";
import type { Business } from "../_lib/types";

const PAGE_SIZE = 12;
type Sort = "baru" | "nama" | "dekat";

export default function LulusanPage() {
  // Filters live in the URL (the same names as on the home page), so Back and shared links keep them.
  const { params, setFilter, q, setQ, term } = useUrlFilters("/lulusan");
  const category = params.get("kategori") ?? "";
  const area = params.get("area") ?? "";
  const promoOnly = params.get("promo") === "1";
  const [sort, setSort] = useState<Sort>("baru");
  const pasangBisnis = usePasangBisnis();
  const [near, setNear] = useState<{ lat: number; lng: number } | null>(null);
  const [shown, setShown] = useState(PAGE_SIZE);

  // The whole directory once (it feeds the numbers in the hero), then a filtered search only when a filter is on.
  const all = useQuery(() => searchBusinesses(), []);
  const filtered = !!(term || category || area || promoOnly);
  const nearest = sort === "dekat" && near ? near : undefined;
  const search = useQuery(
    filtered || nearest ? () => searchBusinesses({ q: term, category, area, promoOnly, near: nearest }) : null,
    [term, category, area, promoOnly, nearest, filtered],
  );
  const { data, loading, error } = filtered || nearest ? search : all;
  const stats: Business[] | null = all.data;
  useEffect(() => setShown(PAGE_SIZE), [term, category, area, promoOnly, sort]);

  const list = useMemo(
    () => (sort === "nama" ? [...(data ?? [])].sort((a, b) => a.name.localeCompare(b.name, "id")) : (data ?? [])),
    [data, sort],
  );

  const changeSort = (next: Sort) => {
    setSort(next); // the choice shows at once; "Terdekat" starts sorting when the location arrives
    if (next !== "dekat" || near) return;
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => setNear({ lat: coords.latitude, lng: coords.longitude }),
      () => {
        setSort("baru");
        toast("Lokasi belum bisa dibaca. Izinkan akses lokasi di browser dulu ya.", "error");
      },
    );
  };
  const reset = () => {
    setQ("");
    setFilter({ q: null, kategori: null, area: null, promo: null });
  };

  return (
    <>
      <PageHero
        crumbs={[{ label: "Beranda", href: "/" }, { label: "Lulusan" }]}
        title="Kenali para lulusan"
        accent="dan bisnis yang mereka bangun."
        aside={
          <dl className="grid grid-cols-2 gap-x-8 gap-y-5 rounded-2xl border border-line bg-surface p-5 shadow-card md:w-80">
            <Stat label="Bisnis tayang" value={stats?.length} />
            <Stat label="Kota" value={stats && new Set(stats.flatMap((b) => b.locations.map((l) => l.city))).size} />
            <Stat label="Lulusan" value={stats && new Set(stats.map((b) => b.owner_id)).size} />
            <Stat label="GLP Perk aktif" value={stats?.filter((b) => b.perk).length} accent />
          </dl>
        }
      >
        Semua bisnis di sini milik lulusan AsiaWorks yang sudah diverifikasi staf. Temukan yang kamu butuhkan, lalu sapa pemiliknya
        lewat Hubungkan.
      </PageHero>

      <Container className="py-6 md:py-8">
        {/* Phones: search on its own row, the two selects side by side (their default labels are short enough for 360px). */}
        <Card className="grid grid-cols-2 gap-3 p-3 sm:p-4 lg:grid-cols-[1fr_13rem_13rem_auto]">
          <SearchInput compact className="col-span-2 lg:col-span-1" value={q} onChange={setQ} placeholder="Cari bisnis, pemilik, atau LP" />
          <Select compact value={category} onChange={(e) => setFilter({ kategori: e.target.value || null })} aria-label="Kategori">
            <option value="">Kategori</option>
            {CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </Select>
          <Select compact value={area} onChange={(e) => setFilter({ area: e.target.value || null })} aria-label="Wilayah">
            <option value="">Wilayah</option>
            {AREAS.map((a) => (
              <option key={a}>{a}</option>
            ))}
            <option>{LUAR_JABODETABEK}</option>
          </Select>
          <button
            type="button"
            aria-pressed={promoOnly}
            onClick={() => setFilter({ promo: promoOnly ? null : "1" })}
            className={
              "tap col-span-2 flex h-10 items-center justify-center gap-1.5 rounded-xl border px-3.5 text-[13px] font-semibold whitespace-nowrap lg:col-span-1 " +
              (promoOnly ? "border-gold bg-gold text-white" : "border-blush-line bg-blush text-maroon hover:border-maroon/40")
            }
          >
            <Tag className="h-4 w-4" /> GLP Perk saja
          </button>
        </Card>

        {filtered && (
          <div className="no-scrollbar -mx-4 mt-3 flex items-center gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">
            <span className="shrink-0 text-[11px] font-semibold tracking-wide text-ink-soft uppercase">Filter aktif</span>
            {term && <Active onRemove={() => setQ("")}>“{term}”</Active>}
            {category && <Active onRemove={() => setFilter({ kategori: null })}>{category}</Active>}
            {area && <Active onRemove={() => setFilter({ area: null })}>{area}</Active>}
            {promoOnly && <Active onRemove={() => setFilter({ promo: null })}>GLP Perk</Active>}
            <button type="button" onClick={reset} className="tap shrink-0 py-2.5 text-[13px] font-semibold text-maroon underline-offset-4 hover:underline">
              Hapus semua
            </button>
          </div>
        )}

        <div className="mt-5 flex items-center justify-between gap-4">
          <p className="text-[13px] text-ink-soft" aria-live="polite">
            {loading ? "Memuat bisnis..." : `${list.length} bisnis lulusan`}
          </p>
          <label className="flex items-center gap-2 text-[13px] text-ink-soft">
            <span className="hidden sm:inline">Urutkan</span>
            <select
              value={sort}
              onChange={(e) => changeSort(e.target.value as Sort)}
              className="h-10 rounded-full border border-line bg-surface px-3 font-medium text-ink md:h-9"
            >
              <option value="baru">Terbaru</option>
              <option value="nama">Nama A-Z</option>
              <option value="dekat">Terdekat</option>
            </select>
          </label>
        </div>

        {error ? (
          <div className="mt-4">
            <Notice>Daftar bisnis belum bisa dimuat. Periksa koneksi lalu muat ulang halaman ya.</Notice>
          </div>
        ) : loading && !data ? (
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
              <Skeleton key={i} className="h-96" />
            ))}
          </div>
        ) : list.length === 0 ? (
          <Empty
            icon={<Store className="h-6 w-6" />}
            title={filtered ? "Belum ada bisnis yang cocok" : "Belum ada bisnis tayang"}
            action={
              filtered ? (
                <Button variant="secondary" onClick={reset}>
                  Hapus filter
                </Button>
              ) : (
                <Button href={pasangBisnis}>Pasang bisnis pertama</Button>
              )
            }
          >
            {filtered ? "Coba kata kunci lain atau longgarkan filternya." : "Jadi lulusan pertama yang memasang bisnis di direktori."}
          </Empty>
        ) : (
          <>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {list.slice(0, shown).map((business, i) => (
                <BusinessCard key={business.id} business={business} index={i % PAGE_SIZE} />
              ))}
            </div>
            {shown < list.length && (
              <div className="mt-6 text-center">
                <Button variant="secondary" onClick={() => setShown(shown + PAGE_SIZE)}>
                  Tampilkan lagi ({list.length - shown})
                </Button>
              </div>
            )}
          </>
        )}

        <div className="mt-10 flex flex-col items-start gap-4 rounded-2xl border border-line bg-surface p-6 shadow-card md:flex-row md:items-center md:justify-between md:p-8">
          <div>
            <h2 className="h-card text-xl">Bisnismu belum ada di sini?</h2>
            <p className="body-copy mt-1 text-sm">Daftar sebagai lulusan, pasang bisnismu, dan biarkan lulusan lain menemukanmu.</p>
          </div>
          <Button href={pasangBisnis} size="lg" className="shrink-0">
            Pasang bisnis
          </Button>
        </div>
      </Container>
    </>
  );
}

function Stat({ label, value, accent }: { label: string; value: number | null | undefined; accent?: boolean }) {
  return (
    <div>
      <dt className="text-[10px] font-semibold tracking-wider text-ink-soft uppercase">{label}</dt>
      <dd className={"mt-1 text-2xl font-semibold tracking-tight " + (accent ? "text-maroon" : "")}>{value ?? "–"}</dd>
    </div>
  );
}

function Active({ children, onRemove }: { children: React.ReactNode; onRemove: () => void }) {
  return (
    <Chip active onClick={onRemove} title="Hapus filter ini">
      {children}
      <X className="h-3.5 w-3.5" aria-hidden />
    </Chip>
  );
}
