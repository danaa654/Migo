import { ArrowRight } from 'lucide-react';
import { serviceMeta } from '@/lib/services';
import type { ServiceInfo, ServiceKey } from '@/lib/services';

/** First step of "Book a Ride": the customer chooses MigoMoto, MigoCars or MigoDala before seeing any booking form. */
export default function ServicePicker({
    services,
    onChoose,
}: {
    services: ServiceInfo[];
    onChoose: (key: ServiceKey) => void;
}) {
    return (
        <div className="space-y-4 rounded-3xl border border-m-line bg-m-card p-4 shadow-sm sm:p-6">
            <div>
                <h1 className="text-xl font-bold text-m-ink sm:text-2xl">
                    What do you need today?
                </h1>
                <p className="mt-0.5 text-sm text-m-muted">
                    Choose a service to start. You can switch later without
                    losing the places you picked.
                </p>
            </div>

            <ul className="grid gap-3 md:grid-cols-3">
                {services.map((s) => {
                    const meta = serviceMeta(s.key);
                    const Icon = meta.icon;
                    const Perk = meta.perkIcon;

                    return (
                        <li
                            key={s.key}
                            className="relative isolate flex min-h-[20rem] flex-col overflow-hidden rounded-2xl bg-m-mint p-4 shadow-sm ring-1 ring-white/70 dark:ring-m-line"
                        >
                            <div
                                aria-hidden
                                className="absolute inset-0 -z-20 bg-cover bg-[position:70%_center] bg-no-repeat dark:brightness-50"
                                style={{ backgroundImage: `url(${meta.image})` }}
                            />
                            {/* Keeps the text readable over the picture on every screen size. */}
                            <div
                                aria-hidden
                                className="absolute inset-x-0 bottom-0 -z-10 h-2/5 bg-gradient-to-t from-white/90 to-transparent dark:from-m-card/90"
                            />
                            <div
                                aria-hidden
                                className="absolute inset-0 -z-10 bg-gradient-to-r from-white/90 via-white/45 to-transparent dark:from-m-card/90 dark:via-m-card/50"
                            />

                            <span className="flex size-11 items-center justify-center rounded-xl bg-[#1FA46B] text-white shadow-sm">
                                <Icon className="size-6" aria-hidden />
                            </span>
                            <h2 className="mt-3 text-xl font-bold text-m-forest dark:text-m-ink">
                                {meta.name}
                            </h2>
                            <p className="mt-1 max-w-[62%] text-sm leading-snug text-m-body">
                                {s.description}
                            </p>

                            <p className="mt-auto mb-3 flex items-center gap-2 pt-6 text-xs font-medium text-m-body">
                                <Perk className="size-4 text-m-green" aria-hidden />
                                {meta.perks}
                            </p>
                            <button
                                type="button"
                                onClick={() => onChoose(s.key)}
                                className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-m-forest px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-m-forest-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-m-accent"
                            >
                                Choose {meta.name}
                                <ArrowRight className="size-4" aria-hidden />
                            </button>
                        </li>
                    );
                })}
            </ul>
        </div>
    );
}