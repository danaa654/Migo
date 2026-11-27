import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useEffect, useRef } from 'react';
import type { Point } from '@/components/location-picker';

const dot = (html: string, color: string) =>
    L.divIcon({
        className: '',
        iconSize: [30, 30],
        iconAnchor: [15, 15],
        html: `<div style="width:30px;height:30px;border-radius:50%;background:${color};color:#fff;border:3px solid #fff;box-shadow:0 1px 5px rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;font:700 13px Inter,Arial,sans-serif">${html}</div>`,
    });

/** Map for an active ride: pickup (A), destination (B) and the rider's moving marker, updated without redrawing the map. */
export default function LiveRideMap({
    pickup,
    destination,
    rider,
    wheelZoom = false,
}: {
    pickup: Point | null;
    destination: Point | null;
    rider: Point | null;
    /** true: the mouse wheel always zooms the map (rider screens). false: wheel zoom turns on after a click (default). */
    wheelZoom?: boolean;
}) {
    const el = useRef<HTMLDivElement>(null);
    const map = useRef<L.Map | null>(null);
    const pins = useRef<L.LayerGroup | null>(null);
    const riderMarker = useRef<L.Marker | null>(null);
    const fitted = useRef(false);

    useEffect(() => {
        if (!el.current) return;
        const m = L.map(el.current, { scrollWheelZoom: wheelZoom }).setView(
            pickup ? [pickup.lat, pickup.lng] : [10.2092, 123.7589],
            15,
        );
        // Wheel zoom turns on after a click on the map and off when the mouse leaves, so scrolling the page never gets stuck on it.
        if (!wheelZoom) {
            m.on('click', () => m.scrollWheelZoom.enable());
            m.on('mouseout', () => m.scrollWheelZoom.disable());
        }
        L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution:
                '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        }).addTo(m);
        pins.current = L.layerGroup().addTo(m);
        map.current = m;
        const fix = setTimeout(() => m.invalidateSize(), 150);

        return () => {
            clearTimeout(fix);
            m.remove();
            map.current = null;
            riderMarker.current = null;
            fitted.current = false;
        };
    }, []);

    useEffect(() => {
        if (!pins.current) return;
        pins.current.clearLayers();
        if (pickup)
            L.marker([pickup.lat, pickup.lng], {
                icon: dot('A', '#16A36A'),
                title: 'Pickup',
            }).addTo(pins.current);
        if (destination)
            L.marker([destination.lat, destination.lng], {
                icon: dot('B', '#DC2626'),
                title: 'Destination',
            }).addTo(pins.current);
    }, [pickup?.lat, pickup?.lng, destination?.lat, destination?.lng]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        const m = map.current;
        if (!m) return;
        if (!rider) {
            riderMarker.current?.remove();
            riderMarker.current = null;
            return;
        }
        if (!riderMarker.current)
            riderMarker.current = L.marker([rider.lat, rider.lng], {
                icon: dot('🏍', '#1B5240'),
                title: 'Your rider',
                zIndexOffset: 1000,
            }).addTo(m);
        else riderMarker.current.setLatLng([rider.lat, rider.lng]);

        if (!fitted.current) {
            fitted.current = true;
            const pts: L.LatLngExpression[] = [[rider.lat, rider.lng]];
            if (pickup) pts.push([pickup.lat, pickup.lng]);
            m.fitBounds(L.latLngBounds(pts), {
                padding: [50, 50],
                maxZoom: 17,
            });
        }
    }, [rider?.lat, rider?.lng]); // eslint-disable-line react-hooks/exhaustive-deps

    return (
        <div
            ref={el}
            className="isolate z-0 h-72 w-full overflow-hidden rounded-md border border-m-line bg-m-mint"
            aria-label="Live map of your ride"
        />
    );
}