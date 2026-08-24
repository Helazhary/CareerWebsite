'use client';

import { forwardRef } from 'react';
import type { Group } from 'three';
import { WORLD_COLORS } from './palette';

/**
 * A blocky E36 assembled from primitives — stage one of the two-stage plan in
 * DESIGN.md §2.6. Correct proportions and a kidney-grille silhouette, no art.
 * M4 drops a `.glb` in behind this same component.
 */
const WHEEL_RADIUS = 0.33;
const WHEELBASE = 2.7;
const TRACK = 1.65;

function Wheel({ position }: { position: [number, number, number] }): React.JSX.Element {
  return (
    <mesh position={position} rotation={[0, 0, Math.PI / 2]} castShadow>
      <cylinderGeometry args={[WHEEL_RADIUS, WHEEL_RADIUS, 0.22, 14]} />
      <meshStandardMaterial color={WORLD_COLORS.tyre} roughness={1} />
    </mesh>
  );
}

export const Car = forwardRef<Group>(function Car(_props, ref): React.JSX.Element {
  return (
    <group ref={ref}>
      {/* Scaled up from real E36 dimensions: the world is measured in metres,
          but a 4.4 m car is a speck beside a 24 m building. */}
      <group scale={2.2}>
        <mesh position={[0, 0.62, 0]} castShadow>
          <boxGeometry args={[1.71, 0.62, 4.43]} />
          <meshStandardMaterial color={WORLD_COLORS.car} roughness={0.45} metalness={0.1} />
        </mesh>

        <mesh position={[0, 1.12, -0.15]} castShadow>
          <boxGeometry args={[1.5, 0.52, 2.1]} />
          <meshStandardMaterial color={WORLD_COLORS.carGlass} roughness={0.25} metalness={0.2} />
        </mesh>

        {/* Kidney grilles. The whole silhouette rests on these. */}
        <mesh position={[-0.28, 0.66, 2.22]}>
          <boxGeometry args={[0.42, 0.24, 0.08]} />
          <meshStandardMaterial color={WORLD_COLORS.tyre} />
        </mesh>
        <mesh position={[0.28, 0.66, 2.22]}>
          <boxGeometry args={[0.42, 0.24, 0.08]} />
          <meshStandardMaterial color={WORLD_COLORS.tyre} />
        </mesh>

        <Wheel position={[-TRACK / 2, WHEEL_RADIUS, WHEELBASE / 2]} />
        <Wheel position={[TRACK / 2, WHEEL_RADIUS, WHEELBASE / 2]} />
        <Wheel position={[-TRACK / 2, WHEEL_RADIUS, -WHEELBASE / 2]} />
        <Wheel position={[TRACK / 2, WHEEL_RADIUS, -WHEELBASE / 2]} />
      </group>
    </group>
  );
});
