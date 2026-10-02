// Fixed option lists. The strings are stored as-is in the database, so the seed and the filters must use these.

export const CATEGORIES = [
  "Food & Beverage",
  "Fashion & Aksesoris",
  "Beauty, Health & Wellness",
  "Art, Craft & Creative",
  "Edukasi",
  "Teknologi",
  "Entertainment",
  "Travel",
  "Lainnya",
] as const;

export const AREAS = [
  "Jabodetabek",
  "Makassar",
  "Jawa Barat & Banten",
  "Jawa Tengah & DIY",
  "Jawa Timur",
  "Bali & Nusa Tenggara",
  "Sumatera",
  "Kalimantan",
  "Sulawesi",
  "Maluku & Papua",
] as const;

// Filter only: matches every area except Jabodetabek (search_businesses knows this exact string).
export const LUAR_JABODETABEK = "Luar Jabodetabek";

// Does a location (or a peluang) in `area` belong under the filter? Makassar has its own entry in the list, and it is
// also part of Sulawesi. search_businesses() applies the same two rules.
export const areaMatches = (filter: string, area: string) =>
  filter === area || (filter === LUAR_JABODETABEK && area !== "Jabodetabek") || (filter === "Sulawesi" && area === "Makassar");

export const SERVICE_TYPES = { produk: "Produk", jasa: "Jasa", keduanya: "Produk & jasa" } as const;

export const PELUANG_KINDS = {
  supplier: "Supplier",
  partner: "Mitra",
  vendor: "Vendor",
  konsultan: "Konsultan",
  freelancer: "Freelancer",
  karyawan: "Karyawan",
} as const;

export const EVENT_KINDS = { meetup: "Meetup", workshop: "Workshop", gathering: "Gathering" } as const;

export const REVIEW_LABELS = {
  draft: "Draf",
  pending: "Menunggu tinjauan",
  approved: "Tayang",
  rejected: "Ditolak",
  suspended: "Ditangguhkan",
} as const;

// Badge tone per review status.
export const REVIEW_TONES = { draft: "gray", pending: "amber", approved: "green", rejected: "red", suspended: "red" } as const;

export const CONNECTION_LABELS = {
  pending: "Menunggu jawaban",
  accepted: "Diterima",
  declined: "Ditolak",
  intro: "Menunggu dikenalkan AsiaWorks",
} as const;

// The AsiaWorks programs a graduate can have finished, in the order people take them.
export const PROGRAMS = ["IB", "IA", "LP"] as const;

export const VERIFICATION_LABELS = {
  draft: "Belum lengkap",
  pending: "Menunggu verifikasi",
  approved: "Lulusan terverifikasi",
  rejected: "Perlu diperbaiki",
} as const;
