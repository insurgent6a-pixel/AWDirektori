"use client";

// Leaflet map on OpenStreetMap tiles (greyed in theme.css). Leaflet loads only when a map is on screen.
// Two uses: show pins (directory, business page) or pick one point (location form).

import "leaflet/dist/leaflet.css";
import type { Circle, LatLngBoundsExpression, Map as LeafletMap, Marker } from "leaflet";
import { LocateFixed, RotateCcw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "../_lib/format";

export type Pin = {
  id: string; // pins of one business share its id
  lat: number;
  lng: number;
  title: string;
  subtitle?: string;
  href?: string;
  approximate?: boolean; // drawn as a round dot in a ~1 km circle instead of a pointed pin
};

const INDONESIA: LatLngBoundsExpression = [
  [-10.5, 95],
  [5.5, 141],
];
const escapeHtml = (text: string) => text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

export default function MapView({
  pins = [],
  activeId,
  onSelect,
  pick,
  onPick,
  still,
  className,
}: {
  pins?: Pin[];
  activeId?: string | null;
  onSelect?: (id: string) => void;
  pick?: { lat: number; lng: number } | null; // picker mode: the chosen point
  onPick?: (point: { lat: number; lng: number }) => void;
  still?: boolean; // a map in the middle of a page: on a phone one finger scrolls the page instead of panning the map
  className?: string;
}) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<LeafletMap | null>(null);
  const layers = useRef<{ id: string; layer: Marker | Circle }[]>([]);
  const [ready, setReady] = useState(false);
  const [locating, setLocating] = useState(false);
  const [noLocation, setNoLocation] = useState(false);
  const picker = !!onPick;

  // Keep the latest callbacks and the active pin without re-creating the map or its pins.
  const handlers = useRef({ onSelect, onPick });
  handlers.current = { onSelect, onPick };
  const active = useRef(activeId);
  active.current = activeId;
  const refit = useRef(() => {});
  const zooming = useRef(false);
  const fitLater = useRef(false);

  useEffect(() => {
    let cancelled = false;
    let observer: ResizeObserver | undefined;
    import("leaflet").then(({ default: L }) => {
      if (cancelled || !container.current || map.current) return;
      const instance = L.map(container.current, { scrollWheelZoom: false, zoomControl: false, dragging: !(still && matchMedia("(pointer: coarse)").matches) });
      L.control.zoom({ position: "bottomright", zoomInTitle: "Perbesar", zoomOutTitle: "Perkecil" }).addTo(instance);
      instance.attributionControl.setPrefix(false);
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 18,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(instance);
      instance.fitBounds(INDONESIA);
      instance.on("click", (e) => handlers.current.onPick?.({ lat: e.latlng.lat, lng: e.latlng.lng }));
      // Leaflet drops a fitBounds that arrives while a zoom is still animating (a filter's answer often does).
      // fit() notes that it was skipped, and the map frames the pins once the animation ends.
      instance.on("zoomstart", () => (zooming.current = true));
      instance.on("zoomend", () => {
        zooming.current = false;
        if (fitLater.current) refit.current();
      });
      // Scroll-zoom only after a click, so the page keeps scrolling past the map.
      instance.on("focus", () => instance.scrollWheelZoom.enable());
      instance.on("blur", () => instance.scrollWheelZoom.disable());
      // A map inside a hidden tab starts at 0x0. Re-measure when it appears, and frame the pins the first time.
      let hadSize = container.current.offsetWidth > 0;
      observer = new ResizeObserver(() => {
        const hasSize = (container.current?.offsetWidth ?? 0) > 0;
        instance.invalidateSize();
        if (hasSize && !hadSize) refit.current();
        hadSize = hasSize;
      });
      observer.observe(container.current);
      map.current = instance;
      setReady(true);
    });
    return () => {
      cancelled = true;
      observer?.disconnect();
      map.current?.remove();
      map.current = null;
    };
  }, []);

  // Draw pins (or the picked point) whenever they change.
  useEffect(() => {
    const instance = map.current;
    if (!ready || !instance) return;
    let cancelled = false;
    import("leaflet").then(({ default: L }) => {
      if (cancelled) return;
      layers.current.forEach(({ layer }) => layer.remove());
      layers.current = [];
      const icon = (on: boolean, approximate = false) =>
        L.divIcon({
          className: "",
          html: `<span class="aw-pin" data-active="${on}"${approximate ? " data-approx" : ""}></span>`,
          iconSize: approximate ? [24, 24] : [32, 32],
          iconAnchor: approximate ? [12, 12] : [16, 30],
        });

      if (picker) {
        if (!pick) return;
        const marker = L.marker([pick.lat, pick.lng], { icon: icon(true), draggable: true, title: "Geser untuk memindahkan pin" }).addTo(instance);
        marker.on("dragend", () => {
          const point = marker.getLatLng();
          handlers.current.onPick?.({ lat: point.lat, lng: point.lng });
        });
        layers.current.push({ id: "", layer: marker });
        if (!instance.getBounds().contains([pick.lat, pick.lng]) || instance.getZoom() < 10) instance.setView([pick.lat, pick.lng], 14);
        return;
      }

      for (const pin of pins) {
        const on = pin.id === active.current;
        // title: the pin's name for a pointer's tooltip and for screen readers (Leaflet makes each marker a button).
        const marker = L.marker([pin.lat, pin.lng], { icon: icon(on, pin.approximate), zIndexOffset: on ? 1000 : 0, title: pin.title });
        // The 1 km circle is smaller than a pixel on a map of the whole country, so an approximate pin gets a dot as well.
        const drawn = pin.approximate
          ? [L.circle([pin.lat, pin.lng], { radius: 1000, color: "#8b1a1a", weight: 1.5, fillColor: "#8b1a1a", fillOpacity: on ? 0.3 : 0.14 }), marker]
          : [marker];
        for (const layer of drawn) {
          layer.bindPopup(
            `<strong>${escapeHtml(pin.title)}</strong>` +
              (pin.subtitle ? `<br>${escapeHtml(pin.subtitle)}` : "") +
              (pin.href ? `<br><a href="${escapeHtml(pin.href)}" class="tap">Lihat bisnis</a>` : ""),
          );
          layer.on("click", () => handlers.current.onSelect?.(pin.id));
          layer.addTo(instance);
          layers.current.push({ id: pin.id, layer });
        }
      }
    });
    return () => {
      cancelled = true;
    };
    // Keyed on the pins' content, so a parent re-render with an equal list does not redraw (and re-pop) every marker.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, JSON.stringify(pins), pick?.lat, pick?.lng, picker]);

  // Highlight the chosen pin in place. Redrawing the pins here would close the popup the same click just opened.
  useEffect(() => {
    if (picker) return;
    for (const { id, layer } of layers.current) {
      const on = id === activeId;
      if ("setStyle" in layer) layer.setStyle({ fillOpacity: on ? 0.3 : 0.14 });
      else {
        layer.getElement()?.firstElementChild?.setAttribute("data-active", String(on));
        layer.setZIndexOffset(on ? 1000 : 0);
      }
    }
  }, [activeId, picker]);

  const fit = () => {
    const instance = map.current;
    if (!instance) return;
    fitLater.current = zooming.current;
    if (zooming.current) return;
    // More room on top: the two buttons sit there.
    if (pins.length) instance.fitBounds(pins.map((pin) => [pin.lat, pin.lng] as [number, number]), { paddingTopLeft: [48, 84], paddingBottomRight: [48, 48], maxZoom: 14 });
    else instance.fitBounds(INDONESIA);
  };

  refit.current = () => !picker && fit();

  // Refit when the set of pins changes (a new search), not when one is merely highlighted.
  const pinKey = pins.map((pin) => `${pin.lat},${pin.lng}`).join("|");
  useEffect(() => {
    if (ready && !picker) fit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, pinKey, picker]);

  const locate = () => {
    setLocating(true);
    setNoLocation(false);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setLocating(false);
        if (picker) handlers.current.onPick?.({ lat: coords.latitude, lng: coords.longitude });
        map.current?.setView([coords.latitude, coords.longitude], 14);
      },
      () => {
        setLocating(false);
        setNoLocation(true); // said on the map itself: a toast would sit behind the sheet the picker lives in
      },
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  };

  return (
    <div className={cn("relative isolate overflow-hidden rounded-2xl border border-line", className)}>
      <div ref={container} className="aw-map h-full w-full" />
      <div className="absolute top-3 right-3 z-[500] flex gap-2">
        {!picker && (
          <button
            type="button"
            onClick={fit}
            className="tap flex h-10 items-center gap-1.5 rounded-full bg-surface px-3.5 text-[13px] font-medium shadow-raised hover:bg-page"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Atur ulang
          </button>
        )}
        <button
          type="button"
          onClick={locate}
          disabled={locating}
          className="tap flex h-10 items-center gap-1.5 rounded-full bg-surface px-3.5 text-[13px] font-medium shadow-raised hover:bg-page disabled:opacity-60"
        >
          <LocateFixed className="h-3.5 w-3.5 text-maroon" /> {locating ? "Mencari..." : "Lokasi saya"}
        </button>
      </div>
      {noLocation && (
        <p role="alert" className="absolute top-16 right-3 z-[500] max-w-[70%] rounded-xl bg-surface/95 px-3.5 py-2.5 text-[13px] text-red shadow-raised">
          Lokasi belum bisa dibaca. Izinkan akses lokasi di browser dulu ya.
        </p>
      )}
      {picker && !pick && (
        <p className="pointer-events-none absolute top-3 left-3 z-[500] max-w-[55%] rounded-xl bg-surface/95 px-3.5 py-2.5 text-[13px] shadow-raised">
          Ketuk peta untuk menaruh pin, lalu geser kalau perlu.
        </p>
      )}
    </div>
  );
}
