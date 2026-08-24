/**
 * Pure plot layout.
 *
 * Turns road anchors into building transforms: where each plot stands, which
 * way it faces, and how big it is. No `three`, no `react`, no DOM.
 *
 * The invariant this file exists to hold is **no two buildings ever overlap**,
 * for any number of entries. A district that runs out of road frontage starts a
 * second rank further back rather than stacking buildings on top of each other,
 * so adding project #10 to a full district degrades the composition instead of
 * breaking the scene (DESIGN.md §5).
 */

import type { Entry, District } from '@content/schema';
import {
  type GraphEdge,
  type RoadGraph,
  type Vec2,
  normalAt,
  sampleEdge,
} from './graph';

export interface Footprint {
  readonly width: number;
  readonly depth: number;
  readonly height: number;
}

export interface PlotTransform {
  readonly entryId: string;
  readonly position: Vec2;
  /**
   * Rotation about the Y axis in radians, in three.js convention (+Z is the
   * model's forward). Every building faces the road it fronts onto.
   */
  readonly rotationY: number;
  readonly footprint: Footprint;
  /** Conservative bounding radius. Two plots never come within `ra + rb`. */
  readonly radius: number;
  /** Which rank back from the road, 0 being roadside. */
  readonly rank: number;
  readonly district: District;
  readonly skin: Entry['skin'];
  readonly status: Entry['status'];
  readonly size: Entry['size'];
}

export interface LayoutOptions {
  /** Half the drivable width of a road. */
  readonly roadHalfWidth: number;
  /** Clear ground between the kerb and the nearest building face. */
  readonly verge: number;
  /** Clear ground between neighbouring buildings. */
  readonly gap: number;
  /** Road left clear at each end of an edge, so junctions stay legible. */
  readonly endMargin: number;
}

export const DEFAULT_LAYOUT_OPTIONS: LayoutOptions = {
  roadHalfWidth: 7,
  verge: 6,
  gap: 10,
  endMargin: 18,
};

/** Building dimensions per schema `size`. Presentation, keyed by a schema field. */
const FOOTPRINTS: Record<Entry['size'], Footprint> = {
  sm: { width: 16, depth: 13, height: 9 },
  md: { width: 24, depth: 18, height: 14 },
  lg: { width: 36, depth: 26, height: 22 },
};

export function footprintFor(size: Entry['size']): Footprint {
  return FOOTPRINTS[size];
}

function radiusOf(footprint: Footprint): number {
  return Math.hypot(footprint.width, footprint.depth) / 2;
}

const MAX_RADIUS = Math.max(...Object.values(FOOTPRINTS).map(radiusOf));

/** Ranks tried before a plot is placed regardless. Bounds the search. */
const MAX_RANK = 24;
/** Breathing room beyond touching bounding circles. */
const SEPARATION_EPSILON = 0.5;

/** One entry and the arc position along the frontage it would like to occupy. */
interface Sited {
  readonly entry: Entry;
  readonly desired: number;
}

interface Frontage {
  readonly edge: GraphEdge;
  readonly side: -1 | 1;
  readonly sited: Sited[];
}

function candidateAt(
  frontage: Frontage,
  entry: Entry,
  /** Arc distance from the start of the edge to the building centre. */
  along: number,
  rank: number,
  config: LayoutOptions,
  rankDepth: number,
): PlotTransform {
  const { edge, side } = frontage;
  const footprint = footprintFor(entry.size);
  const radius = radiusOf(footprint);
  const u = edge.length === 0 ? 0.5 : Math.min(along / edge.length, 1);
  const setback = config.roadHalfWidth + config.verge + radius + rank * rankDepth;

  const centre = sampleEdge(edge, u);
  const outward = normalAt(edge, u, side);

  return {
    entryId: entry.id,
    position: { x: centre.x + outward.x * setback, z: centre.z + outward.z * setback },
    // Face back across the road: the inverse of the outward normal.
    rotationY: Math.atan2(-outward.x, -outward.z),
    footprint,
    radius,
    rank,
    district: entry.district,
    skin: entry.skin,
    status: entry.status,
    size: entry.size,
  };
}

/**
 * A candidate is clear when it touches no placed building and stands entirely
 * out of every road — including roads belonging to other districts, which is
 * what stops a highway building landing on an off-ramp as it curves away.
 */
function isClear(
  candidate: PlotTransform,
  placed: readonly PlotTransform[],
  edges: readonly GraphEdge[],
  config: LayoutOptions,
): boolean {
  for (const other of placed) {
    if (distanceBetween(candidate, other) < candidate.radius + other.radius + SEPARATION_EPSILON) {
      return false;
    }
  }
  for (const edge of edges) {
    if (clearanceToRoad(candidate, edge, 32) < config.roadHalfWidth + candidate.radius) {
      return false;
    }
  }
  return true;
}

/**
 * Pack one frontage, appending to `placed`.
 *
 * Each building starts at the position its anchor asked for — which on the
 * highway is its date — and only moves forward when something is in the way.
 * Chronology therefore survives contact with collision avoidance, which is the
 * whole reason the spine exists.
 *
 * Arc distance alone is not enough to space buildings: on the inside of a curve,
 * offsetting them away from the centreline pulls them together, so separation is
 * checked where the buildings actually stand.
 */
function packFrontage(
  frontage: Frontage,
  edges: readonly GraphEdge[],
  config: LayoutOptions,
  rankDepth: number,
  placed: PlotTransform[],
): void {
  const { edge } = frontage;
  const limit = Math.max(edge.length - config.endMargin, config.endMargin);

  let rank = 0;
  let frontier = config.endMargin;

  for (const { entry, desired } of frontage.sited) {
    const radius = radiusOf(footprintFor(entry.size));
    const floor = config.endMargin + radius;
    const ceiling = Math.max(limit - radius, floor);
    // A building cannot stand past the end of its road, however much its date
    // would like it to.
    const target = Math.min(Math.max(desired, floor), ceiling);
    const step = Math.max(config.gap, radius * 0.5);

    const sweep = (from: number): { transform: PlotTransform; along: number } | undefined => {
      for (let along = Math.min(from, ceiling); along <= ceiling; along += step) {
        const transform = candidateAt(frontage, entry, along, rank, config, rankDepth);
        if (isClear(transform, placed, edges, config)) return { transform, along };
      }
      return undefined;
    };

    let chosen: { transform: PlotTransform; along: number } | undefined;

    while (chosen === undefined && rank <= MAX_RANK) {
      // Preferred spot first — for the highway that is the entry's date — then
      // anywhere else on this rank before stepping back to the next one.
      chosen = sweep(Math.max(target, frontier + radius)) ?? sweep(floor);
      if (chosen === undefined) {
        rank += 1;
        frontier = config.endMargin;
      }
    }

    if (chosen === undefined) {
      // Ran out of ranks. Place it anyway rather than silently dropping content —
      // a cramped world is recoverable, a missing project is not.
      placed.push(candidateAt(frontage, entry, target, MAX_RANK + 1, config, rankDepth));
      continue;
    }

    placed.push(chosen.transform);
    frontier = Math.max(frontier, chosen.along + radius + config.gap);
  }
}

/**
 * Lay out every entry that has a road anchor.
 *
 * Frontages are packed spine-first so off-ramps yield to the highway rather
 * than the other way round, then in a stable key order so the result is
 * identical on every build.
 */
export function layoutPlots(
  graph: RoadGraph,
  entries: readonly Entry[],
  options: Partial<LayoutOptions> = {},
): PlotTransform[] {
  const config: LayoutOptions = { ...DEFAULT_LAYOUT_OPTIONS, ...options };
  const entryById = new Map(entries.map((entry) => [entry.id, entry]));

  const frontages = new Map<string, Frontage>();
  const orderedAnchors = [...graph.anchors].sort(
    (a, b) => a.u - b.u || a.entryId.localeCompare(b.entryId),
  );

  for (const anchor of orderedAnchors) {
    const entry = entryById.get(anchor.entryId);
    const edge = graph.edgeById.get(anchor.edgeId);
    if (entry === undefined || edge === undefined) continue;
    const key = `${anchor.edgeId}:${anchor.side}`;
    const frontage = frontages.get(key) ?? { edge, side: anchor.side, sited: [] };
    frontage.sited.push({ entry, desired: anchor.u * edge.length });
    frontages.set(key, frontage);
  }

  const ordered = [...frontages.entries()].sort(([keyA, a], [keyB, b]) => {
    const spineA = a.edge.district === 'highway' ? 0 : 1;
    const spineB = b.edge.district === 'highway' ? 0 : 1;
    return spineA - spineB || keyA.localeCompare(keyB);
  });

  const rankDepth = 2 * MAX_RADIUS + config.gap;
  const placed: PlotTransform[] = [];
  for (const [, frontage] of ordered) {
    packFrontage(frontage, graph.edges, config, rankDepth, placed);
  }

  return placed;
}

/** Centre-to-centre distance between two plots. */
export function distanceBetween(a: PlotTransform, b: PlotTransform): number {
  return Math.hypot(a.position.x - b.position.x, a.position.z - b.position.z);
}

/**
 * Every pair of plots whose bounding circles intersect. Empty is the invariant;
 * the test asserts on it directly rather than on a boolean.
 */
export function findOverlaps(transforms: readonly PlotTransform[]): [string, string][] {
  const clashes: [string, string][] = [];
  for (let i = 0; i < transforms.length; i += 1) {
    for (let j = i + 1; j < transforms.length; j += 1) {
      const a = transforms[i];
      const b = transforms[j];
      if (a === undefined || b === undefined) continue;
      if (distanceBetween(a, b) < a.radius + b.radius) clashes.push([a.entryId, b.entryId]);
    }
  }
  return clashes;
}

/** Shortest distance from a plot centre to the centreline of its road. */
export function clearanceToRoad(transform: PlotTransform, edge: GraphEdge, samples = 48): number {
  let nearest = Number.POSITIVE_INFINITY;
  for (let step = 0; step <= samples; step += 1) {
    const point = sampleEdge(edge, step / samples);
    nearest = Math.min(nearest, Math.hypot(point.x - transform.position.x, point.z - transform.position.z));
  }
  return nearest;
}
