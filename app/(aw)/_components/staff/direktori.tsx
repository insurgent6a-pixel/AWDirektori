"use client";

// The whole directory for staff, as two lists over the same data: every account with the businesses it owns
// (Akun), and every business with whether the public sees it and, when not, why (Bisnis).
// The numbers on Ringkasan open these lists, so "Bisnis tayang" and "Semua bisnis" can be told apart by looking.

import { ExternalLink, Store, Users } from "lucide-react";
import Link from "next/link";
import { VERIFICATION_LABELS } from "../../_lib/constants";
import { programLabels, tanggal, waLink } from "../../_lib/format";
import { useQuery, useUrlFilters } from "../../_lib/hooks";
import { supabase } from "../../_lib/supabase";
import type { Enums } from "../../_lib/types";
import { Avatar, Badge, Card, Chip, Empty, Failed, SearchInput, Skeleton } from "../ui";
import { ReviewNote, SectionTitle } from "./shared";
import { type Member, VERIFICATION_TONES } from "./verifikasi";

type Business = {
  id: string;
  owner_id: string;
  name: string | null;
  category: string;
  category_other: string | null;
  online_only: boolean;
  status: Enums<"review_status">;
  active: boolean;
  visible: boolean;
  review_note: string | null;
  created_at: string;
  locations: { city: string }[];
};

// Why the public does not see a business. Null while it is live.
const hiddenBecause = (b: Business) =>
  b.visible
    ? null
    : b.status === "approved"
      ? b.active
        ? "Belum disetujui pemiliknya untuk tayang"
        : "Dimatikan pemiliknya"
      : { draft: "Draf, belum dikirim pemiliknya", pending: "Menunggu tinjauan staf", rejected: "Ditolak staf", suspended: "Ditangguhkan staf" }[b.status];

const Tayang = ({ business }: { business: Business }) => (
  <Badge tone={business.visible ? "green" : "gray"}>{business.visible ? "Tayang" : "Tidak tayang"}</Badge>
);

const has = (needle: string, ...texts: (string | null | undefined)[]) => texts.some((t) => t?.toLowerCase().includes(needle));

// ponytail: both lists are read whole and filtered in the browser (the API hands out at most 1000 rows). Move the
// search into the database when the directory nears that.
function useDirectory() {
  const users = useQuery(() => supabase.rpc("staff_users").overrideTypes<Member[], { merge: false }>(), []);
  const businesses = useQuery(
    () =>
      supabase
        .from("businesses")
        .select("id, owner_id, name, category, category_other, online_only, status, active, visible, review_note, created_at, locations(city)")
        .order("created_at", { ascending: false })
        .overrideTypes<Business[], { merge: false }>(),
    [],
  );
  const owners = new Map((users.data ?? []).map((u) => [u.id, u]));
  // The public name: the owner's when the business has none of its own.
  const nameOf = (b: Business) => b.name?.trim() || owners.get(b.owner_id)?.full_name || "Bisnis tanpa nama";
  return { users, businesses, owners, nameOf, loading: (users.loading && !users.data) || (businesses.loading && !businesses.data) };
}

const ACCOUNT_FILTERS: Enums<"verification_status">[] = ["approved", "pending", "rejected", "draft"];

export function AkunStaf() {
  const { users, businesses, nameOf, loading } = useDirectory();
  const { params, setFilter, q, setQ } = useUrlFilters("/staff");
  const status = params.get("status");
  const needle = q.trim().toLowerCase();

  const all = users.data ?? [];
  const owned = (id: string) => (businesses.data ?? []).filter((b) => b.owner_id === id);
  const list = all.filter(
    (u) =>
      (!status || (u.role === "member" && u.verification === status)) &&
      (!needle || has(needle, u.full_name, u.nickname, u.email, u.phone, ...programLabels(u), ...owned(u.id).map(nameOf))),
  );

  return (
    <section>
      <SectionTitle title="Akun">Semua akun yang terdaftar: kontak, status verifikasi, dan bisnis milik masing-masing.</SectionTitle>

      <div className="no-scrollbar -mx-4 mt-2.5 -mb-1.5 flex gap-2 overflow-x-auto px-4 py-1.5 sm:mx-0 sm:px-0">
        <Chip active={!status} onClick={() => setFilter({ status: null })}>
          Semua akun <span className="opacity-75">{all.length}</span>
        </Chip>
        {ACCOUNT_FILTERS.map((s) => (
          <Chip key={s} active={status === s} onClick={() => setFilter({ status: s })}>
            {VERIFICATION_LABELS[s]} <span className="opacity-75">{all.filter((u) => u.role === "member" && u.verification === s).length}</span>
          </Chip>
        ))}
      </div>
      <SearchInput className="mt-3" value={q} onChange={setQ} placeholder="Cari nama, email, WhatsApp, atau bisnis" />

      <div className="mt-4 space-y-3">
        <Failed query={users} />
        <Failed query={businesses} />
        {loading ? (
          [0, 1, 2].map((i) => <Skeleton key={i} className="h-36" />)
        ) : list.length === 0 ? (
          <Empty icon={<Users className="h-6 w-6" />} title="Tidak ada akun">
            Tidak ada akun yang cocok dengan pencarian atau status ini.
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
                    {u.role === "staff" ? <Badge tone="solid">Staf</Badge> : <Badge tone={VERIFICATION_TONES[u.verification]}>{VERIFICATION_LABELS[u.verification]}</Badge>}
                  </p>
                  {u.role === "member" && <p className="mt-0.5 text-[13px] text-ink-soft">{programLabels(u).join(", ") || "Program belum dipilih"}</p>}
                  <p className="flex flex-wrap items-center gap-x-4 text-[13px] text-ink-soft">
                    {u.email && (
                      <a href={`mailto:${u.email}`} className="tap-soft inline-flex min-h-10 items-center hover:text-maroon">
                        {u.email}
                      </a>
                    )}
                    {u.phone && (
                      <a href={waLink(u.phone)} target="_blank" rel="noopener noreferrer" className="tap-soft inline-flex min-h-10 items-center hover:text-maroon">
                        WhatsApp {u.phone}
                      </a>
                    )}
                    <span>Mendaftar {tanggal(u.created_at)}</span>
                  </p>
                </div>
              </div>

              {u.role === "member" && (
                <div className="mt-2 border-t border-line pt-3">
                  {owned(u.id).length === 0 ? (
                    <p className="text-[13px] text-ink-soft">Belum punya bisnis di direktori.</p>
                  ) : (
                    <ul className="space-y-2">
                      {owned(u.id).map((b) => (
                        <li key={b.id} className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                          <Store className="h-4 w-4 shrink-0 text-maroon" />
                          {/* The search box of Bisnis, filled in: the one place with the listing's full state. */}
                          <Link href={`/staff?tab=bisnis&q=${encodeURIComponent(nameOf(b))}`} className="tap-soft font-medium hover:text-maroon hover:underline">
                            {nameOf(b)}
                          </Link>
                          <Tayang business={b} />
                          {!b.visible && <span className="text-[13px] text-ink-soft">{hiddenBecause(b)}</span>}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </Card>
          ))
        )}
      </div>
    </section>
  );
}

export function BisnisStaf() {
  const { users, businesses, owners, nameOf, loading } = useDirectory();
  const { params, setFilter, q, setQ } = useUrlFilters("/staff");
  const show = params.get("tampil"); // "tayang", "tidak", or everything
  const needle = q.trim().toLowerCase();

  const all = businesses.data ?? [];
  const live = all.filter((b) => b.visible).length;
  const list = all.filter((b) => {
    const owner = owners.get(b.owner_id);
    return (
      (!show || b.visible === (show === "tayang")) &&
      (!needle || has(needle, nameOf(b), b.category, b.category_other, owner?.full_name, owner?.nickname, owner?.email, ...b.locations.map((l) => l.city)))
    );
  });

  return (
    <section>
      <SectionTitle title="Bisnis">
        Semua bisnis di direktori. Yang tayang terlihat publik. Yang tidak tayang masih draf, menunggu tinjauan, ditolak, ditangguhkan, atau dimatikan
        pemiliknya.
      </SectionTitle>

      <div className="no-scrollbar -mx-4 mt-2.5 -mb-1.5 flex gap-2 overflow-x-auto px-4 py-1.5 sm:mx-0 sm:px-0">
        <Chip active={!show} onClick={() => setFilter({ tampil: null })}>
          Semua bisnis <span className="opacity-75">{all.length}</span>
        </Chip>
        <Chip active={show === "tayang"} onClick={() => setFilter({ tampil: "tayang" })}>
          Tayang <span className="opacity-75">{live}</span>
        </Chip>
        <Chip active={show === "tidak"} onClick={() => setFilter({ tampil: "tidak" })}>
          Tidak tayang <span className="opacity-75">{all.length - live}</span>
        </Chip>
      </div>
      <SearchInput className="mt-3" value={q} onChange={setQ} placeholder="Cari bisnis, pemilik, kategori, atau kota" />

      <div className="mt-4 space-y-3">
        <Failed query={businesses} />
        <Failed query={users} />
        {loading ? (
          [0, 1, 2].map((i) => <Skeleton key={i} className="h-24" />)
        ) : list.length === 0 ? (
          <Empty icon={<Store className="h-6 w-6" />} title="Tidak ada bisnis">
            Tidak ada bisnis yang cocok dengan pencarian atau pilihan ini.
          </Empty>
        ) : (
          list.map((b) => {
            const owner = owners.get(b.owner_id);
            return (
              <Card key={b.id} className="p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold">{nameOf(b)}</h3>
                  <Tayang business={b} />
                  {!b.visible && <span className="text-[13px] text-ink-soft">{hiddenBecause(b)}</span>}
                </div>
                <p className="mt-1 text-[13px] text-ink-soft">
                  {b.category === "Lainnya" && b.category_other ? b.category_other : b.category}
                  {", "}
                  {b.online_only || !b.locations.length ? "online saja" : [...new Set(b.locations.map((l) => l.city))].join(", ")}
                  {", dibuat "}
                  {tanggal(b.created_at)}
                </p>
                <ReviewNote note={b.visible ? null : b.review_note} />
                <p className="flex flex-wrap items-center gap-x-4 text-[13px]">
                  {owner && (
                    <Link
                      href={`/staff?tab=akun&q=${encodeURIComponent(owner.email ?? owner.full_name)}`}
                      className="tap-soft inline-flex min-h-10 items-center font-medium text-maroon hover:underline"
                    >
                      Pemilik: {owner.full_name || "Tanpa nama"}
                    </Link>
                  )}
                  {b.visible && (
                    <Link href={`/bisnis/${b.id}`} className="tap-soft inline-flex min-h-10 items-center gap-1 font-medium text-maroon hover:underline">
                      Lihat halamannya <ExternalLink className="h-3 w-3" />
                    </Link>
                  )}
                  {b.status === "pending" && (
                    <Link href="/staff?tab=moderasi" className="tap-soft inline-flex min-h-10 items-center font-medium text-maroon hover:underline">
                      Tinjau di Moderasi
                    </Link>
                  )}
                </p>
              </Card>
            );
          })
        )}
      </div>
    </section>
  );
}
