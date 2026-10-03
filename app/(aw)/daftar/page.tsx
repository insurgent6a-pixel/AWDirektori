"use client";

// Sign-up in three short steps: Akun, Tentang kamu, Bisnis (optional). Each step saves before the next one opens,
// so a graduate can stop and continue later.

import { Check, Clock, PartyPopper, Plus, Store } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Breadcrumbs, Container } from "../_components/shell";
import { Button, Card, Field, Input, Notice, Select, Skeleton, Textarea, toast } from "../_components/ui";
import { useAuth } from "../_lib/auth";
import { CATEGORIES, PROGRAMS } from "../_lib/constants";
import { cn, looksLikePhone, pesan, validLink, withHttps } from "../_lib/format";
import { supabase } from "../_lib/supabase";
import type { Profile } from "../_lib/types";

type Step = "akun" | "diri" | "bisnis" | "selesai";
const STEPS: { key: Step; label: string }[] = [
  { key: "akun", label: "Akun" },
  { key: "diri", label: "Tentang kamu" },
  { key: "bisnis", label: "Bisnis" },
];

type Program = (typeof PROGRAMS)[number];
const toBatch = (value: string) => (value.trim() ? Number(value) : undefined);
const digits = (value: string) => value.replace(/\D/g, "").replace(/^0+/, "").slice(0, 4); // a batch is a number, never 0

export default function DaftarPage() {
  const { user, profile, loading, isStaff } = useAuth();
  const params = useSearchParams();
  const router = useRouter();
  const [step, setStep] = useState<Step | null>(null);
  const [madeBusiness, setMadeBusiness] = useState(false);
  const [returning, setReturning] = useState(false); // opened this page with the sign-up already done

  // Where to resume: no account yet, data still to fill in, or already sent.
  useEffect(() => {
    if (loading || step) return;
    if (isStaff) return router.replace("/staff"); // a staff account is not a graduate: no onboarding, no place in the queue
    if (!user) setStep("akun");
    else if (!profile || profile.verification === "draft" || profile.verification === "rejected") setStep("diri");
    else {
      setReturning(true);
      setStep(params.get("langkah") === "bisnis" ? "bisnis" : "selesai");
    }
  }, [loading, user, profile, isStaff, step, params, router]);

  const index = STEPS.findIndex((s) => s.key === step);
  // "Lanjut" sits at the bottom of a long form: open the next step from its top.
  // (In braces: newer browsers return a promise from scrollTo, and an effect must return nothing or a cleanup.)
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [step]);

  return (
    <div className="wash min-h-[calc(100dvh-4rem-1px-env(safe-area-inset-top,0px))]">
      <Container className="max-w-xl py-6 md:py-10">
        <Breadcrumbs items={[{ label: "Beranda", href: "/" }, { label: "Daftar" }]} />
        <h1 className="h-section mt-5">Data Bisnis Lulusan AsiaWorks</h1>
        <p className="body-copy mt-2 text-sm">
          Halo Graduates! Punya bisnis? Punya jasa? Punya produk keren? Yuk berkumpul di platform digital komunitas AsiaWorks.
        </p>

        {step !== "selesai" && (
          <ol className="mt-6 grid grid-cols-3 gap-2" aria-label="Langkah pendaftaran">
            {STEPS.map((s, i) => (
              <li key={s.key} aria-current={i === index ? "step" : undefined}>
                <span className={cn("block h-1.5 rounded-full", i <= index ? "bg-maroon" : "bg-line")} />
                <span className={cn("mt-2 flex items-center gap-1.5 text-[12px] font-medium", i <= index ? "text-maroon" : "text-ink-soft")}>
                  {i < index ? <Check className="animate-pop h-3.5 w-3.5" /> : <span>{i + 1}.</span>}
                  {s.label}
                </span>
              </li>
            ))}
          </ol>
        )}

        <Card raised key={step} className="rise mt-5 p-5 sm:p-7">
          {!step ? (
            <Skeleton className="h-64" />
          ) : step === "akun" ? (
            <StepAkun onDone={() => setStep("diri")} />
          ) : step === "diri" ? (
            <StepDiri profile={profile} onDone={() => setStep("bisnis")} />
          ) : step === "bisnis" ? (
            <StepBisnis
              onDone={(created) => {
                setMadeBusiness(created);
                setStep("selesai");
              }}
            />
          ) : (
            <Selesai approved={profile?.verification === "approved"} madeBusiness={madeBusiness} returning={returning} />
          )}
        </Card>

        {step === "akun" && (
          <p className="mt-5 text-center text-sm text-ink-soft">
            Sudah punya akun?{" "}
            <Link href="/masuk" className="tap -my-2.5 inline-block py-2.5 font-semibold text-maroon underline-offset-2 hover:underline">
              Masuk
            </Link>
          </p>
        )}
      </Container>
    </div>
  );
}

// ── 1. Akun ─────────────────────────────────────────────────────────

function StepAkun({ onDone }: { onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmEmail, setConfirmEmail] = useState<string | null>(null);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const email = String(form.get("email")).trim();
    setBusy(true);
    setError(null);
    const { data, error } = await supabase.auth.signUp({
      email,
      password: String(form.get("password")),
      options: { data: { full_name: String(form.get("full_name")).trim() }, emailRedirectTo: `${window.location.origin}/daftar` },
    });
    setBusy(false);
    if (error) {
      return setError(
        /already registered/i.test(error.message)
          ? "Email ini sudah terdaftar. Masuk saja ya."
          : /password/i.test(error.message)
            ? "Kata sandi minimal 6 karakter."
            : "Pendaftaran belum berhasil. Periksa isiannya lalu coba lagi ya.",
      );
    }
    // With email confirmation switched on in Supabase there is no session yet.
    if (!data.session) {
      // For an address that already has an account, Supabase answers with a user that has no identities and sends nothing.
      if (data.user?.identities?.length === 0) return setError("Email ini sudah terdaftar. Masuk saja ya.");
      return setConfirmEmail(email);
    }
    onDone();
  };

  if (confirmEmail) {
    return (
      <div>
        <h2 className="h-card text-xl">Cek email kamu</h2>
        <p className="body-copy mt-2 text-sm">
          Kami mengirim tautan konfirmasi ke <b className="text-ink">{confirmEmail}</b>. Buka tautannya, lalu lanjutkan pendaftaran dari sana.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <h2 className="h-card text-xl">Buat akun dulu</h2>
      <Field label="Nama lengkap">
        <Input name="full_name" required autoComplete="name" placeholder="Sesuai data pelatihan AsiaWorks" />
      </Field>
      <Field label="Email">
        <Input name="email" type="email" required autoComplete="email" autoCapitalize="none" placeholder="nama@email.com" />
      </Field>
      <Field label="Kata sandi" hint="Minimal 6 karakter.">
        <Input name="password" type="password" required minLength={6} autoComplete="new-password" />
      </Field>
      {error && <Notice>{error}</Notice>}
      <Button type="submit" size="lg" full loading={busy}>
        Lanjut
      </Button>
    </form>
  );
}

// ── 2. Tentang kamu ─────────────────────────────────────────────────

function StepDiri({ profile, onDone }: { profile: Profile | null; onDone: () => void }) {
  const router = useRouter();
  const { refresh } = useAuth();
  const [fullName, setFullName] = useState(profile?.full_name ?? "");
  const [nickname, setNickname] = useState(profile?.nickname ?? "");
  const [phone, setPhone] = useState("");
  // The programs ticked, and the batch number typed for each. A number goes along only while its program is ticked.
  const [picked, setPicked] = useState<Program[]>(() => PROGRAMS.filter((p) => profile?.programs.includes(p)));
  const [batch, setBatch] = useState<Record<Program, string>>({
    IB: profile?.batch_ib?.toString() ?? "",
    IA: profile?.batch_ia?.toString() ?? "",
    LP: profile?.batch_lp?.toString() ?? "",
  });
  const number = (p: Program) => (picked.includes(p) ? toBatch(batch[p]) : undefined);
  const [busy, setBusy] = useState<"submit" | "later" | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Coming back later: bring back what was already saved.
  useEffect(() => {
    if (profile && !fullName) setFullName(profile.full_name);
    supabase.rpc("my_phone").then(({ data }) => data && setPhone((current) => current || data));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id]);

  const save = async (submit: boolean) => {
    if (submit && !looksLikePhone(phone)) return setError("Nomor WhatsApp belum benar. Contoh: 0812 3456 7890.");
    if (submit && !picked.length) return setError("Pilih dulu program yang kamu ikuti: IB, IA, atau LP.");
    setBusy(submit ? "submit" : "later");
    setError(null);
    const { error } = await supabase.rpc("save_profile", {
      p_full_name: fullName,
      p_nickname: nickname,
      p_phone: phone,
      p_programs: picked,
      p_lp: number("LP"),
      p_ib: number("IB"),
      p_ia: number("IA"),
      p_submit: submit,
    });
    if (error) {
      setBusy(null);
      return setError(pesan(error));
    }
    await refresh(); // the dashboard, and this form on a later visit, read the saved values from the session
    setBusy(null);
    if (submit) return onDone();
    toast("Tersimpan. Lanjutkan kapan saja lewat tombol Lengkapi data di dasbor.");
    router.push("/akun");
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save(true);
      }}
      className="space-y-4"
    >
      <h2 className="h-card text-xl">Kenalan dulu, yuk</h2>
      {profile?.verification === "rejected" && (
        <Notice tone="amber">
          Staf meminta data kamu diperbaiki{profile.verification_note ? `: ${profile.verification_note}` : "."} Perbarui lalu kirim lagi ya.
        </Notice>
      )}
      <Field label="Nama lengkap">
        <Input value={fullName} onChange={(e) => setFullName(e.target.value)} required autoComplete="name" />
      </Field>
      <Field label="Nama panggilan" hint="Nama ini yang tampil di kartu bisnismu.">
        <Input value={nickname} onChange={(e) => setNickname(e.target.value)} required autoComplete="nickname" />
      </Field>
      <Field label="No HP (WhatsApp) pribadi" hint="Disimpan terenkripsi. Lulusan lain baru bisa melihatnya setelah kamu menerima permintaan Hubungkan dari mereka.">
        <Input value={phone} onChange={(e) => setPhone(e.target.value)} required type="tel" inputMode="tel" autoComplete="tel" placeholder="0812 3456 7890" />
      </Field>
      {/* Three boxes to choose from. Each one chosen brings up its batch number: a must for LP, optional for IB and IA. */}
      <fieldset>
        <legend className="mb-1.5 text-[13px] font-medium">Kamu lulusan program apa?</legend>
        <div className="grid grid-cols-3 gap-2.5">
          {PROGRAMS.map((p) => {
            const on = picked.includes(p);
            return (
              <button
                key={p}
                type="button"
                role="checkbox"
                aria-checked={on}
                onClick={() => setPicked(PROGRAMS.filter((x) => (x === p ? !on : picked.includes(x))))}
                className={cn(
                  "tap relative grid h-16 place-items-center rounded-2xl border text-lg font-semibold",
                  on ? "border-maroon bg-blush text-maroon shadow-card hover:bg-blush-line" : "border-line bg-surface hover:border-maroon/40 active:bg-page",
                )}
              >
                {p}
                <span
                  aria-hidden
                  className={cn(
                    "absolute top-1.5 right-1.5 grid h-5 w-5 place-items-center rounded-full bg-maroon text-white transition-[opacity,scale] duration-300 ease-bouncy",
                    !on && "scale-50 opacity-0",
                  )}
                >
                  <Check className="h-3 w-3" strokeWidth={3} />
                </span>
              </button>
            );
          })}
        </div>
        <p className="mt-1.5 text-[13px] text-ink-soft">Pilih IB, IA, atau LP (GLP). Boleh lebih dari satu.</p>
        {picked.map((p) => (
          <div key={p} className="rise mt-3">
            <Field label={`Angkatan ${p}`} optional={p !== "LP"} hint={p === "LP" ? undefined : "Kosongkan saja kalau lupa nomornya."}>
              <Input
                value={batch[p]}
                onChange={(e) => setBatch({ ...batch, [p]: digits(e.target.value) })}
                required={p === "LP"}
                inputMode="numeric"
                placeholder="Contoh: 175"
              />
            </Field>
          </div>
        ))}
      </fieldset>
      {error && <Notice>{error}</Notice>}
      <Button type="submit" size="lg" full loading={busy === "submit"}>
        Lanjut
      </Button>
      <Button variant="ghost" full loading={busy === "later"} onClick={() => save(false)}>
        Simpan, lanjut nanti
      </Button>
    </form>
  );
}

// ── 3. Bisnis (optional) ────────────────────────────────────────────

function StepBisnis({ onDone }: { onDone: (created: boolean) => void }) {
  const { user } = useAuth();
  const [links, setLinks] = useState([""]);
  const [category, setCategory] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const created = useRef<string | null>(null); // the draft's id, once the first of the two requests went through

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user) return;
    const form = new FormData(e.currentTarget);
    const text = (name: string) => String(form.get(name) ?? "").trim();
    if (!text("contact")) return setError("Kontak bisnis wajib diisi.");
    const values = {
      name: text("name") || null,
      description: text("description"),
      category,
      category_other: category === "Lainnya" ? text("category_other") || null : null,
      links: links.map((l) => l.trim()).filter(Boolean).map(withHttps),
    };
    if (!values.links.every(validLink)) return setError("Tulis alamat lengkapnya ya, contoh: instagram.com/namabisnis");
    setBusy(true);
    setError(null);
    // Two requests: the draft, then its contact. A retry updates the draft it already made instead of adding another.
    const saved = created.current
      ? await supabase.from("businesses").update(values).eq("id", created.current).select("id").single()
      : await supabase.from("businesses").insert({ ...values, owner_id: user.id }).select("id").single();
    if (saved.error) {
      setBusy(false);
      return setError("Bisnis belum tersimpan. Periksa tautannya (contoh: instagram.com/namabisnis) lalu coba lagi ya.");
    }
    created.current = saved.data.id;
    const { error } = await supabase.rpc("set_business_contact", { p_business: saved.data.id, p_contact: text("contact") });
    setBusy(false);
    if (error) return setError("Kontak belum tersimpan. Coba lagi ya.");
    onDone(true);
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <h2 className="h-card text-xl">Ceritakan bisnismu</h2>
        <p className="body-copy mt-1 text-sm">Belum punya bisnis? Lewati saja, kamu tetap bisa memasang Peluang dan terhubung dengan lulusan lain.</p>
      </div>
      <Field label="Nama bisnis" optional>
        <Input name="name" maxLength={80} placeholder="Kopi Titik Temu" />
      </Field>
      <Field label="Kontak bisnis" hint="WhatsApp atau email bisnis. Hanya terlihat oleh sesama lulusan.">
        <Input name="contact" required placeholder="0812 3456 7890" />
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
      {category === "Lainnya" && (
        <Field label="Sebutkan kategorinya" optional>
          <Input name="category_other" maxLength={60} placeholder="Misalnya: Jasa logistik" />
        </Field>
      )}
      <Field label="Deskripsi singkat" hint="Dua sampai tiga kalimat: apa yang kamu tawarkan, dan untuk siapa.">
        <Textarea name="description" required maxLength={600} />
      </Field>
      {error && <Notice>{error}</Notice>}
      <Button type="submit" size="lg" full loading={busy}>
        Simpan bisnis
      </Button>
      <Button variant="ghost" full onClick={() => onDone(!!created.current)}>
        Lewati dulu
      </Button>
    </form>
  );
}

// ── Done ────────────────────────────────────────────────────────────

// The last panel. Someone who comes back here later (a "Pasang bisnis" link, a bookmark) is offered the next step
// instead of a dead end.
function Selesai({ approved, madeBusiness, returning }: { approved: boolean; madeBusiness: boolean; returning: boolean }) {
  const Icon = approved ? PartyPopper : Clock;
  return (
    <div className="text-center">
      <span className="animate-pop mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-blush text-maroon">
        <Icon className="h-6 w-6" />
      </span>
      <h2 className="h-card mt-4 text-xl">{approved ? "Kamu sudah terverifikasi" : "Data kamu sudah kami terima"}</h2>
      <p className="body-copy mt-2 text-sm">
        {approved
          ? "Semua fitur lulusan sudah terbuka: Hubungkan, Peluang, RSVP acara, dan promo sesama lulusan."
          : "Staf AsiaWorks akan mencocokkan angkatanmu. Sambil menunggu, kamu sudah bisa menyiapkan bisnismu."}
      </p>
      {madeBusiness && (
        <p className="mt-4 flex items-start gap-3 rounded-xl bg-page p-4 text-left text-sm">
          <Store className="mt-0.5 h-4 w-4 shrink-0 text-maroon" />
          <span>Bisnismu tersimpan sebagai draf. Tambahkan foto dan pin lokasi di dasbor, lalu kirim.</span>
        </p>
      )}
      <div className="mt-6 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {madeBusiness ? (
          <Button href="/akun?tab=bisnis" size="lg">
            Lengkapi bisnis
          </Button>
        ) : returning ? (
          <Button href="/akun?tab=bisnis&baru=1" size="lg">
            <Store className="h-4 w-4" /> Pasang bisnis
          </Button>
        ) : (
          <Button href="/akun" size="lg">
            Buka dasbor
          </Button>
        )}
        {returning && !madeBusiness ? (
          <Button href="/akun" variant="secondary" size="lg">
            Buka dasbor
          </Button>
        ) : (
          <Button href="/" variant="secondary" size="lg">
            Jelajahi direktori
          </Button>
        )}
      </div>
    </div>
  );
}
