"use client";

// Dashboard: Hubungkan requests, both directions. The owner accepts or declines; staff take no part.
// Contact details only show once a request is accepted (the database returns them only then).

import { Check, Link2, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { CONNECTION_LABELS } from "../../_lib/constants";
import { pesan, tanggal, waLink } from "../../_lib/format";
import { useQuery } from "../../_lib/hooks";
import { supabase } from "../../_lib/supabase";
import type { Connection } from "../../_lib/types";
import { ContactValue } from "../actions";
import { stagger } from "../cards";
import { Avatar, Badge, Button, Card, Empty, Failed, Skeleton, Tabs, toast } from "../ui";

const TONES = { pending: "amber", accepted: "green", declined: "gray", intro: "maroon" } as const;

export function KoneksiTab() {
  const { data, loading, error, reload } = useQuery(() => supabase.rpc("my_connections").overrideTypes<Connection[], { merge: false }>(), []);
  const [box, setBox] = useState<"masuk" | "terkirim">("masuk");
  const [busy, setBusy] = useState<string | null>(null);

  const all = data ?? [];
  const list = all.filter((c) => c.incoming === (box === "masuk"));
  const waiting = all.filter((c) => c.incoming && c.status === "pending").length;

  const respond = async (id: string, action: "accept" | "decline") => {
    setBusy(id + action);
    const { error } = await supabase.rpc("respond_connection", { p_id: id, p_action: action });
    setBusy(null);
    if (error) return toast(pesan(error), "error");
    window.dispatchEvent(new Event("aw:koneksi")); // the Koneksi badge re-counts (shell.tsx)
    toast(
      { accept: "Diterima. Kontak kalian berdua sekarang saling terbuka.", decline: "Permintaan ditolak." }[action],
    );
    reload();
  };

  return (
    <section>
      <h2 className="h-card text-xl">Koneksi</h2>
      <p className="text-[13px] text-ink-soft">Permintaan Hubungkan yang masuk ke kamu dan yang kamu kirim.</p>
      <Tabs
        className="mt-4 max-w-sm"
        items={[
          { value: "masuk", label: "Masuk", count: waiting },
          { value: "terkirim", label: "Terkirim" },
        ]}
        value={box}
        onChange={setBox}
      />

      <div className="mt-4 space-y-3">
        <Failed query={{ error, reload }} />
        {loading && !data ? (
          [0, 1].map((i) => <Skeleton key={i} className="h-36" />)
        ) : list.length === 0 ? (
          <Empty
            icon={<Link2 className="h-6 w-6" />}
            title={box === "masuk" ? "Belum ada permintaan masuk" : "Belum ada permintaan terkirim"}
            action={box === "terkirim" && <Button href="/lulusan">Cari lulusan</Button>}
          >
            {box === "masuk"
              ? "Saat lulusan lain menyapa bisnismu atau menjawab peluangmu, permintaannya muncul di sini."
              : "Temukan bisnis atau peluang yang cocok, lalu ketuk Hubungkan."}
          </Empty>
        ) : (
          list.map((c, i) => (
            <Card key={c.id} className="rise p-4" style={stagger(i)}>
              <div className="flex items-start gap-3">
                <Avatar name={c.other_name} />
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-semibold">
                    {c.other_name}
                    {c.other_lp && <Badge>LP {c.other_lp}</Badge>}
                    <Badge tone={TONES[c.status]}>{CONNECTION_LABELS[c.status]}</Badge>
                  </p>
                  <p className="mt-0.5 text-[12px] text-ink-soft">
                    {c.peluang_title ? (
                      <>Menjawab peluang “{c.peluang_title}”</>
                    ) : c.business_id ? (
                      <>
                        Untuk{" "}
                        <Link href={`/bisnis/${c.business_id}`} className="tap -my-2.5 inline-block py-2.5 font-medium text-maroon hover:underline">
                          {c.business_name}
                        </Link>
                      </>
                    ) : null}{" "}
                    · {tanggal(c.created_at)}
                  </p>
                </div>
              </div>
              <p className="body-copy mt-3 rounded-xl bg-page px-3.5 py-3 text-sm whitespace-pre-line">{c.message}</p>

              {c.status === "accepted" && (
                <div className="mt-3 space-y-2">
                  {c.other_phone ? (
                    <ContactValue value={c.other_phone} />
                  ) : (
                    <p className="text-[13px] text-ink-soft">Nomor WhatsApp belum diisi.</p>
                  )}
                  <div className="flex flex-wrap items-center gap-x-5 text-[13px] text-ink-soft">
                    {c.other_email && (
                      <a href={`mailto:${c.other_email}`} className="tap-soft inline-flex min-h-10 items-center font-medium text-maroon hover:underline">
                        {c.other_email}
                      </a>
                    )}
                    {c.business_contact && c.business_contact !== c.other_phone && (
                      <span>
                        Kontak bisnis:{" "}
                        <a
                          href={/@/.test(c.business_contact) ? `mailto:${c.business_contact}` : waLink(c.business_contact)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="tap-soft inline-flex min-h-10 items-center font-medium text-maroon hover:underline"
                        >
                          {c.business_contact}
                        </a>
                      </span>
                    )}
                  </div>
                </div>
              )}

              {c.incoming && (c.status === "pending" || c.status === "intro") && (
                <div className="mt-3 flex flex-wrap gap-2 border-t border-line pt-3">
                  <Button size="sm" loading={busy === c.id + "accept"} onClick={() => respond(c.id, "accept")}>
                    <Check className="h-4 w-4" /> Terima
                  </Button>
                  <Button size="sm" variant="secondary" loading={busy === c.id + "decline"} onClick={() => respond(c.id, "decline")}>
                    <X className="h-4 w-4" /> Tolak
                  </Button>
                </div>
              )}
            </Card>
          ))
        )}
      </div>
    </section>
  );
}
