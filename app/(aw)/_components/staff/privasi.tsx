"use client";

// Privacy requests from members: a copy of their data, or deleting the account for real.

import { Download, LockKeyhole, Trash2 } from "lucide-react";
import { useState } from "react";
import { useAuth } from "../../_lib/auth";
import { pesan, tanggal } from "../../_lib/format";
import { useQuery } from "../../_lib/hooks";
import { removeImages, removeUserFiles } from "../../_lib/storage";
import { supabase } from "../../_lib/supabase";
import type { Enums } from "../../_lib/types";
import { Badge, Button, Card, ConfirmSheet, Empty, Failed, Skeleton, toast } from "../ui";
import { personName, SectionTitle } from "./shared";

type Request = {
  id: string;
  kind: Enums<"privacy_kind">;
  created_at: string;
  handled_at: string | null;
  user: { id: string; full_name: string; nickname: string | null } | null;
};
type Contact = { id: string; email: string | null };

export function Privasi({ onChanged }: { onChanged: () => void }) {
  const { user: me } = useAuth();
  const list = useQuery(
    () =>
      supabase
        .from("privacy_requests")
        .select("id, kind, created_at, handled_at, user:profiles!privacy_requests_user_id_fkey(id, full_name, nickname)")
        .order("created_at", { ascending: false })
        .overrideTypes<Request[], { merge: false }>(),
    [],
  );
  const contacts = useQuery(() => supabase.rpc("staff_users").overrideTypes<Contact[], { merge: false }>(), []);
  const [deleting, setDeleting] = useState<Request | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const emailOf = (r: Request) => contacts.data?.find((c) => c.id === r.user?.id)?.email;

  // Builds the export in the database and hands it to the browser as a file. Staff send it on to the member.
  const exportData = async (r: Request) => {
    setBusy(r.id);
    const { data, error } = await supabase.rpc("export_user_data", { p_user: r.user!.id });
    setBusy(null);
    if (error) return toast(pesan(error), "error");
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `data-${(r.user!.nickname || r.user!.full_name || "lulusan").toLowerCase().replace(/\W+/g, "-")}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const markDone = async (r: Request) => {
    setBusy("done" + r.id);
    const { error } = await supabase.from("privacy_requests").update({ handled_at: new Date().toISOString(), handled_by: me!.id }).eq("id", r.id);
    setBusy(null);
    if (error) return toast("Belum tersimpan. Coba lagi ya.", "error");
    toast(r.kind === "delete" ? "Permintaan ditutup. Akunnya tidak dihapus." : "Permintaan ditandai selesai.");
    list.reload();
    onChanged(); // the queue number in the console's sidebar
  };

  // Deletion is real: the stored files first, then the account. Cascades remove every row; payments keep only the amount.
  const deleteAccount = async () => {
    const uid = deleting!.user!.id;
    // Photos that go with the account but sit outside its own folder: stories about its businesses, ads for them and
    // events it hosts were illustrated by staff. Those rows cascade with the account, so their files must go too.
    const owned = await supabase.from("businesses").select("id").eq("owner_id", uid);
    const hosted = await supabase.from("events").select("image_path").eq("host_id", uid);
    if (owned.error || hosted.error) throw new Error("Data akun belum bisa dibaca. Coba lagi ya.");
    const photos = hosted.data.map((row) => row.image_path);
    if (owned.data.length) {
      const ids = owned.data.map((b) => b.id).join();
      const stories = await supabase.from("stories").select("image_path").or(`business_a.in.(${ids}),business_b.in.(${ids})`);
      const ads = await supabase.from("banners").select("image_path").in("business_id", owned.data.map((b) => b.id));
      if (stories.error || ads.error) throw new Error("Data akun belum bisa dibaca. Coba lagi ya.");
      photos.push(...stories.data.map((row) => row.image_path), ...ads.data.map((row) => row.image_path));
    }
    await removeImages(photos);
    await removeUserFiles(uid);
    const { error } = await supabase.rpc("delete_account", { p_user: uid });
    if (error) throw new Error(pesan(error));
    setDeleting(null);
    toast("Akun beserta seluruh datanya sudah dihapus.");
    list.reload();
    onChanged();
  };

  return (
    <section>
      <SectionTitle title="Permintaan privasi">Unduh datanya, kirim ke email pemiliknya, lalu tandai selesai. Penghapusan akun bersifat permanen; kalau pemiliknya batal, tutup permintaannya.</SectionTitle>
      <div className="mt-4 space-y-3">
        <Failed query={list} />
        {list.loading && !list.data ? (
          <Skeleton className="h-32" />
        ) : !list.data?.length ? (
          <Empty icon={<LockKeyhole className="h-6 w-6" />} title="Tidak ada permintaan">
            Permintaan salinan data atau penghapusan akun dari anggota muncul di sini.
          </Empty>
        ) : (
          list.data.map((r) => (
            <Card key={r.id} className="p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={r.kind === "delete" ? "red" : "maroon"}>{r.kind === "delete" ? "Hapus akun" : "Ekspor data"}</Badge>
                {/* A handled delete request that is still here was closed without deleting: a deletion takes its request along. */}
                <Badge tone={!r.handled_at ? "amber" : r.kind === "delete" ? "gray" : "green"}>
                  {!r.handled_at ? "Menunggu" : `${r.kind === "delete" ? "Ditutup" : "Selesai"} ${tanggal(r.handled_at)}`}
                </Badge>
              </div>
              <p className="mt-2 font-semibold">{personName(r.user)}</p>
              <p className="text-[13px] text-ink-soft">
                {emailOf(r) ?? "email tidak tersedia"} · diminta {tanggal(r.created_at)}
              </p>
              {!r.handled_at && r.user && (
                <div className="mt-3 flex flex-wrap gap-2 border-t border-line pt-3">
                  {r.kind === "export" ? (
                    <>
                      <Button size="sm" loading={busy === r.id} onClick={() => exportData(r)}>
                        <Download className="h-4 w-4" /> Unduh data (JSON)
                      </Button>
                      <Button size="sm" variant="secondary" loading={busy === "done" + r.id} onClick={() => markDone(r)}>
                        Tandai selesai
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button size="sm" variant="danger" onClick={() => setDeleting(r)}>
                        <Trash2 className="h-4 w-4" /> Hapus akun permanen
                      </Button>
                      {/* The member changed their mind, or asked by mistake. */}
                      <Button size="sm" variant="secondary" loading={busy === "done" + r.id} onClick={() => markDone(r)}>
                        Tutup tanpa menghapus
                      </Button>
                    </>
                  )}
                </div>
              )}
            </Card>
          ))
        )}
      </div>

      <ConfirmSheet open={!!deleting} onClose={() => setDeleting(null)} onConfirm={deleteAccount} title="Hapus akun ini?" confirmLabel="Hapus permanen">
        Akun {deleting ? personName(deleting.user) : ""} beserta semua bisnis, peluang, koneksi, dan file yang diunggahnya akan dihapus permanen. Tindakan
        ini tidak bisa dibatalkan.
      </ConfirmSheet>
    </section>
  );
}
