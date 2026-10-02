"use client";

// The cards every page shares, so a business, a peluang or an event looks the same wherever it shows up.

import { BadgeCheck, CalendarClock, Clock, MapPin, Tag, UserRound, Users } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { EVENT_KINDS, PELUANG_KINDS, SERVICE_TYPES } from "../_lib/constants";
import { useAuth } from "../_lib/auth";
import { batchLabel, bulanPendek, cn, hari, jam, jarak, programLabels, sisaHari, tanggalPendek } from "../_lib/format";
import { useQuery } from "../_lib/hooks";
import { peluangFeed, searchBusinesses } from "../_lib/queries";
import { supabase } from "../_lib/supabase";
import type { Business, EventItem, Graduate, Peluang, Story } from "../_lib/types";
import { ConnectButton, ReportButton, RsvpButton, SaveButton } from "./actions";
import { Avatar, Badge, Button, Failed, Media, Sheet, Skeleton } from "./ui";

// Entrance delay for item n of a list, capped so a long list does not keep its last cards waiting.
export const stagger = (index = 0) => ({ "--i": Math.min(index, 12) }) as React.CSSProperties;

// "Jakarta Selatan +2", "Online", with the distance when the search was by location.
export function placeLabel(business: Business) {
  if (business.online_only || !business.locations.length) return "Online";
  const more = business.locations.length - 1;
  return business.locations[0].city + (more ? ` +${more}` : "");
}

export function PerkNote({ perk, className }: { perk: string; className?: string }) {
  return (
    <p className={cn("flex items-start gap-2 rounded-xl bg-gold-soft px-3 py-2 text-[12px] leading-snug", className)}>
      <Tag className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gold" />
      <span>
        <b className="font-semibold text-gold">GLP Perk:</b> {perk}
      </span>
    </p>
  );
}

// ── Business ────────────────────────────────────────────────────────

// Grid card (Lulusan page, saved list).
export function BusinessCard({ business, index }: { business: Business; index?: number }) {
  const href = `/bisnis/${business.id}`;
  return (
    <article
      className="rise lift relative flex flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-card"
      style={stagger(index)}
    >
      <Link href={href} className="tap-soft relative block" tabIndex={-1} aria-hidden>
        <Media path={business.image_path} name={business.name} className="aspect-[4/3]" />
        {batchLabel(business) && (
          <span className="absolute top-3 left-0 rounded-r-full bg-maroon py-1 pr-3 pl-2.5 text-[11px] font-semibold text-white">
            {batchLabel(business)}
          </span>
        )}
      </Link>
      <SaveButton kind="business" id={business.id} floating className="absolute top-2.5 right-2.5" />
      <div className="flex flex-1 flex-col p-4">
        <p className="flex items-center gap-1.5 text-[11px] font-medium tracking-wide text-ink-soft uppercase">
          <span className="truncate">{business.category}</span>
          <span aria-hidden>·</span>
          <span className="shrink-0">{placeLabel(business)}</span>
        </p>
        <h3 className="h-card mt-1.5">
          <Link href={href} className="tap-soft -my-2 inline-block py-2 hover:text-maroon">
            {business.name}
          </Link>
        </h3>
        {/* a div, not a p: the name carries its sheet, and a dialog cannot sit inside a paragraph */}
        <div className="mt-1 flex items-center gap-1.5 text-[13px]">
          <OwnerName id={business.owner_id} name={business.owner_name} businessId={business.id} className="text-maroon" />
          <BadgeCheck className="h-4 w-4 text-maroon" aria-label="Lulusan terverifikasi" />
          {business.service_type && <span className="text-ink-soft">· {SERVICE_TYPES[business.service_type]}</span>}
        </div>
        <p className="body-copy mt-2 line-clamp-3 text-[13px]">{business.description}</p>
        {business.perk && <PerkNote perk={business.perk} className="mt-3" />}
        <div className="mt-auto grid grid-cols-2 gap-2 pt-4">
          <ConnectButton businessId={business.id} ownerId={business.owner_id} targetName={business.name} size="sm" />
          <Button href={href} variant="secondary" size="sm">
            Lihat detail
          </Button>
        </div>
      </div>
    </article>
  );
}

// Compact row (directory list beside the map).
export function BusinessRow({
  business,
  active,
  onActivate,
  index,
}: {
  business: Business;
  active?: boolean;
  onActivate?: () => void;
  index?: number;
}) {
  return (
    <Link
      href={`/bisnis/${business.id}`}
      onMouseEnter={onActivate}
      onFocus={onActivate}
      className={cn(
        "rise tap-soft flex gap-3 rounded-xl border p-3",
        active ? "border-blush-line bg-blush" : "border-line bg-surface hover:bg-page",
      )}
      style={stagger(index)}
    >
      <Media path={business.image_path} name={business.name} className="h-14 w-14 shrink-0 rounded-lg [&_span]:text-lg" />
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className="truncate text-sm font-semibold">{business.name}</p>
          {batchLabel(business) && <Badge className="shrink-0">{batchLabel(business)}</Badge>}
        </div>
        <p className="truncate text-[12px] text-ink-soft">
          {business.owner_name} · {business.category}
        </p>
        <p className="mt-0.5 truncate text-[12px] text-ink-soft">{business.description}</p>
        <div className="mt-2 flex items-center justify-between gap-3 text-[12px]">
          <span className="flex min-w-0 items-center gap-1 text-ink-soft">
            <MapPin className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">
              {placeLabel(business)}
              {business.distance_km != null && ` · ${jarak(business.distance_km)}`}
            </span>
          </span>
          {business.perk && <span className="max-w-[55%] truncate font-semibold text-maroon">{business.perk}</span>}
        </div>
      </div>
    </Link>
  );
}

// ── Lulusan ─────────────────────────────────────────────────────────

// The person behind a card. A tap on the name opens them in a sheet: programs, every live business, open Peluang.
// businessId / peluangId: the card the name sits on, which is what Hubungkan in the sheet is about.
export function OwnerName({
  id,
  name,
  businessId,
  peluangId,
  className,
}: {
  id: string;
  name: string;
  businessId?: string;
  peluangId?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        className={cn("tap -my-2.5 min-w-0 py-2.5 text-left font-semibold underline-offset-4 hover:underline", className)}
      >
        {name}
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Profil lulusan">
        <OwnerProfile id={id} name={name} businessId={businessId} peluangId={peluangId} onLeave={() => setOpen(false)} />
      </Sheet>
    </>
  );
}

function OwnerProfile({
  id,
  name,
  businessId,
  peluangId,
  onLeave,
}: {
  id: string;
  name: string;
  businessId?: string;
  peluangId?: string;
  onLeave: () => void;
}) {
  const { isStaff } = useAuth();
  // graduate_feed is public and only holds people who already show a business or a Peluang.
  const person = useQuery<Graduate>(
    () => supabase.from("graduate_feed").select("*").eq("id", id).maybeSingle().overrideTypes<Graduate, { merge: false }>(),
    [id],
  );
  // ponytail: the whole directory (one page of 200) filtered here. Give search_businesses an owner filter beyond that.
  const directory = useQuery(() => searchBusinesses(), []);
  const peluang = useQuery(() => peluangFeed(id), [id]);
  const businesses = directory.data?.filter((b) => b.owner_id === id) ?? [];
  const fullName = person.data?.full_name || name;
  const nickname = person.data?.nickname;

  return (
    <div className="pb-1">
      <div className="flex items-center gap-3.5">
        <Avatar name={fullName} className="h-14 w-14 text-lg" />
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-lg leading-snug font-semibold tracking-tight">
            <span className="truncate">{fullName}</span>
            <BadgeCheck className="h-[18px] w-[18px] shrink-0 text-maroon" aria-label="Lulusan terverifikasi" />
          </p>
          {nickname && nickname !== fullName && <p className="text-[13px] text-ink-soft">Biasa dipanggil {nickname}</p>}
          {person.data && (
            <p className="mt-1.5 flex flex-wrap gap-1.5">
              {programLabels(person.data).map((label) => (
                <Badge key={label} tone={label.startsWith("LP") ? "maroon" : "gray"}>
                  {label}
                </Badge>
              ))}
            </p>
          )}
        </div>
      </div>

      {/* A tap on a row leaves for that page; the sheet closes too, for when it is the page already open. */}
      <div className="mt-5 space-y-5" onClick={(e) => (e.target as HTMLElement).closest("a") && onLeave()}>
        <section>
          <h3 className="text-[13px] font-semibold">Bisnis{businesses.length > 1 ? ` (${businesses.length})` : ""}</h3>
          <div className="mt-2 space-y-2">
            <Failed query={directory} />
            {directory.loading ? (
              <Skeleton className="h-24" />
            ) : businesses.length ? (
              businesses.map((b) => <BusinessRow key={b.id} business={b} />)
            ) : (
              !directory.error && <p className="text-[13px] text-ink-soft">Belum ada bisnis yang tayang.</p>
            )}
          </div>
        </section>

        {!!peluang.data?.length && (
          <section>
            <h3 className="text-[13px] font-semibold">Peluang terbuka</h3>
            <div className="mt-2 space-y-2">
              {peluang.data.map((p) => (
                <Link key={p.id} href="/peluang" className="tap-soft block rounded-xl border border-line p-3 hover:bg-page">
                  <p className="truncate text-sm font-semibold">{p.title}</p>
                  <p className="truncate text-[12px] text-ink-soft">
                    Mencari {PELUANG_KINDS[p.kind].toLowerCase()}
                    {p.deadline ? `, sampai ${tanggalPendek(p.deadline)}` : ""}
                  </p>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>

      {!isStaff && (businessId || peluangId) && (
        <ConnectButton businessId={businessId} peluangId={peluangId} ownerId={id} targetName={nickname || name} size="lg" full className="mt-5" />
      )}
    </div>
  );
}

// ── Peluang ─────────────────────────────────────────────────────────

export function PeluangCard({ peluang, index }: { peluang: Peluang; index?: number }) {
  const sisa = sisaHari(peluang.deadline);
  const urgent = !!peluang.deadline && new Date(peluang.deadline).getTime() - Date.now() < 7 * 86_400_000;
  return (
    <article className="rise lift flex flex-col rounded-2xl border border-line bg-surface p-5 shadow-card" style={stagger(index)}>
      <div className="flex items-center justify-between gap-2">
        <Badge tone="gold">Mencari {PELUANG_KINDS[peluang.kind].toLowerCase()}</Badge>
        {sisa && (
          <Badge tone={urgent ? "red" : "gray"}>
            <Clock className="h-3 w-3" /> {sisa}
          </Badge>
        )}
      </div>
      <h3 className="h-card mt-3 text-[19px]">{peluang.title}</h3>
      <div className="mt-3 flex items-center gap-3 rounded-xl bg-page p-2.5">
        <Avatar name={peluang.owner_name} />
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-sm font-semibold">
            <OwnerName id={peluang.owner_id} name={peluang.owner_name} peluangId={peluang.id} className="truncate hover:text-maroon" />
            {peluang.batch_lp && <Badge>LP {peluang.batch_lp}</Badge>}
            <BadgeCheck className="h-4 w-4 shrink-0 text-maroon" aria-label="Lulusan terverifikasi" />
          </div>
          {peluang.business_id && peluang.business_name && (
            <Link href={`/bisnis/${peluang.business_id}`} className="tap-soft -my-2.5 block truncate py-2.5 text-[12px] text-ink-soft hover:text-maroon">
              {peluang.business_name}
            </Link>
          )}
        </div>
      </div>
      <p className="body-copy mt-3 line-clamp-3 text-[13px]">{peluang.description}</p>
      <dl className="mt-4 grid grid-cols-3 gap-1.5 rounded-xl bg-page p-1.5 text-[12px]">
        <Fact label="Lokasi">{peluang.area ?? "Di mana saja"}</Fact>
        <Fact label="Batas waktu">{peluang.deadline ? tanggalPendek(peluang.deadline) : "Terbuka"}</Fact>
        <Fact label="Peminat">
          <Users className="mr-1 inline h-3.5 w-3.5 text-maroon" />
          {peluang.interested} lulusan
        </Fact>
      </dl>
      <div className="mt-auto flex gap-2 pt-4">
        <div className="min-w-0 flex-1">
          <ConnectButton peluangId={peluang.id} ownerId={peluang.owner_id} targetName={peluang.owner_name} label="Saya berminat" full />
        </div>
        <SaveButton kind="peluang" id={peluang.id} />
        <ReportButton peluangId={peluang.id} icon />
      </div>
    </article>
  );
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0 rounded-lg bg-surface px-2.5 py-2">
      <dt className="text-[10px] font-medium tracking-wide text-ink-soft uppercase">{label}</dt>
      <dd className="mt-0.5 line-clamp-2 leading-tight font-semibold break-words">{children}</dd>
    </div>
  );
}

// ── Acara ───────────────────────────────────────────────────────────

export function seatsLabel(event: Pick<EventItem, "capacity" | "going" | "waitlist">) {
  if (event.capacity == null) return { text: "Terbuka", tone: "gray" as const };
  const left = event.capacity - event.going;
  if (left <= 0) return { text: event.waitlist ? `Penuh · ${event.waitlist} menunggu` : "Penuh", tone: "amber" as const };
  return { text: `Sisa ${left} kursi`, tone: left <= 5 ? ("red" as const) : ("green" as const) };
}

export function DateBlock({ date, className }: { date: string; className?: string }) {
  return (
    <span className={cn("grid h-14 w-14 shrink-0 place-content-center rounded-xl bg-maroon text-center text-white shadow-button", className)}>
      <span className="text-xl leading-none font-semibold tracking-tight">{new Date(date).getDate()}</span>
      <span className="mt-1 text-[10px] font-semibold tracking-widest uppercase">{bulanPendek(date)}</span>
    </span>
  );
}

export function EventCard({
  event,
  rsvp,
  onChanged,
  index,
}: {
  event: EventItem;
  rsvp: "going" | "waitlist" | null;
  onChanged: () => void;
  index?: number;
}) {
  const seats = seatsLabel(event);
  return (
    <article className="rise lift flex flex-col rounded-2xl border border-line bg-surface shadow-card" style={stagger(index)}>
      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-start gap-3">
          <DateBlock date={event.starts_at} />
          <div className="min-w-0 flex-1">
            <p className="eyebrow">{EVENT_KINDS[event.kind]}</p>
            {/* One wrapping row: on a narrow card the seats drop under the city instead of pushing the card wider. */}
            <div className="mt-1.5 flex flex-wrap justify-between gap-1.5">
              <Badge tone="gray">{event.city}</Badge>
              <Badge tone={seats.tone}>{seats.text}</Badge>
            </div>
          </div>
        </div>
        <h3 className="h-card mt-4">{event.title}</h3>
        <p className="body-copy mt-2 line-clamp-3 text-[13px]">{event.description}</p>
        <ul className="mt-4 space-y-1.5 text-[13px] text-ink-soft">
          <li className="flex items-center gap-2">
            <CalendarClock className="h-4 w-4 shrink-0 text-maroon" />
            <span>
              {hari(event.starts_at)}, {jam(event.starts_at)}
            </span>
          </li>
          <li className="flex items-center gap-2">
            <MapPin className="h-4 w-4 shrink-0 text-maroon" />
            <span className="truncate">{event.venue}</span>
          </li>
          {event.host_name && (
            <li className="flex items-center gap-2">
              <UserRound className="h-4 w-4 shrink-0 text-maroon" />
              <span className="truncate">
                Tuan rumah: {event.host_name}
                {event.host_lp ? ` (LP ${event.host_lp})` : ""}
              </span>
            </li>
          )}
        </ul>
      </div>
      <div className="flex items-center justify-between gap-3 rounded-b-2xl border-t border-line bg-page px-5 py-3">
        <p className="min-w-0">
          <span className="block text-[10px] font-medium tracking-wide text-ink-soft uppercase">Biaya</span>
          <span className="block truncate text-[13px] font-semibold text-maroon">{event.fee || "Gratis"}</span>
        </p>
        <RsvpButton event={event} status={rsvp} onChanged={onChanged} />
      </div>
    </article>
  );
}

// ── Cerita ──────────────────────────────────────────────────────────

export function StoryCard({ story, index }: { story: Story; index?: number }) {
  const [open, setOpen] = useState(false);
  // Whether the closed text is really cut. Measured, not guessed from its length: a short text with line breaks can
  // be cut, and a long one fits on a wide card.
  const body = useRef<HTMLParagraphElement>(null);
  const [cut, setCut] = useState(false);
  useEffect(() => {
    const p = body.current;
    if (p && !open) setCut(p.scrollHeight > p.clientHeight + 1);
  }, [story.body, open]);
  return (
    <article
      className="rise flex flex-col gap-4 rounded-2xl border border-line bg-surface p-4 shadow-card sm:flex-row"
      style={stagger(index)}
    >
      <Media path={story.image_path} name={story.title} className="aspect-[16/10] shrink-0 rounded-xl sm:aspect-square sm:w-36" />
      <div className="min-w-0">
        {/* Thumbs get a 40px row per name. The room is added to the row itself, not pulled in with a negative margin:
            when the two names wrap, pulled-in tap areas overlap and a tap on the first name opens the second. */}
        <p className="eyebrow pointer-coarse:-my-3">
          <Link href={`/bisnis/${story.business_a}`} className="tap inline-block hover:underline pointer-coarse:py-3">
            {story.name_a}
          </Link>{" "}
          ×{" "}
          <Link href={`/bisnis/${story.business_b}`} className="tap inline-block hover:underline pointer-coarse:py-3">
            {story.name_b}
          </Link>
        </p>
        <h3 className="h-card mt-1.5">{story.title}</h3>
        <p ref={body} className={cn("body-copy mt-2 text-[13px]", open ? "whitespace-pre-line" : "line-clamp-3")}>
          {story.body}
        </p>
        {(cut || open) && (
          <button
            type="button"
            onClick={() => setOpen(!open)}
            aria-expanded={open}
            className="tap mt-1 inline-flex min-h-10 items-center text-[13px] font-semibold text-maroon underline-offset-4 hover:underline"
          >
            {open ? "Tutup" : "Baca selengkapnya"}
          </button>
        )}
      </div>
    </article>
  );
}
