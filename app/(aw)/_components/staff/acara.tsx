"use client";

// Staff run events: create, edit, delete, review proposals from graduates, and see who is coming.

import { CalendarDays, ImagePlus, Pencil, Plus, Trash2, Users } from "lucide-react";
import { useRef, useState } from "react";
import { useAuth } from "../../_lib/auth";
import { EVENT_KINDS, REVIEW_LABELS, REVIEW_TONES } from "../../_lib/constants";
import { hari, jam, localInput } from "../../_lib/format";
import { useQuery } from "../../_lib/hooks";
import { removeImages, uploadImage } from "../../_lib/storage";
import { supabase } from "../../_lib/supabase";
import type { Enums, Tables } from "../../_lib/types";
import { Badge, Button, Card, ConfirmSheet, Empty, Failed, Field, IconButton, Input, Notice, Select, Sheet, Skeleton, Textarea, toast } from "../ui";
import { Decide, type Person, personLabel, SectionTitle } from "./shared";

type Kind = Enums<"event_kind">;
type EventRow = Tables<"events"> & { host: Person };
type Guest = { status: Enums<"rsvp_status">; created_at: string; user: Person };

export function AcaraStaf({ onChanged }: { onChanged: () => void }) {
  const list = useQuery(
    () =>
      supabase
        .from("events")
        .select("*, host:profiles!events_host_id_fkey(full_name, nickname, batch_lp)")
        .order("starts_at", { ascending: false })
        .overrideTypes<EventRow[], { merge: false }>(),
    [],
  );
  const [editing, setEditing] = useState<EventRow | "new" | null>(null);
  const [removing, setRemoving] = useState<EventRow | null>(null);
  const [guestsOf, setGuestsOf] = useState<EventRow | null>(null);

  const changed = () => {
    list.reload();
    onChanged(); // the queue number in the console's sidebar
  };

  const proposals = (list.data ?? []).filter((e) => e.status === "pending");
  const others = (list.data ?? []).filter((e) => e.status !== "pending");

  return (
    <section>
      <SectionTitle
        title="Acara"
        action={
          <Button onClick={() => setEditing("new")}>
            <Plus className="h-4 w-4" /> Acara baru
          </Button>
        }
      >
        Acara buatan staf langsung tayang. Usulan dari lulusan menunggu persetujuan di bawah.
      </SectionTitle>

      {proposals.length > 0 && (
        <div className="mt-5">
          <p className="eyebrow">Usulan lulusan</p>
          <div className="mt-2 space-y-3">
            {proposals.map((e) => (
              <EventItem key={e.id} event={e} onEdit={setEditing}>
                <Decide kind="event" id={e.id} status={e.status} onDone={changed} />
              </EventItem>
            ))}
          </div>
        </div>
      )}

      <div className="mt-5 space-y-3">
        <Failed query={list} />
        {list.loading && !list.data ? (
          <Skeleton className="h-40" />
        ) : others.length === 0 ? (
          <Empty icon={<CalendarDays className="h-6 w-6" />} title="Belum ada acara" action={<Button onClick={() => setEditing("new")}>Buat acara pertama</Button>}>
            Meetup, workshop, atau kumpul bareng. Lengkap dengan RSVP, batas kursi, dan daftar tunggu.
          </Empty>
        ) : (
          others.map((e) => (
            <EventItem key={e.id} event={e} onEdit={setEditing}>
              <div className="flex flex-wrap items-center gap-2">
                <Button size="sm" variant="secondary" onClick={() => setGuestsOf(e)}>
                  <Users className="h-4 w-4" /> Peserta
                </Button>
                {e.status !== "approved" && <Decide kind="event" id={e.id} status={e.status} onDone={changed} />}
                <IconButton label="Hapus acara" onClick={() => setRemoving(e)}>
                  <Trash2 className="h-4 w-4 text-red" />
                </IconButton>
              </div>
            </EventItem>
          ))
        )}
      </div>

      <Sheet open={!!editing} onClose={() => setEditing(null)} title={editing === "new" ? "Acara baru" : "Ubah acara"}>
        {editing && (
          <EventForm
            event={editing === "new" ? null : editing}
            onDone={() => {
              setEditing(null);
              changed();
            }}
          />
        )}
      </Sheet>

      <Sheet open={!!guestsOf} onClose={() => setGuestsOf(null)} title="Peserta">
        {guestsOf && <Guests event={guestsOf} />}
      </Sheet>

      <ConfirmSheet
        open={!!removing}
        onClose={() => setRemoving(null)}
        title="Hapus acara ini?"
        confirmLabel="Hapus"
        onConfirm={async () => {
          await removeImages([removing!.image_path]);
          const { error } = await supabase.from("events").delete().eq("id", removing!.id);
          if (error) throw new Error("Belum terhapus. Coba lagi ya.");
          setRemoving(null);
          toast("Acara dihapus.");
          changed();
        }}
      >
        “{removing?.title}” beserta semua RSVP-nya akan dihapus permanen.
      </ConfirmSheet>
    </section>
  );
}

function EventItem({ event, onEdit, children }: { event: EventRow; onEdit: (event: EventRow) => void; children: React.ReactNode }) {
  const past = new Date(event.starts_at) < new Date();
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="maroon">{EVENT_KINDS[event.kind]}</Badge>
            <Badge tone={REVIEW_TONES[event.status]}>{REVIEW_LABELS[event.status]}</Badge>
            {past && <Badge tone="gray">Sudah lewat</Badge>}
          </div>
          <h3 className="mt-2 font-semibold">{event.title}</h3>
          <p className="mt-0.5 text-[13px] text-ink-soft">
            {hari(event.starts_at)}, {jam(event.starts_at)} · {event.venue}, {event.city}
            {event.capacity ? ` · ${event.capacity} kursi` : " · tanpa batas kursi"}
            {event.host ? ` · tuan rumah ${personLabel(event.host)}` : ""}
          </p>
        </div>
        <IconButton label="Ubah acara" onClick={() => onEdit(event)}>
          <Pencil className="h-4 w-4" />
        </IconButton>
      </div>
      <div className="mt-3 border-t border-line pt-3">{children}</div>
    </Card>
  );
}

function Guests({ event }: { event: EventRow }) {
  const guests = useQuery(
    () =>
      supabase
        .from("rsvps")
        .select("status, created_at, user:profiles!rsvps_user_id_fkey(full_name, nickname, batch_lp)")
        .eq("event_id", event.id)
        .order("created_at")
        .overrideTypes<Guest[], { merge: false }>(),
    [event.id],
  );
  if (guests.error) return <Failed query={guests} />;
  if (guests.loading) return <Skeleton className="h-32" />;
  const going = (guests.data ?? []).filter((g) => g.status === "going");
  const waiting = (guests.data ?? []).filter((g) => g.status === "waitlist");
  return (
    <div className="space-y-4 text-sm">
      <p className="font-semibold">{event.title}</p>
      {[
        [`Terdaftar (${going.length}${event.capacity ? ` dari ${event.capacity}` : ""})`, going],
        [`Daftar tunggu (${waiting.length})`, waiting],
      ].map(([title, people]) => (
        <div key={title as string}>
          <p className="text-[12px] font-medium tracking-wide text-ink-soft uppercase">{title as string}</p>
          {(people as Guest[]).length === 0 ? (
            <p className="mt-1 text-[13px] text-ink-soft">Belum ada.</p>
          ) : (
            <ol className="mt-1.5 list-decimal space-y-1 pl-5">
              {(people as Guest[]).map((g, i) => (
                <li key={i}>{personLabel(g.user)}</li>
              ))}
            </ol>
          )}
        </div>
      ))}
    </div>
  );
}

function EventForm({ event, onDone }: { event: EventRow | null; onDone: () => void }) {
  const { user } = useAuth();
  const fileInput = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const text = (name: string) => String(form.get(name) ?? "").trim();
    setBusy(true);
    setError(null);
    try {
      const image_path = file ? await uploadImage(file, user!.id) : (event?.image_path ?? null);
      const values = {
        kind: text("kind") as Kind,
        title: text("title"),
        description: text("description"),
        starts_at: new Date(text("starts_at")).toISOString(),
        ends_at: text("ends_at") ? new Date(text("ends_at")).toISOString() : null,
        venue: text("venue"),
        city: text("city"),
        capacity: text("capacity") ? Number(text("capacity")) : null,
        fee: text("fee") || null,
        image_path,
      };
      const { error } = event ? await supabase.from("events").update(values).eq("id", event.id) : await supabase.from("events").insert(values);
      if (error) {
        if (file) removeImages([image_path]).catch(() => {}); // the upload that now belongs to nothing
        throw new Error("Acara belum tersimpan. Periksa isiannya lalu coba lagi ya.");
      }
      if (file && event?.image_path) removeImages([event.image_path]).catch(() => {}); // the replaced image
      toast(event ? "Acara diperbarui." : "Acara tayang.");
      onDone();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="Nama acara">
        <Input name="title" defaultValue={event?.title} required maxLength={120} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Jenis">
          <Select name="kind" defaultValue={event?.kind ?? "meetup"} required>
            {(Object.keys(EVENT_KINDS) as Kind[]).map((k) => (
              <option key={k} value={k}>
                {EVENT_KINDS[k]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Kota">
          <Input name="city" defaultValue={event?.city} required placeholder="Jakarta Selatan" />
        </Field>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Mulai">
          <Input name="starts_at" type="datetime-local" defaultValue={localInput(event?.starts_at ?? null)} required />
        </Field>
        <Field label="Selesai" optional>
          <Input name="ends_at" type="datetime-local" defaultValue={localInput(event?.ends_at ?? null)} />
        </Field>
      </div>
      <Field label="Tempat">
        <Input name="venue" defaultValue={event?.venue} required placeholder="Nama tempat, atau Online (Zoom)" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Kapasitas" optional hint="Kosong berarti tanpa batas.">
          <Input name="capacity" type="number" inputMode="numeric" min={1} defaultValue={event?.capacity ?? ""} />
        </Field>
        <Field label="Biaya" optional>
          <Input name="fee" defaultValue={event?.fee ?? ""} placeholder="Gratis" />
        </Field>
      </div>
      <Field label="Tentang acaranya">
        <Textarea name="description" defaultValue={event?.description} required maxLength={800} />
      </Field>
      <div>
        <Button variant="secondary" size="sm" onClick={() => fileInput.current?.click()}>
          <ImagePlus className="h-4 w-4" /> {file ? file.name.slice(0, 28) : event?.image_path ? "Ganti gambar" : "Pilih gambar (opsional)"}
        </Button>
        <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
      </div>
      {error && <Notice>{error}</Notice>}
      <Button type="submit" size="lg" full loading={busy}>
        {event ? "Simpan perubahan" : "Terbitkan acara"}
      </Button>
    </form>
  );
}
