import { useEffect, useState } from 'react';
import type { ServiceKey } from '@/lib/services';

export type NearbyRiders = {
    count: number;
    eta_minutes: number | null;
    radius_km: number;
    /** Anonymous positions on a coarse grid. Never a rider id, name or photo. */
    riders: { lat: number; lng: number }[];
};

const DEFAULT_CENTER = { lat: 10.2092, lng: 123.7589 }; // same fallback as the location picker
const REFRESH_MS = 12_000;

/**
 * Polls the public nearby-riders endpoint for the chosen service, around the pickup (or the default centre).
 * Pauses while the tab is hidden. Returns null until the first answer, and keeps the last answer if a refresh fails.
 */
export function useNearbyRiders(
    service: ServiceKey | null,
    center: { lat: number; lng: number } | null,
    /** MigoDala only: 'two_wheel' or 'four_wheel', so the count and markers match the vehicle chosen. */
    vehicle: string | null = null,
): NearbyRiders | null {
    const [data, setData] = useState<NearbyRiders | null>(null);
    const lat = Number((center?.lat ?? DEFAULT_CENTER.lat).toFixed(3));
    const lng = Number((center?.lng ?? DEFAULT_CENTER.lng).toFixed(3));

    useEffect(() => {
        if (!service) return;
        setData(null);
        let stopped = false;
        let ctrl: AbortController | null = null;

        const load = async () => {
            if (document.hidden) return;
            ctrl?.abort();
            ctrl = new AbortController();
            try {
                const qs = new URLSearchParams({
                    service_type: service,
                    lat: String(lat),
                    lng: String(lng),
                });
                if (vehicle) qs.set('vehicle', vehicle);
                const res = await fetch(`/book/nearby-riders?${qs}`, {
                    headers: { Accept: 'application/json' },
                    signal: ctrl.signal,
                });
                if (res.ok && !stopped) setData((await res.json()) as NearbyRiders);
            } catch {
                /* offline or aborted: keep showing the last answer */
            }
        };

        void load();
        const timer = setInterval(load, REFRESH_MS);
        const onVisible = () => !document.hidden && void load();
        document.addEventListener('visibilitychange', onVisible);

        return () => {
            stopped = true;
            ctrl?.abort();
            clearInterval(timer);
            document.removeEventListener('visibilitychange', onVisible);
        };
    }, [service, lat, lng, vehicle]);

    return data;
}