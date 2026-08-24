'use client';

import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { InstancedMesh } from 'three';
import type { LampItem, PropKind, ScatterItem } from './scatter';

/**
 * Planting, rocks and street lamps.
 *
 * Every kind is a single `InstancedMesh`, so several hundred props cost a
 * handful of draw calls rather than several hundred. Doing this later would
 * have meant rewriting it — scatter is where the draw-call budget in
 * DESIGN.md §8 is actually spent.
 */

const dummy = new THREE.Object3D();
const swatch = new THREE.Color();

/**
 * Tint each instance a little differently.
 *
 * Identical geometry is fine — a low-poly world is meant to repeat. Identical
 * *colour* across four hundred trees is what makes it look machine-made, and it
 * costs one extra attribute to fix.
 */
function tintInstances(
  mesh: InstancedMesh | null,
  items: readonly { shade: number }[],
  base: string,
  spread: number,
): void {
  if (mesh === null) return;
  const colour = new THREE.Color(base);
  const hsl = { h: 0, s: 0, l: 0 };
  colour.getHSL(hsl);
  items.forEach((item, index) => {
    swatch.setHSL(
      hsl.h + (item.shade - 0.5) * spread * 0.5,
      hsl.s * (0.75 + item.shade * 0.5),
      hsl.l * (0.85 + item.shade * 0.55),
    );
    mesh.setColorAt(index, swatch);
  });
  if (mesh.instanceColor !== null) mesh.instanceColor.needsUpdate = true;
}

function useInstances(
  items: readonly { position: { x: number; z: number }; rotationY: number; scale?: number }[],
  apply?: (object: THREE.Object3D, index: number) => void,
): React.RefObject<InstancedMesh | null> {
  const mesh = useRef<InstancedMesh>(null);

  useLayoutEffect(() => {
    const target = mesh.current;
    if (target === null) return;
    items.forEach((item, index) => {
      dummy.position.set(item.position.x, 0, item.position.z);
      dummy.rotation.set(0, item.rotationY, 0);
      const scale = item.scale ?? 1;
      dummy.scale.set(scale, scale, scale);
      apply?.(dummy, index);
      dummy.updateMatrix();
      target.setMatrixAt(index, dummy.matrix);
    });
    target.instanceMatrix.needsUpdate = true;
    target.computeBoundingSphere();
  }, [items, apply]);

  return mesh;
}

function Trees({ items }: { items: readonly ScatterItem[] }): React.JSX.Element | null {
  const trunks = useInstances(items, (object) => {
    object.position.y = 2.1 * (object.scale.x || 1);
  });
  const canopies = useInstances(items, (object, index) => {
    object.position.y = 6.4 * (object.scale.x || 1);
    // Squash and stretch per tree: a canopy is never a perfect ball, and a
    // field of perfect balls is unmistakably generated.
    const item = items[index];
    if (item !== undefined) {
      object.scale.y *= 0.82 + item.shade * 0.5;
      object.scale.x *= 0.9 + (1 - item.shade) * 0.28;
    }
  });

  useLayoutEffect(() => {
    tintInstances(canopies.current, items, '#436b4c', 0.16);
    tintInstances(trunks.current, items, '#54432f', 0.06);
  }, [items, canopies, trunks]);

  if (items.length === 0) return null;

  return (
    <group>
      <instancedMesh ref={trunks} args={[undefined, undefined, items.length]} castShadow>
        <cylinderGeometry args={[0.34, 0.46, 4.2, 6]} />
        <meshStandardMaterial color="#453728" roughness={1} />
      </instancedMesh>
      <instancedMesh ref={canopies} args={[undefined, undefined, items.length]} castShadow>
        {/* Faceted rather than smooth: the world is deliberately low-poly. */}
        <icosahedronGeometry args={[3.4, 0]} />
        <meshStandardMaterial color="#436b4c" roughness={0.95} flatShading />
      </instancedMesh>
    </group>
  );
}

function Shrubs({ items }: { items: readonly ScatterItem[] }): React.JSX.Element | null {
  const mesh = useInstances(items, (object) => {
    object.position.y = 0.9 * (object.scale.x || 1);
    object.scale.y *= 0.7;
  });
  useLayoutEffect(() => tintInstances(mesh.current, items, '#4a6d51', 0.2), [items, mesh]);
  if (items.length === 0) return null;
  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, items.length]} castShadow>
      <icosahedronGeometry args={[1.5, 0]} />
      <meshStandardMaterial color="#4a6d51" roughness={1} flatShading />
    </instancedMesh>
  );
}

function Rocks({ items }: { items: readonly ScatterItem[] }): React.JSX.Element | null {
  const mesh = useInstances(items, (object) => {
    object.position.y = 0.35 * (object.scale.x || 1);
    object.scale.y *= 0.55;
  });
  useLayoutEffect(() => tintInstances(mesh.current, items, '#4b4f58', 0.08), [items, mesh]);
  if (items.length === 0) return null;
  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, items.length]} castShadow>
      <dodecahedronGeometry args={[1.1, 0]} />
      <meshStandardMaterial color="#4b4f58" roughness={1} flatShading />
    </instancedMesh>
  );
}

/**
 * Street lamps. The heads are emissive rather than real lights — a few dozen
 * point lights would cost more than the entire rest of the scene, and at dusk
 * a glowing head plus the fog reads the same from a moving car.
 */
function Lamps({ items }: { items: readonly LampItem[] }): React.JSX.Element | null {
  const posts = useInstances(items, (object) => {
    object.position.y = 4.4;
  });
  const shades = useInstances(items, (object) => {
    object.position.y = 8.9;
  });
  const heads = useInstances(items, (object) => {
    object.position.y = 8.62;
  });

  if (items.length === 0) return null;

  return (
    <group>
      <instancedMesh ref={posts} args={[undefined, undefined, items.length]} castShadow>
        <cylinderGeometry args={[0.15, 0.22, 8.8, 6]} />
        <meshStandardMaterial color="#3b414d" roughness={0.8} metalness={0.3} />
      </instancedMesh>
      <instancedMesh ref={shades} args={[undefined, undefined, items.length]} castShadow>
        <boxGeometry args={[1.05, 0.3, 0.6]} />
        <meshStandardMaterial color="#343a45" roughness={0.8} metalness={0.3} />
      </instancedMesh>
      {/* The lit element sits under the shade, so it glows downward at the road
          instead of reading as a slab hanging in the dark. */}
      <instancedMesh ref={heads} args={[undefined, undefined, items.length]}>
        <boxGeometry args={[0.86, 0.16, 0.44]} />
        <meshStandardMaterial
          color="#ffe6b8"
          emissive="#ffd9a0"
          emissiveIntensity={2.1}
          toneMapped={false}
        />
      </instancedMesh>
    </group>
  );
}

export function Scenery({
  items,
  lamps,
}: {
  items: readonly ScatterItem[];
  lamps: readonly LampItem[];
}): React.JSX.Element {
  const byKind = useMemo(() => {
    const groups: Record<PropKind, ScatterItem[]> = { tree: [], shrub: [], rock: [] };
    for (const item of items) groups[item.kind].push(item);
    return groups;
  }, [items]);

  return (
    <group>
      <Trees items={byKind.tree} />
      <Shrubs items={byKind.shrub} />
      <Rocks items={byKind.rock} />
      <Lamps items={lamps} />
    </group>
  );
}
