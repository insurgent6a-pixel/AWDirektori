"use client";

// Acara: meetups, workshops and gatherings with RSVP, plus collaboration stories (Cerita) and "offer to host".

import { CalendarClock, CalendarDays, CalendarPlus, MapPin, UserRound } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Gate, RsvpButton } from "../_components/actions";
import { EventCard, seatsLabel, StoryCard } from "../_components/cards";
import { Container, PageHero } from "../_components/shell";
import { Badge, Button, Card, Chip, Empty, Field, Input, Media, Notice, SearchInput, Select, Sheet, Skeleton, Textarea, Toggle, toast } from "../_components/ui";
import { useAuth } from "../_lib/auth";
import { EVENT_KINDS } from "../_lib/constants";
import { hari, jam, localInput } from "../_lib/format";
import { useQuery } from "../_lib/hooks";
import { eventFeed, myRsvps, storyFeed } from "../_lib/queries";
import { supabase } from "../_lib/supabase";
import type { Enums, EventItem } from "../_lib/types";

type Kind = Enums<"event_kind">;

export default function AcaraPage() {
  const { user, isStaff } = useAuth();
  const events = useQuery(() => eventFeed(), []);
  const stories = useQuery(storyFeed, []);
  const rsvps = useQuery(user ? () => myRsvps(user.id) : null, [user?.id]);
  const [q, setQ] = useState("");
  const [kind, setKind] = useState<Kind | "">("");
  const [city, setCity] = useState("");
  const [seatsOnly, setSeatsOnly] = useState(false);
  const [hosting, setHosting] = useState(false);

  const all = events.data ?? [];
  const cities = useMemo(() => [...new Set(all.map((e) => e.city))].sort(), [all]);
  // ponytail: filtered in the browser, fine for a few hundred events. Move to a search RPC beyond that.
  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return all.filter(
      (e) =>
        (!kind || e.kind === kind) &&
        (!city || e.city === city) &&
        (!seatsOnly || e.capacity == null || e.going < e.capacity) &&
        (!needle || [e.title, e.description, e.venue, e.city, e.host_name].some((text) => text?.toLowerCase().includes(needle))),
    );
  }, [all, q, kind, city, seatsOnly]);

  const filtered = !!(q || kind || city || seatsOnly);
  const [featured, ...rest] = list;
  const refresh = () => {
    events.reload();
    rsvps.reload();
  };
  const statusOf = (event: EventItem) => rsvps.data?.get(event.id) ?? null;

  // "/acara#cerita" (the Cerita shortcut on the home page): the section only exists once its data is in, so the
  // browser's own jump to the hash finds nothing. Jump once, when the page has its content.
  const jumped = useRef(false);
  useEffect(() => {
    if (jumped.current || window.location.hash !== "#cerita" || !stories.data || events.loading) return;
    jumped.current = true;
    document.getElementById("cerita")?.scrollIntoView();
  }, [stories.data, events.loading]);

  return (
    <>
      <PageHero
        crumbs={[{ label: "Beranda", href: "/" }, { label: "Acara" }]}
        title="Agenda acara"
        accent="& temu lulusan."
        action={
          <Button size="lg" onClick={() => setHosting(true)}>
            <CalendarPlus className="h-4 w-4" /> Usulkan acara
          </Button>
        }
      >
        Meetup, workshop, dan kumpul bareng lulusan AsiaWorks di berbagai kota. Amankan kursimu lewat RSVP, atau tawarkan diri jadi tuan
        rumah di kotamu.
      </PageHero>

      <Container className="py-6 md:py-8">
        <div className="no-scrollbar -mx-4 -my-1.5 flex gap-2 overflow-x-auto px-4 py-1.5 sm:mx-0 sm:px-0">
          <Chip active={!kind} onClick={() => setKind("")}>
            Semua acara <span className="opacity-75">{all.length}</span>
          </Chip>
          {(Object.keys(EVENT_KINDS) as Kind[]).map((k) => (
            <Chip key={k} active={kind === k} onClick={() => setKind(k)}>
              {EVENT_KINDS[k]} <span className="opacity-75">{all.filter((e) => e.kind === k).length}</span>
            </Chip>
          ))}
        </div>
        <Card className="mt-3 grid grid-cols-1 gap-3 p-3 sm:grid-cols-2 sm:p-4 lg:grid-cols-[1fr_13rem_auto]">
          <SearchInput compact className="sm:col-span-2 lg:col-span-1" value={q} onChange={setQ} placeholder="Cari acara atau tuan rumah" />
          <Select compact value={city} onChange={(e) => setCity(e.target.value)} aria-label="Kota">
            <option value="">Kota</option>
            {cities.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </Select>
          <label className="flex h-10 items-center justify-between gap-3 rounded-xl border border-line bg-surface px-3.5 text-[13px] font-medium">
            Masih ada kursi
            <Toggle checked={seatsOnly} onChange={setSeatsOnly} label="Hanya acara yang masih ada kursi" />
          </label>
        </Card>

        {events.error ? (
          <div className="mt-6">
            <Notice>Acara belum bisa dimuat. Periksa koneksi lalu muat ulang halaman ya.</Notice>
          </div>
        ) : events.loading && !events.data ? (
          <Skeleton className="mt-6 h-96" />
        ) : !featured ? (
          <Empty
            icon={<CalendarDays className="h-6 w-6" />}
            title={filtered ? "Belum ada acara yang cocok" : "Belum ada acara terjadwal"}
            action={
              filtered ? (
                <Button variant="secondary" onClick={() => (setQ(""), setKind(""), setCity(""), setSeatsOnly(false))}>
                  Hapus filter
                </Button>
              ) : (
                <Button onClick={() => setHosting(true)}>Usulkan acara di kotamu</Button>
              )
            }
          >
            {filtered ? "Coba longgarkan filternya." : "Mau kumpul bareng lulusan di kotamu? Usulkan acaranya, staf AsiaWorks bantu mewujudkan."}
          </Empty>
        ) : (
          <>
            <FeaturedEvent event={featured} status={statusOf(featured)} onChanged={refresh} />
            {rest.length > 0 && (
              <section className="mt-10">
                <p className="eyebrow">Agenda berikutnya</p>
                <div className="mt-1 flex items-end justify-between gap-4">
                  <h2 className="h-section">Acara terjadwal</h2>
                  <p className="text-[13px] text-ink-soft">{rest.length} acara lain</p>
                </div>
                <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {rest.map((event, i) => (
                    <EventCard key={event.id} event={event} rsvp={statusOf(event)} onChanged={refresh} index={i} />
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </Container>

      {/* Shown once loaded, also with no story yet: the home page's Cerita shortcut lands here. */}
      {stories.data && (
        <section id="cerita" className="scroll-mt-20 border-y border-line bg-surface py-10 md:py-14">
          <Container>
            <p className="eyebrow">Cerita kolaborasi</p>
            <h2 className="h-section mt-1">Yang lahir dari pertemuan antar lulusan</h2>
            <p className="body-copy mt-2 max-w-xl text-sm">Ditulis staf AsiaWorks dan tayang atas persetujuan kedua pemilik bisnis.</p>
            {stories.data.length ? (
              <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
                {stories.data.map((story, i) => (
                  <StoryCard key={story.id} story={story} index={i} />
                ))}
              </div>
            ) : (
              <p className="mt-6 text-sm text-ink-soft">Belum ada cerita yang tayang. Punya cerita kolaborasi dengan sesama lulusan? Kabari staf AsiaWorks ya.</p>
            )}
          </Container>
        </section>
      )}

      <Container className="mt-10 md:mt-14">
        <div className="wash overflow-hidden rounded-3xl border border-line p-7 shadow-card md:p-12">
          <Badge tone="maroon">Jadi tuan rumah</Badge>
          <h2 className="h-section mt-4 max-w-lg">Ingin mengadakan temu lulusan di kotamu?</h2>
          <p className="body-copy mt-3 max-w-lg text-sm">
            Usulkan acaranya. Staf AsiaWorks meninjau, membantu publikasi ke seluruh direktori, dan mengurus daftar pesertanya.
          </p>
          <Button size="lg" className="mt-6" onClick={() => setHosting(true)}>
            <CalendarPlus className="h-4 w-4" /> Usulkan acara
          </Button>
        </div>
      </Container>

      <Sheet open={hosting} onClose={() => setHosting(false)} title="Usulkan acara">
        {isStaff ? (
          // Staff publish from the console: there an event needs no review and no host.
          <>
            <Notice tone="amber">Usulan acara ini untuk lulusan. Staf membuat acara dari konsol, dan acaranya langsung tayang.</Notice>
            <Button href="/staff?tab=acara" full className="mt-4">
              Buka konsol staf
            </Button>
          </>
        ) : (
          <Gate>
            <HostForm onDone={() => setHosting(false)} />
          </Gate>
        )}
      </Sheet>
    </>
  );
}

// The next event gets the big card, like the reference's hero.
function FeaturedEvent({ event, status, onChanged }: { event: EventItem; status: "going" | "waitlist" | null; onChanged: () => void }) {
  const seats = seatsLabel(event);
  return (
    <Card raised className="rise mt-6 overflow-hidden border-t-4 border-t-maroon">
      <div className="grid grid-cols-1 gap-6 p-5 md:grid-cols-[1.25fr_1fr] md:gap-10 md:p-8">
        <div className="flex flex-col">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="solid">Acara terdekat</Badge>
            <Badge tone="maroon">{EVENT_KINDS[event.kind]}</Badge>
            <Badge tone={seats.tone}>{seats.text}</Badge>
          </div>
          <h2 className="mt-4 text-[1.75rem] leading-[1.15] font-bold tracking-tight md:text-4xl">{event.title}</h2>
          <p className="body-copy mt-3 text-sm">{event.description}</p>
          <ul className="mt-5 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
            <li className="flex items-start gap-2.5">
              <CalendarClock className="mt-0.5 h-4 w-4 shrink-0 text-maroon" />
              <span>
                <b className="block font-semibold">{hari(event.starts_at)}</b>
                <span className="text-ink-soft">
                  {jam(event.starts_at)}
                  {event.ends_at && ` sampai ${jam(event.ends_at)}`}
                </span>
              </span>
            </li>
            <li className="flex items-start gap-2.5">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-maroon" />
              <span>
                <b className="block font-semibold">{event.venue}</b>
                <span className="text-ink-soft">{event.city}</span>
              </span>
            </li>
            {event.host_name && (
              <li className="flex items-start gap-2.5">
                <UserRound className="mt-0.5 h-4 w-4 shrink-0 text-maroon" />
                <span>
                  <b className="block font-semibold">{event.host_name}</b>
                  <span className="text-ink-soft">Tuan rumah{event.host_lp ? ` · LP ${event.host_lp}` : ""}</span>
                </span>
              </li>
            )}
          </ul>
          <div className="mt-auto flex flex-wrap items-center gap-5 pt-6">
            <RsvpButton event={event} status={status} onChanged={onChanged} size="lg" />
            <p>
              <span className="block text-[10px] font-medium tracking-wide text-ink-soft uppercase">Biaya</span>
              <span className="text-xl font-semibold tracking-tight text-maroon">{event.fee || "Gratis"}</span>
            </p>
          </div>
        </div>
        <Media path={event.image_path} name={event.title} className="order-first aspect-[16/10] rounded-2xl md:order-none md:aspect-auto md:min-h-72" />
      </div>
    </Card>
  );
}

// A graduate offers to host. It goes to staff as a proposal and is published once they approve.
function HostForm({ onDone }: { onDone: () => void }) {
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user) return;
    const form = new FormData(e.currentTarget);
    const text = (name: string) => String(form.get(name) ?? "").trim();
    setBusy(true);
    setError(null);
    const { error } = await supabase.from("events").insert({
      host_id: user.id,
      kind: text("kind") as Kind,
      title: text("title"),
      description: text("description"),
      starts_at: new Date(text("starts_at")).toISOString(),
      venue: text("venue"),
      city: text("city"),
      capacity: text("capacity") ? Number(text("capacity")) : null,
      fee: text("fee") || null,
    });
    setBusy(false);
    if (error) return setError("Usulan belum terkirim. Periksa isiannya lalu coba lagi ya.");
    onDone();
    toast("Usulan terkirim. Staf AsiaWorks akan meninjaunya.");
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <p className="body-copy text-sm">Ceritakan rencananya. Setelah disetujui staf, acaranya tayang di halaman ini dengan kamu sebagai tuan rumah.</p>
      <Field label="Nama acara">
        <Input name="title" required maxLength={120} placeholder="Ngopi bareng lulusan Bandung" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Jenis">
          <Select name="kind" required>
            {(Object.keys(EVENT_KINDS) as Kind[]).map((k) => (
              <option key={k} value={k}>
                {EVENT_KINDS[k]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Kota">
          <Input name="city" required placeholder="Bandung" />
        </Field>
      </div>
      <Field label="Tanggal dan jam mulai">
        <Input name="starts_at" type="datetime-local" required min={localInput(new Date())} />
      </Field>
      <Field label="Tempat">
        <Input name="venue" required placeholder="Nama tempat, atau Online (Zoom)" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Kapasitas" optional>
          <Input name="capacity" type="number" inputMode="numeric" min={1} placeholder="30" />
        </Field>
        <Field label="Biaya" optional>
          <Input name="fee" placeholder="Gratis" />
        </Field>
      </div>
      <Field label="Tentang acaranya">
        <Textarea name="description" required maxLength={600} placeholder="Siapa yang cocok ikut, dan apa yang akan dibahas?" />
      </Field>
      {error && <Notice>{error}</Notice>}
      <Button type="submit" size="lg" full loading={busy}>
        Kirim usulan
      </Button>
    </form>
  );
}
