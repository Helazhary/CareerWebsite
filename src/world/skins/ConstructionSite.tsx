'use client';

import type { Footprint } from '../layout';

/**
 * What an `in-progress` entry looks like: a part-built shell inside
 * scaffolding, with a crane over it (DESIGN.md §2.5).
 *
 * The point is that a project can go on the map before it is finished, and
 * flipping one schema field completes it. Nothing here knows which project it
 * is standing in for.
 */

const SCAFFOLD = '#c8a24a';
const SHELL = '#4b525f';
const STEEL = '#8b93a4';

function ScaffoldCage({ footprint }: { footprint: Footprint }): React.JSX.Element {
  const w = footprint.width * 0.56;
  const d = footprint.depth * 0.56;
  const h = footprint.height * 0.92;
  const lifts = Math.max(2, Math.round(h / 4.5));
  const corners: [number, number][] = [
    [-w, -d],
    [w, -d],
    [-w, d],
    [w, d],
  ];

  return (
    <group>
      {corners.map(([x, z]) => (
        <mesh key={`${x}:${z}`} position={[x, h / 2, z]} castShadow>
          <cylinderGeometry args={[0.16, 0.16, h, 6]} />
          <meshStandardMaterial color={SCAFFOLD} roughness={0.75} metalness={0.3} />
        </mesh>
      ))}

      {/* Lift boards, one deck per storey. */}
      {Array.from({ length: lifts }, (_, i) => {
        const y = ((i + 1) * h) / (lifts + 1);
        return (
          <group key={i}>
            <mesh position={[0, y, d]}>
              <boxGeometry args={[w * 2, 0.12, 0.5]} />
              <meshStandardMaterial color={SCAFFOLD} roughness={0.8} />
            </mesh>
            <mesh position={[0, y, -d]}>
              <boxGeometry args={[w * 2, 0.12, 0.5]} />
              <meshStandardMaterial color={SCAFFOLD} roughness={0.8} />
            </mesh>
            <mesh position={[w, y, 0]}>
              <boxGeometry args={[0.5, 0.12, d * 2]} />
              <meshStandardMaterial color={SCAFFOLD} roughness={0.8} />
            </mesh>
            <mesh position={[-w, y, 0]}>
              <boxGeometry args={[0.5, 0.12, d * 2]} />
              <meshStandardMaterial color={SCAFFOLD} roughness={0.8} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

function Crane({ footprint }: { footprint: Footprint }): React.JSX.Element {
  const mastHeight = footprint.height * 1.5;
  const jib = footprint.width * 1.1;
  const x = -footprint.width * 0.42;
  const z = -footprint.depth * 0.42;

  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, mastHeight / 2, 0]} castShadow>
        <boxGeometry args={[0.7, mastHeight, 0.7]} />
        <meshStandardMaterial color={STEEL} roughness={0.6} metalness={0.45} />
      </mesh>
      <mesh position={[jib * 0.3, mastHeight, 0]} castShadow>
        <boxGeometry args={[jib, 0.45, 0.45]} />
        <meshStandardMaterial color={STEEL} roughness={0.6} metalness={0.45} />
      </mesh>
      {/* Hoist cable and block. */}
      <mesh position={[jib * 0.62, mastHeight - footprint.height * 0.42, 0]}>
        <boxGeometry args={[0.07, footprint.height * 0.84, 0.07]} />
        <meshStandardMaterial color="#20242e" />
      </mesh>
      <mesh position={[jib * 0.62, mastHeight - footprint.height * 0.86, 0]} castShadow>
        <boxGeometry args={[0.9, 0.6, 0.9]} />
        <meshStandardMaterial color={SCAFFOLD} roughness={0.7} metalness={0.3} />
      </mesh>
    </group>
  );
}

export function ConstructionSite({ footprint }: { footprint: Footprint }): React.JSX.Element {
  // Part-built: a couple of finished floors, then open frame above.
  const builtHeight = footprint.height * 0.42;

  return (
    <group>
      <mesh position={[0, builtHeight / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[footprint.width * 0.9, builtHeight, footprint.depth * 0.9]} />
        <meshStandardMaterial color={SHELL} roughness={0.95} />
      </mesh>

      {/* Bare floor slabs above the finished part. */}
      {[0.62, 0.8].map((fraction) => (
        <mesh key={fraction} position={[0, footprint.height * fraction, 0]} castShadow>
          <boxGeometry args={[footprint.width * 0.86, 0.3, footprint.depth * 0.86]} />
          <meshStandardMaterial color={SHELL} roughness={0.95} />
        </mesh>
      ))}

      <ScaffoldCage footprint={footprint} />
      <Crane footprint={footprint} />
    </group>
  );
}
