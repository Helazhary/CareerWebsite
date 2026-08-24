'use client';

import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import type { DirectionalLight, Group } from 'three';

/**
 * The key light, riding along with the car.
 *
 * A single static directional light cannot shadow a world a kilometre long: the
 * shadow camera would have to cover the whole map, and at any usable texture
 * size the shadows turn to mush. Moving the light with the car keeps the shadow
 * volume small and tight, so shadows stay sharp wherever the viewer happens to
 * be, and the rest of the map costs nothing to light.
 */

/** Low and to one side: a dusk sun, long shadows across the road. */
const OFFSET: readonly [number, number, number] = [-120, 105, 70];
const SHADOW_EXTENT = 150;

export function Sun({ follow }: { follow: React.RefObject<Group | null> }): React.JSX.Element {
  const light = useRef<DirectionalLight>(null);
  const target = useRef<Group>(null);

  useFrame(() => {
    const car = follow.current;
    const lamp = light.current;
    if (car === null || lamp === null) return;

    lamp.position.set(
      car.position.x + OFFSET[0],
      OFFSET[1],
      car.position.z + OFFSET[2],
    );
    if (target.current !== null) {
      target.current.position.set(car.position.x, 0, car.position.z);
      target.current.updateMatrixWorld();
      lamp.target = target.current;
    }
  });

  return (
    <group>
      <directionalLight
        ref={light}
        color="#ffd9a8"
        intensity={2.4}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-bias={-0.0008}
        shadow-normalBias={0.6}
        shadow-camera-near={20}
        shadow-camera-far={420}
        shadow-camera-left={-SHADOW_EXTENT}
        shadow-camera-right={SHADOW_EXTENT}
        shadow-camera-top={SHADOW_EXTENT}
        shadow-camera-bottom={-SHADOW_EXTENT}
      />
      <group ref={target} />
    </group>
  );
}
