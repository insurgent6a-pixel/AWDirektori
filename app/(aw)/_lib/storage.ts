import { supabase } from "./supabase";

const MAX_SIDE = 1280;

// Phone photos are several megabytes. Shrinking in the browser keeps uploads quick and pages light.
async function shrink(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file).catch(() => {
    throw new Error("Gambar tidak bisa dibaca. Pakai JPG atau PNG ya.");
  });
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const context = canvas.getContext("2d")!;
  context.fillStyle = "#ffffff"; // JPEG has no transparency
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Gambar tidak bisa diproses."))), "image/jpeg", 0.85),
  );
}

// Uploads into the user's own folder and returns the stored path ("{uid}/{file}.jpg").
export async function uploadImage(file: File, uid: string) {
  if (!file.type.startsWith("image/")) throw new Error("Pilih file gambar (JPG atau PNG) ya.");
  const path = `${uid}/${crypto.randomUUID()}.jpg`;
  const { error } = await supabase.storage.from("media").upload(path, await shrink(file), { contentType: "image/jpeg" });
  if (error) throw new Error("Gambar gagal diunggah. Coba lagi ya.");
  return path;
}

// Throws when a file could not be removed, so a delete never reports success while files stay behind.
export async function removeImages(paths: (string | null | undefined)[]) {
  const real = paths.filter((p): p is string => !!p);
  if (!real.length) return;
  const { error } = await supabase.storage.from("media").remove(real);
  if (error) throw new Error("File belum bisa dihapus. Coba lagi ya.");
}

// Every file a person uploaded. Staff call this before delete_account so no file outlives the account.
export async function removeUserFiles(uid: string) {
  const { data, error } = await supabase.storage.from("media").list(uid, { limit: 1000 });
  if (error) throw new Error("Daftar file belum bisa dibaca. Coba lagi ya.");
  await removeImages(data.map((file) => `${uid}/${file.name}`));
}
