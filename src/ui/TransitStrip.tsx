'use client';

import { entries } from '@content/registry';
import { DISTRICT_LABELS } from '@/lib/site';
import type { HudState } from '@/world/Scene';
import { DISTRICT_TINT } from '@/world/palette';
import { worldTransit } from '@/world/world';

/**
 * The line you are on, always on screen.
 *
 * The full map answers "where am I and what is on this road" well, and answers
 * it only when asked — it is a modal that stops the car, so it cannot help at
 * the moment you actually need it, which is the two seconds before a junction.
 * Someone driving should never have to open anything to know where they are.
 *
 * So this is the one line of the diagram that is currently true: the road's
 * name, its stops in order, a lit dot for the one you are at, and the name of
 * the one coming up. Everything else the map knows stays in the map, one click
 * away — and this is that click.
 *
 * It is a `<button>` and not a decorated `<div>` because the whole card opens
 * the map. It reads `hud` and holds no state of its own; `Scene` computes the
 * position on the diagram once per meaningful change and publishes it, so this
 * never walks the graph and never runs an animation frame.
 */
const TITLES = new Map(entries.map((entry) => [entry.id, entry.title]));

export function TransitStrip({
  hud,
  onOpenMap,
  hidden,
}: {
  hud: HudState | null;
  onOpenMap: () => void;
  /** The intro card or a panel is up. */
  hidden: boolean;
}): React.JSX.Element | null {
  const district = hud?.roadDistrict ?? null;
  if (district === null) return null;

  const line = worldTransit.lines.find((candidate) => candidate.district === district);
  const label = DISTRICT_LABELS[district] ?? district;
  const tint = DISTRICT_TINT[district] ?? 'var(--color-muted)';

  const atId = hud?.atEntryId ?? null;
  const nextId = hud?.nextEntryId ?? null;
  const nextTitle = nextId === null ? null : (TITLES.get(nextId) ?? nextId);

  // Where along this line the car has got to.
  //
  // `atEntryId` is the nearest building in the world, which at a junction is
  // often one on the road you are *about* to take — so on its own it lights
  // nothing here about half the time. Falling back to the stop coming up gives
  // the strip a position on every frame, and filling everything behind it turns
  // a row of dots into "third of seven" without a word of text.
  const stations = line?.stations ?? [];
  const atIndex = stations.findIndex((station) => station.entryId === atId);
  const nextIndex = stations.findIndex((station) => station.entryId === nextId);
  const passedThrough = atIndex >= 0 ? atIndex : nextIndex - 1;

  return (
    <div
      className={`pointer-events-none absolute bottom-16 left-4 z-10 sm:bottom-20 sm:left-6 ${
        hidden ? 'hidden' : 'hidden sm:block'
      }`}
    >
      <button
        type="button"
        onClick={onOpenMap}
        className="pointer-events-auto w-64 rounded-lg border border-line bg-ink/75 p-3 text-left backdrop-blur-sm transition hover:border-accent focus:border-accent focus:outline-none"
      >
        <span className="flex items-baseline justify-between gap-2">
          <span
            className="text-[11px] font-semibold uppercase tracking-[0.18em]"
            style={{ color: tint }}
          >
            {label}
          </span>
          <span className="text-[10px] uppercase tracking-widest text-muted">Map</span>
        </span>

        {/* The stops on this road, in order, with the one you are at filled.
            Drawn rather than listed: at four to six stops a row of dots says
            "third of six" at a glance, and six titles would not fit anyway. */}
        {stations.length > 0 && (
          <span className="mt-2 flex items-center" aria-hidden>
            {stations.map((station, index) => {
              const isAt = index === atIndex;
              const isNext = index === nextIndex;
              const passed = index < passedThrough;
              return (
                <span key={station.entryId} className="flex flex-1 items-center last:flex-none">
                  <span
                    className="shrink-0 rounded-full border-2 transition-all"
                    style={{
                      width: isAt ? '0.7rem' : '0.55rem',
                      height: isAt ? '0.7rem' : '0.55rem',
                      borderColor: isAt || isNext ? 'var(--color-accent)' : tint,
                      backgroundColor: isAt
                        ? 'var(--color-accent)'
                        : passed
                          ? tint
                          : 'transparent',
                    }}
                  />
                  {index < stations.length - 1 && (
                    <span
                      className="h-0.5 flex-1"
                      style={{ backgroundColor: tint, opacity: index < passedThrough ? 0.9 : 0.4 }}
                    />
                  )}
                </span>
              );
            })}
          </span>
        )}

        <span className="mt-2 block truncate text-xs text-muted">
          {nextTitle === null ? (
            'Road ends — press S to turn around'
          ) : (
            <>
              Next · <span className="text-text">{nextTitle}</span>
            </>
          )}
        </span>
      </button>
    </div>
  );
}
