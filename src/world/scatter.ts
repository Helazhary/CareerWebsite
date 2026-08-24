/**
 * Scenery placement. Pure — no three, no react, no DOM.
 *
 * Decides where planting, rocks and street lamps stand. Kept pure and seeded
 * for the same reason the plot layout is: "nothing grows in the middle of the
 * road" is an invariant that breaks silently and is invisible until someone
 * drives past it. Here it is a test.
 *
 * Deterministic, so the world is identical on every build and every machine —
 * a scene that reshuffles itself between deploys would make visual review
 * impossible.
 */

import type { District } from '@content/schema';
import { type RoadGraph, type Vec2, normalAt, sampleEdge } from './graph';
import type { PlotTransform } from './layout';

export type PropKind = 'tree' | 'shrub' | 'rock';

export interface ScatterItem {
  readonly kind: PropKind;
  readonly position: Vec2;
  readonly rotationY: number;
  readonly scale: number;
}

export interface LampItem {
  readonly position: Vec2;
  readonly rotationY: number;
}

export interface ScatterOptions {
  readonly seed: number;
  /** Clear distance from any road centreline. */
  readonly roadClearance: number;
  /** Clear distance beyond a building's own radius. */
  readonly plotClearance: number;
  /** Spacing of the candidate grid. Lower is denser and slower. */
  readonly gridStep: number;
  /** Chance a given candidate becomes something, 0..1. */
  readonly density: number;
  /** How far past the built world scenery keeps going. */
  readonly margin: number;
  /** Hard cap, so a bigger world cannot melt a laptop. */
  readonly maxItems: number;
}

export const DEFAULT_SCATTER: ScatterOptions = {
  seed: 20260824,
  roadClearance: 13,
  plotClearance: 5,
  gridStep: 17,
  density: 0.55,
  margin: 190,
  maxItems: 1400,
};

/** Small, fast, seedable. Identical output everywhere. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Uniform grid index over 2D points.
 *
 * Without it, testing every candidate against every road sample is a few
 * million distance checks per build. With it the scatter is imperceptible.
 */
class PointGrid {
  private readonly cells = new Map<string, Vec2[]>();

  constructor(private readonly cellSize: number) {}

  private key(x: number, z: number): string {
    return `${Math.floor(x / this.cellSize)}:${Math.floor(z / this.cellSize)}`;
  }

  add(point: Vec2): void {
    const key = this.key(point.x, point.z);
    const bucket = this.cells.get(key);
    if (bucket === undefined) this.cells.set(key, [point]);
    else bucket.push(point);
  }

  /** True when any indexed point lies within `radius` of the query. */
  hasWithin(query: Vec2, radius: number): boolean {
    const cx = Math.floor(query.x / this.cellSize);
    const cz = Math.floor(query.z / this.cellSize);
    const reach = Math.ceil(radius / this.cellSize);
    for (let dx = -reach; dx <= reach; dx += 1) {
      for (let dz = -reach; dz <= reach; dz += 1) {
        const bucket = this.cells.get(`${cx + dx}:${cz + dz}`);
        if (bucket === undefined) continue;
        for (const point of bucket) {
          if (Math.hypot(point.x - query.x, point.z - query.z) < radius) return true;
        }
      }
    }
    return false;
  }
}

/** Densely sampled points along every road, for clearance testing. */
function roadPoints(graph: RoadGraph, spacing: number): Vec2[] {
  const points: Vec2[] = [];
  for (const edge of graph.edges) {
    const steps = Math.max(2, Math.ceil(edge.length / spacing));
    for (let i = 0; i <= steps; i += 1) points.push(sampleEdge(edge, i / steps));
  }
  return points;
}

/** What grows where. Districts read differently from the road because of this. */
const KIND_WEIGHTS: Record<District, readonly [number, number, number]> = {
  //            tree  shrub  rock
  highway: [0.55, 0.32, 0.13],
  garage: [0.3, 0.34, 0.36],
  lab: [0.62, 0.33, 0.05],
  agents: [0.28, 0.3, 0.42],
  workshop: [0.24, 0.28, 0.48],
  arcade: [0.38, 0.42, 0.2],
};

function pickKind(random: () => number, district: District): PropKind {
  const weights = KIND_WEIGHTS[district];
  const roll = random();
  if (roll < weights[0]) return 'tree';
  if (roll < weights[0] + weights[1]) return 'shrub';
  return 'rock';
}

/** Nearest district, so planting takes on the character of where it stands. */
function nearestDistrict(point: Vec2, plots: readonly PlotTransform[]): District {
  let best: District = 'highway';
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const plot of plots) {
    const distance = Math.hypot(plot.position.x - point.x, plot.position.z - point.z);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = plot.district;
    }
  }
  return best;
}

export function scatterScenery(
  graph: RoadGraph,
  plots: readonly PlotTransform[],
  options: Partial<ScatterOptions> = {},
): ScatterItem[] {
  const config: ScatterOptions = { ...DEFAULT_SCATTER, ...options };
  const random = mulberry32(config.seed);

  const xs = graph.nodes.map((n) => n.position.x).concat(plots.map((p) => p.position.x));
  const zs = graph.nodes.map((n) => n.position.z).concat(plots.map((p) => p.position.z));
  if (xs.length === 0) return [];

  const minX = Math.min(...xs) - config.margin;
  const maxX = Math.max(...xs) + config.margin;
  const minZ = Math.min(...zs) - config.margin;
  const maxZ = Math.max(...zs) + config.margin;

  const roads = new PointGrid(config.roadClearance);
  for (const point of roadPoints(graph, config.roadClearance * 0.6)) roads.add(point);

  const items: ScatterItem[] = [];

  for (let x = minX; x <= maxX && items.length < config.maxItems; x += config.gridStep) {
    for (let z = minZ; z <= maxZ && items.length < config.maxItems; z += config.gridStep) {
      if (random() > config.density) continue;

      // Jitter off the grid, or the world looks like an orchard.
      const candidate: Vec2 = {
        x: x + (random() - 0.5) * config.gridStep * 0.9,
        z: z + (random() - 0.5) * config.gridStep * 0.9,
      };

      if (roads.hasWithin(candidate, config.roadClearance)) continue;

      let blocked = false;
      for (const plot of plots) {
        const distance = Math.hypot(plot.position.x - candidate.x, plot.position.z - candidate.z);
        if (distance < plot.radius + config.plotClearance) {
          blocked = true;
          break;
        }
      }
      if (blocked) continue;

      items.push({
        kind: pickKind(random, nearestDistrict(candidate, plots)),
        position: candidate,
        rotationY: random() * Math.PI * 2,
        scale: 0.7 + random() * 0.75,
      });
    }
  }

  return items;
}

/**
 * Street lamps down both shoulders of every road.
 *
 * Placed along the spline rather than scattered, because lighting that does not
 * follow the road reads as litter. They are what gives the road somewhere to be
 * at dusk.
 */
export function scatterLamps(
  graph: RoadGraph,
  spacing = 46,
  offset = 10.5,
  clearance = 9,
): LampItem[] {
  const lamps: LampItem[] = [];

  // A lamp sits on the verge of its own road, but near a junction that verge
  // can be the middle of a different one. Clearance has to be tested against
  // every road, not the one the lamp belongs to.
  const roads = new PointGrid(clearance);
  for (const point of roadPoints(graph, clearance * 0.5)) roads.add(point);

  for (const edge of graph.edges) {
    // At least one, however short the stretch. Flooring left the two short
    // connectors between junctions completely unlit — which is precisely
    // where a driver needs to see the road.
    const count = Math.max(1, Math.round(edge.length / spacing));
    for (let i = 0; i < count; i += 1) {
      const u = (i + 0.5) / count;
      const centre = sampleEdge(edge, u);
      // Alternate sides so the road is lit evenly without doubling the count.
      const side = i % 2 === 0 ? 1 : -1;
      const outward = normalAt(edge, u, side);
      const position: Vec2 = {
        x: centre.x + outward.x * offset,
        z: centre.z + outward.z * offset,
      };
      if (roads.hasWithin(position, clearance)) continue;

      lamps.push({ position, rotationY: Math.atan2(-outward.x, -outward.z) });
    }
  }

  return lamps;
}
