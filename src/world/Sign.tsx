'use client';

import { useEffect, useMemo } from 'react';
import type { Footprint } from './layout';
import { createSignTexture } from './signTexture';

/**
 * A building's sign, rendered to a canvas texture at runtime from the entry
 * title (DESIGN.md §2.5).
 *
 * This is the single mechanism that makes the site modular: a new entry in
 * `content/` produces a correctly-signed building with no art work and no
 * change to the renderer.
 */

const CANVAS_WIDTH = 1024;
const CANVAS_HEIGHT = 256;

export type SignMount = 'facade' | 'hoarding';

export function Sign({
  text,
  footprint,
  mount = 'facade',
  panel = '#11151d',
  ink = '#e7eaf0',
}: {
  text: string;
  footprint: Footprint;
  mount?: SignMount;
  panel?: string;
  ink?: string;
}): React.JSX.Element | null {
  const texture = useMemo(
    () =>
      createSignTexture(text, {
        width: CANVAS_WIDTH,
        height: CANVAS_HEIGHT,
        panel,
        ink,
      }),
    [text, panel, ink],
  );

  // Canvas textures hold a bitmap on the GPU. Without this, driving past a few
  // hundred buildings would leak every one of them.
  useEffect(() => () => texture?.dispose(), [texture]);

  if (texture === null) return null;

  const width = footprint.width * (mount === 'hoarding' ? 0.62 : 0.78);
  const height = width * (CANVAS_HEIGHT / CANVAS_WIDTH);

  // A facade sign hangs just under the roofline, clear of doors and window
  // bands. A hoarding stands at the kerb, well in front of the scaffolding.
  const y = mount === 'hoarding'
    ? height / 2 + 1.6
    : Math.max(footprint.height - height * 0.85, footprint.height * 0.55);
  const z = footprint.depth / 2 + (mount === 'hoarding' ? 3.2 : 0.12);

  const face = (
    <mesh>
      <planeGeometry args={[width, height]} />
      <meshStandardMaterial
        map={texture}
        transparent={false}
        roughness={0.6}
        emissive="#ffffff"
        emissiveMap={texture}
        emissiveIntensity={0.55}
      />
    </mesh>
  );

  if (mount === 'facade') return <group position={[0, y, z]}>{face}</group>;

  return (
    <group position={[0, 0, z]}>
      <group position={[0, y, 0]}>{face}</group>
      {[-width * 0.36, width * 0.36].map((x) => (
        <mesh key={x} position={[x, (y - height / 2) / 2, -0.12]} castShadow>
          <boxGeometry args={[0.28, y - height / 2, 0.28]} />
          <meshStandardMaterial color="#5c6473" roughness={0.85} />
        </mesh>
      ))}
    </group>
  );
}
