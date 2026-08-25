/**
 * Pure road-graph construction.
 *
 * Takes content entries and returns the road network as plain data: junction
 * nodes, spline edges, and an anchor per entry saying where on the network its
 * building sits. No `three`, no `react`, no DOM — this file runs in Node and is
 * unit tested directly.
 *
 * The world is oriented so that **x is time** and **z is lateral offset**. The
 * main highway runs along `z = 0` from the garage at spawn out into fog, and a
 * date maps to an x coordinate. Driving straight therefore reads exactly like
 * the resume, which is the whole point of the map (DESIGN.md §2.3).
 */

import type { Entry, District } from '@content/schema';

export interface Vec2 {
  readonly x: number;
  readonly z: number;
}

export type NodeKind = 'spawn' | 'junction' | 'terminus';

export interface GraphNode {
  readonly id: string;
  readonly kind: NodeKind;
  readonly position: Vec2;
  /** Edges incident to this node. A junction has 3; spawn and termini have 1. */
  readonly edgeIds: readonly string[];
}

/** What a stretch of road *is*, structurally. Presentation keys off this. */
export type EdgeKind = 'spine' | 'spur' | 'detour';

export interface GraphEdge {
  readonly id: string;
  readonly fromId: string;
  readonly toId: string;
  readonly kind: EdgeKind;
  /**
   * Which district this stretch of road belongs to. `highway` is the spine;
   * anything else is an off-ramp. The HUD resolves this to a display label —
   * graph.ts stays free of presentation.
   */
  readonly district: District;
  /** Catmull-Rom control points in world space, `from` first and `to` last. */
  readonly points: readonly Vec2[];
  /**
   * Cumulative distance at evenly spaced raw parameters, used to reparameterise
   * the spline by arc length. Without this, `u` advances faster on straight
   * stretches than on curves and the car changes speed for no reason.
   */
  readonly arcTable: readonly number[];
  /** Arc length in world units. */
  readonly length: number;
}

/** Where a single entry's building sits on the road network. */
export interface RoadAnchor {
  readonly entryId: string;
  readonly edgeId: string;
  /** Parameter along the edge, 0..1. */
  readonly u: number;
  /** Which side of the road the building sits on. */
  readonly side: -1 | 1;
}

export interface RoadGraph {
  readonly nodes: readonly GraphNode[];
  readonly edges: readonly GraphEdge[];
  readonly spawnNodeId: string;
  readonly anchors: readonly RoadAnchor[];
  readonly nodeById: ReadonlyMap<string, GraphNode>;
  readonly edgeById: ReadonlyMap<string, GraphEdge>;
  readonly anchorByEntryId: ReadonlyMap<string, RoadAnchor>;
}

export interface GraphOptions {
  /** World units per calendar month along the spine. */
  readonly unitsPerMonth: number;
  /** Minimum spacing between two features on the spine, in world units. */
  readonly minSpineGap: number;
  /**
   * Minimum spacing between two off-ramps leaving the *same* side of the
   * spine. Districts whose work overlaps in time would otherwise get junctions
   * a few units apart and their cul-de-sacs would be laid on top of each other.
   */
  readonly sameSideDistrictGap: number;
  /** How far an off-ramp reaches away from the spine. */
  readonly spurLength: number;
  /** How far the garage sits behind the first spine feature. */
  readonly garageDepth: number;
  /** How far the road continues past the last building, into fog. */
  readonly fogRunout: number;
  /** Half the length of a detour's opening along the spine. */
  readonly detourSpan: number;
  /** How far a detour bows away from the spine. */
  readonly detourDepth: number;
}

export const DEFAULT_GRAPH_OPTIONS: GraphOptions = {
  unitsPerMonth: 14,
  minSpineGap: 46,
  sameSideDistrictGap: 260,
  spurLength: 170,
  garageDepth: 90,
  // Long enough to read as a place you went, short enough that the road home
  // is always in view.
  fogRunout: 300,
  detourSpan: 62,
  detourDepth: 92,
};

/**
 * Which side of the spine a district's off-ramp leaves from.
 *
 * `0` means the district has no off-ramp of its own: `highway` *is* the spine,
 * and `garage` is the stub at spawn that the car drives out of. Behaviour keys
 * off district, never off an entry's identity.
 */
const DISTRICT_SIDE: Record<District, -1 | 0 | 1> = {
  highway: 0,
  garage: 0,
  lab: 1,
  agents: 1,
  workshop: -1,
  arcade: -1,
};

/** Districts that branch off the spine, in a stable order. */
const SPUR_DISTRICTS: readonly District[] = (
  Object.keys(DISTRICT_SIDE) as District[]
).filter((d) => DISTRICT_SIDE[d] !== 0);

/** `YYYY-MM` to an absolute month count. Comparable, subtractable. */
export function monthIndex(yearMonth: string): number {
  const [yearPart, monthPart] = yearMonth.split('-');
  const year = Number(yearPart);
  const month = Number(monthPart);
  if (!Number.isFinite(year) || !Number.isFinite(month)) {
    throw new Error(`Expected YYYY-MM, received "${yearMonth}"`);
  }
  return year * 12 + (month - 1);
}

/**
 * Push values apart until each is at least `minGap` from the previous one,
 * preserving order and never moving a value backwards. Chronology survives;
 * two things that happened the same month still get their own plot of land.
 */
export function spreadMonotonicWith(
  values: readonly number[],
  gapBefore: (index: number) => number,
): number[] {
  const out: number[] = [];
  let previous = Number.NEGATIVE_INFINITY;
  values.forEach((value, index) => {
    const placed =
      previous === Number.NEGATIVE_INFINITY ? value : Math.max(value, previous + gapBefore(index));
    out.push(placed);
    previous = placed;
  });
  return out;
}

export function spreadMonotonic(values: readonly number[], minGap: number): number[] {
  return spreadMonotonicWith(values, () => minGap);
}

const ARC_SAMPLES = 96;

/**
 * Control point at `index`, reflecting past either end rather than clamping.
 *
 * Reflection is what makes a straight two-point edge evaluate as an exactly
 * straight, evenly spaced line. Clamping instead produces a subtle ease in the
 * parameterisation, which is invisible in the road but wrong for anything that
 * walks along it.
 */
function pointAt(points: readonly Vec2[], index: number): Vec2 {
  const count = points.length;
  if (count === 0) throw new Error('road edge has no control points');

  if (index < 0) {
    const first = points[0];
    const second = points[1] ?? first;
    if (first === undefined || second === undefined) throw new Error('road edge control point missing');
    return { x: 2 * first.x - second.x, z: 2 * first.z - second.z };
  }
  if (index > count - 1) {
    const last = points[count - 1];
    const previous = points[count - 2] ?? last;
    if (last === undefined || previous === undefined) throw new Error('road edge control point missing');
    return { x: 2 * last.x - previous.x, z: 2 * last.z - previous.z };
  }

  const point = points[index];
  if (point === undefined) throw new Error('road edge control point missing');
  return point;
}

function catmullRom(p0: number, p1: number, p2: number, p3: number, t: number): number {
  const t2 = t * t;
  const t3 = t2 * t;
  return (
    0.5 *
    (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3)
  );
}

function clamp01(value: number): number {
  return Math.min(Math.max(value, 0), 1);
}

/** Evaluate the spline at its raw parameter, which is *not* arc length. */
function sampleRaw(points: readonly Vec2[], t: number): Vec2 {
  if (points.length === 1) return pointAt(points, 0);
  const segments = points.length - 1;
  const scaled = clamp01(t) * segments;
  const index = Math.min(Math.floor(scaled), segments - 1);
  const local = scaled - index;
  const p0 = pointAt(points, index - 1);
  const p1 = pointAt(points, index);
  const p2 = pointAt(points, index + 1);
  const p3 = pointAt(points, index + 2);
  return {
    x: catmullRom(p0.x, p1.x, p2.x, p3.x, local),
    z: catmullRom(p0.z, p1.z, p2.z, p3.z, local),
  };
}

function buildArcTable(points: readonly Vec2[]): number[] {
  const table: number[] = [0];
  if (points.length < 2) return table;
  let previous = sampleRaw(points, 0);
  let total = 0;
  for (let step = 1; step <= ARC_SAMPLES; step += 1) {
    const current = sampleRaw(points, step / ARC_SAMPLES);
    total += Math.hypot(current.x - previous.x, current.z - previous.z);
    table.push(total);
    previous = current;
  }
  return table;
}

/** Map a distance fraction to the raw spline parameter that reaches it. */
function rawForArc(edge: GraphEdge, u: number): number {
  const { arcTable, length } = edge;
  if (length === 0 || arcTable.length < 2) return clamp01(u);
  const target = clamp01(u) * length;

  let low = 0;
  let high = arcTable.length - 1;
  while (high - low > 1) {
    const mid = Math.floor((low + high) / 2);
    if ((arcTable[mid] ?? 0) <= target) low = mid;
    else high = mid;
  }

  const before = arcTable[low] ?? 0;
  const after = arcTable[high] ?? before;
  const span = after - before;
  const withinSegment = span === 0 ? 0 : (target - before) / span;
  return (low + withinSegment) / (arcTable.length - 1);
}

/**
 * Position on an edge at `u` in 0..1, where `u` is the **fraction of distance
 * travelled**. Equal steps in `u` are equal steps on the ground.
 */
export function sampleEdge(edge: GraphEdge, u: number): Vec2 {
  return sampleRaw(edge.points, rawForArc(edge, u));
}

/** Unit tangent on an edge at parameter `u`. The direction the car faces. */
export function tangentAt(edge: GraphEdge, u: number): Vec2 {
  const delta = 1e-4;
  const before = sampleEdge(edge, Math.max(u - delta, 0));
  const after = sampleEdge(edge, Math.min(u + delta, 1));
  const dx = after.x - before.x;
  const dz = after.z - before.z;
  const magnitude = Math.hypot(dx, dz);
  if (magnitude === 0) return { x: 1, z: 0 };
  return { x: dx / magnitude, z: dz / magnitude };
}

/** Unit normal pointing to the given side of the road. */
export function normalAt(edge: GraphEdge, u: number, side: -1 | 1): Vec2 {
  const tangent = tangentAt(edge, u);
  return { x: -tangent.z * side, z: tangent.x * side };
}

function makeEdge(
  id: string,
  fromId: string,
  toId: string,
  district: District,
  kind: EdgeKind,
  points: readonly Vec2[],
): GraphEdge {
  const arcTable = buildArcTable(points);
  return {
    id,
    fromId,
    toId,
    district,
    kind,
    points,
    arcTable,
    length: arcTable[arcTable.length - 1] ?? 0,
  };
}

/** Earliest month an entry touches. Sorting the spine is sorting by this. */
function startOf(entry: Entry): number {
  return monthIndex(entry.start);
}

/**
 * Build the road network for a set of entries.
 *
 * The shape is fixed and deterministic: a spine carrying everything on the
 * `highway` district in date order, one off-ramp per other district leaving the
 * spine at the date that district's work began, and a garage stub behind spawn.
 */
export function buildRoadGraph(
  entries: readonly Entry[],
  options: Partial<GraphOptions> = {},
): RoadGraph {
  const config: GraphOptions = { ...DEFAULT_GRAPH_OPTIONS, ...options };

  if (entries.length === 0) {
    const spawn: GraphNode = { id: 'spawn', kind: 'spawn', position: { x: 0, z: 0 }, edgeIds: ['spine-0'] };
    const fog: GraphNode = {
      id: 'terminus-fog',
      kind: 'terminus',
      position: { x: config.fogRunout, z: 0 },
      edgeIds: ['spine-0'],
    };
    const edge = makeEdge('spine-0', spawn.id, fog.id, 'highway', 'spine', [spawn.position, fog.position]);
    return assemble([spawn, fog], [edge], spawn.id, []);
  }

  const baseMonth = Math.min(...entries.map(startOf));
  const rawX = (entry: Entry): number => (startOf(entry) - baseMonth) * config.unitsPerMonth;

  // Everything that needs its own slice of the timeline: spine buildings, and
  // the junction where each off-ramp leaves.
  type Feature =
    | { readonly kind: 'entry'; readonly id: string; readonly raw: number }
    | { readonly kind: 'junction'; readonly id: string; readonly district: District; readonly raw: number }
    | { readonly kind: 'detour'; readonly id: string; readonly entryId: string; readonly end: 'in' | 'out'; readonly raw: number };

  // Only the highway rides the timeline. The garage is the stub at spawn — it
  // opens the world regardless of when the car in it was built.
  const spineEntries = entries.filter((e) => e.district === 'highway' && !e.detour);
  const detourEntries = entries.filter((e) => e.district === 'highway' && e.detour);

  const features: Feature[] = spineEntries.map((e) => ({ kind: 'entry', id: e.id, raw: rawX(e) }));

  // A detour opens and closes on the spine at its own date, so it still reads
  // chronologically when driven straight past.
  for (const entry of detourEntries) {
    features.push({
      kind: 'detour', id: `detour-in-${entry.id}`, entryId: entry.id, end: 'in',
      raw: rawX(entry) - config.detourSpan,
    });
    features.push({
      kind: 'detour', id: `detour-out-${entry.id}`, entryId: entry.id, end: 'out',
      raw: rawX(entry) + config.detourSpan,
    });
  }

  for (const district of SPUR_DISTRICTS) {
    const members = entries.filter((e) => e.district === district);
    if (members.length === 0) continue;
    features.push({
      kind: 'junction',
      id: `junction-${district}`,
      district,
      raw: Math.min(...members.map(rawX)),
    });
  }

  features.sort((a, b) => a.raw - b.raw || a.id.localeCompare(b.id));
  const spreadX = spreadMonotonicWith(
    features.map((f) => f.raw),
    (index) => {
      const previous = features[index - 1];
      const current = features[index];
      if (previous?.kind !== 'junction' || current?.kind !== 'junction') return config.minSpineGap;
      return DISTRICT_SIDE[previous.district] === DISTRICT_SIDE[current.district]
        ? config.sameSideDistrictGap
        : config.minSpineGap;
    },
  );

  const positioned = features.map((feature, index) => ({
    feature,
    x: spreadX[index] ?? feature.raw,
  }));

  const firstX = positioned[0]?.x ?? 0;
  const lastX = positioned[positioned.length - 1]?.x ?? 0;

  // --- Spine nodes: spawn, every junction in order, then fog. ---
  const spawnPosition: Vec2 = { x: firstX - config.garageDepth, z: 0 };
  const spineNodes: { id: string; kind: NodeKind; position: Vec2; district?: District }[] = [
    { id: 'spawn', kind: 'spawn', position: spawnPosition },
  ];
  for (const { feature, x } of positioned) {
    if (feature.kind === 'junction') {
      spineNodes.push({ id: feature.id, kind: 'junction', position: { x, z: 0 }, district: feature.district });
    }
    if (feature.kind === 'detour') {
      spineNodes.push({ id: feature.id, kind: 'junction', position: { x, z: 0 } });
    }
  }
  spineNodes.push({
    id: 'terminus-fog',
    kind: 'terminus',
    position: { x: lastX + config.fogRunout, z: 0 },
  });

  const edges: GraphEdge[] = [];
  const incident = new Map<string, string[]>();
  const link = (nodeId: string, edgeId: string): void => {
    const list = incident.get(nodeId) ?? [];
    list.push(edgeId);
    incident.set(nodeId, list);
  };

  for (let i = 0; i < spineNodes.length - 1; i += 1) {
    const from = spineNodes[i];
    const to = spineNodes[i + 1];
    if (from === undefined || to === undefined) continue;
    const id = `spine-${i}`;
    edges.push(makeEdge(id, from.id, to.id, 'highway', 'spine', [from.position, to.position]));
    link(from.id, id);
    link(to.id, id);
  }

  // --- Off-ramps: an S-curve away from the spine, ending in a cul-de-sac. ---
  const spurTermini: GraphNode[] = [];
  for (const node of spineNodes) {
    if (node.kind !== 'junction' || node.district === undefined) continue;
    const side = DISTRICT_SIDE[node.district];
    if (side === 0) continue;

    const origin = node.position;
    const end: Vec2 = { x: origin.x, z: side * config.spurLength };
    const points: readonly Vec2[] = [
      origin,
      { x: origin.x + config.spurLength * 0.22, z: side * config.spurLength * 0.2 },
      { x: origin.x + config.spurLength * 0.16, z: side * config.spurLength * 0.62 },
      end,
    ];

    const terminusId = `terminus-${node.district}`;
    const edgeId = `spur-${node.district}`;
    edges.push(makeEdge(edgeId, node.id, terminusId, node.district, 'spur', points));
    link(node.id, edgeId);
    link(terminusId, edgeId);
    spurTermini.push({ id: terminusId, kind: 'terminus', position: end, edgeIds: [edgeId] });
  }

  // --- Detours: a bridge leaving the spine and rejoining it further on. ---
  for (const entry of detourEntries) {
    const openId = `detour-in-${entry.id}`;
    const closeId = `detour-out-${entry.id}`;
    const open = spineNodes.find((node) => node.id === openId);
    const close = spineNodes.find((node) => node.id === closeId);
    if (open === undefined || close === undefined) continue;

    const depth = config.detourDepth;
    const points: readonly Vec2[] = [
      open.position,
      { x: open.position.x + (close.position.x - open.position.x) * 0.28, z: depth * 0.75 },
      { x: open.position.x + (close.position.x - open.position.x) * 0.5, z: depth },
      { x: open.position.x + (close.position.x - open.position.x) * 0.72, z: depth * 0.75 },
      close.position,
    ];

    const edgeId = `detour-${entry.id}`;
    edges.push(makeEdge(edgeId, openId, closeId, entry.district, 'detour', points));
    link(openId, edgeId);
    link(closeId, edgeId);
  }

  const nodes: GraphNode[] = [
    ...spineNodes.map((node) => ({
      id: node.id,
      kind: node.kind,
      position: node.position,
      edgeIds: incident.get(node.id) ?? [],
    })),
    ...spurTermini.map((node) => ({ ...node, edgeIds: incident.get(node.id) ?? [] })),
  ];

  const anchors = placeAnchors(entries, edges, positioned);
  return assemble(nodes, edges, 'spawn', anchors);
}

/**
 * Decide which stretch of road each building sits beside.
 *
 * Spine entries land at their date. Off-ramp entries space out evenly along
 * their spur. Sides alternate so consecutive buildings face each other across
 * the road rather than stacking on one shoulder.
 */
function placeAnchors(
  entries: readonly Entry[],
  edges: readonly GraphEdge[],
  positioned: readonly { readonly feature: { readonly kind: string; readonly id: string }; readonly x: number }[],
): RoadAnchor[] {
  const anchors: RoadAnchor[] = [];
  const spineEdges = edges.filter((e) => e.district === 'highway');
  const xById = new Map(positioned.map(({ feature, x }) => [feature.id, x]));

  const spineEntries = entries
    .filter((e) => e.district === 'highway' && !e.detour)
    .sort((a, b) => (xById.get(a.id) ?? 0) - (xById.get(b.id) ?? 0));

  spineEntries.forEach((entry, index) => {
    const x = xById.get(entry.id);
    if (x === undefined) return;
    const host = spineEdges.find((edge) => {
      const start = pointAt(edge.points, 0).x;
      const end = pointAt(edge.points, edge.points.length - 1).x;
      return x >= start && x <= end;
    });
    if (host === undefined) return;
    const start = pointAt(host.points, 0).x;
    const end = pointAt(host.points, host.points.length - 1).x;
    const span = end - start;
    anchors.push({
      entryId: entry.id,
      edgeId: host.id,
      u: span === 0 ? 0.5 : (x - start) / span,
      side: index % 2 === 0 ? 1 : -1,
    });
  });

  // Detour entries sit at the far side of their own bridge — the point of the
  // detour is that you have to leave the main road to reach them.
  for (const entry of entries) {
    if (!entry.detour) continue;
    const bridge = edges.find((edge) => edge.id === `detour-${entry.id}`);
    if (bridge === undefined) continue;
    anchors.push({ entryId: entry.id, edgeId: bridge.id, u: 0.5, side: 1 });
  }

  // The garage sits at spawn, on the opening stretch of road, so the world
  // starts with the car in its own garage rather than dropped onto a motorway.
  const openingEdge = spineEdges[0];
  if (openingEdge !== undefined) {
    entries
      .filter((e) => e.district === 'garage')
      .sort((a, b) => startOf(a) - startOf(b) || a.id.localeCompare(b.id))
      .forEach((entry, index) => {
        anchors.push({
          entryId: entry.id,
          edgeId: openingEdge.id,
          u: Math.min(0.06 + index * 0.12, 0.45),
          side: index % 2 === 0 ? -1 : 1,
        });
      });
  }

  for (const district of SPUR_DISTRICTS) {
    const members = entries
      .filter((e) => e.district === district)
      .sort((a, b) => startOf(a) - startOf(b) || a.id.localeCompare(b.id));
    if (members.length === 0) continue;
    const spur = edges.find((e) => e.district === district);
    if (spur === undefined) continue;
    members.forEach((entry, index) => {
      anchors.push({
        entryId: entry.id,
        edgeId: spur.id,
        u: (index + 1) / (members.length + 1),
        side: index % 2 === 0 ? 1 : -1,
      });
    });
  }

  return anchors;
}

function assemble(
  nodes: readonly GraphNode[],
  edges: readonly GraphEdge[],
  spawnNodeId: string,
  anchors: readonly RoadAnchor[],
): RoadGraph {
  return {
    nodes,
    edges,
    spawnNodeId,
    anchors,
    nodeById: new Map(nodes.map((n) => [n.id, n])),
    edgeById: new Map(edges.map((e) => [e.id, e])),
    anchorByEntryId: new Map(anchors.map((a) => [a.entryId, a])),
  };
}

/** Edges leaving a node, excluding the one arrived on. The junction menu. */
export function branchesFrom(graph: RoadGraph, nodeId: string, arrivedOn?: string): GraphEdge[] {
  const node = graph.nodeById.get(nodeId);
  if (node === undefined) return [];
  return node.edgeIds
    .filter((id) => id !== arrivedOn)
    .flatMap((id) => {
      const edge = graph.edgeById.get(id);
      return edge === undefined ? [] : [edge];
    });
}

/** The node at the far end of an edge, given the one you came from. */
export function otherEnd(edge: GraphEdge, nodeId: string): string {
  return edge.fromId === nodeId ? edge.toId : edge.fromId;
}

/**
 * How far a side road runs before it is clear of the roads it left.
 *
 * A junction is not a point. A spur leaves the spine and stays alongside it for
 * tens of units before there is room for both of them to have their own kerbs,
 * verges and lines — and until then, whatever each road draws beside itself is
 * drawn on top of its neighbour. Coplanar and identically coloured, that is
 * z-fighting; it produced a stitched white slab at every off-ramp.
 *
 * The renderer needs one number: how long to hold a side road's flanking
 * ribbons closed for. That number is a property of the graph's geometry rather
 * than a look, so it is measured here rather than guessed there — content that
 * changes the spacing of the world changes this answer with it, instead of
 * silently outgrowing a constant.
 *
 * Measured as: walking out from the junction along the minor road, the distance
 * at which its centreline is finally `clearance` from every neighbour's, taking
 * each neighbour as a whole rather than at matched distance — the spur curves,
 * and the point of it nearest the spine is not the point level with it.
 */
export function minorRoadClearance(graph: RoadGraph, clearance: number): number {
  const STEP = 2;
  const LIMIT = 160;
  const SAMPLES = 48;
  let needed = 0;

  for (const node of graph.nodes) {
    if (node.kind !== 'junction') continue;
    const incident = node.edgeIds.flatMap((id) => {
      const edge = graph.edgeById.get(id);
      return edge === undefined ? [] : [edge];
    });

    for (const minor of incident) {
      if (minor.kind === 'spine') continue;
      const outward = minor.fromId === node.id;

      for (const other of incident) {
        if (other.id === minor.id) continue;

        let clearedAt = LIMIT;
        for (let distance = 0; distance <= LIMIT; distance += STEP) {
          const u = outward ? distance / minor.length : 1 - distance / minor.length;
          if (u < 0 || u > 1) break;
          const point = sampleEdge(minor, u);

          let nearest = Number.POSITIVE_INFINITY;
          for (let i = 0; i <= SAMPLES; i += 1) {
            const against = sampleEdge(other, i / SAMPLES);
            nearest = Math.min(nearest, Math.hypot(point.x - against.x, point.z - against.z));
          }
          if (nearest >= clearance) {
            clearedAt = distance;
            break;
          }
        }
        needed = Math.max(needed, clearedAt);
      }
    }
  }

  return needed;
}
