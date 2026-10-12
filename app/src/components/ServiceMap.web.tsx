import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { useEffect, useRef } from 'react';
import { colors, statusTone } from '../theme';
import { FREMONT_CENTER } from '../utils/geo';
import type { ServiceMapProps } from './ServiceMap.types';

/** White circle with a status-colored dot (green open, amber reduced, red closed). */
function pinIcon(status: string, selected: boolean): L.DivIcon {
  const size = selected ? 38 : 28;
  const dot = selected ? 18 : 14;
  const ring = selected ? `border:3px solid ${colors.navy};box-sizing:border-box;` : '';
  return L.divIcon({
    className: '',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    html:
      `<div style="width:${size}px;height:${size}px;border-radius:50%;background:#fff;${ring}` +
      `box-shadow:0 2px 6px rgba(0,0,0,.3);display:flex;align-items:center;justify-content:center">` +
      `<div style="width:${dot}px;height:${dot}px;border-radius:50%;background:${statusTone(status).color}"></div></div>`,
  });
}

/** Web map (react-native-maps is native-only), built on Leaflet + OpenStreetMap tiles. */
export default function ServiceMap({ services, selectedId, onSelect }: ServiceMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Record<string, L.Marker>>({});
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  // Create the map once.
  useEffect(() => {
    if (!containerRef.current) return;
    const map = L.map(containerRef.current, { zoomControl: false }).setView(
      [FREMONT_CENTER.latitude, FREMONT_CENTER.longitude],
      12,
    );
    L.control.zoom({ position: 'bottomright' }).addTo(map);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map);
    mapRef.current = map;
    const resize = setTimeout(() => map.invalidateSize(), 100);
    return () => {
      clearTimeout(resize);
      map.remove();
      mapRef.current = null;
      markersRef.current = {};
    };
  }, []);

  // Redraw the pins when the list of services (e.g. the search filter) or the selection changes.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    Object.values(markersRef.current).forEach((marker) => marker.remove());
    markersRef.current = {};
    services.forEach((s) => {
      const selected = s.id === selectedId;
      const label = document.createElement('span');
      label.textContent = s.name;
      markersRef.current[s.id] = L.marker([s.latitude, s.longitude], {
        icon: pinIcon(s.status, selected),
        title: s.name,
        zIndexOffset: selected ? 1000 : 0,
      })
        .bindTooltip(label)
        .on('click', () => onSelectRef.current(s.id))
        .addTo(map);
    });
  }, [services, selectedId]);

  // Fly to the selected pin, a little north of centre so the bottom sheet does not cover it.
  useEffect(() => {
    const selected = services.find((s) => s.id === selectedId);
    if (selected && mapRef.current) {
      mapRef.current.flyTo([selected.latitude - 0.006, selected.longitude], 14, { duration: 0.6 });
    }
    // Only re-centre when the selection changes, not when the search filter does.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  return (
    <div
      ref={containerRef}
      role="application"
      aria-label="Map of Fremont showing city services and their status"
      style={{ width: '100%', height: '100%' }}
    />
  );
}
