'use client';

import { entries } from '@content/registry';
import type { PlotTransform } from './layout';
import { DISTRICT_TINT } from './palette';
import { Sign } from './Sign';
import { renderSkin } from './skins/registry';

/** Titles by id. Built once — the renderer reads content, it does not embed it. */
const TITLES = new Map(entries.map((entry) => [entry.id, entry.title]));

/**
 * One building. The same primitive for every entry — a job, a degree and a side
 * project differ only by schema fields (DESIGN.md §2.5).
 *
 * Nothing here may branch on an entry's identity. Behaviour varies by `skin`,
 * `district`, `size` and `status`, and by nothing else.
 */
export function Plot({ transform }: { transform: PlotTransform }): React.JSX.Element {
  const { entryId, position, rotationY, footprint, district, skin, status } = transform;
  const title = TITLES.get(entryId) ?? entryId;

  return (
    <group position={[position.x, 0, position.z]} rotation={[0, rotationY, 0]}>
      {status === 'in-progress' ? (
        // M2 task: real scaffolding. Until then an unfinished building still
        // has to read as unfinished.
        <mesh position={[0, footprint.height / 2, 0]}>
          <boxGeometry args={[footprint.width, footprint.height, footprint.depth]} />
          <meshStandardMaterial color={DISTRICT_TINT[district]} wireframe />
        </mesh>
      ) : (
        renderSkin(skin, { footprint, tint: DISTRICT_TINT[district] })
      )}
      <Sign text={title} footprint={footprint} />
    </group>
  );
}
