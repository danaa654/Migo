import { Bike, Car, Package, ShieldCheck, Zap } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

/** Stored on bookings.service_type exactly like this (App\Enums\ServiceType). */
export type ServiceKey = 'MIGOMOTO' | 'MIGOCARS' | 'MIGODALA';

/** One entry of the `services` prop sent by CustomerBookingController. Fares come from the admin settings, never from here. */
export type ServiceInfo = {
    key: ServiceKey;
    name: string;
    description: string;
    is_delivery: boolean;
    max_passengers: number;
    starting_fare: number;
    package_sizes: Record<string, string> | null;
};

type Meta = {
    name: string;
    short: string;
    icon: LucideIcon;
    /** Icon circle colours, taken from the MIGO palette. */
    tone: string;
    /** Small label chip colours. */
    chip: string;
    /** Card background on the selection screen (public/img). */
    image: string;
    perks: string;
    perkIcon: LucideIcon;
};

export const SERVICE_META: Record<ServiceKey, Meta> = {
    MIGOMOTO: {
        name: 'MigoMoto',
        short: 'Motorcycle ride',
        icon: Bike,
        tone: 'bg-m-green/12 text-m-greentext',
        chip: 'bg-m-green/10 text-m-greentext',
        image: '/img/moto.png',
        perks: 'Fast • Affordable • Reliable',
        perkIcon: Zap,
    },
    MIGOCARS: {
        name: 'MigoCars',
        short: 'Private car',
        icon: Car,
        tone: 'bg-m-forest/12 text-m-forest dark:text-m-accent',
        chip: 'bg-m-forest/10 text-m-forest dark:text-m-accent',
        image: '/img/cars.png',
        perks: 'Safe • Comfortable • Convenient',
        perkIcon: ShieldCheck,
    },
    MIGODALA: {
        name: 'MigoDala',
        short: 'Delivery',
        icon: Package,
        tone: 'bg-[#F59E0B]/15 text-m-amber',
        chip: 'bg-[#F59E0B]/15 text-m-amber',
        image: '/img/dala.png',
        perks: 'Secure • On Time • Hassle-Free',
        perkIcon: Package,
    },
};

/** Bookings made before services existed have no service_type: they are MigoMoto rides. */
export const serviceKeyOf = (key?: string | null): ServiceKey =>
    key && key in SERVICE_META ? (key as ServiceKey) : 'MIGOMOTO';

export const serviceMeta = (key?: string | null): Meta =>
    SERVICE_META[serviceKeyOf(key)];

export const PACKAGE_SIZE_LABEL: Record<string, string> = {
    small: 'Small',
    medium: 'Medium',
    large: 'Large',
};
