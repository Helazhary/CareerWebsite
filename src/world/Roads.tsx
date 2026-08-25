'use client';

import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { type GraphEdge, type RoadGraph, minorRoadClearance, normalAt, sampleEdge } from './graph';
import { WORLD_COLORS } from './palette';
import { makeRoadTexture } from './textures';

const SAMPLES = 56;
/** Lifted off the ground so the road does not z-fight with it. */
const SURFACE_Y = 0.06;
const MARKING_Y = 0.09;
const KERB_WIDTH = 1.1;
const CENTRE_LINE_WIDTH = 0.55;
const EDGE_LINE_WIDTH = 0.34;
const VERGE_WIDTH = 7;
/**
 * A little past clear, so the ribbon reaches full width having already left its
 * neighbour rather than exactly as it does.
 */
const TAPER_MARGIN = 1.15;

/**
 * Side roads sit a hair under the spine.
 *
 * Where two carriageways overlap near a junction they are the same colour, so
 * the only thing the overlap costs is z-fighting — and coplanar surfaces at
 * identical heights is exactly how you get it. Four millimetres is invisible
 * from any camera in this scene and makes the ordering deterministic.
 */
const MINOR_DROP = 0.004;
/** Dash and gap along the centre line, in world units. */
const DASH = 9;
const GAP = 7;

/**
 * A flat ribbon following the spline between two lateral offsets.
 *
 * Offsets rather than a width so the same function draws the carriageway, the
 * kerbs and the centre line. Without the markings the road is invisible against
 * the ground at driving speed — the tarmac and the verge are both dark grey.
 */
/**
 * How a ribbon fades out at a junction: over what distance, and at which ends.
 *
 * Rather than cutting the flanking ribbons off at a hard line, a side road's
 * kerbs, verges and lines collapse to nothing as they approach the junction —
 * which is also what a real slip road does, widening out of the mouth instead
 * of starting at full width.
 */
interface Taper {
  readonly length: number;
  readonly atStart: boolean;
  readonly atEnd: boolean;
}

/** Eased rather than linear, so a collapsing kerb does not read as a wedge. */
function smoothstep(t: number): number {
  const clamped = Math.min(Math.max(t, 0), 1);
  return clamped * clamped * (3 - 2 * clamped);
}

/** How much of its full width the ribbon has at this point along the edge. */
function widthAt(edge: GraphEdge, u: number, taper: Taper | undefined): number {
  if (taper === undefined) return 1;
  const along = u * edge.length;
  let scale = 1;
  if (taper.atStart) scale = Math.min(scale, smoothstep(along / taper.length));
  if (taper.atEnd) scale = Math.min(scale, smoothstep((edge.length - along) / taper.length));
  return scale;
}

function buildRibbon(
  edge: GraphEdge,
  from: number,
  to: number,
  y: number,
  taper?: Taper,
): THREE.BufferGeometry {
  const positions = new Float32Array((SAMPLES + 1) * 2 * 3);
  const indices: number[] = [];

  // Collapse towards whichever edge of the ribbon is nearer the centreline, so
  // a kerb shrinks back against the carriageway rather than sliding across it.
  // The `from` vertex must stay the `from` vertex: swapping the pair reverses
  // the winding, and a ribbon with its normals in the ground renders perfectly
  // and is invisible from above.
  const anchorIsFrom = Math.abs(from) <= Math.abs(to);

  for (let i = 0; i <= SAMPLES; i += 1) {
    const u = i / SAMPLES;
    const centre = sampleEdge(edge, u);
    const outward = normalAt(edge, u, 1);
    const scale = widthAt(edge, u, taper);
    const near = anchorIsFrom ? from : to + (from - to) * scale;
    const far = anchorIsFrom ? from + (to - from) * scale : to;
    const base = i * 6;

    positions[base] = centre.x + outward.x * near;
    positions[base + 1] = y;
    positions[base + 2] = centre.z + outward.z * near;

    positions[base + 3] = centre.x + outward.x * far;
    positions[base + 4] = y;
    positions[base + 5] = centre.z + outward.z * far;

    if (i < SAMPLES) {
      const left = i * 2;
      const right = left + 1;
      indices.push(left, right, left + 2, right, right + 2, left + 2);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

/**
 * The centre line, broken into dashes.
 *
 * A solid painted line reads as a barrier and kills any sense of speed. Dashes
 * streaming past the car are most of what makes driving feel like driving, and
 * they cost one extra geometry per road.
 */
function buildDashes(
  edge: GraphEdge,
  halfWidth: number,
  y: number,
  taper?: Taper,
): THREE.BufferGeometry {
  const positions: number[] = [];
  const indices: number[] = [];
  const period = DASH + GAP;
  const count = Math.max(1, Math.floor(edge.length / period));

  for (let d = 0; d < count; d += 1) {
    const startU = (d * period) / edge.length;
    const endU = Math.min((d * period + DASH) / edge.length, 1);
    const steps = 4;

    // A centre line has no business inside a junction, and half a dash looks
    // worse than none: drop the whole dash rather than shortening it.
    if (widthAt(edge, (startU + endU) / 2, taper) < 1) continue;

    const base = positions.length / 3;
    for (let i = 0; i <= steps; i += 1) {
      const u = startU + ((endU - startU) * i) / steps;
      const centre = sampleEdge(edge, u);
      const outward = normalAt(edge, u, 1);
      // Negative side first, matching buildRibbon. Reversing the pair flips the
      // winding, which points the normals at the ground and makes the dashes
      // invisible from above while still rendering perfectly.
      positions.push(
        centre.x - outward.x * halfWidth, y, centre.z - outward.z * halfWidth,
        centre.x + outward.x * halfWidth, y, centre.z + outward.z * halfWidth,
      );
      if (i < steps) {
        const left = base + i * 2;
        const right = left + 1;
        indices.push(left, right, left + 2, right, right + 2, left + 2);
      }
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

/**
 * A patch of tarmac laid over a junction.
 *
 * Where roads meet, their ribbons overlap and their markings run straight
 * through each other — kerbs cross the carriageway and two centre lines meet at
 * an angle. Real junctions have none of that: the markings simply stop. The
 * apron sits above the markings and covers them, which is both what a junction
 * looks like and the cheapest way to hide the seam.
 */
function buildApron(radius: number, y: number): THREE.BufferGeometry {
  const geometry = new THREE.CircleGeometry(radius, 24);
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(0, y, 0);
  return geometry;
}

interface Ribbon {
  readonly key: string;
  readonly geometry: THREE.BufferGeometry;
  readonly color: string;
}

/**
 * A detour is somewhere else, so it does not look like the road that got you
 * there. Snow carries the Montreal exchange semester visually rather than as a
 * bullet point (DESIGN.md §2.3), and keys off the edge's structural kind — the
 * renderer never learns which entry is on it.
 */
function surfaceFor(edge: GraphEdge): {
  road: string;
  kerb: string;
  verge: string;
  centre: string;
  edgeLine: string;
} {
  if (edge.kind === 'detour') {
    // Snow settles beside a road, not on it — a ploughed road is still a road.
    // Painting the carriageway white read as a mistake rather than as weather.
    return {
      road: WORLD_COLORS.road,
      kerb: WORLD_COLORS.snowKerb,
      verge: WORLD_COLORS.snowVerge,
      centre: WORLD_COLORS.centreLine,
      edgeLine: WORLD_COLORS.edgeLine,
    };
  }
  return {
    road: WORLD_COLORS.road,
    kerb: WORLD_COLORS.kerb,
    verge: WORLD_COLORS.verge,
    centre: WORLD_COLORS.centreLine,
    edgeLine: WORLD_COLORS.edgeLine,
  };
}

export function Roads({ graph, halfWidth }: { graph: RoadGraph; halfWidth: number }): React.JSX.Element {
  const asphalt = useMemo(() => {
    const map = makeRoadTexture();
    if (map !== null) map.repeat.set(6, 220);
    return map;
  }, []);
  useEffect(() => () => asphalt?.dispose(), [asphalt]);

  /**
   * How long side roads hold their kerbs and verges closed for leaving a
   * junction. Measured from the graph rather than fixed here: it is a property
   * of how far apart the roads actually are, and a constant would quietly stop
   * being enough the moment the content changed the spacing of the world.
   */
  const taperLength = useMemo(
    () => minorRoadClearance(graph, (halfWidth + KERB_WIDTH + VERGE_WIDTH) * 2) * TAPER_MARGIN,
    [graph, halfWidth],
  );

  const ribbons = useMemo<Ribbon[]>(
    () =>
      graph.edges.flatMap((edge) => {
        const paint = surfaceFor(edge);

        // Only side roads taper. A major road's markings run straight past a
        // side turning in the real world and should here: it is the minor road
        // that gives way, and the spine is the one thing you are always
        // following. Two of the spine's own segments are only 46 units long,
        // so tapering it would erase them outright.
        const minor = edge.kind !== 'spine';
        const taper: Taper | undefined = minor
          ? {
              length: taperLength,
              atStart: graph.nodeById.get(edge.fromId)?.kind === 'junction',
              atEnd: graph.nodeById.get(edge.toId)?.kind === 'junction',
            }
          : undefined;
        const lift = minor ? -MINOR_DROP : 0;
        const surfaceY = SURFACE_Y + lift;
        const markingY = MARKING_Y + lift;

        return [
        // Verges first: they sit under everything and give the road an edge to
        // meet, instead of tarmac stopping dead against open ground.
        {
          key: `${edge.id}-verge-left`,
          geometry: buildRibbon(edge, halfWidth + KERB_WIDTH, halfWidth + KERB_WIDTH + VERGE_WIDTH, surfaceY - 0.02, taper),
          // Both verges take the edge's own paint. The left one was hardcoded
          // to the default, so a detour had snow down one side and summer grass
          // down the other.
          color: paint.verge,
        },
        {
          key: `${edge.id}-verge-right`,
          geometry: buildRibbon(edge, -halfWidth - KERB_WIDTH - VERGE_WIDTH, -halfWidth - KERB_WIDTH, surfaceY - 0.02, taper),
          color: paint.verge,
        },
        {
          key: `${edge.id}-surface`,
          geometry: buildRibbon(edge, -halfWidth, halfWidth, surfaceY),
          color: paint.road,
        },
        {
          key: `${edge.id}-kerb-left`,
          geometry: buildRibbon(edge, halfWidth, halfWidth + KERB_WIDTH, markingY, taper),
          color: paint.kerb,
        },
        {
          key: `${edge.id}-kerb-right`,
          geometry: buildRibbon(edge, -halfWidth - KERB_WIDTH, -halfWidth, markingY, taper),
          color: paint.kerb,
        },
        {
          key: `${edge.id}-edge-left`,
          geometry: buildRibbon(edge, halfWidth - 1.5 - EDGE_LINE_WIDTH, halfWidth - 1.5, markingY, taper),
          color: paint.edgeLine,
        },
        {
          key: `${edge.id}-edge-right`,
          geometry: buildRibbon(edge, -halfWidth + 1.5, -halfWidth + 1.5 + EDGE_LINE_WIDTH, markingY, taper),
          color: paint.edgeLine,
        },
        {
          key: `${edge.id}-centre`,
          geometry: buildDashes(edge, CENTRE_LINE_WIDTH, markingY, taper),
          color: paint.centre,
        },
      ];
      }),
    [graph, halfWidth, taperLength],
  );

  const aprons = useMemo(() => {
    const geometry = buildApron(halfWidth + KERB_WIDTH * 1.6, MARKING_Y + 0.02);
    const nodes = graph.nodes.filter((node) => node.kind === 'junction');
    return { geometry, nodes };
  }, [graph, halfWidth]);

  useEffect(() => () => aprons.geometry.dispose(), [aprons]);

  return (
    <group>
      {aprons.nodes.map((node) => (
        <mesh
          key={`apron-${node.id}`}
          geometry={aprons.geometry}
          position={[node.position.x, 0, node.position.z]}
          receiveShadow
        >
          <meshStandardMaterial color={WORLD_COLORS.road} map={asphalt} roughness={0.95} />
        </mesh>
      ))}
      {ribbons.map(({ key, geometry, color }) => (
        <mesh key={key} geometry={geometry} receiveShadow>
          <meshStandardMaterial
            color={color}
            // Only the carriageway is textured; markings and kerbs stay flat so
            // the grain does not fight the paint.
            map={key.endsWith('-surface') ? asphalt : null}
            roughness={0.95}
            metalness={0}
            // Paint sits on tarmac. Nine centimetres of clearance is plenty at
            // arm's length and nothing at all two hundred units down the road,
            // where the depth buffer stops being able to tell them apart and
            // the markings dissolve into the surface. The offset settles it in
            // the rasteriser instead, where distance does not matter.
            polygonOffset={!key.endsWith('-surface')}
            polygonOffsetFactor={-2}
            polygonOffsetUnits={-2}
          />
        </mesh>
      ))}
    </group>
  );
}
