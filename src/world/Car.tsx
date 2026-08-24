'use client';

import { useFrame } from '@react-three/fiber';
import { forwardRef, useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
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
const NOSE_Z = 2.2;

/** Full colour sweep, in seconds. Slow enough to notice, not to nag. */
const RGB_CYCLE_SECONDS = 70;

function Wheel({ position }: { position: [number, number, number] }): React.JSX.Element {
  return (
    <mesh position={position} rotation={[0, 0, Math.PI / 2]} castShadow>
      <cylinderGeometry args={[WHEEL_RADIUS, WHEEL_RADIUS, 0.22, 14]} />
      <meshStandardMaterial color={WORLD_COLORS.tyre} roughness={1} />
    </mesh>
  );
}

/**
 * The angel eyes: four halo rings, two per headlight, as fitted to the real car.
 *
 * They face away from a chase camera, so the rings alone would never be seen.
 * The light they throw is the point — a tinted pool on the road ahead that
 * carries the colour back to the viewer. One unshadowed spot light is the whole
 * cost.
 */
function AngelEyes(): React.JSX.Element {
  const rings = useRef<THREE.MeshStandardMaterial>(null);
  const beam = useRef<THREE.SpotLight>(null);
  const target = useRef<Group>(null);
  const colour = useMemo(() => new THREE.Color(), []);

  const geometry = useMemo(() => new THREE.TorusGeometry(0.17, 0.028, 8, 24), []);
  useEffect(() => () => geometry.dispose(), [geometry]);

  useFrame((state) => {
    const hue = (state.clock.elapsedTime / RGB_CYCLE_SECONDS) % 1;
    colour.setHSL(hue, 1, 0.52);
    rings.current?.color.copy(colour);
    rings.current?.emissive.copy(colour);
    beam.current?.color.copy(colour);
    if (beam.current !== null && target.current !== null) beam.current.target = target.current;
  });

  return (
    <group>
      {[-0.72, -0.4, 0.4, 0.72].map((x) => (
        <mesh key={x} geometry={geometry} position={[x, 0.72, NOSE_Z]}>
          <meshStandardMaterial
            ref={x === -0.72 ? rings : undefined}
            emissiveIntensity={2.6}
            toneMapped={false}
          />
        </mesh>
      ))}

      <spotLight
        ref={beam}
        position={[0, 0.8, NOSE_Z]}
        angle={0.5}
        penumbra={0.85}
        intensity={260}
        distance={70}
        decay={1.6}
        castShadow={false}
      />
      <group ref={target} position={[0, -0.4, NOSE_Z + 14]} />
    </group>
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
          <meshStandardMaterial
            color={WORLD_COLORS.car}
            roughness={0.32}
            metalness={0.55}
          />
        </mesh>

        <mesh position={[0, 1.12, -0.15]} castShadow>
          <boxGeometry args={[1.5, 0.52, 2.1]} />
          <meshStandardMaterial color={WORLD_COLORS.carGlass} roughness={0.15} metalness={0.3} />
        </mesh>

        {/* Kidney grilles. The whole silhouette rests on these. */}
        <mesh position={[-0.28, 0.66, NOSE_Z + 0.02]}>
          <boxGeometry args={[0.42, 0.24, 0.08]} />
          <meshStandardMaterial color={WORLD_COLORS.tyre} />
        </mesh>
        <mesh position={[0.28, 0.66, NOSE_Z + 0.02]}>
          <boxGeometry args={[0.42, 0.24, 0.08]} />
          <meshStandardMaterial color={WORLD_COLORS.tyre} />
        </mesh>

        {/* Front splitter, as fitted. */}
        <mesh position={[0, 0.24, NOSE_Z + 0.1]} castShadow>
          <boxGeometry args={[1.78, 0.07, 0.55]} />
          <meshStandardMaterial color="#0f1218" roughness={0.8} />
        </mesh>

        <AngelEyes />

        {/* Gold split-spokes on the real car; the rims read even at this size. */}
        <Wheel position={[-TRACK / 2, WHEEL_RADIUS, WHEELBASE / 2]} />
        <Wheel position={[TRACK / 2, WHEEL_RADIUS, WHEELBASE / 2]} />
        <Wheel position={[-TRACK / 2, WHEEL_RADIUS, -WHEELBASE / 2]} />
        <Wheel position={[TRACK / 2, WHEEL_RADIUS, -WHEELBASE / 2]} />
      </group>
    </group>
  );
});
