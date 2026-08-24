'use client';

import { useEffect, useMemo, useRef } from 'react';
import { entries } from '@content/registry';
import { DISTRICT_LABELS } from '@/lib/site';
import { type DriveState, headingOf, positionOf } from '@/world/drive';
import { sampleEdge } from '@/world/graph';
import { DISTRICT_TINT } from '@/world/palette';
import type { PlotTransform } from '@/world/layout';
import { worldGraph, worldPlots } from '@/world/world';

const PADDING = 60;
const ROAD_SAMPLES = 40;

/**
 * Top-down map of the world, in plain SVG rather than a second WebGL view.
 *
 * Every building is a real `<button>`, so this doubles as the keyboard route
 * through the world: Tab cycles the plots and Enter travels to one. That is the
 * whole of DESIGN.md §2.1's "Tab cycles focusable plots", got for free by not
 * drawing the map into a canvas.
 */
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
  const marker = useRef<SVGGElement>(null);

  const { viewBox, roads, titles } = useMemo(() => {
    const xs: number[] = [];
    const zs: number[] = [];
    for (const node of worldGraph.nodes) {
      xs.push(node.position.x);
      zs.push(node.position.z);
    }
    for (const plot of worldPlots) {
      xs.push(plot.position.x);
      zs.push(plot.position.z);
    }
    const minX = Math.min(...xs) - PADDING;
    const minZ = Math.min(...zs) - PADDING;
    const width = Math.max(...xs) + PADDING - minX;
    const height = Math.max(...zs) + PADDING - minZ;

    return {
      viewBox: `${minX} ${minZ} ${width} ${height}`,
      roads: worldGraph.edges.map((edge) => ({
        id: edge.id,
        points: Array.from({ length: ROAD_SAMPLES + 1 }, (_, i) => {
          const point = sampleEdge(edge, i / ROAD_SAMPLES);
          return `${point.x.toFixed(1)},${point.z.toFixed(1)}`;
        }).join(' '),
      })),
      titles: new Map(entries.map((entry) => [entry.id, entry.title])),
    };
  }, []);

  // The car moves every frame; React does not need to know about any of it.
  useEffect(() => {
    if (!open) return;
    let raf = 0;
    const follow = (): void => {
      const group = marker.current;
      if (group !== null) {
        const position = positionOf(worldGraph, stateRef.current);
        const heading = headingOf(worldGraph, stateRef.current);
        const degrees = (Math.atan2(heading.x, -heading.z) * 180) / Math.PI;
        group.setAttribute('transform', `translate(${position.x} ${position.z}) rotate(${degrees})`);
      }
      raf = requestAnimationFrame(follow);
    };
    raf = requestAnimationFrame(follow);
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
      <div className="w-full max-w-4xl rounded-lg border border-line bg-surface/95 p-4 shadow-2xl">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-sm font-medium uppercase tracking-widest text-muted">Map</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-xs text-muted transition hover:text-accent"
          >
            Close (Esc)
          </button>
        </div>

        <svg
          viewBox={viewBox}
          className="h-auto w-full"
          role="group"
          aria-label="Map of the world. Choose a building to travel to it."
        >
          {roads.map((road) => (
            <polyline
              key={road.id}
              points={road.points}
              fill="none"
              stroke="var(--color-line)"
              strokeWidth={12}
              strokeLinecap="round"
            />
          ))}

          {worldPlots.map((plot: PlotTransform) => (
            <g key={plot.entryId}>
              <title>{titles.get(plot.entryId) ?? plot.entryId}</title>
              <circle
                cx={plot.position.x}
                cy={plot.position.z}
                r={Math.max(plot.footprint.width, plot.footprint.depth) / 2}
                fill={DISTRICT_TINT[plot.district]}
                fillOpacity={plot.status === 'in-progress' ? 0.35 : 0.9}
                stroke={DISTRICT_TINT[plot.district]}
                strokeWidth={2}
                className="cursor-pointer transition-opacity hover:fill-opacity-100"
                onClick={() => onTravel(plot.entryId)}
              />
            </g>
          ))}

          <g ref={marker}>
            <polygon points="0,-16 11,12 0,5 -11,12" fill="var(--color-accent)" />
          </g>
        </svg>

        {/* The real controls: focusable, labelled, and usable without a pointer. */}
        <ul className="mt-4 flex flex-wrap gap-1.5">
          {worldPlots.map((plot) => (
            <li key={plot.entryId}>
              <button
                type="button"
                onClick={() => onTravel(plot.entryId)}
                className="rounded border border-line px-2 py-1 text-xs text-muted transition hover:border-accent hover:text-text focus:border-accent focus:text-text focus:outline-none"
              >
                <span className="sr-only">Travel to </span>
                {titles.get(plot.entryId) ?? plot.entryId}
                <span className="sr-only"> in {DISTRICT_LABELS[plot.district] ?? plot.district}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
