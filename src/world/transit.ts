/**
 * The world as a transit diagram. No `three`, no `react`, no DOM.
 *
 * A top-down tracing of the actual roads is an honest map and a poor one: the
 * spine is a kilometre of near-straight line with four stubs coming off it, so
 * at any size that fits on screen the buildings are dots a few pixels apart and
 * the off-ramps are hard to tell from kinks. What the viewer actually needs to
 * answer is "which things are on this road, in what order, and which one am I
 * at" — and that is the question a subway map is built to answer.
 *
 * So this throws away distance and keeps *sequence*. Stations are evenly
 * spaced, lines are horizontals joined by 45° elbows, and a junction is an
 * interchange. Nothing here knows the name of a project or a district: the
 * diagram is a function of the road graph and the laid-out plots, so adding an
 * entry, moving one between districts or changing a date redraws it with no
 * edit to this file.
 *
 * Geometry is in schematic units with +y *down*, matching SVG, so the component
 * can drop these straight into a `viewBox` without a flip.
 */

import type { District } from '@content/schema';
import { type RoadGraph, otherEnd } from './graph';
import type { PlotTransform } from './layout';
import { type DriveState, branchOptions, positionOf, straightAheadIndex } from './drive';

export interface TransitStation {
  readonly entryId: string;
  readonly district: District;
  /** Which line this station sits on. Equal to `district`. */
  readonly lineId: string;
  readonly x: number;
  readonly y: number;
  /** Position along its own line, from the interchange outward. */
  readonly index: number;
}

export interface TransitLine {
  readonly id: string;
  readonly district: District;
  /** True for the spine: the line every other one branches off. */
  readonly trunk: boolean;
  /** Polyline through schematic space, in drawing order. */
  readonly points: readonly { readonly x: number; readonly y: number }[];
  readonly stations: readonly TransitStation[];
}

/** Where a branch line meets the trunk. Drawn as a hollow ring. */
export interface TransitInterchange {
  readonly district: District;
  readonly x: number;
  readonly y: number;
}

export interface TransitDiagram {
  readonly lines: readonly TransitLine[];
  readonly interchanges: readonly TransitInterchange[];
  readonly stationByEntryId: ReadonlyMap<string, TransitStation>;
  /** Bounding box of everything drawable, before label padding. */
  readonly bounds: {
    readonly minX: number;
    readonly minY: number;
    readonly width: number;
    readonly height: number;
  };
}

/** Distance between consecutive stations. The only length in the diagram. */
const SPACING = 62;
/** How far the 45° elbow travels before a branch line runs flat. */
const ELBOW = 34;
/**
 * Vertical distance between one branch line and the next on the same side.
 *
 * Set by the labels, not by the lines. A station name is set at 13px and leans
 * at 38° so that names 62 units apart do not overlap, which means a long one
 * reaches about a hundred units away from its own dot. Rows any closer than
 * that and every label lies across the line above it.
 */
const ROW = 120;
/** Stub of line drawn past the last station, so a line ends rather than stops. */
const TAIL = 22;
/** Clearance between two branch lines sharing a row, in schematic units. */
const ROW_GAP = SPACING;

/**
 * Which side of the spine a district's off-ramp leaves from, read back out of
 * the graph rather than declared here.
 *
 * `graph.ts` owns that decision and does not export it. Deriving it from where
 * the spur's terminus actually ended up means this cannot drift out of step
 * with the world it is a diagram of — and a spur that moved to the other side
 * of the spine moves on the map too, with no edit here.
 */
function sideOfSpur(graph: RoadGraph, spurEdgeId: string): 1 | -1 {
  const edge = graph.edgeById.get(spurEdgeId);
  const terminus = edge === undefined ? undefined : graph.nodeById.get(edge.toId);
  return (terminus?.position.z ?? 1) < 0 ? -1 : 1;
}

/** Rows already claimed on one side, as x ranges. */
type Occupancy = { x0: number; x1: number }[][];

function claimRow(rows: Occupancy, x0: number, x1: number): number {
  for (let row = 0; row < rows.length; row += 1) {
    const spans = rows[row];
    if (spans === undefined) continue;
    const clashes = spans.some((span) => x0 < span.x1 + ROW_GAP && span.x0 - ROW_GAP < x1);
    if (!clashes) {
      spans.push({ x0, x1 });
      return row;
    }
  }
  rows.push([{ x0, x1 }]);
  return rows.length - 1;
}

/**
 * Build the diagram from the world.
 *
 * `plots` rather than `graph.anchors` on purpose: `layoutPlots` slides a
 * building along its frontage when the spot it wanted is taken, and the anchor
 * stays behind. A map drawn from anchors would show an order the world does not
 * have — which is exactly the class of bug `.claude/rules/world.md` warns about
 * when it says to assert on final rendered positions.
 */
export function buildTransitDiagram(
  graph: RoadGraph,
  plots: readonly PlotTransform[],
): TransitDiagram {
  const spurEdgeByDistrict = new Map<District, string>();
  for (const edge of graph.edges) {
    if (edge.kind === 'spur') spurEdgeByDistrict.set(edge.district, edge.id);
  }

  const onTrunk = (plot: PlotTransform): boolean => !spurEdgeByDistrict.has(plot.district);

  // Everything that has to appear on the trunk in a definite order: its own
  // stations, and the point at which each branch leaves it.
  type Feature =
    | { kind: 'station'; worldX: number; plot: PlotTransform }
    | { kind: 'interchange'; worldX: number; district: District };

  const features: Feature[] = plots
    .filter(onTrunk)
    .map((plot) => ({ kind: 'station' as const, worldX: plot.position.x, plot }));

  for (const [district, edgeId] of spurEdgeByDistrict) {
    const edge = graph.edgeById.get(edgeId);
    const junction = edge === undefined ? undefined : graph.nodeById.get(edge.fromId);
    if (junction === undefined) continue;
    features.push({ kind: 'interchange', worldX: junction.position.x, district });
  }

  features.sort(
    (a, b) =>
      a.worldX - b.worldX ||
      (a.kind === 'station' ? a.plot.entryId : a.district).localeCompare(
        b.kind === 'station' ? b.plot.entryId : b.district,
      ),
  );

  const trunkStations: TransitStation[] = [];
  const interchanges: TransitInterchange[] = [];
  const interchangeX = new Map<District, number>();

  features.forEach((feature, index) => {
    const x = index * SPACING;
    if (feature.kind === 'station') {
      trunkStations.push({
        entryId: feature.plot.entryId,
        district: feature.plot.district,
        lineId: 'trunk',
        x,
        y: 0,
        index: trunkStations.length,
      });
    } else {
      interchanges.push({ district: feature.district, x, y: 0 });
      interchangeX.set(feature.district, x);
    }
  });

  const trunkEnd = features.length === 0 ? 0 : (features.length - 1) * SPACING;
  const lines: TransitLine[] = [
    {
      id: 'trunk',
      district: 'highway',
      trunk: true,
      points: [
        { x: -TAIL, y: 0 },
        { x: trunkEnd + TAIL, y: 0 },
      ],
      stations: trunkStations,
    },
  ];

  const rowsBySide = new Map<1 | -1, Occupancy>([
    [1, []],
    [-1, []],
  ]);

  // Branches in the order they leave the trunk, so row packing is stable and
  // the earliest branch takes the innermost row.
  const spurs = [...spurEdgeByDistrict.entries()].sort(
    (a, b) => (interchangeX.get(a[0]) ?? 0) - (interchangeX.get(b[0]) ?? 0),
  );

  for (const [district, edgeId] of spurs) {
    const junctionX = interchangeX.get(district);
    if (junctionX === undefined) continue;

    // `u` runs away from the spine — `graph.ts` builds every spur from its
    // junction to its terminus — so this is order of arrival when driving in.
    const members = plots
      .filter((plot) => plot.district === district)
      .sort((a, b) => a.u - b.u || a.entryId.localeCompare(b.entryId));

    const side = sideOfSpur(graph, edgeId);
    const firstX = junctionX + ELBOW + SPACING * 0.6;
    const lastX = firstX + SPACING * Math.max(members.length - 1, 0);
    const rows = rowsBySide.get(side) ?? [];
    const row = claimRow(rows, junctionX, lastX + TAIL);
    const y = side * ROW * (row + 1);

    const stations = members.map((plot, index) => ({
      entryId: plot.entryId,
      district,
      lineId: district,
      x: firstX + SPACING * index,
      y,
      index,
    }));

    lines.push({
      id: district,
      district,
      trunk: false,
      points: [
        { x: junctionX, y: 0 },
        { x: junctionX + ELBOW, y },
        { x: lastX + TAIL, y },
      ],
      stations,
    });
  }

  const xs: number[] = [];
  const ys: number[] = [];
  for (const line of lines) {
    for (const point of line.points) {
      xs.push(point.x);
      ys.push(point.y);
    }
    for (const station of line.stations) {
      xs.push(station.x);
      ys.push(station.y);
    }
  }

  const minX = xs.length === 0 ? 0 : Math.min(...xs);
  const minY = ys.length === 0 ? 0 : Math.min(...ys);

  return {
    lines,
    interchanges,
    stationByEntryId: new Map(
      lines.flatMap((line) => line.stations.map((station) => [station.entryId, station])),
    ),
    bounds: {
      minX,
      minY,
      width: (xs.length === 0 ? 0 : Math.max(...xs)) - minX,
      height: (ys.length === 0 ? 0 : Math.max(...ys)) - minY,
    },
  };
}

/** Where the car is on the diagram, and where it is going next. */
export interface TransitPosition {
  /** Nearest station to the car. Always set while there is anything to be near. */
  readonly atEntryId: string | null;
  /** First station the car will reach if it keeps going. Null at a dead end. */
  readonly nextEntryId: string | null;
}

/** Plots on one edge, ordered the way a car travelling `direction` meets them. */
function alongEdge(
  plots: readonly PlotTransform[],
  edgeId: string,
  direction: 1 | -1,
): PlotTransform[] {
  return plots
    .filter((plot) => plot.edgeId === edgeId)
    .sort((a, b) => (a.u - b.u) * direction || a.entryId.localeCompare(b.entryId));
}

/**
 * How many edges of road the lookahead will cross to find the next stop.
 *
 * The spine is cut into a separate edge between every pair of features on it,
 * so "the next stop" is routinely four or five edges away and a one-hop
 * lookahead reports nothing at all for most of the drive. That is not a guess
 * about the viewer's intentions: past the junction immediately ahead the walk
 * follows *straight on*, which is what will happen if they do nothing.
 */
const MAX_LOOKAHEAD_EDGES = 12;

/**
 * Which stop you are at and which one is coming, from the drive state.
 *
 * At the junction directly ahead the walk takes the branch the car is actually
 * set to take, so steering changes what the map promises before you commit to
 * it. Beyond that it carries straight on, and it stops the moment it would
 * revisit a road — which is what keeps a cul-de-sac from reporting the building
 * behind you as the one coming up.
 */
export function transitPosition(
  graph: RoadGraph,
  plots: readonly PlotTransform[],
  state: DriveState,
): TransitPosition {
  const edge = graph.edgeById.get(state.edgeId);
  if (edge === undefined) return { atEntryId: null, nextEntryId: null };

  // Compared in world coordinates rather than along the road, so "the stop you
  // are in" is the building you can see out of the window — including one on a
  // road you are not currently on, which is the case at every junction.
  const here = positionOf(graph, state);
  let nearest: { entryId: string; distance: number } | null = null;
  for (const plot of plots) {
    const dx = plot.position.x - here.x;
    const dz = plot.position.z - here.z;
    const distance = dx * dx + dz * dz;
    if (nearest === null || distance < nearest.distance) {
      nearest = { entryId: plot.entryId, distance };
    }
  }

  const atEntryId = nearest?.entryId ?? null;
  const visited = new Set<string>([state.edgeId]);
  let cursor: DriveState = state;

  for (let hop = 0; hop < MAX_LOOKAHEAD_EDGES; hop += 1) {
    const onThisRoad = alongEdge(plots, cursor.edgeId, cursor.direction);
    const found =
      hop === 0
        ? onThisRoad.find((plot) => (cursor.direction > 0 ? plot.u > cursor.u : plot.u < cursor.u))
        : onThisRoad[0];
    if (found !== undefined) return { atEntryId, nextEntryId: found.entryId };

    const options = branchOptions(graph, cursor);
    // The junction in front of you is the viewer's decision and is already
    // made; every junction after it is answered with "straight on", because
    // that is what holding the throttle does.
    const index =
      hop === 0
        ? Math.min(Math.max(cursor.choice, 0), Math.max(options.length - 1, 0))
        : straightAheadIndex(options);
    const nextEdge = graph.edgeById.get(options[index]?.edgeId ?? '');
    if (nextEdge === undefined || visited.has(nextEdge.id)) break;
    visited.add(nextEdge.id);

    const forward = nextEdge.fromId === cursor.targetNodeId;
    cursor = {
      edgeId: nextEdge.id,
      u: forward ? 0 : 1,
      direction: forward ? 1 : -1,
      speed: 0,
      targetNodeId: otherEnd(nextEdge, cursor.targetNodeId),
      choice: 0,
      turning: 0,
    };
  }

  return { atEntryId, nextEntryId: null };
}
