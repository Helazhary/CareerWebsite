'use client';

import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { type GraphEdge, type RoadGraph, normalAt, sampleEdge } from './graph';
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
function buildRibbon(edge: GraphEdge, from: number, to: number, y: number): THREE.BufferGeometry {
  const positions = new Float32Array((SAMPLES + 1) * 2 * 3);
  const indices: number[] = [];

  for (let i = 0; i <= SAMPLES; i += 1) {
    const u = i / SAMPLES;
    const centre = sampleEdge(edge, u);
    const outward = normalAt(edge, u, 1);
    const base = i * 6;

    positions[base] = centre.x + outward.x * from;
    positions[base + 1] = y;
    positions[base + 2] = centre.z + outward.z * from;

    positions[base + 3] = centre.x + outward.x * to;
    positions[base + 4] = y;
    positions[base + 5] = centre.z + outward.z * to;

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
function buildDashes(edge: GraphEdge, halfWidth: number, y: number): THREE.BufferGeometry {
  const positions: number[] = [];
  const indices: number[] = [];
  const period = DASH + GAP;
  const count = Math.max(1, Math.floor(edge.length / period));

  for (let d = 0; d < count; d += 1) {
    const startU = (d * period) / edge.length;
    const endU = Math.min((d * period + DASH) / edge.length, 1);
    const steps = 4;

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

  const ribbons = useMemo<Ribbon[]>(
    () =>
      graph.edges.flatMap((edge) => {
        const paint = surfaceFor(edge);
        return [
        // Verges first: they sit under everything and give the road an edge to
        // meet, instead of tarmac stopping dead against open ground.
        {
          key: `${edge.id}-verge-left`,
          geometry: buildRibbon(edge, halfWidth + KERB_WIDTH, halfWidth + KERB_WIDTH + VERGE_WIDTH, SURFACE_Y - 0.02),
          color: WORLD_COLORS.verge,
        },
        {
          key: `${edge.id}-verge-right`,
          geometry: buildRibbon(edge, -halfWidth - KERB_WIDTH - VERGE_WIDTH, -halfWidth - KERB_WIDTH, SURFACE_Y - 0.02),
          color: paint.verge,
        },
        {
          key: `${edge.id}-surface`,
          geometry: buildRibbon(edge, -halfWidth, halfWidth, SURFACE_Y),
          color: paint.road,
        },
        {
          key: `${edge.id}-kerb-left`,
          geometry: buildRibbon(edge, halfWidth, halfWidth + KERB_WIDTH, MARKING_Y),
          color: paint.kerb,
        },
        {
          key: `${edge.id}-kerb-right`,
          geometry: buildRibbon(edge, -halfWidth - KERB_WIDTH, -halfWidth, MARKING_Y),
          color: paint.kerb,
        },
        {
          key: `${edge.id}-edge-left`,
          geometry: buildRibbon(edge, halfWidth - 1.5 - EDGE_LINE_WIDTH, halfWidth - 1.5, MARKING_Y),
          color: paint.edgeLine,
        },
        {
          key: `${edge.id}-edge-right`,
          geometry: buildRibbon(edge, -halfWidth + 1.5, -halfWidth + 1.5 + EDGE_LINE_WIDTH, MARKING_Y),
          color: paint.edgeLine,
        },
        {
          key: `${edge.id}-centre`,
          geometry: buildDashes(edge, CENTRE_LINE_WIDTH, MARKING_Y),
          color: paint.centre,
        },
      ];
      }),
    [graph, halfWidth],
  );

  const aprons = useMemo(() => {
    const geometry = buildApron(halfWidth + KERB_WIDTH * 0.8, MARKING_Y + 0.02);
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
          />
        </mesh>
      ))}
    </group>
  );
}
