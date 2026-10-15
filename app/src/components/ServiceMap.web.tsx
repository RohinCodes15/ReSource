import type * as Leaflet from 'leaflet';
import { useEffect, useRef, useState } from 'react';
import { colors, statusTone } from '../theme';
import type { MapPin, ServiceMapProps } from './ServiceMap.types';

// OpenStreetMap's own tile server is fine for a demo. For real traffic set EXPO_PUBLIC_MAP_TILE_URL
// to a hosted provider, as OpenStreetMap's tile usage policy asks.
const TILE_URL = process.env.EXPO_PUBLIC_MAP_TILE_URL || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap contributors</a>';
// Leaflet's stylesheet is a copy in public/leaflet, added to the page only when a map opens, so it
// does not hold up the first paint of every other screen.
const LEAFLET_CSS = '/leaflet/leaflet-1.9.4.css';
/** Pins closer than this many pixels on screen are drawn as one group. */
const CLUSTER_PX = 44;
/** Zoom at which a group is opened into a ring instead of zooming further. */
const RING_ZOOM = 16;

function loadLeafletCss(): Promise<void> {
  if (document.querySelector(`link[href="${LEAFLET_CSS}"]`)) return Promise.resolve();
  return new Promise((resolve) => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = LEAFLET_CSS;
    link.onload = () => resolve();
    link.onerror = () => resolve();
    document.head.appendChild(link);
  });
}

/** A paper-colored disc with a status glyph and a navy edge, so status never depends on color alone. */
function pinHtml(status: string, selected: boolean): string {
  const tone = statusTone(status);
  const size = selected ? 38 : 30;
  const ring = selected ? `border:3px solid ${colors.navyDark};` : `border:2px solid ${colors.navy};`;
  return (
    `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${tone.bg};${ring}box-sizing:border-box;` +
    `box-shadow:0 1px 3px rgba(26,34,51,.25);display:flex;align-items:center;justify-content:center;` +
    `color:${tone.text};font:700 ${selected ? 18 : 15}px/1 system-ui,sans-serif">${tone.glyph}</div>`
  );
}

/** A group of pins: a navy disc with the number of services in it. */
function clusterHtml(count: number): string {
  return (
    `<div style="width:40px;height:40px;border-radius:50%;background:${colors.navy};border:3px solid ${colors.background};` +
    `box-shadow:0 0 0 1.5px ${colors.navy},0 1px 4px rgba(26,34,51,.3);display:flex;align-items:center;justify-content:center;` +
    `color:${colors.white};font:600 16px/1 Inter_600SemiBold,system-ui,sans-serif">${count}</div>`
  );
}

type Group = { key: string; pins: MapPin[]; lat: number; lng: number };

/** Greedy grouping by distance on screen at the given zoom. */
function cluster(L: typeof Leaflet, map: Leaflet.Map, pins: MapPin[], zoom: number): Group[] {
  const groups: (Group & { x: number; y: number })[] = [];
  pins.forEach((pin) => {
    const point = map.project(L.latLng(pin.latitude, pin.longitude), zoom);
    const near = groups.find((g) => Math.hypot(g.x - point.x, g.y - point.y) < CLUSTER_PX);
    if (near) {
      near.pins.push(pin);
      const n = near.pins.length;
      near.x += (point.x - near.x) / n;
      near.y += (point.y - near.y) / n;
      near.lat += (pin.latitude - near.lat) / n;
      near.lng += (pin.longitude - near.lng) / n;
    } else {
      groups.push({ key: '', pins: [pin], lat: pin.latitude, lng: pin.longitude, x: point.x, y: point.y });
    }
  });
  return groups.map((g) => ({ key: g.pins.map((p) => p.service.id).sort().join('|'), pins: g.pins, lat: g.lat, lng: g.lng }));
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
  const [zoom, setZoom] = useState(12);
  /** The group opened into a ring, by its key. */
  const [opened, setOpened] = useState<string | null>(null);
  const [tilesFailed, setTilesFailed] = useState(false);

  // Leaflet is loaded only when the map screen opens, keeping it out of the first page load.
  useEffect(() => {
    let cancelled = false;
    void Promise.all([import('leaflet'), loadLeafletCss()]).then(([module]) => {
      const L = (module as unknown as { default?: typeof Leaflet }).default ?? module;
      if (cancelled || !containerRef.current) return;
      const map = L.map(containerRef.current, { zoomControl: false }).setView([center.latitude, center.longitude], 12);
      L.control.zoom({ position: 'topright', zoomInTitle: labels.zoomIn, zoomOutTitle: labels.zoomOut }).addTo(map);
      map.attributionControl.setPrefix(false);
      // OpenStreetMap refuses tile requests that carry no Referer (the site sends none by default),
      // so the tiles name this site's origin. A tile that still fails is hidden, never painted over.
      let loaded = 0;
      let failed = 0;
      L.tileLayer(TILE_URL, { maxZoom: 19, attribution: ATTRIBUTION, referrerPolicy: 'strict-origin-when-cross-origin', className: 'resource-tiles' })
        .on('tileload', () => { loaded += 1; setTilesFailed(false); })
        .on('tileerror', (event: Leaflet.TileErrorEvent) => {
          (event.tile as HTMLElement).style.visibility = 'hidden';
          failed += 1;
          if (!loaded && failed >= 2) setTilesFailed(true);
        })
        .addTo(map);
      layerRef.current = L.layerGroup().addTo(map);
      map.on('zoomend', () => { setZoom(map.getZoom()); setOpened(null); });
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

  // Redraw the pins when the list (filters, search), the zoom, an opened group or the selection changes.
  useEffect(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!ready || !L || !map || !layer) return;
    layer.clearLayers();
    if (you) {
      L.circleMarker([you.latitude, you.longitude], { radius: 8, color: colors.white, weight: 3, fillColor: colors.navy, fillOpacity: 1, interactive: false })
        .bindTooltip(labels.you).addTo(layer);
    }
    const tag = (marker: Leaflet.Marker, label: string, testId: string, extra?: Record<string, string>) => {
      // Leaflet makes the marker focusable and activates it with Enter; give it a name and a role.
      const element = marker.getElement();
      element?.setAttribute('role', 'button');
      element?.setAttribute('aria-label', label);
      element?.setAttribute('data-testid', testId);
      Object.entries(extra ?? {}).forEach(([name, value]) => element?.setAttribute(name, value));
    };
    const drawPin = (pin: MapPin, lat: number, lng: number, dx = 0, dy = 0) => {
      const selected = pin.service.id === selectedId;
      const size = selected ? 38 : 30;
      const marker = L.marker([lat, lng], {
        icon: L.divIcon({ className: '', iconSize: [size, size], iconAnchor: [size / 2 - dx, size / 2 - dy], html: pinHtml(pin.service.status, selected) }),
        title: pin.label,
        alt: pin.label,
        keyboard: true,
        zIndexOffset: selected ? 1000 : 0,
      }).on('click', () => onSelectRef.current(pin.service.id)).addTo(layer);
      tag(marker, pin.label, `pin-${pin.service.id}`);
    };
    cluster(L, map, pins, zoom).forEach((group) => {
      if (group.pins.length === 1) { drawPin(group.pins[0], group.pins[0].latitude, group.pins[0].longitude); return; }
      // An opened group, or one holding the selected service, is drawn as a ring around its center.
      if (group.key === opened || group.pins.some((pin) => pin.service.id === selectedId)) {
        const radius = Math.max(28, group.pins.length * 9);
        group.pins.forEach((pin, i) => {
          const angle = (2 * Math.PI * i) / group.pins.length - Math.PI / 2;
          drawPin(pin, group.lat, group.lng, Math.round(radius * Math.cos(angle)), Math.round(radius * Math.sin(angle)));
        });
        return;
      }
      const label = labels.cluster(group.pins.length, group.pins.map((pin) => pin.label).join('; '));
      const marker = L.marker([group.lat, group.lng], {
        icon: L.divIcon({ className: '', iconSize: [40, 40], iconAnchor: [20, 20], html: clusterHtml(group.pins.length) }),
        title: label,
        alt: label,
        keyboard: true,
      }).on('click', () => {
        // Zoom in until the group comes apart; pins that share one address open into a ring instead.
        const bounds = L.latLngBounds(group.pins.map((pin) => [pin.latitude, pin.longitude] as [number, number]));
        const target = Math.min(map.getBoundsZoom(bounds.pad(0.6)), RING_ZOOM);
        if (target <= map.getZoom() || !bounds.isValid() || bounds.getNorthEast().equals(bounds.getSouthWest())) {
          if (map.getZoom() < 14) map.setView(bounds.getCenter(), 14);
          setOpened(group.key);
          window.setTimeout(() => setOpened(group.key), 350); // after the zoom has settled
        } else {
          map.fitBounds(bounds.pad(0.6), { maxZoom: RING_ZOOM });
        }
      }).addTo(layer);
      tag(marker, label, 'pin-cluster', { 'data-count': String(group.pins.length), 'data-members': group.key });
    });
  }, [pins, selectedId, you, ready, zoom, opened, labels]);

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

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', minHeight: 280 }}>
      <div ref={containerRef} role="application" aria-label={labels.map} data-testid="service-map" style={{ width: '100%', height: '100%', minHeight: 280 }} />
      {tilesFailed && (
        <div role="status" data-testid="map-tiles-failed" style={{ position: 'absolute', left: 12, right: 12, bottom: 12, zIndex: 900, background: colors.surface, color: colors.text, border: `1px solid ${colors.border}`, borderRadius: 10, padding: '10px 12px', font: '400 14px/1.4 Inter_400Regular, system-ui, sans-serif' }}>
          {labels.tilesFailed}
        </div>
      )}
    </div>
  );
}
