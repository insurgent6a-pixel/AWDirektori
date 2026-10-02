"use client";

// Peluang: partner requests posted by graduates. Other graduates answer through Hubungkan.

import { Handshake, MessageCircle, PencilLine, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { PeluangCard } from "../_components/cards";
import { Container, PageHero } from "../_components/shell";
import { Button, Card, Chip, Empty, Notice, SearchInput, Select, Skeleton } from "../_components/ui";
import { AREAS, areaMatches, PELUANG_KINDS } from "../_lib/constants";
import { useQuery } from "../_lib/hooks";
import { peluangFeed } from "../_lib/queries";
import type { Enums } from "../_lib/types";

const PAGE_SIZE = 8;
const NEW_PELUANG = "/akun?tab=peluang&baru=1";
type Kind = Enums<"peluang_kind">;

const STEPS = [
  { icon: PencilLine, title: "Pasang kebutuhanmu", text: "Tulis apa yang kamu cari: supplier, mitra, vendor, konsultan, freelancer, atau karyawan." },
  { icon: MessageCircle, title: "Lulusan lain menjawab", text: "Yang berminat mengirim pesan singkat lewat Hubungkan. Kamu yang memilih mau lanjut dengan siapa." },
  { icon: Handshake, title: "Terima, lalu ngobrol", text: "Begitu kamu terima, kontak kalian berdua saling terbuka. Sisanya tinggal lanjut di WhatsApp." },
];

export default function PeluangPage() {
  const { data, loading, error } = useQuery(peluangFeed, []);
  const [q, setQ] = useState("");
  const [kind, setKind] = useState<Kind | "">("");
  const [area, setArea] = useState("");
  const [sort, setSort] = useState<"baru" | "segera">("baru");
  const [shown, setShown] = useState(PAGE_SIZE);

  // ponytail: filtered in the browser, fine for a few hundred rows. Move to a search RPC beyond that.
  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const rows = (data ?? []).filter(
      (p) =>
        (!kind || p.kind === kind) &&
        (!area || !p.area || areaMatches(area, p.area)) && // no area means "Di mana saja": it applies to every region
        (!needle || [p.title, p.description, p.owner_name, p.business_name, p.area].some((text) => text?.toLowerCase().includes(needle))),
    );
    if (sort === "segera") rows.sort((a, b) => (a.deadline ?? "9999").localeCompare(b.deadline ?? "9999"));
    return rows;
  }, [data, q, kind, area, sort]);

  const count = (k: Kind) => (data ?? []).filter((p) => p.kind === k).length;
  const filtered = !!(q || kind || area);
  const reset = () => {
    setQ("");
    setKind("");
    setArea("");
  };

  return (
    <>
      <PageHero
        crumbs={[{ label: "Beranda", href: "/direktori" }, { label: "Peluang" }]}
        title={"Peluang kerja\u00a0sama"} // non-breaking: "kerja sama" stays on one line
        accent="antar lulusan."
        action={
          <Button href={NEW_PELUANG} size="lg">
            <Plus className="h-4 w-4" /> Pasang peluang
          </Button>
        }
      >
        Kebutuhan nyata dari sesama lulusan AsiaWorks: supplier, mitra, vendor, konsultan, freelancer, sampai karyawan. Lihat yang cocok,
        lalu jawab lewat Hubungkan.
      </PageHero>

      <Container className="py-6 md:py-8">
        <Card className="space-y-3 p-3 sm:p-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-[1fr_13rem_11rem]">
            <SearchInput compact className="col-span-2 md:col-span-1" value={q} onChange={(v) => (setQ(v), setShown(PAGE_SIZE))} placeholder="Cari peluang, bisnis, lulusan" />
            <Select compact value={area} onChange={(e) => (setArea(e.target.value), setShown(PAGE_SIZE))} aria-label="Wilayah">
              <option value="">Wilayah</option>
              {AREAS.map((a) => (
                <option key={a}>{a}</option>
              ))}
            </Select>
            <Select compact value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} aria-label="Urutkan">
              <option value="baru">Terbaru</option>
              <option value="segera">Segera berakhir</option>
            </Select>
          </div>
          <div className="no-scrollbar -mx-3 -my-1.5 flex gap-2 overflow-x-auto px-3 py-1.5 sm:-mx-4 sm:px-4">
            <Chip active={!kind} onClick={() => (setKind(""), setShown(PAGE_SIZE))}>
              Semua jenis
            </Chip>
            {(Object.keys(PELUANG_KINDS) as Kind[]).map((k) => (
              <Chip key={k} active={kind === k} onClick={() => (setKind(k), setShown(PAGE_SIZE))}>
                {PELUANG_KINDS[k]}
                <span className="opacity-75">{count(k)}</span>
              </Chip>
            ))}
          </div>
        </Card>

        <p className="mt-5 flex items-center justify-between text-[13px] text-ink-soft" aria-live="polite">
          {loading ? "Memuat peluang..." : `${list.length} peluang terbuka`}
          {filtered && (
            <button type="button" onClick={reset} className="tap -my-2.5 py-2.5 font-semibold text-maroon underline-offset-4 hover:underline">
              Hapus filter
            </button>
          )}
        </p>

        {error ? (
          <div className="mt-4">
            <Notice>Peluang belum bisa dimuat. Periksa koneksi lalu muat ulang halaman ya.</Notice>
          </div>
        ) : loading ? (
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-80" />
            ))}
          </div>
        ) : list.length === 0 ? (
          <Empty
            icon={<Handshake className="h-6 w-6" />}
            title={filtered ? "Belum ada yang cocok" : "Belum ada peluang"}
            action={
              filtered ? (
                <Button variant="secondary" onClick={reset}>
                  Hapus filter
                </Button>
              ) : (
                <Button href={NEW_PELUANG}>Pasang peluang pertama</Button>
              )
            }
          >
            {filtered ? "Coba kata kunci lain atau longgarkan filternya." : "Punya kebutuhan untuk bisnismu? Jadi yang pertama memasangnya."}
          </Empty>
        ) : (
          <>
            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
              {list.slice(0, shown).map((p, i) => (
                <PeluangCard key={p.id} peluang={p} index={i % PAGE_SIZE} />
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
      </Container>

      <Container className="mt-10 md:mt-16">
        <h2 className="h-section text-center">Cara kerjanya</h2>
        <ol className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
          {STEPS.map(({ icon: Icon, title, text }, i) => (
            <li key={title} className="rounded-2xl border border-line bg-surface p-5 shadow-card">
              <span className="flex items-center gap-3">
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-blush text-maroon">
                  <Icon className="h-5 w-5" />
                </span>
                <span className="text-2xl font-semibold tracking-tight text-ink-soft">{i + 1}</span>
              </span>
              <h3 className="h-card mt-4">{title}</h3>
              <p className="body-copy mt-1.5 text-sm">{text}</p>
            </li>
          ))}
        </ol>

        <div className="mt-8 flex flex-col items-start gap-5 overflow-hidden rounded-3xl bg-ink p-7 text-white shadow-float md:flex-row md:items-center md:justify-between md:p-10">
          <div className="max-w-xl">
            <h2 className="h-section">Punya kebutuhan untuk bisnismu?</h2>
            <p className="mt-2 text-sm leading-relaxed text-white/70">
              Pasang peluang, biar lulusan yang tepat datang sendiri. Bisa dipasang walau kamu belum memasang bisnis.
            </p>
          </div>
          <Button href={NEW_PELUANG} size="lg" className="shrink-0">
            <Plus className="h-4 w-4" /> Pasang peluang
          </Button>
        </div>
      </Container>
    </>
  );
}
