'use client';

import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import type { RoadGraph } from './graph';
import { DEFAULT_LAYOUT_OPTIONS } from './layout';
import { WORLD_COLORS } from './palette';
import { site } from '@/lib/site';
import { createSignTexture } from './signTexture';

/**
 * The end of the road.
 *
 * The spine runs past the last building and keeps going into the fog, with a
 * gantry sign over it. The closing note is "still driving" rather than "get in
 * touch", because the road not ending is the whole point — a contact call to
 * action would say the career was finished (DESIGN.md §2.3).
 */

const SIGN_WIDTH = 19;
const SIGN_HEIGHT = 5;
const GANTRY_HEIGHT = 13;

/**
 * How far the road carries on past the last node the car can reach.
 *
 * The drivable graph stops at the terminus — driving a kilometre of empty fog
 * is not an experience. But a road that simply *stops*, with a visible edge and
 * bare ground beyond, says the world ran out. This stretch is scenery: it runs
 * past the fog distance so it is never seen to end.
 */
const RUN_ON = 1500;

/** A flat strip along +x. The continuation is straight, so this is enough. */
function strip(
  fromX: number,
  halfWidth: number,
  y: number,
  length: number,
  offsetZ = 0,
): THREE.BufferGeometry {
  const geometry = new THREE.PlaneGeometry(length, halfWidth * 2);
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(fromX + length / 2, y, offsetZ);
  return geometry;
}

export function RoadEnd({ graph }: { graph: RoadGraph }): React.JSX.Element | null {
  const fog = graph.nodeById.get('terminus-fog');

  const texture = useMemo(
    () =>
      createSignTexture(site.closingSign, {
        width: 768,
        height: Math.round((768 * SIGN_HEIGHT) / SIGN_WIDTH),
        panel: '#0d1119',
        ink: '#dfe5ef',
        uppercase: true,
      }),
    [],
  );
  useEffect(() => () => texture?.dispose(), [texture]);

  const halfWidth = DEFAULT_LAYOUT_OPTIONS.roadHalfWidth;
  const runOn = useMemo(() => {
    if (fog === undefined) return null;
    // Every layer the drivable road has, or the join is a visible seam right
    // where the eye is already looking.
    const x = fog.position.x;
    return {
      verge: strip(x, halfWidth + 8.1, 0.04, RUN_ON),
      surface: strip(x, halfWidth, 0.06, RUN_ON),
      kerbs: [
        strip(x, 0.55, 0.09, RUN_ON, halfWidth + 0.55),
        strip(x, 0.55, 0.09, RUN_ON, -halfWidth - 0.55),
      ],
      edges: [
        strip(x, 0.17, 0.09, RUN_ON, halfWidth - 1.67),
        strip(x, 0.17, 0.09, RUN_ON, -halfWidth + 1.67),
      ],
      centre: strip(x, 0.55, 0.09, RUN_ON),
    };
  }, [fog, halfWidth]);

  useEffect(
    () => () => {
      runOn?.surface.dispose();
      runOn?.verge.dispose();
      runOn?.centre.dispose();
      runOn?.kerbs.forEach((geometry) => geometry.dispose());
      runOn?.edges.forEach((geometry) => geometry.dispose());
    },
    [runOn],
  );

  if (fog === undefined || texture === null || runOn === null) return null;

  // Set back from the terminus so the road visibly continues underneath and
  // past it, rather than stopping at a sign.
  const x = fog.position.x - 120;

  return (
    <group>
      {/* Scenery, not road: the car can never reach this. It exists so the
          highway is never seen to stop. */}
      <group position={[0, 0, fog.position.z]}>
        <mesh geometry={runOn.verge} receiveShadow>
          <meshStandardMaterial color={WORLD_COLORS.verge} roughness={1} />
        </mesh>
        <mesh geometry={runOn.surface} receiveShadow>
          <meshStandardMaterial color={WORLD_COLORS.road} roughness={0.95} />
        </mesh>
        {runOn.kerbs.map((geometry, index) => (
          <mesh key={`kerb-${index}`} geometry={geometry}>
            <meshStandardMaterial color={WORLD_COLORS.kerb} roughness={0.9} />
          </mesh>
        ))}
        {runOn.edges.map((geometry, index) => (
          <mesh key={`edge-${index}`} geometry={geometry}>
            <meshStandardMaterial color={WORLD_COLORS.edgeLine} roughness={0.9} />
          </mesh>
        ))}
        <mesh geometry={runOn.centre}>
          <meshStandardMaterial color={WORLD_COLORS.centreLine} roughness={0.9} />
        </mesh>
      </group>

    <group position={[x, 0, fog.position.z]} rotation={[0, -Math.PI / 2, 0]}>
      {[-12, 12].map((offset) => (
        <mesh key={offset} position={[offset, GANTRY_HEIGHT / 2, 0]} castShadow>
          <boxGeometry args={[0.7, GANTRY_HEIGHT, 0.7]} />
          <meshStandardMaterial color="#454c59" roughness={0.85} metalness={0.3} />
        </mesh>
      ))}
      <mesh position={[0, GANTRY_HEIGHT, 0]} castShadow>
        <boxGeometry args={[25, 0.6, 0.6]} />
        <meshStandardMaterial color="#454c59" roughness={0.85} metalness={0.3} />
      </mesh>
      <mesh position={[0, GANTRY_HEIGHT - SIGN_HEIGHT / 2 - 0.6, 0]}>
        <planeGeometry args={[SIGN_WIDTH, SIGN_HEIGHT]} />
        <meshStandardMaterial
          map={texture}
          roughness={0.6}
          emissive="#ffffff"
          emissiveMap={texture}
          emissiveIntensity={0.6}
        />
      </mesh>
    </group>
    </group>
  );
}
