'use client';

import { useMemo } from 'react';
import * as THREE from 'three';
import { type GraphEdge, type RoadGraph, normalAt, sampleEdge } from './graph';
import { WORLD_COLORS } from './palette';

const SAMPLES = 56;
/** Lifted off the ground so the road does not z-fight with it. */
const SURFACE_Y = 0.06;
const MARKING_Y = 0.09;
const KERB_WIDTH = 1.1;
const CENTRE_LINE_WIDTH = 0.45;

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

interface Ribbon {
  readonly key: string;
  readonly geometry: THREE.BufferGeometry;
  readonly color: string;
}

export function Roads({ graph, halfWidth }: { graph: RoadGraph; halfWidth: number }): React.JSX.Element {
  const ribbons = useMemo<Ribbon[]>(
    () =>
      graph.edges.flatMap((edge) => [
        {
          key: `${edge.id}-surface`,
          geometry: buildRibbon(edge, -halfWidth, halfWidth, SURFACE_Y),
          color: WORLD_COLORS.road,
        },
        {
          key: `${edge.id}-kerb-left`,
          geometry: buildRibbon(edge, halfWidth, halfWidth + KERB_WIDTH, MARKING_Y),
          color: WORLD_COLORS.kerb,
        },
        {
          key: `${edge.id}-kerb-right`,
          geometry: buildRibbon(edge, -halfWidth - KERB_WIDTH, -halfWidth, MARKING_Y),
          color: WORLD_COLORS.kerb,
        },
        {
          key: `${edge.id}-centre`,
          geometry: buildRibbon(edge, -CENTRE_LINE_WIDTH, CENTRE_LINE_WIDTH, MARKING_Y),
          color: WORLD_COLORS.centreLine,
        },
      ]),
    [graph, halfWidth],
  );

  return (
    <group>
      {ribbons.map(({ key, geometry, color }) => (
        <mesh key={key} geometry={geometry} receiveShadow>
          <meshStandardMaterial color={color} roughness={0.95} metalness={0} />
        </mesh>
      ))}
    </group>
  );
}
