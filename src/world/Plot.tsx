'use client';

import type { PlotTransform } from './layout';
import { DISTRICT_TINT } from './palette';

/**
 * One building. The same primitive for every entry — a job, a degree and a
 * side project differ only by schema fields (DESIGN.md §2.5).
 *
 * Nothing here may branch on an entry's identity. Behaviour varies by
 * `district`, `size` and `status`, and by nothing else.
 */
export function Plot({ transform }: { transform: PlotTransform }): React.JSX.Element {
  const { position, rotationY, footprint, district, status } = transform;
  const underConstruction = status === 'in-progress';

  return (
    <group position={[position.x, 0, position.z]} rotation={[0, rotationY, 0]}>
      <mesh position={[0, footprint.height / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[footprint.width, footprint.height, footprint.depth]} />
        <meshStandardMaterial
          color={DISTRICT_TINT[district]}
          roughness={0.9}
          metalness={0}
          // M2 replaces this with real scaffolding. For now an unfinished
          // building reads as an unfinished building.
          wireframe={underConstruction}
        />
      </mesh>
    </group>
  );
}
