import { REVIEW_LABELS, REVIEW_TONES } from "./constants";
import { supabase } from "./supabase";

export function cn(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

// Our own database functions raise their messages in Indonesian (P0001, or 42501/28000 where the function chose the
// code). Anything else, a broken constraint or a dropped connection, would reach people as raw English.
export const pesan = (error: { message: string; code?: string }) =>
  ["P0001", "42501", "28000"].includes(error.code ?? "") && !/row-level|permission denied/i.test(error.message)
    ? error.message
    : "Belum berhasil. Periksa koneksi lalu coba lagi ya.";

// "smooth", unless the visitor asked their device for less motion.
export const scrollBehavior = (): ScrollBehavior => (matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth");

// Dates and times show in the viewer's own zone, so the label reads WIB, WITA or WIT as it should.
const dateFormat = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "long", year: "numeric" });
const shortDateFormat = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", year: "numeric" });
const dayFormat = new Intl.DateTimeFormat("id-ID", { weekday: "long", day: "numeric", month: "long" });
const timeFormat = new Intl.DateTimeFormat("id-ID", { hour: "2-digit", minute: "2-digit", timeZoneName: "short" });
const monthFormat = new Intl.DateTimeFormat("id-ID", { month: "short" });
// A date without a time ("2026-11-04", a deadline) means that calendar day wherever the viewer is, not UTC midnight.
const toDate = (value: string | Date) => new Date(typeof value === "string" && value.length === 10 ? value + "T00:00:00" : value);
export const tanggal = (value: string | Date) => dateFormat.format(toDate(value));
export const tanggalPendek = (value: string | Date) => shortDateFormat.format(toDate(value)); // "4 Nov 2026", for tight cells
export const hari = (value: string | Date) => dayFormat.format(new Date(value));
export const jam = (value: string | Date) => timeFormat.format(new Date(value));
export const bulanPendek = (value: string | Date) => monthFormat.format(new Date(value)).replace(".", "");

// "Sisa 5 hari" for a deadline (a date without time). Null when there is no deadline.
export function sisaHari(deadline: string | null) {
  if (!deadline) return null;
  const days = Math.round((new Date(deadline + "T00:00:00").getTime() - new Date().setHours(0, 0, 0, 0)) / 86_400_000);
  if (days < 0) return "Sudah lewat";
  if (days === 0) return "Hari terakhir";
  return `Sisa ${days} hari`;
}

export const jarak = (km: number) => (km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1).replace(".", ",")} km`);

// 0812-3456-7890 or +62 812... becomes 628123456790 for wa.me.
export function waNumber(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("0")) return "62" + digits.slice(1);
  if (digits.startsWith("8")) return "62" + digits;
  return digits;
}
export const looksLikePhone = (value: string) => /^[+\d][\d\s\-().]{7,}$/.test(value.trim());
export function waLink(phone: string, text?: string) {
  return `https://wa.me/${waNumber(phone)}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}

// Stored links are rendered as <a href>. Anything that is not http(s) becomes inert.
export const safeUrl = (url: string) => (/^https?:\/\//i.test(url) ? url : "#");
export const withHttps = (url: string) => (/^https?:\/\//i.test(url.trim()) ? url.trim() : `https://${url.trim()}`);
// What an owner types becomes a full address (withHttps). "@namatoko" or a bare word is not one.
export const validLink = (url: string) => /^https?:\/\/[^\s/@]+\.[^\s/]{2,}/i.test(url);

const LINK_NAMES: [RegExp, string][] = [
  [/(^|\.)instagram\.com$/, "Instagram"],
  [/(^|\.)tiktok\.com$/, "TikTok"],
  [/(^|\.)(facebook|fb)\.com$/, "Facebook"],
  [/(^|\.)tokopedia\.com$/, "Tokopedia"],
  [/(^|\.)shopee\.[a-z.]+$/, "Shopee"],
  [/(^|\.)(wa\.me|whatsapp\.com)$/, "WhatsApp"],
  [/(^|\.)(youtube\.com|youtu\.be)$/, "YouTube"],
  [/(^|\.)linkedin\.com$/, "LinkedIn"],
  [/(^|\.)(x|twitter)\.com$/, "X"],
];
// "Instagram" for instagram.com/toko, otherwise the bare host. Judged by the host alone, so wix.com is not "X".
export function linkName(url: string) {
  const host = url.replace(/^https?:\/\/(www\.)?/i, "").split(/[/?#]/)[0].toLowerCase();
  return LINK_NAMES.find(([pattern]) => pattern.test(host))?.[1] ?? host;
}

// <input type="datetime-local"> (and "date") reads and writes local time without a zone. Slice to 10 for a date.
export const localInput = (value: string | Date | null) =>
  value ? new Date(new Date(value).getTime() - new Date(value).getTimezoneOffset() * 60_000).toISOString().slice(0, 16) : "";

export function initials(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  return ((words[0]?.[0] ?? "") + (words.length > 1 ? words[words.length - 1][0] : "")).toUpperCase() || "A";
}

export const imgUrl = (path: string) => supabase.storage.from("media").getPublicUrl(path).data.publicUrl;

// The badge an owner sees. "Tayang" only when it really shows: approved, switched on, and not past its date.
export function reviewBadge(status: keyof typeof REVIEW_LABELS, active = true, until?: string | null) {
  if (status === "approved" && !active) return { label: "Dimatikan", tone: "gray" as const };
  if (status === "approved" && until && until < localInput(new Date()).slice(0, 10)) return { label: "Lewat batas waktu", tone: "gray" as const };
  return { label: REVIEW_LABELS[status], tone: REVIEW_TONES[status] };
}

// The batch on a card: the furthest program its owner gave a number for.
export const batchLabel = (owner: { batch_lp: number | null; batch_ia: number | null; batch_ib: number | null }) =>
  owner.batch_lp ? `LP ${owner.batch_lp}` : owner.batch_ia ? `IA ${owner.batch_ia}` : owner.batch_ib ? `IB ${owner.batch_ib}` : null;

// Every program someone chose, with its batch number where they gave one: ["IB", "IA 12", "LP 150"].
export const programLabels = (person: { programs: string[]; batch_lp: number | null; batch_ib: number | null; batch_ia: number | null }) =>
  person.programs.map((program) => {
    const batch = ({ IB: person.batch_ib, IA: person.batch_ia, LP: person.batch_lp } as Record<string, number | null>)[program];
    return batch ? `${program} ${batch}` : program;
  });
