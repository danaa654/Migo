import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { ArrowUpDown, MapPin, Route, Search, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { straightLineKm } from '@/components/booking-map';

export type Point = { lat: number; lng: number };
export type Mode = 'pickup' | 'destination';

type Props = {
    pickup: Point | null;
    destination: Point | null;
    pickupText: string;
    destinationText: string;
    /** Called whenever the customer sets a point (map click, dragging a pin, search, or "use my location"). */
    onPick: (mode: Mode, point: Point, address: string) => void;
    /** Called when the customer types in one of the two address fields (the parent clears that field's pin). */
    onText: (mode: Mode, text: string) => void;
    onClear: (mode: Mode) => void;
    onSwap: () => void;
    errors?: Partial<Record<Mode, string>>;
    /** Gives the parent a function that detects the customer's location (for a "Use my location" button elsewhere). */
    registerLocate?: (fn: () => void) => void;
    onLocating?: (locating: boolean) => void;
    /** Let the map grow to fill the height left by its parent (used by the booking page). */
    fill?: boolean;
    /** "Destination" for rides, "Delivery destination" for MigoDala. */
    destinationLabel?: string;
};

type Place = {
    place_id: number;
    display_name: string;
    lat: string;
    lon: string;
};

const DEFAULT_CENTER: Point = { lat: 10.2092, lng: 123.7589 }; // Naga City, Cebu
const NOMINATIM = 'https://nominatim.openstreetmap.org';

/**
 * OpenStreetMap's free Nominatim service allows at most 1 request per second, so every lookup goes through
 * this queue, which spaces requests at least 1.1 s apart.
 */
let queue: Promise<unknown> = Promise.resolve();
let lastRequestAt = 0;
function nominatim<T>(path: string): Promise<T> {
    const run = queue.then(async () => {
        const wait = Math.max(0, 1100 - (Date.now() - lastRequestAt));
        if (wait) await new Promise((r) => setTimeout(r, wait));
        lastRequestAt = Date.now();
        const res = await fetch(
            `${NOMINATIM}${path}${path.includes('?') ? '&' : '?'}format=jsonv2&accept-language=en`,
        );
        if (!res.ok) throw new Error(`Nominatim ${res.status}`);

        return (await res.json()) as T;
    });
    queue = run.catch(() => undefined);

    return run;
}

const coordText = (p: Point) => `${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}`;

/** A coloured circle with a letter (pure HTML, so no marker image files are needed). */
const pin = (letter: string, color: string) =>
    L.divIcon({
        className: '',
        iconSize: [30, 30],
        iconAnchor: [15, 15],
        html: `<div style="width:30px;height:30px;border-radius:50%;background:${color};color:#fff;border:3px solid #fff;box-shadow:0 1px 5px rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;font:700 13px Inter,Arial,sans-serif">${letter}</div>`,
    });

const ICONS: Record<Mode, L.DivIcon> = {
    pickup: pin('A', '#16A36A'),
    destination: pin('B', '#DC2626'),
};

type FieldProps = {
    id: string;
    mode: Mode;
    label: string;
    value: string;
    placeholder: string;
    error?: string;
    active: boolean;
    hasPoint: boolean;
    busy: boolean;
    onFocus: () => void;
    onChange: (text: string) => void;
    onSearch: () => void;
    onClear: () => void;
};

function Field({
    id,
    mode,
    label,
    value,
    placeholder,
    error,
    active,
    hasPoint,
    busy,
    onFocus,
    onChange,
    onSearch,
    onClear,
}: FieldProps) {
    return (
        <div>
            <div
                className={`flex items-center gap-3 rounded-2xl border bg-m-card px-4 py-3 shadow-sm transition ${active ? 'border-m-accent ring-2 ring-m-accent/20' : 'border-m-line'} ${error ? 'border-m-red' : ''}`}
            >
                <MapPin
                    className={`size-6 shrink-0 ${mode === 'pickup' ? 'text-m-green' : 'text-m-red'}`}
                    fill="currentColor"
                    fillOpacity={0.15}
                    aria-hidden
                />
                <div className="min-w-0 flex-1">
                    <label htmlFor={id} className="block text-xs text-m-muted">
                        {label}
                    </label>
                    <input
                        id={id}
                        name={id}
                        type="text"
                        value={value}
                        onFocus={onFocus}
                        onChange={(e) => onChange(e.target.value)}
                        onKeyDown={(e) => {
                            // Without a pin yet, Enter searches the typed address instead of submitting the form.
                            if (e.key === 'Enter' && !hasPoint) {
                                e.preventDefault();
                                onSearch();
                            }
                        }}
                        placeholder={placeholder}
                        autoComplete="off"
                        aria-invalid={!!error}
                        className="w-full bg-transparent text-sm font-medium text-m-ink outline-none placeholder:font-normal placeholder:text-m-faint"
                    />
                </div>
                {!hasPoint && value.trim().length >= 3 && (
                    <button
                        type="button"
                        onClick={onSearch}
                        disabled={busy}
                        aria-label={`Search for the ${label.toLowerCase()}`}
                        title="Search this place"
                        className="flex size-8 shrink-0 items-center justify-center rounded-full text-m-accent transition hover:bg-m-mint disabled:opacity-60"
                    >
                        <Search className="size-4" aria-hidden />
                    </button>
                )}
                {value && (
                    <button
                        type="button"
                        onClick={onClear}
                        aria-label={`Clear ${label.toLowerCase()}`}
                        className="flex size-8 shrink-0 items-center justify-center rounded-full text-m-muted transition hover:bg-m-mint hover:text-m-ink"
                    >
                        <X className="size-4" aria-hidden />
                    </button>
                )}
            </div>
            {error && (
                <p className="mt-1.5 text-xs font-medium text-m-redtext">
                    {error}
                </p>
            )}
        </div>
    );
}

export default function LocationPicker({
    pickup,
    destination,
    pickupText,
    destinationText,
    onPick,
    onText,
    onClear,
    onSwap,
    errors,
    registerLocate,
    onLocating,
    fill = false,
    destinationLabel = 'Destination',
}: Props) {
    const mapEl = useRef<HTMLDivElement>(null);
    const map = useRef<L.Map | null>(null);
    const markers = useRef<Record<Mode, L.Marker | null>>({
        pickup: null,
        destination: null,
    });
    const route = useRef<L.Polyline | null>(null);
    const hadBoth = useRef(false);
    const [mode, setMode] = useState<Mode>('pickup');
    const [ready, setReady] = useState(false);
    const [notice, setNotice] = useState<string | null>(null);
    const [results, setResults] = useState<Place[]>([]);
    const [busy, setBusy] = useState(false);
    const [large, setLarge] = useState(false);

    // Latest values for the Leaflet listeners (created once).
    const live = useRef({
        mode,
        pickup,
        destination,
        onPick,
        pickupText,
        destinationText,
        locate: () => {},
    });
    live.current.mode = mode;
    live.current.pickup = pickup;
    live.current.destination = destination;
    live.current.onPick = onPick;
    live.current.pickupText = pickupText;
    live.current.destinationText = destinationText;

    async function place(target: Mode, point: Point, knownAddress?: string) {
        let address = knownAddress;
        if (!address) {
            try {
                const r = await nominatim<{ display_name?: string }>(
                    `/reverse?lat=${point.lat}&lon=${point.lng}&zoom=18`,
                );
                address = r.display_name ?? coordText(point);
            } catch {
                address = coordText(point); // lookup unavailable: keep the pin, show its coordinates
            }
        }
        live.current.onPick(target, point, address);
        // After the pickup is placed, move on to the destination.
        if (target === 'pickup' && !live.current.destination)
            setMode('destination');
    }

    function locate(silent = false) {
        if (!navigator.geolocation) {
            if (!silent)
                setNotice(
                    'Your browser cannot detect your location. Click the map or search for an address instead.',
                );
            return;
        }
        onLocating?.(true);
        setNotice(null);
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                onLocating?.(false);
                const point = {
                    lat: pos.coords.latitude,
                    lng: pos.coords.longitude,
                };
                map.current?.setView(point, 17);
                void place('pickup', point);
            },
            (err) => {
                onLocating?.(false);
                if (!silent) {
                    setNotice(
                        err.code === err.PERMISSION_DENIED
                            ? 'Location access was blocked. Allow location for this site in your browser, or click the map to set your pickup.'
                            : 'We could not detect your location. Click the map or search for an address instead.',
                    );
                }
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 },
        );
    }
    live.current.locate = () => locate();

    async function search(target: Mode) {
        const q = (
            target === 'pickup'
                ? live.current.pickupText
                : live.current.destinationText
        ).trim();
        if (q.length < 3 || busy) return;
        setMode(target);
        setBusy(true);
        setNotice(null);
        setResults([]);
        try {
            const found = await nominatim<Place[]>(
                `/search?q=${encodeURIComponent(q)}&countrycodes=ph&limit=5`,
            );
            if (found.length === 0)
                setNotice(
                    'We could not find that place. Try adding the barangay or city, or click the map instead.',
                );
            setResults(found);
        } catch {
            setNotice(
                'Search is unavailable right now. Please click the map to set the point instead.',
            );
        } finally {
            setBusy(false);
        }
    }

    function choose(p: Place) {
        const point = { lat: Number(p.lat), lng: Number(p.lon) };
        map.current?.setView(point, 16);
        setResults([]);
        void place(live.current.mode, point, p.display_name);
    }

    // Create the map once.
    useEffect(() => {
        if (!mapEl.current) return;
        const m = L.map(mapEl.current, {
            center: [DEFAULT_CENTER.lat, DEFAULT_CENTER.lng],
            zoom: 13,
        });
        L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution:
                '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        }).addTo(m);
        m.on(
            'click',
            (e: L.LeafletMouseEvent) =>
                void place(live.current.mode, {
                    lat: e.latlng.lat,
                    lng: e.latlng.lng,
                }),
        );
        map.current = m;
        setReady(true);
        registerLocate?.(() => live.current.locate());
        if (!live.current.pickup) locate(true); // try to detect the customer's location on load

        return () => {
            m.remove();
            map.current = null;
            markers.current = { pickup: null, destination: null };
            route.current = null;
            setReady(false);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Keep the pins (and the dashed line between them) in step with the form.
    useEffect(() => {
        if (!ready || !map.current) return;
        (['pickup', 'destination'] as Mode[]).forEach((m) => {
            const point = m === 'pickup' ? pickup : destination;
            const existing = markers.current[m];
            if (!point) {
                existing?.remove();
                markers.current[m] = null;
                return;
            }
            if (existing) {
                existing.setLatLng([point.lat, point.lng]);
                return;
            }
            const marker = L.marker([point.lat, point.lng], {
                icon: ICONS[m],
                draggable: true,
                title:
                    m === 'pickup'
                        ? 'Pickup (drag to adjust)'
                        : 'Destination (drag to adjust)',
            }).addTo(map.current!);
            marker.on('dragend', () => {
                const ll = marker.getLatLng();
                void place(m, { lat: ll.lat, lng: ll.lng });
            });
            markers.current[m] = marker;
        });

        route.current?.remove();
        route.current = null;
        if (pickup && destination) {
            const line: L.LatLngTuple[] = [
                [pickup.lat, pickup.lng],
                [destination.lat, destination.lng],
            ];
            route.current = L.polyline(line, {
                color: '#1B5240',
                weight: 4,
                opacity: 0.85,
                dashArray: '8 8',
            }).addTo(map.current);
            if (!hadBoth.current)
                map.current.fitBounds(L.latLngBounds(line), {
                    padding: [60, 60],
                    maxZoom: 16,
                });
        }
        hadBoth.current = !!(pickup && destination);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [ready, pickup, destination]);

    // The map container changes height when it is enlarged.
    useEffect(() => {
        map.current?.invalidateSize();
    }, [large]);

    // In fill mode the map's size follows the layout (window resize, columns stacking), so keep Leaflet in step.
    useEffect(() => {
        if (!fill || !mapEl.current || typeof ResizeObserver === 'undefined')
            return;
        const ro = new ResizeObserver(() => map.current?.invalidateSize());
        ro.observe(mapEl.current);

        return () => ro.disconnect();
    }, [fill]);

    const km = pickup && destination ? straightLineKm(pickup, destination) : null;

    return (
        <div
            className={
                fill ? 'flex min-h-0 flex-1 flex-col gap-3' : 'space-y-3'
            }
        >
            <div className="relative space-y-2.5">
                <Field
                    id="pickup_location"
                    mode="pickup"
                    label="Pickup location"
                    value={pickupText}
                    placeholder="Search a place or click the map"
                    error={errors?.pickup}
                    active={mode === 'pickup'}
                    hasPoint={!!pickup}
                    busy={busy}
                    onFocus={() => setMode('pickup')}
                    onChange={(t) => {
                        setResults([]);
                        onText('pickup', t);
                    }}
                    onSearch={() => void search('pickup')}
                    onClear={() => {
                        setResults([]);
                        onClear('pickup');
                    }}
                />
                <Field
                    id="destination"
                    mode="destination"
                    label={destinationLabel}
                    value={destinationText}
                    placeholder="e.g. SM City Cebu, Mandaue"
                    error={errors?.destination}
                    active={mode === 'destination'}
                    hasPoint={!!destination}
                    busy={busy}
                    onFocus={() => setMode('destination')}
                    onChange={(t) => {
                        setResults([]);
                        onText('destination', t);
                    }}
                    onSearch={() => void search('destination')}
                    onClear={() => {
                        setResults([]);
                        onClear('destination');
                    }}
                />
                <button
                    type="button"
                    onClick={onSwap}
                    aria-label="Swap pickup and destination"
                    title="Swap pickup and destination"
                    className="absolute top-1/2 right-16 z-10 flex size-9 -translate-y-1/2 items-center justify-center rounded-full border border-m-line bg-m-card text-m-accent shadow-sm transition hover:bg-m-mint focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-m-accent"
                >
                    <ArrowUpDown className="size-4" aria-hidden />
                </button>
            </div>

            {results.length > 0 && (
                <ul
                    className="divide-y divide-m-line overflow-hidden rounded-xl border border-m-line bg-m-card text-sm shadow-sm"
                    aria-label="Search results"
                >
                    {results.map((r) => (
                        <li key={r.place_id}>
                            <button
                                type="button"
                                onClick={() => choose(r)}
                                className="w-full px-4 py-2.5 text-left transition hover:bg-m-mint"
                            >
                                {r.display_name}
                            </button>
                        </li>
                    ))}
                </ul>
            )}

            {notice && (
                <p role="status" className="text-sm text-m-amber">
                    {notice}
                </p>
            )}

            {/* "isolate" keeps Leaflet's internal z-indexes below the page header and dialogs. */}
            <div
                className={`relative isolate z-0 overflow-hidden rounded-2xl border border-m-line bg-m-mint ${fill ? `flex-1 ${large ? 'min-h-[32rem]' : 'min-h-[20rem]'}` : ''}`}
            >
                <div
                    ref={mapEl}
                    className={`w-full transition-[height] duration-300 ${fill ? 'absolute inset-0' : large ? 'h-[32rem]' : 'h-80'}`}
                    aria-label="Map for choosing pickup and destination"
                />
                <button
                    type="button"
                    onClick={() => setLarge(!large)}
                    className="absolute top-3 right-3 z-[1000] rounded-full bg-m-card/95 px-3.5 py-1.5 text-xs font-semibold text-m-body shadow-md backdrop-blur transition hover:bg-m-mint"
                >
                    {large ? 'Smaller map' : 'View larger map'}
                </button>
                {km !== null && (
                    <p className="absolute bottom-6 left-3 z-[1000] flex items-center gap-2 rounded-full bg-m-card/95 px-3.5 py-1.5 text-xs font-semibold text-m-body shadow-md backdrop-blur">
                        <Route className="size-4 text-m-accent" aria-hidden />
                        <span>
                            ≈{' '}
                            {km < 1
                                ? `${Math.round(km * 1000)} m`
                                : `${km.toFixed(1)} km`}{' '}
                            <span className="font-normal text-m-muted">
                                straight line
                            </span>
                        </span>
                    </p>
                )}
            </div>
            <p className="text-xs text-m-muted">
                Click the map to set the highlighted point, or drag a pin to
                adjust it. You can also type a place and press Enter.
            </p>
        </div>
    );
}