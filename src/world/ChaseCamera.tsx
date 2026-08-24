'use client';

import { useFrame, useThree } from '@react-three/fiber';
import { useRef } from 'react';
import * as THREE from 'three';
import type { RoadGraph } from './graph';
import { type DriveState, headingOf, positionOf } from './drive';

/**
 * Elevated three-quarter chase camera. Fixed pitch, fixed distance, damped
 * follow, no user control (DESIGN.md §2.2).
 *
 * Giving the viewer camera control is the fastest way to let them frame a scene
 * badly. Taking it away guarantees every building is seen the way it was laid
 * out, and removes a whole class of "I got stuck looking at the sky".
 */
const DISTANCE = 44;
const HEIGHT = 25;
const LOOK_AHEAD = 30;
/** Higher is snappier. Low enough that junctions feel like a glide, not a cut. */
const FOLLOW_DAMPING = 3.2;

export function ChaseCamera({
  graph,
  stateRef,
}: {
  graph: RoadGraph;
  stateRef: React.RefObject<DriveState>;
}): null {
  const { camera } = useThree();
  const desired = useRef(new THREE.Vector3());
  const focus = useRef(new THREE.Vector3());
  const settled = useRef(false);

  useFrame((_, delta) => {
    const state = stateRef.current;
    const position = positionOf(graph, state);
    const heading = headingOf(graph, state);

    desired.current.set(
      position.x - heading.x * DISTANCE,
      HEIGHT,
      position.z - heading.z * DISTANCE,
    );
    focus.current.set(
      position.x + heading.x * LOOK_AHEAD,
      3.5,
      position.z + heading.z * LOOK_AHEAD,
    );

    // Snap on the first frame so the opening shot is framed, not swooping in
    // from wherever the camera was initialised.
    if (!settled.current) {
      camera.position.copy(desired.current);
      settled.current = true;
    } else {
      camera.position.lerp(desired.current, 1 - Math.exp(-FOLLOW_DAMPING * delta));
    }

    camera.lookAt(focus.current);
  });

  return null;
}
