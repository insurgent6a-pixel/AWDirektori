"use client";

// What a member can do to a listing: Hubungkan, Lihat kontak, kode promo, simpan, laporkan, RSVP.
// The database enforces who may do what; these components only explain it kindly.

import { Bookmark, Check, Copy, Flag, Hourglass, KeyRound, MessageCircle, Phone, Send, Ticket } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { useAuth } from "../_lib/auth";
import { cn, looksLikePhone, pesan, waLink } from "../_lib/format";
import { supabase } from "../_lib/supabase";
import type { EventItem } from "../_lib/types";
import { Button, Failed, IconButton, Notice, Sheet, Spinner, Textarea, toast } from "./ui";

type ButtonLook = { size?: "sm" | "md" | "lg"; variant?: "primary" | "secondary" | "ghost"; full?: boolean; className?: string };

// Shown inside a sheet when the visitor still has to sign in or wait for verification.
// `staff` lets staff through as well: they may read contacts and promo codes, but the database keeps RSVP for
// graduates. `member` lets every signed-in member through, verified or not (Hubungkan); staff stay out.
export function Gate({ children, staff, member }: { children: React.ReactNode; staff?: boolean; member?: boolean }) {
  const { user, profile, loading, failed, refresh, isGraduate, isStaff } = useAuth();
  const path = usePathname();
  // The session is still loading: do not tell a signed-in member to sign in.
  if (loading) {
    return (
      <div className="grid place-items-center py-8">
        <Spinner />
      </div>
    );
  }
  if (!user) {
    return (
      <div className="pb-1">
        <p className="body-copy text-sm">
          {member ? "Masuk dulu ya, supaya pemiliknya tahu siapa yang menyapa. Belum punya akun? Daftar dulu." : "Fitur ini khusus lulusan AsiaWorks. Masuk dulu ya, atau daftar kalau belum punya akun."}
        </p>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <Button variant="secondary" href={`/daftar`}>
            Daftar
          </Button>
          <Button href={`/masuk?next=${encodeURIComponent(path)}`}>Masuk</Button>
        </div>
      </div>
    );
  }
  if (failed && !profile) return <Failed query={{ error: "profile", reload: refresh }} />;
  if (isStaff && !staff) {
    return <Notice tone="amber">Fitur ini untuk {member ? "akun anggota" : "lulusan terverifikasi"}. Akun staf tidak ikut di sini.</Notice>;
  }
  if (!isGraduate && !isStaff && !member) {
    const waiting = profile?.verification === "pending";
    return (
      <div className="pb-1">
        <Notice tone="amber">
          {waiting
            ? "Data kamu sedang diverifikasi staf AsiaWorks. Begitu disetujui, fitur ini langsung terbuka."
            : "Lengkapi data lulusan kamu dulu supaya staf bisa memverifikasi."}
        </Notice>
        {!waiting && (
          <Button href="/daftar" full className="mt-4">
            Lengkapi data
          </Button>
        )}
      </div>
    );
  }
  return <>{children}</>;
}

// Copy with the feedback on the button itself: a toast would sit behind the sheet these buttons live in.
function useCopy() {
  const [copied, setCopied] = useState(false);
  const copy = (text: string) =>
    navigator.clipboard?.writeText(text).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      },
      () => {}, // the browser said no: the value stays on screen to copy by hand
    );
  return [copied, copy] as const;
}

// ── Hubungkan ───────────────────────────────────────────────────────

export function ConnectButton({
  businessId,
  peluangId,
  ownerId,
  targetName,
  label = "Hubungkan",
  size = "md",
  variant = "primary",
  full,
  className,
}: { businessId?: string | null; peluangId?: string; ownerId: string | null; targetName: string | null; label?: string } & ButtonLook) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mine = !!user && user.id === ownerId;

  const send = async () => {
    setBusy(true);
    setError(null);
    const { error } = await supabase.rpc("connect", {
      p_message: message,
      ...(peluangId ? { p_peluang: peluangId } : { p_business: businessId ?? undefined }),
    });
    setBusy(false);
    if (error) return setError(pesan(error));
    setOpen(false);
    setMessage("");
    toast("Permintaan terkirim. Jawabannya muncul di Dasbor, tab Koneksi.");
  };

  return (
    <>
      <Button size={size} variant={variant} full={full} className={className} disabled={mine} onClick={() => setOpen(true)}>
        <MessageCircle className="h-4 w-4" />
        {mine ? "Milikmu" : label}
      </Button>
      <Sheet open={open} onClose={() => setOpen(false)} title={`Hubungkan dengan ${targetName ?? "lulusan ini"}`}>
        <Gate member>
          <p className="body-copy text-sm">
            Ceritakan singkat apa yang kamu cari. Kalau diterima, kontak kalian berdua saling terbuka.
          </p>
          <Textarea
            className="mt-4"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            maxLength={500}
            aria-label="Pesan untuk pemilik"
            placeholder="Contoh: Halo, saya butuh katering untuk acara kantor 50 orang bulan depan. Bisa ngobrol?"
            autoFocus
          />
          <p className="mt-1.5 text-right text-[12px] text-ink-soft">{message.length}/500</p>
          {error && (
            <div className="mt-2">
              <Notice>{error}</Notice>
            </div>
          )}
          <Button full size="lg" className="mt-4" loading={busy} disabled={message.trim().length < 10} onClick={send}>
            <Send className="h-4 w-4" /> Kirim permintaan
          </Button>
        </Gate>
      </Sheet>
    </>
  );
}

// ── Lihat kontak ────────────────────────────────────────────────────

export function ContactValue({ value }: { value: string }) {
  const phone = looksLikePhone(value);
  const email = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value.trim());
  const [copied, copy] = useCopy();
  return (
    <div className="rounded-2xl border border-line bg-page p-4">
      <p className="text-lg font-semibold tracking-tight break-all select-all">{value}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {phone && (
          <Button size="sm" href={waLink(value)}>
            <MessageCircle className="h-4 w-4" /> Chat WhatsApp
          </Button>
        )}
        {email && (
          <Button size="sm" href={`mailto:${value.trim()}`}>
            Kirim email
          </Button>
        )}
        <Button size="sm" variant="secondary" onClick={() => copy(value)}>
          {copied ? <Check className="h-4 w-4 text-green" /> : <Copy className="h-4 w-4" />} {copied ? "Tersalin" : "Salin"}
        </Button>
      </div>
    </div>
  );
}

export function ContactButton({ businessId, size = "md", variant = "secondary", full, className }: { businessId: string } & ButtonLook) {
  const [open, setOpen] = useState(false);
  const [contact, setContact] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reveal = async () => {
    setBusy(true);
    setError(null);
    const { data, error } = await supabase.rpc("view_contact", { p_business: businessId });
    setBusy(false);
    if (error) return setError(pesan(error));
    setContact(data || "Pemilik belum mengisi kontak.");
  };

  return (
    <>
      <Button size={size} variant={variant} full={full} className={className} onClick={() => setOpen(true)}>
        <Phone className="h-4 w-4" /> Lihat kontak
      </Button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Kontak bisnis">
        <Gate staff>
          {contact ? (
            <ContactValue value={contact} />
          ) : (
            <>
              <p className="body-copy text-sm">
                Kontak hanya untuk sesama lulusan. Pemilik bisnis bisa melihat siapa saja yang membuka kontaknya.
              </p>
              {error && (
                <div className="mt-3">
                  <Notice>{error}</Notice>
                </div>
              )}
              <Button full size="lg" className="mt-4" loading={busy} onClick={reveal}>
                Tampilkan kontak
              </Button>
            </>
          )}
        </Gate>
      </Sheet>
    </>
  );
}

// ── Kode promo ──────────────────────────────────────────────────────

export function PromoCodeButton({ businessId, className }: { businessId: string; className?: string }) {
  const { isGraduate, isStaff } = useAuth();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState<string | null>(null);
  const [state, setState] = useState<"idle" | "busy" | "failed">("idle");
  const [copied, copy] = useCopy();

  const fetchCode = async () => {
    setState("busy");
    const { data, error } = await supabase.rpc("promo_code", { p_business: businessId });
    setCode(data);
    setState(error ? "failed" : "idle"); // a dropped request is not "this deal is gone"
  };
  const show = () => {
    setOpen(true);
    if (isGraduate || isStaff) fetchCode(); // everyone else meets the Gate below; the database would say no anyway
  };

  return (
    <>
      <Button size="sm" variant="secondary" className={className} onClick={show}>
        <Ticket className="h-4 w-4 text-gold" /> Lihat kode promo
      </Button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Kode promo sesama lulusan">
        <Gate staff>
          {state === "busy" ? (
            <p className="body-copy text-sm">Mengambil kode...</p>
          ) : state === "failed" ? (
            <>
              <Notice>Kode belum bisa diambil. Periksa koneksi lalu coba lagi ya.</Notice>
              <Button full variant="secondary" className="mt-4" onClick={fetchCode}>
                Coba lagi
              </Button>
            </>
          ) : code ? (
            <>
              <p className="body-copy text-sm">Sebutkan atau masukkan kode ini saat bertransaksi dengan bisnis ini.</p>
              <button
                type="button"
                onClick={() => copy(code)}
                className="tap mt-4 flex w-full items-center justify-between rounded-2xl border border-dashed border-gold bg-gold-soft px-5 py-4 hover:border-solid"
              >
                <span className="text-xl font-bold tracking-[0.12em] text-gold select-all">{code}</span>
                <span className="flex items-center gap-1.5 text-[13px] font-semibold text-gold">
                  {copied ? <Check className="h-5 w-5" /> : <Copy className="h-5 w-5" />} {copied ? "Tersalin" : "Salin"}
                </span>
              </button>
            </>
          ) : (
            <Notice tone="amber">Kode promo ini sedang tidak tersedia.</Notice>
          )}
        </Gate>
      </Sheet>
    </>
  );
}

// ── Simpan ──────────────────────────────────────────────────────────

export function SaveButton({ kind, id, floating, className }: { kind: "business" | "peluang"; id: string; floating?: boolean; className?: string }) {
  const { user, loading, isStaff, isSaved, toggleSave } = useAuth();
  const router = useRouter();
  const path = usePathname();
  const saved = isSaved(kind, id);
  const [tapped, setTapped] = useState(false); // the bookmark pops for a tap, not when a list of saved ones loads
  if (isStaff) return null; // the saved list lives in the member dashboard, which staff do not have
  return (
    <IconButton
      label={saved ? "Hapus dari tersimpan" : "Simpan"}
      aria-pressed={saved}
      floating={floating}
      className={className}
      onClick={async () => {
        if (loading) return; // the session is still loading: a signed-in member must not be sent to the login page
        if (!user) return router.push(`/masuk?next=${encodeURIComponent(path)}`);
        setTapped(true);
        // The bookmark flips at once; the message waits for the write, so it never claims a save that failed.
        const ok = await toggleSave(kind, id);
        if (!ok) toast("Belum tersimpan. Coba lagi ya.", "error");
        else toast(saved ? "Dihapus dari tersimpan." : "Tersimpan. Lihat lagi di Dasbor, tab Akun.");
      }}
    >
      {/* key restarts the pop each time it is saved */}
      <Bookmark key={String(saved)} className={cn("h-[18px] w-[18px]", saved && "fill-maroon text-maroon", saved && tapped && "animate-pop")} />
    </IconButton>
  );
}

// ── Laporkan ────────────────────────────────────────────────────────

// `icon`: the square button that sits on a card. Without it, the quiet text link of a page.
export function ReportButton({ businessId, peluangId, icon }: { businessId?: string; peluangId?: string; icon?: boolean }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = async () => {
    if (!user) return;
    setBusy(true);
    setError(null);
    const { error } = await supabase
      .from("reports")
      .insert(peluangId ? { reporter_id: user.id, peluang_id: peluangId, reason } : { reporter_id: user.id, business_id: businessId, reason });
    setBusy(false);
    if (error) return setError("Laporan belum terkirim. Coba lagi ya.");
    setOpen(false);
    setReason("");
    toast("Laporan terkirim. Staf AsiaWorks akan meninjaunya.");
  };

  return (
    <>
      {icon ? (
        <IconButton label="Laporkan" onClick={() => setOpen(true)}>
          <Flag className="h-[18px] w-[18px] text-ink-soft" />
        </IconButton>
      ) : (
        <button type="button" onClick={() => setOpen(true)} className="tap inline-flex min-h-10 items-center gap-1.5 text-[13px] text-ink-soft hover:text-maroon">
          <Flag className="h-3.5 w-3.5" /> Laporkan
        </button>
      )}
      <Sheet open={open} onClose={() => setOpen(false)} title="Laporkan ke staf">
        {!user ? (
          <Gate>{null}</Gate>
        ) : (
          <>
            <p className="body-copy text-sm">Ada yang tidak sesuai? Ceritakan singkat, staf AsiaWorks yang akan menindaklanjuti.</p>
            <Textarea
              className="mt-4"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={500}
              aria-label="Alasan laporan"
              placeholder="Apa yang perlu kami periksa?"
            />
            {error && (
              <div className="mt-3">
                <Notice>{error}</Notice>
              </div>
            )}
            <Button full size="lg" className="mt-4" loading={busy} disabled={reason.trim().length < 5} onClick={send}>
              Kirim laporan
            </Button>
          </>
        )}
      </Sheet>
    </>
  );
}

// ── RSVP ────────────────────────────────────────────────────────────

export function RsvpButton({
  event,
  status,
  onChanged,
  size = "sm",
}: {
  event: Pick<EventItem, "id" | "capacity" | "going" | "starts_at">;
  status: "going" | "waitlist" | null;
  onChanged: () => void;
  size?: "sm" | "md" | "lg";
}) {
  const { isGraduate } = useAuth();
  const [gate, setGate] = useState(false);
  const [busy, setBusy] = useState(false);
  const [joined, setJoined] = useState(false); // the status pops when this tap got the seat, not on every page load
  const full = event.capacity != null && (event.going ?? 0) >= event.capacity;
  const past = !!event.starts_at && new Date(event.starts_at) < new Date();

  const join = async () => {
    if (!isGraduate) return setGate(true);
    setBusy(true);
    const { data, error } = await supabase.rpc("rsvp", { p_event: event.id! });
    setBusy(false);
    if (error) return toast(pesan(error), "error");
    setJoined(true);
    toast(
      data === "going"
        ? "Kursi kamu aman. Sampai jumpa di acara!"
        : "Acara penuh, kamu masuk daftar tunggu. Kalau ada kursi kosong, otomatis jadi milikmu sesuai urutan.",
    );
    onChanged();
  };

  const cancel = async () => {
    setBusy(true);
    const { error } = await supabase.rpc("cancel_rsvp", { p_event: event.id! });
    setBusy(false);
    if (error) return toast(pesan(error), "error");
    toast("RSVP dibatalkan.");
    onChanged();
  };

  if (past) return <span className="text-[13px] text-ink-soft">Sudah berlangsung</span>;

  if (status) {
    return (
      <div className="flex items-center gap-2">
        <span className={cn("inline-flex items-center gap-1 text-[13px] font-semibold", joined && "animate-pop", status === "going" ? "text-green" : "text-amber")}>
          {status === "going" ? <Check className="h-4 w-4" /> : <Hourglass className="h-4 w-4" />}
          {status === "going" ? "Terdaftar" : "Daftar tunggu"}
        </span>
        <Button size="sm" variant="ghost" loading={busy} onClick={cancel}>
          Batal
        </Button>
      </div>
    );
  }

  return (
    <>
      <Button size={size} variant={full ? "secondary" : "primary"} loading={busy} onClick={join}>
        {full ? "Ikut daftar tunggu" : "RSVP"}
      </Button>
      <Sheet open={gate} onClose={() => setGate(false)} title="RSVP acara">
        <Gate>
          <p className="body-copy text-sm">Kamu sudah bisa RSVP. Tutup jendela ini lalu ketuk RSVP sekali lagi.</p>
        </Gate>
      </Sheet>
    </>
  );
}

// "Masuk untuk ..." line with a link, for places where an inline hint is better than a button.
export function SignInHint({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  return (
    <p className="flex items-center gap-2 text-[13px] text-ink-soft">
      <KeyRound className="h-4 w-4 shrink-0 text-maroon" />
      <span>
        <Link href={`/masuk?next=${encodeURIComponent(path)}`} className="tap -my-2.5 inline-block py-2.5 font-semibold text-maroon underline-offset-2 hover:underline">
          Masuk
        </Link>{" "}
        {children}
      </span>
    </p>
  );
}
