import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useEffect, useRef } from 'react';
import type { Point } from '@/components/location-picker';

const pin = (letter: string, color: string) =>
    L.divIcon({
        className: '',
        iconSize: [30, 30],
        iconAnchor: [15, 15],
        html: `<div style="width:30px;height:30px;border-radius:50%;background:${color};color:#fff;border:3px solid #fff;box-shadow:0 1px 5px rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;font:700 13px Inter,Arial,sans-serif">${letter}</div>`,
    });

/** Straight-line distance in km between two points (an estimate, not the road distance). */
export function straightLineKm(a: Point, b: Point): number {
    const rad = (d: number) => (d * Math.PI) / 180;
    const h =
        Math.sin(rad(b.lat - a.lat) / 2) ** 2 +
        Math.cos(rad(a.lat)) *
            Math.cos(rad(b.lat)) *
            Math.sin(rad(b.lng - a.lng) / 2) ** 2;

    return 12742 * Math.asin(Math.sqrt(h));
}

/** Read-only map showing the pickup (A) and destination (B) pins, zoomed to fit both. */
export default function BookingMap({
    pickup,
    destination,
    className = 'h-64',
}: {
    pickup: Point | null;
    destination: Point | null;
    className?: string;
}) {
    const el = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!el.current || (!pickup && !destination)) return;
        const map = L.map(el.current, { scrollWheelZoom: false });
        // Wheel zoom turns on after a click on the map and off when the mouse leaves, so scrolling the page never gets stuck on it.
        map.on('click', () => map.scrollWheelZoom.enable());
        map.on('mouseout', () => map.scrollWheelZoom.disable());
        L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution:
                '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        }).addTo(map);

        const points: L.LatLngExpression[] = [];
        if (pickup) {
            L.marker([pickup.lat, pickup.lng], {
                icon: pin('A', '#16A36A'),
                title: 'Pickup',
            }).addTo(map);
            points.push([pickup.lat, pickup.lng]);
        }
        if (destination) {
            L.marker([destination.lat, destination.lng], {
                icon: pin('B', '#DC2626'),
                title: 'Destination',
            }).addTo(map);
            points.push([destination.lat, destination.lng]);
        }
        if (pickup && destination) {
            L.polyline(points, {
                color: '#1B5240',
                weight: 3,
                dashArray: '6 8',
            }).addTo(map);
            map.fitBounds(L.latLngBounds(points), { padding: [40, 40] });
        } else {
            map.setView(points[0], 16);
        }
        const fix = setTimeout(() => map.invalidateSize(), 150); // the map may be created inside a dialog that is still animating in

        return () => {
            clearTimeout(fix);
            map.remove();
        };
    }, [pickup?.lat, pickup?.lng, destination?.lat, destination?.lng]); // eslint-disable-line react-hooks/exhaustive-deps

    if (!pickup && !destination) {
        return (
            <p className="rounded-md bg-m-page px-3 py-3 text-sm text-m-muted">
                No map pin was saved for this booking, only the typed addresses.
            </p>
        );
    }

    return (
        <div
            ref={el}
            className={`isolate z-0 w-full overflow-hidden rounded-md border border-m-line bg-m-mint ${className}`}
            aria-label="Map showing pickup and destination"
        />
    );
}