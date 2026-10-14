import 'leaflet/dist/leaflet.css';
import type * as Leaflet from 'leaflet';
import { useEffect, useRef, useState } from 'react';
import { colors, statusTone } from '../theme';
import type { ServiceMapProps } from './ServiceMap.types';

// OpenStreetMap's own tile server is fine for a demo. For real traffic set EXPO_PUBLIC_MAP_TILE_URL
// to a hosted provider, as OpenStreetMap's tile usage policy asks.
const TILE_URL = process.env.EXPO_PUBLIC_MAP_TILE_URL || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap contributors</a>';

/** White circle holding a status-colored disc and a glyph, so status never depends on color alone. */
function pinHtml(status: string, selected: boolean): string {
  const tone = statusTone(status);
  const size = selected ? 40 : 32;
  const ring = selected ? `border:3px solid ${colors.navyDark};` : `border:2px solid ${colors.white};`;
  return (
    `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${tone.bg};${ring}box-sizing:border-box;` +
    `box-shadow:0 2px 6px rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;` +
    `color:${tone.text};font:700 ${selected ? 20 : 16}px/1 system-ui,sans-serif">${tone.glyph}</div>`
  );
}

/** Web map built on Leaflet and OpenStreetMap tiles (react-native-maps is phones only). */
export default function ServiceMap({ pins, selectedId, onSelect, center, you, recenterKey, labels }: ServiceMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Leaflet.Map | null>(null);
  const leafletRef = useRef<typeof Leaflet | null>(null);
  const layerRef = useRef<Leaflet.LayerGroup | null>(null);
  const onSelectRef = useRef(onSelect);
  useEffect(() => { onSelectRef.current = onSelect; });
  const [ready, setReady] = useState(false);

  // Leaflet is loaded only when the map screen opens, keeping it out of the first page load.
  useEffect(() => {
    let cancelled = false;
    void import('leaflet').then((module) => {
      const L = (module as unknown as { default?: typeof Leaflet }).default ?? module;
      if (cancelled || !containerRef.current) return;
      const map = L.map(containerRef.current, { zoomControl: false }).setView([center.latitude, center.longitude], 12);
      const zoom = L.control.zoom({ position: 'bottomright', zoomInTitle: labels.zoomIn, zoomOutTitle: labels.zoomOut });
      zoom.addTo(map);
      map.attributionControl.setPrefix(false);
      L.tileLayer(TILE_URL, { maxZoom: 19, attribution: ATTRIBUTION }).addTo(map);
      layerRef.current = L.layerGroup().addTo(map);
      leafletRef.current = L;
      mapRef.current = map;
      setTimeout(() => map.invalidateSize(), 100);
      setReady(true);
    });
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // The map is created once; later changes are applied by the effects below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Redraw the pins when the list (filters, search) or the selection changes.
  useEffect(() => {
    const L = leafletRef.current;
    const layer = layerRef.current;
    if (!ready || !L || !layer) return;
    layer.clearLayers();
    if (you) {
      L.circleMarker([you.latitude, you.longitude], { radius: 8, color: colors.white, weight: 3, fillColor: colors.navy, fillOpacity: 1, interactive: false })
        .bindTooltip(labels.you).addTo(layer);
    }
    pins.forEach((pin) => {
      const selected = pin.service.id === selectedId;
      const size = selected ? 40 : 32;
      const marker = L.marker([pin.latitude, pin.longitude], {
        icon: L.divIcon({ className: '', iconSize: [size, size], iconAnchor: [size / 2 - pin.dx, size / 2 - pin.dy], html: pinHtml(pin.service.status, selected) }),
        title: pin.label,
        alt: pin.label,
        keyboard: true,
        zIndexOffset: selected ? 1000 : 0,
      }).on('click', () => onSelectRef.current(pin.service.id)).addTo(layer);
      // Leaflet makes the pin focusable and activates it with Enter; give it a name and a role.
      const element = marker.getElement();
      element?.setAttribute('role', 'button');
      element?.setAttribute('aria-label', pin.label);
      element?.setAttribute('data-testid', `pin-${pin.service.id}`);
    });
  }, [pins, selectedId, you, ready, labels.you]);

  // Bring the selected pin into view, a little above center so the detail sheet does not hide it.
  useEffect(() => {
    const pin = pins.find((p) => p.service.id === selectedId);
    if (pin && mapRef.current) mapRef.current.setView([pin.latitude - 0.004, pin.longitude], Math.max(mapRef.current.getZoom(), 14));
    // Only when the selection changes, not when the filter does.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  useEffect(() => {
    if (ready) mapRef.current?.setView([center.latitude, center.longitude], 12);
  }, [recenterKey, center.latitude, center.longitude, ready]);

  return <div ref={containerRef} role="application" aria-label={labels.map} data-testid="service-map" style={{ width: '100%', height: '100%', minHeight: 280 }} />;
}
