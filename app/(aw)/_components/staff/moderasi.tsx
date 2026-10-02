"use client";

// Moderation: approve, reject, suspend or reinstate listings; review Peluang and Promo; handle reports and
// introduction requests. A suspended listing disappears everywhere at once (the database's feeds enforce that).

import { ExternalLink, Phone } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { REVIEW_LABELS, REVIEW_TONES } from "../../_lib/constants";
import { linkName, pesan, safeUrl, tanggal } from "../../_lib/format";
import { useQuery } from "../../_lib/hooks";
import { supabase } from "../../_lib/supabase";
import type { Enums } from "../../_lib/types";
import { Badge, Card, Chip, Failed, Media, Skeleton, toast, useKeepInView } from "../ui";
import { LaporanQueue, PeluangQueue, PerkenalanQueue, PromoQueue } from "./moderasi-antrean";
import { Decide, type Overview, type Person, personLabel, QueueEmpty, ReviewNote, SectionTitle, type Status, StatusFilter } from "./shared";

const QUEUES = [
  ["bisnis", "Bisnis", "businesses_pending"],
  ["peluang", "Peluang", "peluang_pending"],
  ["promo", "Promo", "promos_pending"],
  ["laporan", "Laporan", "reports_open"],
  ["perkenalan", "Perkenalan", "intros"],
] as const;

export function Moderasi({ overview, onChanged }: { overview: Overview | null; onChanged: () => void }) {
  const router = useRouter();
  const params = useSearchParams();
  const queue = QUEUES.find(([key]) => key === params.get("antrean"))?.[0] ?? "bisnis";
  const rail = useKeepInView<HTMLDivElement>([queue, overview]); // phones: the open queue's chip stays on screen

  return (
    <section>
      <SectionTitle title="Moderasi">Tayang butuh dua hal: persetujuan pemilik (diberikan saat mengirim) dan persetujuan staf.</SectionTitle>
      <div ref={rail} role="group" aria-label="Antrean moderasi" className="no-scrollbar -mx-4 mt-2.5 -mb-1.5 flex gap-2 overflow-x-auto px-4 py-1.5 sm:mx-0 sm:px-0">
        {QUEUES.map(([key, label, count]) => (
          <Chip key={key} active={queue === key} onClick={() => router.replace(`/staff?tab=moderasi&antrean=${key}`, { scroll: false })}>
            {label}
            {!!overview?.[count] && <span className="rounded-full bg-blush px-1.5 text-[11px] font-semibold text-maroon">{overview[count]}</span>}
          </Chip>
        ))}
      </div>
      <div key={queue} className="mt-4">
        {queue === "bisnis" && <BisnisQueue onChanged={onChanged} />}
        {queue === "peluang" && <PeluangQueue onChanged={onChanged} />}
        {queue === "promo" && <PromoQueue onChanged={onChanged} />}
        {queue === "laporan" && <LaporanQueue onChanged={onChanged} />}
        {queue === "perkenalan" && <PerkenalanQueue onChanged={onChanged} />}
      </div>
    </section>
  );
}

type BusinessRow = {
  id: string;
  name: string | null;
  description: string;
  category: string;
  category_other: string | null;
  links: string[];
  image_path: string | null;
  online_only: boolean;
  status: Status;
  review_note: string | null;
  active: boolean;
  created_at: string;
  owner: Person;
  locations: { city: string; area: string; mode: Enums<"location_mode"> }[];
};

function BisnisQueue({ onChanged }: { onChanged: () => void }) {
  const [status, setStatus] = useState<Status>("pending");
  const [contacts, setContacts] = useState<Record<string, string>>({});
  const list = useQuery(
    () =>
      supabase
        .from("businesses")
        .select(
          "id, name, description, category, category_other, links, image_path, online_only, status, review_note, active, created_at, owner:profiles!businesses_owner_id_fkey(full_name, nickname, batch_lp), locations(city, area, mode)",
        )
        .eq("status", status)
        .order("created_at")
        .overrideTypes<BusinessRow[], { merge: false }>(),
    [status],
  );
  const done = () => {
    list.reload();
    onChanged();
  };
  // Staff reading a contact leaves no trace in the owner's statistics.
  const reveal = async (id: string) => {
    const { data, error } = await supabase.rpc("view_contact", { p_business: id });
    if (error) return toast(pesan(error), "error");
    setContacts((c) => ({ ...c, [id]: data || "Belum diisi" }));
  };

  return (
    <>
      <StatusFilter value={status} onChange={setStatus} />
      <Failed query={list} />
      <div className="space-y-3">
        {list.loading && !list.data ? (
          [0, 1].map((i) => <Skeleton key={i} className="h-44" />)
        ) : !list.data?.length ? (
          <QueueEmpty status={status} />
        ) : (
          list.data.map((b) => {
            const name = b.name?.trim() || b.owner?.full_name || "Bisnis tanpa nama";
            return (
              <Card key={b.id} className="p-4">
                <div className="flex items-start gap-4">
                  <Media path={b.image_path} name={name} className="h-20 w-20 shrink-0 rounded-xl [&_span]:text-2xl" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold">{name}</h3>
                      <Badge tone={REVIEW_TONES[b.status]}>{REVIEW_LABELS[b.status]}</Badge>
                      {b.status === "approved" && !b.active && <Badge tone="gray">Dimatikan pemilik</Badge>}
                    </div>
                    <p className="mt-0.5 text-[13px] text-ink-soft">
                      {personLabel(b.owner)} · {b.category === "Lainnya" && b.category_other ? b.category_other : b.category} · dibuat{" "}
                      {tanggal(b.created_at)}
                    </p>
                    <p className="body-copy mt-2 text-[13px] whitespace-pre-line">{b.description}</p>
                    <p className="mt-2 text-[13px] text-ink-soft">
                      Lokasi:{" "}
                      {b.online_only
                        ? "Online saja"
                        : b.locations.length
                          ? b.locations.map((l) => `${l.city} (${l.area}${l.mode === "area" ? ", perkiraan" : ""})`).join(", ")
                          : "belum ada"}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-x-4 text-[13px]">
                      {b.links.map((url) => (
                        <a
                          key={url}
                          href={safeUrl(url)}
                          target="_blank"
                          rel="noopener noreferrer nofollow"
                          className="tap-soft inline-flex min-h-10 items-center gap-1 font-medium text-maroon hover:underline"
                        >
                          {linkName(url)} <ExternalLink className="h-3 w-3" />
                        </a>
                      ))}
                      {contacts[b.id] ? (
                        <span className="inline-flex min-h-10 items-center font-medium">Kontak: {contacts[b.id]}</span>
                      ) : (
                        <button type="button" onClick={() => reveal(b.id)} className="tap inline-flex min-h-10 items-center gap-1 font-medium text-maroon underline-offset-2 hover:underline">
                          <Phone className="h-3 w-3" /> Lihat kontak
                        </button>
                      )}
                    </div>
                    <ReviewNote note={b.review_note} />
                  </div>
                </div>
                <div className="mt-3 border-t border-line pt-3">
                  <Decide kind="business" id={b.id} status={b.status} onDone={done} />
                </div>
              </Card>
            );
          })
        )}
      </div>
    </>
  );
}
