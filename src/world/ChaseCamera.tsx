'use client';

import { useFrame, useThree } from '@react-three/fiber';
import { useRef } from 'react';
import * as THREE from 'three';
import type { RoadGraph } from './graph';
import { type DriveState, headingOf, positionOf } from './drive';
import type { LookOffset } from './useLookAround';

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

/**
 * Framing inside the garage.
 *
 * The touring camera sits 44 units back and 25 up, which is above the roof and
 * behind the back wall — from in the garage it frames nothing at all. Indoors
 * it pulls in close and drops to eye level, then the existing damping carries
 * it back out to the touring shot as the car leaves.
 */
const INTERIOR_DISTANCE = 20;
const INTERIOR_HEIGHT = 7.5;
const INTERIOR_LOOK_AHEAD = 16;
/** Higher is snappier. Low enough that junctions feel like a glide, not a cut. */
const FOLLOW_DAMPING = 3.2;

export function ChaseCamera({
  graph,
  stateRef,
  interiorRef,
  lookRef,
}: {
  graph: RoadGraph;
  stateRef: React.RefObject<DriveState>;
  /** Frame for an enclosed space rather than open road. Read every frame. */
  interiorRef: React.RefObject<boolean>;
  /** Drag-to-look offset, springing back to the designed framing on release. */
  lookRef: React.RefObject<LookOffset>;
}): null {
  const { camera } = useThree();
  const desired = useRef(new THREE.Vector3());
  const focus = useRef(new THREE.Vector3());
  const settled = useRef(false);

  useFrame((_, delta) => {
    const state = stateRef.current;
    const position = positionOf(graph, state);
    const heading = headingOf(graph, state);

    const look = lookRef.current;
    // Let go and the camera returns to the framing the scene was laid out for.
    if (!look.held) {
      const decay = Math.exp(-2.6 * delta);
      look.yaw *= decay;
      look.pitch *= decay;
    }

    const interior = interiorRef.current;
    const distance = interior ? INTERIOR_DISTANCE : DISTANCE;
    const height = interior ? INTERIOR_HEIGHT : HEIGHT;
    const lookAhead = interior ? INTERIOR_LOOK_AHEAD : LOOK_AHEAD;

    // The camera keeps its place and turns its head. Orbiting it around the
    // car instead swings it straight through the garage walls, and in any
    // enclosed space it always will — a room is smaller than the chase radius.
    desired.current.set(
      position.x - heading.x * distance,
      height,
      position.z - heading.z * distance,
    );

    const cos = Math.cos(look.yaw);
    const sin = Math.sin(look.yaw);
    const forwardX = heading.x * cos - heading.z * sin;
    const forwardZ = heading.x * sin + heading.z * cos;

    focus.current.set(
      desired.current.x + forwardX * (distance + lookAhead),
      height - (interior ? 3.6 : 6) + look.pitch * (distance + lookAhead),
      desired.current.z + forwardZ * (distance + lookAhead),
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
