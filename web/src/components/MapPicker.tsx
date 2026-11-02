import { useEffect, useRef, useState } from "react";
import { Field } from "./form";
import { logoPin, PIN_RATIO } from "./map-marker";

/** Kathmandu, as a starting view when a property has no coordinates yet. */
const DEFAULT: [number, number] = [27.7172, 85.324];

/**
 * Pick a property's location by clicking a map.
 *
 * Coordinates were two decimal-degree inputs, which asks a recovery officer
 * to know that Budhanilkantha is 27.7781, 85.3616 — so in practice they were
 * left empty, and an empty pair is why a notice shows no map and no "open in
 * OpenStreetMap" link.
 *
 * Leaflet is loaded only when this component mounts, not with the bundle: it
 * is 148 KB of JavaScript for one screen of the panel, and every other screen
 * would otherwise carry it. The import is inside an effect so the chunk is
 * fetched when the property editor opens and never before.
 *
 * The number fields stay, and stay authoritative — typing a coordinate from a
 * lalpurja moves the pin, and the form submits the same two values it always
 * did.
 */
export function MapPicker({
  latitude,
  longitude,
}: {
  latitude?: number | null;
  longitude?: number | null;
}) {
  const [lat, setLat] = useState(latitude ?? null);
  const [lng, setLng] = useState(longitude ?? null);
  const [failed, setFailed] = useState(false);
  const holder = useRef<HTMLDivElement>(null);
  const marker = useRef<{ setLatLng: (p: [number, number]) => void } | null>(null);

  useEffect(() => {
    let map: { remove: () => void } | null = null;
    let cancelled = false;

    (async () => {
      try {
        const L = (await import("leaflet")).default;
        await import("leaflet/dist/leaflet.css");
        if (cancelled || !holder.current) return;

        const start: [number, number] = lat != null && lng != null ? [lat, lng] : DEFAULT;
        map = L.map(holder.current, { attributionControl: true }).setView(start, lat != null ? 15 : 12);

        L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19,
          attribution: "© OpenStreetMap contributors",
        }).addTo(map as never);

        // Our own mark rather than Leaflet's default pin, which is a PNG
        // fetched by a relative path the bundler rewrites — a broken marker
        // image is a worse map than no image at all. A divIcon is markup, so
        // it takes the theme's colours and needs no asset.
        const icon = L.divIcon({
          html: logoPin(38),
          className: "",
          iconSize: [38, Math.round(38 * PIN_RATIO)],
          iconAnchor: [19, Math.round(38 * PIN_RATIO)],
        });
        const pin = L.marker(start, { icon, draggable: true }).addTo(map as never);
        (pin as never as { on: (e: string, f: () => void) => void }).on("dragend", () => {
          const ll = (pin as never as { getLatLng: () => { lat: number; lng: number } }).getLatLng();
          const next: [number, number] = [
            Number(ll.lat.toFixed(6)),
            Number(ll.lng.toFixed(6)),
          ];
          setLat(next[0]);
          setLng(next[1]);
        });
        marker.current = pin as never;
        if (lat == null) pin.setOpacity(0);

        (map as never as { on: (e: string, f: (ev: { latlng: { lat: number; lng: number } }) => void) => void }).on(
          "click",
          (ev) => {
            const next: [number, number] = [
              Number(ev.latlng.lat.toFixed(6)),
              Number(ev.latlng.lng.toFixed(6)),
            ];
            pin.setOpacity(1);
            pin.setLatLng(next);
            setLat(next[0]);
            setLng(next[1]);
          }
        );
      } catch {
        // A panel that cannot draw a map is still a panel: the number fields
        // below remain usable, so this degrades rather than breaks.
        if (!cancelled) setFailed(true);
      }
    })();

    return () => {
      cancelled = true;
      map?.remove();
    };
    // Mounted once; later coordinate edits move the pin through the effect below.
  }, []);

  // Typing into the number fields moves the pin, so the two stay in step.
  useEffect(() => {
    if (lat != null && lng != null) marker.current?.setLatLng([lat, lng]);
  }, [lat, lng]);

  return (
    <>
      {!failed && (
        <div class="sm:col-span-2 lg:col-span-3">
          <span class="label">Location</span>
          <div
            ref={holder}
            class="mt-1.5 h-64 w-full overflow-hidden rounded-lg border border-line bg-surface-sunken"
          />
          <p class="mt-1.5 text-xs text-content-faint">
            Click the map to set the pin, or type the coordinates below.
          </p>
        </div>
      )}

      <Field label="Latitude" hint="Decimal degrees, e.g. 27.6878">
        <input
          type="number" step="any" name="latitude" class="field mt-1.5"
          value={lat ?? ""}
          onInput={(e) => {
            const v = (e.target as HTMLInputElement).value;
            setLat(v === "" ? null : Number(v));
          }}
        />
      </Field>

      <Field label="Longitude" hint="Decimal degrees, e.g. 85.3159">
        <input
          type="number" step="any" name="longitude" class="field mt-1.5"
          value={lng ?? ""}
          onInput={(e) => {
            const v = (e.target as HTMLInputElement).value;
            setLng(v === "" ? null : Number(v));
          }}
        />
      </Field>
    </>
  );
}
