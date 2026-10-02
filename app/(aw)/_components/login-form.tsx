"use client";

// One login for everyone (Supabase Auth). Members use it at /masuk, staff at /staff; the role decides where you land.

import { ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../_lib/auth";
import { supabase } from "../_lib/supabase";
import { Breadcrumbs } from "./shell";
import { Button, Card, Field, Input, Notice, toast } from "./ui";

const MESSAGES: Record<string, string> = {
  "Invalid login credentials": "Email atau kata sandi belum cocok. Coba periksa lagi ya.",
  "Email not confirmed": "Email kamu belum dikonfirmasi. Buka tautan di kotak masuk dulu ya.",
};

type Mode = "login" | "forgot" | "reset";

export function LoginForm({ staff = false }: { staff?: boolean }) {
  const router = useRouter();
  const params = useSearchParams();
  // Only same-site paths, so a crafted link cannot bounce someone to another site after login. Judged the way the
  // router will resolve it: a pattern test lets "/<tab>/evil.example" through, which a URL parser reads as "//evil.example".
  const next = params.get("next");
  const safeNext = useMemo(() => {
    if (!next || typeof window === "undefined") return null;
    try {
      const url = new URL(next, window.location.origin);
      return url.origin === window.location.origin ? url.pathname + url.search + url.hash : null;
    } catch {
      return null;
    }
  }, [next]);
  const { user, loading } = useAuth();

  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  // Already signed in and opening /masuk again: go straight on. (/staff decides for itself what to show.)
  // Once the form itself has chosen where to go after a sign-in, this stays out of the way.
  const leaving = useRef(false);
  useEffect(() => {
    if (!staff && !loading && user && mode === "login" && !busy && !leaving.current) router.replace(safeNext ?? "/akun");
  }, [staff, loading, user, mode, busy, router, safeNext]);

  // Arriving from a "reset password" email signs the person in and asks for a new password.
  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.slice(1));
    if (hash.get("type") === "recovery") setMode("reset");
    // An expired or already used email link comes back as #error=...: say so, and offer a new one.
    else if (hash.get("error")) {
      setMode("forgot");
      setError("Tautan itu sudah tidak berlaku. Minta tautan baru ya.");
    }
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setMode("reset");
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/masuk` });
        // An unknown address gives no error (nobody learns who is registered); a failed send does.
        if (error) return setError("Tautan belum bisa dikirim. Coba lagi sebentar ya.");
        setSent(true);
        return;
      }
      if (mode === "reset") {
        const { error } = await supabase.auth.updateUser({ password });
        if (error) return setError("Kata sandi baru belum tersimpan. Pakai minimal 6 karakter ya.");
        toast("Kata sandi baru tersimpan.");
        return router.replace("/akun");
      }
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error || !data.user) return setError(MESSAGES[error?.message ?? ""] ?? "Belum bisa masuk. Coba lagi sebentar ya.");
      const { data: profile } = await supabase.from("profiles").select("role, verification").eq("id", data.user.id).maybeSingle();
      if (staff && profile?.role !== "staff") {
        await supabase.auth.signOut();
        return setError("Akun ini bukan akun staf. Lulusan masuk lewat halaman Masuk.");
      }
      leaving.current = true;
      if (profile?.role === "staff") return router.replace("/staff");
      router.replace(safeNext ?? (profile?.verification === "draft" ? "/daftar" : "/akun"));
    } finally {
      setBusy(false);
    }
  };

  const title = { login: staff ? "Masuk staf" : "Masuk", forgot: "Lupa kata sandi", reset: "Buat kata sandi baru" }[mode];
  const intro = {
    login: staff ? "Khusus staf AsiaWorks." : "Halo lagi! Masuk untuk mengelola bisnis, peluang, dan koneksi kamu.",
    forgot: "Tulis email kamu. Kami kirim tautan untuk membuat kata sandi baru.",
    reset: "Pilih kata sandi baru untuk akun kamu.",
  }[mode];

  return (
    <div className="wash min-h-[calc(100dvh-4rem-1px-env(safe-area-inset-top,0px))] px-4 py-6 md:py-10">
      <div className="mx-auto w-full max-w-md">
        <Breadcrumbs items={[{ label: "Beranda", href: "/" }, { label: staff ? "Masuk staf" : "Masuk" }]} />
      </div>
      <Card raised className="rise mx-auto mt-6 w-full max-w-md p-6 sm:p-8 md:mt-12">
        {staff && (
          <span className="mb-4 inline-flex items-center gap-1.5 rounded-full bg-ink px-3 py-1 text-[11px] font-semibold text-white">
            <ShieldCheck className="h-3.5 w-3.5" /> Konsol staf
          </span>
        )}
        <h1 className="h-section">{title}</h1>
        <p className="body-copy mt-2 text-sm">{intro}</p>

        {sent ? (
          <div className="mt-6 space-y-4">
            <Notice tone="green">Kalau email itu terdaftar, tautannya sudah kami kirim. Cek kotak masuk (dan folder spam) ya.</Notice>
            <Button
              variant="secondary"
              full
              onClick={() => {
                setSent(false);
                setMode("login");
              }}
            >
              Kembali ke halaman masuk
            </Button>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-6 space-y-4">
            {mode !== "reset" && (
              <Field label="Email">
                <Input
                  type="email"
                  required
                  autoComplete="email"
                  autoCapitalize="none"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nama@email.com"
                />
              </Field>
            )}
            {mode !== "forgot" && (
              <Field label={mode === "reset" ? "Kata sandi baru" : "Kata sandi"}>
                <Input
                  type="password"
                  required
                  minLength={6}
                  autoComplete={mode === "reset" ? "new-password" : "current-password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </Field>
            )}
            {error && <Notice>{error}</Notice>}
            <Button type="submit" size="lg" full loading={busy}>
              {{ login: "Masuk", forgot: "Kirim tautan", reset: "Simpan kata sandi" }[mode]}
            </Button>
            {mode === "login" && (
              <button type="button" onClick={() => (setError(null), setMode("forgot"))} className="tap mx-auto -my-2.5 block py-2.5 text-[13px] font-medium text-maroon underline-offset-2 hover:underline">
                Lupa kata sandi?
              </button>
            )}
            {mode === "forgot" && (
              <button type="button" onClick={() => (setError(null), setMode("login"))} className="tap mx-auto -my-2.5 block py-2.5 text-[13px] font-medium text-maroon underline-offset-2 hover:underline">
                Kembali ke halaman masuk
              </button>
            )}
          </form>
        )}

        {!staff && mode === "login" && !sent && (
          <p className="mt-6 border-t border-line pt-5 text-center text-sm text-ink-soft">
            Belum punya akun?{" "}
            <Link href="/daftar" className="tap -my-2.5 inline-block py-2.5 font-semibold text-maroon underline-offset-2 hover:underline">
              Daftar sebagai lulusan
            </Link>
          </p>
        )}
      </Card>
    </div>
  );
}
