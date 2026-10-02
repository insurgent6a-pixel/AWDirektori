"use client";

// A business page: description, image, links, locations, the GLP perk, and the ways to reach the owner.
// ponytail: fetched in the browser, so search engines see an empty shell. Fetch in a server component if indexing matters.

import { BadgeCheck, ExternalLink, Globe, MapPin, Store, Wifi } from "lucide-react";
import { useParams } from "next/navigation";
import { useEffect } from "react";
import { ConnectButton, ContactButton, PromoCodeButton, ReportButton, SaveButton } from "../../_components/actions";
import { PeluangCard, PerkNote } from "../../_components/cards";
import MapView from "../../_components/map";
import { Breadcrumbs, Container } from "../../_components/shell";
import { Badge, Button, Card, Empty, Failed, Media, Skeleton } from "../../_components/ui";
import { SERVICE_TYPES } from "../../_lib/constants";
import { linkName, safeUrl } from "../../_lib/format";
import { useQuery } from "../../_lib/hooks";
import { searchBusinesses } from "../../_lib/queries";
import { supabase } from "../../_lib/supabase";
import type { Business, Peluang } from "../../_lib/types";

export default function BusinessPage() {
  const { id } = useParams<{ id: string }>();
  const { data, loading, error, reload } = useQuery(() => searchBusinesses({ ids: [id] }), [id]);
  const peluang = useQuery(() => supabase.from("peluang_feed").select("*").eq("business_id", id).overrideTypes<Peluang[], { merge: false }>(), [id]);
  const business = data?.[0];

  // One view per browser session, so a refresh does not inflate the owner's statistics.
  useEffect(() => {
    if (!business) return;
    const key = `aw-view-${business.id}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
    supabase.rpc("track_view", { p_business: business.id }).then(() => {});
  }, [business]);

  // The tab title. A <title> element here would lose to the layout's on a direct load, and the name is only known
  // once the data is in, so it is set (and put back) by hand.
  useEffect(() => {
    if (!business) return;
    const before = document.title;
    document.title = `${business.name} · Direktori AsiaWorks`;
    return () => {
      document.title = before;
    };
  }, [business]);

  if (loading) {
    return (
      <Container className="grid grid-cols-1 gap-6 py-8 lg:grid-cols-[1.6fr_1fr]">
        <Skeleton className="aspect-[16/9]" />
        <Skeleton className="h-80" />
      </Container>
    );
  }
  // A dropped request is not "this business does not exist".
  if (error) {
    return (
      <Container className="py-10">
        <Failed query={{ error, reload }} />
      </Container>
    );
  }
  if (!business) {
    return (
      <Container className="py-10">
        <Breadcrumbs items={[{ label: "Beranda", href: "/" }, { label: "Direktori", href: "/" }, { label: "Tidak ditemukan" }]} />
        <Empty icon={<Store className="h-6 w-6" />} title="Bisnis ini tidak ditemukan" action={<Button href="/">Kembali ke direktori</Button>}>
          Mungkin sedang tidak tayang, atau tautannya sudah berubah.
        </Empty>
      </Container>
    );
  }

  const pins = business.locations.map((l) => ({
    id: l.id,
    lat: l.lat,
    lng: l.lng,
    title: l.label || business.name,
    subtitle: l.mode === "area" ? `Perkiraan area, ${l.city}` : (l.address ?? l.city),
    approximate: l.mode === "area",
  }));

  return (
    <>
      <Container className="py-6 md:py-8">
        <Breadcrumbs
          items={[
            { label: "Beranda", href: "/" },
            { label: "Direktori", href: "/" },
            { label: business.category, href: `/?kategori=${encodeURIComponent(business.category)}` },
            { label: business.name },
          ]}
        />

        <div className="mt-5 grid grid-cols-1 items-start gap-6 lg:grid-cols-[1.6fr_1fr] lg:gap-8">
          <div className="min-w-0 space-y-6">
            <div className="rise relative">
              <Media path={business.image_path} name={business.name} className="aspect-[16/9] rounded-3xl shadow-raised" />
              <SaveButton kind="business" id={business.id} floating className="absolute top-3 right-3" />
            </div>

            <Summary business={business} className="lg:hidden" />

            <section>
              <h2 className="h-card text-xl">Tentang bisnis ini</h2>
              <p className="body-copy mt-2 whitespace-pre-line">{business.description}</p>
            </section>

            <section>
              <h2 className="h-card text-xl">Lokasi</h2>
              {business.online_only || business.locations.length === 0 ? (
                <p className="mt-3 flex items-center gap-3 rounded-2xl border border-line bg-surface p-4 text-sm">
                  <Wifi className="h-5 w-5 shrink-0 text-maroon" />
                  Bisnis ini melayani secara online. Hubungi pemiliknya untuk memesan.
                </p>
              ) : (
                <>
                  <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {business.locations.map((l, i) => (
                      <li key={l.id} className="flex gap-3 rounded-2xl border border-line bg-surface p-4 text-sm">
                        <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-maroon" />
                        <div className="min-w-0">
                          <p className="font-semibold">{l.label || (business.locations.length > 1 ? `Lokasi ${i + 1}` : "Lokasi")}</p>
                          <p className="text-ink-soft">{l.mode === "area" ? "Perkiraan area (sekitar 1 km)" : l.address}</p>
                          <p className="text-ink-soft">
                            {l.city} · {l.area}
                          </p>
                          {l.mode === "exact" && (
                            <a
                              href={`https://www.google.com/maps/search/?api=1&query=${l.lat},${l.lng}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="tap inline-flex min-h-10 items-center gap-1 text-[13px] font-semibold text-maroon underline-offset-4 hover:underline"
                            >
                              Buka di Google Maps <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                  <MapView pins={pins} still className="mt-3 h-72 md:h-96" />
                </>
              )}
            </section>

            {!!peluang.data?.length && (
              <section>
                <h2 className="h-card text-xl">Peluang dari bisnis ini</h2>
                <div className="mt-3 grid grid-cols-1 gap-4">
                  {peluang.data.map((p, i) => (
                    <PeluangCard key={p.id} peluang={p} index={i} />
                  ))}
                </div>
              </section>
            )}

            <ReportButton businessId={business.id} />
          </div>

          <Summary business={business} className="sticky top-24 hidden lg:block" />
        </div>
      </Container>

      {/* Phones keep the two main actions within thumb reach, just above the bottom bar. Sticky, so at the end of the
          page it rests under the content instead of covering the footer. */}
      <div className="sticky bottom-[calc(4rem+env(safe-area-inset-bottom,0px))] z-30 grid grid-cols-2 gap-2 border-t border-line bg-surface/95 p-3 backdrop-blur-md md:hidden">
        <ContactButton businessId={business.id} full />
        <ConnectButton businessId={business.id} ownerId={business.owner_id} targetName={business.name} full />
      </div>
    </>
  );
}

// Name, owner, perk, links and actions. A sticky side card on desktop, inline on phones.
function Summary({ business, className }: { business: Business; className?: string }) {
  return (
    <Card raised className={"rise p-5 md:p-6 " + (className ?? "")}>
      <p className="flex flex-wrap items-center gap-2 text-[11px] font-medium tracking-wide text-ink-soft uppercase">
        {business.category === "Lainnya" && business.category_other ? business.category_other : business.category}
        {business.service_type && <Badge tone="gray">{SERVICE_TYPES[business.service_type]}</Badge>}
      </p>
      <h1 className="mt-2 text-[1.75rem] leading-tight font-bold tracking-tight">{business.name}</h1>
      <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1.5 text-sm">
        <span className="font-semibold text-maroon">{business.owner_name}</span>
        <BadgeCheck className="h-4 w-4 text-maroon" aria-label="Lulusan terverifikasi" />
        {business.batch_lp && <Badge>LP {business.batch_lp}</Badge>}
        {business.batch_ib && <Badge tone="gray">IB {business.batch_ib}</Badge>}
        {business.batch_ia && <Badge tone="gray">IA {business.batch_ia}</Badge>}
      </p>

      {business.perk && (
        <div className="mt-4 space-y-2">
          <PerkNote perk={business.perk} />
          <PromoCodeButton businessId={business.id} />
        </div>
      )}

      <div className="mt-5 hidden gap-2 md:grid">
        <ConnectButton businessId={business.id} ownerId={business.owner_id} targetName={business.name} size="lg" full />
        <ContactButton businessId={business.id} size="lg" full />
      </div>

      {business.links.length > 0 && (
        <ul className="mt-5 space-y-2 border-t border-line pt-5">
          {business.links.map((url) => (
            <li key={url}>
              <a
                href={safeUrl(url)}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="tap flex items-center gap-3 rounded-xl border border-line px-3.5 py-2.5 text-sm font-medium hover:bg-page"
              >
                <Globe className="h-4 w-4 shrink-0 text-maroon" />
                <span className="min-w-0 flex-1 truncate">{linkName(url)}</span>
                <ExternalLink className="h-3.5 w-3.5 shrink-0 text-ink-soft" />
              </a>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
