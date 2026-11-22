import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useEffect, useRef } from 'react';

export type MapRider = {
    id: string;
    name: string;
    status: string;
    lat: number;
    lng: number;
    stale: boolean;
};
export type MapBooking = {
    id: string;
    reference: string;
    status: string;
    lat: number;
    lng: number;
};

const riderColor = (r: MapRider) =>
    r.stale
        ? '#9CA3AF'
        : r.status === 'online_available'
          ? '#16A36A'
          : r.status === 'on_trip'
            ? '#1B5240'
            : '#F59E0B';
const bookingColor = (s: string) =>
    s === 'pending' || s === 'searching_for_rider'
        ? '#DC2626'
        : s === 'in_progress'
          ? '#1B5240'
          : '#7C3AED';

const dot = (label: string, color: string, size = 28) =>
    L.divIcon({
        className: '',
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
        html: `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${color};color:#fff;border:3px solid #fff;box-shadow:0 1px 5px rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;font:700 12px Inter,Arial,sans-serif">${label}</div>`,
    });

const tip = (text: string) => {
    const el = document.createElement('div');
    el.textContent = text; // text node, never HTML: rider names are user input
    return el;
};

/** Live operations map. Markers are updated in place (no redraw) every time the polled data changes. */
export default function DispatchMap({
    riders,
    bookings,
}: {
    riders: MapRider[];
    bookings: MapBooking[];
}) {
    const el = useRef<HTMLDivElement>(null);
    const map = useRef<L.Map | null>(null);
    const riderLayer = useRef<L.LayerGroup | null>(null);
    const bookingLayer = useRef<L.LayerGroup | null>(null);
    const riderMarkers = useRef(new Map<string, L.Marker>());
    const bookingMarkers = useRef(new Map<string, L.Marker>());
    const fitted = useRef(false);

    useEffect(() => {
        if (!el.current) return;
        const m = L.map(el.current, { scrollWheelZoom: true }).setView(
            [10.2092, 123.7589],
            13,
        );
        L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution:
                '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        }).addTo(m);
        riderLayer.current = L.layerGroup().addTo(m);
        bookingLayer.current = L.layerGroup().addTo(m);
        map.current = m;
        const fix = setTimeout(() => m.invalidateSize(), 150);
        const rm = riderMarkers.current;
        const bm = bookingMarkers.current;

        return () => {
            clearTimeout(fix);
            m.remove();
            map.current = null;
            rm.clear();
            bm.clear();
            fitted.current = false;
        };
    }, []);

    useEffect(() => {
        const layer = riderLayer.current;
        if (!layer) return;
        const seen = new Set<string>();
        for (const r of riders) {
            seen.add(r.id);
            const label = `${r.name} · ${r.stale ? 'stale GPS' : r.status.replace(/_/g, ' ')}`;
            const existing = riderMarkers.current.get(r.id);
            if (existing) {
                existing
                    .setLatLng([r.lat, r.lng])
                    .setIcon(dot('🏍', riderColor(r)))
                    .setTooltipContent(tip(label));
            } else {
                riderMarkers.current.set(
                    r.id,
                    L.marker([r.lat, r.lng], { icon: dot('🏍', riderColor(r)) })
                        .bindTooltip(tip(label))
                        .addTo(layer),
                );
            }
        }
        for (const [id, mk] of riderMarkers.current) {
            if (!seen.has(id)) {
                mk.remove();
                riderMarkers.current.delete(id);
            }
        }
    }, [riders]);

    useEffect(() => {
        const layer = bookingLayer.current;
        if (!layer) return;
        const seen = new Set<string>();
        for (const b of bookings) {
            seen.add(b.id);
            const label = `${b.reference} · ${b.status.replace(/_/g, ' ')}`;
            const existing = bookingMarkers.current.get(b.id);
            if (existing) {
                existing
                    .setLatLng([b.lat, b.lng])
                    .setIcon(dot('A', bookingColor(b.status), 24))
                    .setTooltipContent(tip(label));
            } else {
                bookingMarkers.current.set(
                    b.id,
                    L.marker([b.lat, b.lng], {
                        icon: dot('A', bookingColor(b.status), 24),
                    })
                        .bindTooltip(tip(label))
                        .addTo(layer),
                );
            }
        }
        for (const [id, mk] of bookingMarkers.current) {
            if (!seen.has(id)) {
                mk.remove();
                bookingMarkers.current.delete(id);
            }
        }
    }, [bookings]);

    // Fit the view once, the first time there is something to show (afterwards the admin's own pan/zoom is respected).
    useEffect(() => {
        const m = map.current;
        if (
            !m ||
            fitted.current ||
            (riders.length === 0 && bookings.length === 0)
        )
            return;
        fitted.current = true;
        const pts: L.LatLngExpression[] = [
            ...riders.map((r) => [r.lat, r.lng] as L.LatLngExpression),
            ...bookings.map((b) => [b.lat, b.lng] as L.LatLngExpression),
        ];
        m.fitBounds(L.latLngBounds(pts), { padding: [40, 40], maxZoom: 16 });
    }, [riders, bookings]);

    return (
        <div
            ref={el}
            className="isolate z-0 h-96 w-full overflow-hidden rounded-md border border-m-line bg-m-mint"
            aria-label="Live dispatch map"
        />
    );
}
