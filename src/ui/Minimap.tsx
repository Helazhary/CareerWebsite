'use client';

import { useEffect, useMemo, useRef } from 'react';
import { entries } from '@content/registry';
import { DISTRICT_LABELS } from '@/lib/site';
import type { DriveState } from '@/world/drive';
import { DISTRICT_TINT } from '@/world/palette';
import { transitPosition } from '@/world/transit';
import { worldGraph, worldPlots, worldTransit } from '@/world/world';

/**
 * The map, drawn as a transit diagram.
 *
 * A scale tracing of the roads is the honest map and the useless one: the world
 * is a kilometre of near-straight spine with four stubs off it, so at any size
 * that fits on a screen the buildings are dots three pixels apart and an
 * off-ramp is indistinguishable from a kink. The question a viewer actually has
 * is "what is on this road, in what order, and where am I in that order" —
 * which is the question a subway map exists to answer, and it answers it by
 * throwing away distance and keeping sequence.
 *
 * The geometry all comes from `worldTransit`, which is a pure function of the
 * road graph and the laid-out plots. Adding an entry, moving one to another
 * district or changing a date redraws this with no edit here.
 *
 * Every station is a real `<button>` in the list underneath, so this is still
 * the keyboard route through the world: Tab cycles the stops and Enter travels
 * to one. That is DESIGN.md §2.1's "Tab cycles focusable plots", got for free
 * by not drawing the map into a canvas.
 */
const PAD_LEFT = 40;
/** Room for the line names, which sit past the end of each line. */
const PAD_RIGHT = 250;
/** Room for the station labels on the outermost rows, which lean out. */
const PAD_TOP = 140;
const PAD_BOTTOM = 140;

/**
 * Labels lean rather than lie flat; at 62 units apart, flat ones collide.
 *
 * Each one leans *away* from the trunk — up from the spine and from the lines
 * above it, down from the lines below — so a name never crosses the line its
 * own row branches off. `ROW` in `transit.ts` is spaced for exactly this reach.
 *
 * Shallow — 26° rather than anything steeper — because the reach is what sets
 * the padding, and the padding is what squares up the diagram. The longest
 * title here is about 270 units set at 13px: at 38° it hung 165 units clear of
 * its own row and ran off the bottom, and even once that fitted, the padding
 * left the whole thing nearly square and it drew at 600px in a 1020px modal.
 * Flatter labels mean a wider, shorter box, which is the shape the screen is.
 *
 * The floor is legibility of the *gap*: two names on the same row are 62 units
 * apart, which at this angle leaves 27 units between parallel baselines set at
 * 13px. Going much flatter runs them into each other.
 */
const LABEL_ANGLE = 26;

export function Minimap({
  open,
  onClose,
  onTravel,
  stateRef,
}: {
  open: boolean;
  onClose: () => void;
  onTravel: (entryId: string) => void;
  stateRef: React.RefObject<DriveState>;
}): React.JSX.Element | null {
  const svg = useRef<SVGSVGElement>(null);

  const { viewBox, titles } = useMemo(() => {
    const { minX, minY, width, height } = worldTransit.bounds;
    return {
      viewBox: `${minX - PAD_LEFT} ${minY - PAD_TOP} ${width + PAD_LEFT + PAD_RIGHT} ${
        height + PAD_TOP + PAD_BOTTOM
      }`,
      titles: new Map(entries.map((entry) => [entry.id, entry.title])),
    };
  }, []);

  /**
   * Which stop is lit, updated by animation frame rather than by React.
   *
   * Two class names on two elements is not worth a re-render of the whole
   * overlay, and the map is open while the car coasts to a stop — so this does
   * change for a second or so after opening, and has to keep up.
   */
  useEffect(() => {
    if (!open) return;
    let raf = 0;
    let previous = '';

    const paint = (): void => {
      const root = svg.current;
      if (root !== null) {
        const { atEntryId, nextEntryId } = transitPosition(
          worldGraph,
          worldPlots,
          stateRef.current,
        );
        const signature = `${atEntryId ?? ''}>${nextEntryId ?? ''}`;
        if (signature !== previous) {
          previous = signature;
          for (const node of root.querySelectorAll('[data-station]')) {
            const id = node.getAttribute('data-station');
            node.classList.toggle('is-at', id === atEntryId);
            node.classList.toggle('is-next', id !== atEntryId && id === nextEntryId);
          }
        }
      }
      raf = requestAnimationFrame(paint);
    };

    raf = requestAnimationFrame(paint);
    return () => cancelAnimationFrame(raf);
  }, [open, stateRef]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent): void => {
      if (event.code === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-ink/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-5xl rounded-lg border border-line bg-surface/95 p-4 shadow-2xl">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-sm font-medium uppercase tracking-widest text-muted">Map</h2>
          <p className="text-xs text-muted">
            <span className="mr-3">
              <span className="mr-1.5 inline-block size-2 rounded-full bg-accent align-middle" />
              here
            </span>
            <span className="mr-3">
              <span className="mr-1.5 inline-block size-2 rounded-full bg-accent/45 align-middle" />
              next
            </span>
            <button type="button" onClick={onClose} className="transition hover:text-accent">
              Close (Esc)
            </button>
          </p>
        </div>

        <svg
          ref={svg}
          viewBox={viewBox}
          // Height-led, width from the viewBox aspect. Capping the height of a
          // full-width SVG letterboxes it instead: the element stays 100% wide,
          // the drawing shrinks to fit the cap, and the diagram ends up a small
          // island in the middle of a lot of empty modal.
          className="transit mx-auto h-[62vh] w-auto max-w-full"
          role="group"
          aria-label="Map of the world, drawn as a transit diagram. Choose a stop to travel to it."
        >
          {worldTransit.lines.map((line) => (
            <polyline
              key={line.id}
              points={line.points.map((point) => `${point.x},${point.y}`).join(' ')}
              fill="none"
              stroke={DISTRICT_TINT[line.district]}
              strokeWidth={line.trunk ? 13 : 9}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeOpacity={0.85}
            />
          ))}

          {/* Interchanges: where a branch leaves the spine, drawn as a ring so
              it reads as a place you pass through rather than a stop. Unlabelled
              — four junctions sit within 250 units of each other on the trunk,
              and four centred names there ran straight through one another. */}
          {worldTransit.interchanges.map((interchange) => (
            <circle
              key={interchange.district}
              cx={interchange.x}
              cy={interchange.y}
              r={7}
              fill="var(--color-surface)"
              stroke={DISTRICT_TINT[interchange.district]}
              strokeWidth={3.5}
            />
          ))}

          {/* The line names, at the end of each line, the way a transit map
              names a line where it terminates. Nothing else lives out there. */}
          {worldTransit.lines.map((line) => {
            const end = line.points[line.points.length - 1];
            if (end === undefined) return null;
            return (
              <text
                key={`${line.id}-name`}
                x={end.x + 14}
                y={end.y}
                dominantBaseline="middle"
                className="text-[12px] font-semibold uppercase tracking-[0.18em]"
                fill={DISTRICT_TINT[line.district]}
              >
                {DISTRICT_LABELS[line.district] ?? line.district}
              </text>
            );
          })}

          {worldTransit.lines.flatMap((line) =>
            line.stations.map((station) => {
              const tint = DISTRICT_TINT[station.district];
              const title = titles.get(station.entryId) ?? station.entryId;
              // Away from the trunk: up for the spine and everything above it,
              // down for everything below.
              const lean = station.y > 0 ? 1 : -1;
              const labelX = station.x + 12;
              const labelY = station.y + lean * 13;
              return (
                <g
                  key={station.entryId}
                  data-station={station.entryId}
                  className="transit-stop cursor-pointer"
                  style={{ '--tint': tint } as React.CSSProperties}
                  onClick={() => onTravel(station.entryId)}
                >
                  <title>{title}</title>
                  <circle className="transit-halo" cx={station.x} cy={station.y} r={16} />
                  <circle className="transit-dot" cx={station.x} cy={station.y} r={9} />
                  <text
                    className="transit-label text-[13px]"
                    x={labelX}
                    y={labelY}
                    transform={`rotate(${LABEL_ANGLE * lean} ${labelX} ${labelY})`}
                  >
                    {title}
                  </text>
                </g>
              );
            }),
          )}
        </svg>

        {/* The real controls: focusable, labelled, and usable without a pointer. */}
        <ul className="mt-4 flex flex-wrap gap-1.5">
          {worldTransit.lines.flatMap((line) =>
            line.stations.map((station) => (
              <li key={station.entryId}>
                <button
                  type="button"
                  onClick={() => onTravel(station.entryId)}
                  className="rounded border border-line px-2 py-1 text-xs text-muted transition hover:border-accent hover:text-text focus:border-accent focus:text-text focus:outline-none"
                >
                  <span className="sr-only">Travel to </span>
                  {titles.get(station.entryId) ?? station.entryId}
                  <span className="sr-only">
                    {' '}
                    in {DISTRICT_LABELS[station.district] ?? station.district}
                  </span>
                </button>
              </li>
            )),
          )}
        </ul>
      </div>
    </div>
  );
}
