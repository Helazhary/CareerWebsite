'use client';

import { useFrame, useThree } from '@react-three/fiber';
import { useRef } from 'react';
import * as THREE from 'three';
import type { RoadGraph } from './graph';
import { MAX_FRAME_SECONDS, type DriveState, positionOf, visualHeadingOf } from './drive';
import type { LookOffset } from './useLookAround';

/**
 * Elevated three-quarter chase camera. Damped follow, and a bounded orbit the
 * viewer can nudge (DESIGN.md §2.2).
 *
 * Giving the viewer *free* camera control is the fastest way to let them frame
 * a scene badly. What is on offer here is narrower: swing round the car, tilt a
 * little, and let go — the framing comes back on its own, so every building is
 * still seen the way it was laid out and "I got stuck looking at the sky"
 * remains impossible.
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

/**
 * How fast the camera swings round to the heading behind the car.
 *
 * Damping the *angle* rather than lerping the position is what makes a U-turn
 * an arc. Lerp two points 88 units apart and the camera takes the chord: it
 * flies straight through the car and out the other side, which is a worse
 * artefact than the cut this replaced.
 */
const AZIMUTH_DAMPING = 3.4;

/**
 * How tightly the orbit follows the pointer while a drag is in progress.
 *
 * Fast enough to feel like the camera is attached to the finger, not so fast
 * that it loses the smoothing entirely on a slow frame.
 */
const DRAG_TRACKING = 16;

/**
 * How close the orbit comes in at the car's nose, as a fraction of the chase
 * radius. Behind the car it is always 1; this is the other end of the ramp.
 */
const ORBIT_REACH_MIN = 0.42;

/** Elevation bounds, absolute. Below the lower one you are under the road. */
const MIN_ELEVATION = 0.14;
const MAX_ELEVATION = 1.15;

/**
 * How long a look is held before it drifts back.
 *
 * The old spring started the instant the pointer came up and was most of the
 * way home in a third of a second, so looking at a building meant holding the
 * mouse button down the entire time. Long enough here to actually look at
 * something, short enough that a stray drag does not strand the framing.
 */
const HOLD_SECONDS = 1.6;
/**
 * Gentle. This is a drift back, not a snap.
 *
 * Slower than it was, because the orbit now goes all the way round: coming home
 * from 170° at the old rate was a lurch, and the point of letting the viewer
 * spin the camera is spoiled if the way back is abrupt.
 */
const SPRING = 0.85;
/** How quickly a flick runs out of momentum. */
const INERTIA_DECAY = 4.5;
/** Below this the spring has arrived; snap and stop paying for it. */
const LOOK_SETTLED = 0.002;

/**
 * Where the camera aims, as a fraction of the way from the car up to the
 * camera's own height.
 *
 * Aiming straight at the car would pitch the camera 20° down and turn the shot
 * into a top-down of a roof. Biasing the focus most of the way back up to the
 * camera's height keeps the near-horizontal framing the world was laid out for,
 * and — because it is expressed against the camera height rather than as a
 * constant — it keeps it when the viewer tilts.
 *
 * Both this and the look-ahead are scaled by how far round the orbit has been
 * dragged, and that is not a refinement — it is the difference between the
 * promise this camera makes and a bug. Held at full strength while orbited, the
 * camera aims thirty units past the car and eighteen units above it, and the
 * car slides off the bottom of the frame: exactly the complaint the orbit was
 * built to fix, arrived at from the other direction. Behind the car they are
 * the framing the world was laid out for; side-on they fall to zero and the
 * camera simply looks at the car.
 */
const CAR_EYE = 3;
const FRAME_BIAS = 0.72;

/** Shortest signed angle from `from` to `to`, in radians. */
function angleDelta(from: number, to: number): number {
  return Math.atan2(Math.sin(to - from), Math.cos(to - from));
}

function clamp(value: number, low: number, high: number): number {
  return Math.min(Math.max(value, low), high);
}

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
  /** Drag-to-look offset, drifting back to the designed framing on release. */
  lookRef: React.RefObject<LookOffset>;
}): null {
  const { camera } = useThree();
  const desired = useRef(new THREE.Vector3());
  const focus = useRef(new THREE.Vector3());
  const settled = useRef(false);
  const azimuth = useRef<number | null>(null);

  useFrame((_, raw) => {
    // Two clocks, deliberately.
    //
    // `delta` is simulated time, clamped exactly as the car's own step is:
    // anything that has to stay in step with the drive model — the azimuth
    // swinging round behind the car, the follow lerp — runs on this, or on a
    // slow machine the camera finishes a U-turn before the U-turn does.
    //
    // `raw` is wall-clock, and the look offset runs on it. How long the viewer
    // gets to hold a look before it drifts back is a promise made to a person,
    // not to the simulation; clamping it made a 1.6 second hold last six
    // seconds at ten frames a second, and the spring never started at all.
    const delta = Math.min(raw, MAX_FRAME_SECONDS);
    const state = stateRef.current;
    const position = positionOf(graph, state);
    // The presentation heading, so a U-turn sweeps the camera round with the
    // car instead of cutting to the far side of it on the next frame.
    const heading = visualHeadingOf(graph, state);

    const look = lookRef.current;
    if (look.held) {
      look.idle = 0;
    } else {
      look.idle += raw;

      // Carry the flick on for a moment, then let it die.
      const momentum = Math.exp(-INERTIA_DECAY * raw);
      // Wrapped, so a flick that carries past the back of the car keeps going
      // round instead of running up against ±180°.
      look.yaw = angleDelta(0, look.yaw + look.velocityYaw * raw);
      look.pitch += look.velocityPitch * raw;
      look.velocityYaw *= momentum;
      look.velocityPitch *= momentum;

      // Let go and, after a pause long enough to look at something, the camera
      // returns to the framing the scene was laid out for.
      if (look.idle > HOLD_SECONDS) {
        const decay = Math.exp(-SPRING * raw);
        look.yaw *= decay;
        look.pitch *= decay;
        if (Math.abs(look.yaw) < LOOK_SETTLED) look.yaw = 0;
        if (Math.abs(look.pitch) < LOOK_SETTLED) look.pitch = 0;
      }
    }

    const interior = interiorRef.current;
    const distance = interior ? INTERIOR_DISTANCE : DISTANCE;
    const height = interior ? INTERIOR_HEIGHT : HEIGHT;
    const lookAhead = interior ? INTERIOR_LOOK_AHEAD : LOOK_AHEAD;

    if (interior) {
      // Indoors the camera keeps its place and turns its head. Orbiting it
      // around the car instead swings it straight through the garage walls,
      // and in any enclosed space it always will — a room is smaller than the
      // chase radius.
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
        height - 3.6 + look.pitch * (distance + lookAhead),
        desired.current.z + forwardZ * (distance + lookAhead),
      );
      // Coming back out of the garage, the orbit picks up from wherever the
      // interior camera left off rather than whipping round to meet it.
      azimuth.current = Math.atan2(
        desired.current.z - position.z,
        desired.current.x - position.x,
      );
    } else {
      // Outdoors the camera orbits the car on a fixed radius, so the car stays
      // in the middle of the frame whichever way you drag.
      const behind = Math.atan2(-heading.z, -heading.x);
      const target = behind + look.yaw;

      if (azimuth.current === null) {
        azimuth.current = target;
      } else {
        // Tight while a finger is down, damped the rest of the time. Damping is
        // there to make a U-turn an arc; under a drag it is just lag, and a
        // camera that trails the pointer by a third of a second feels broken.
        const rate = look.held ? DRAG_TRACKING : AZIMUTH_DAMPING;
        azimuth.current += angleDelta(azimuth.current, target) * (1 - Math.exp(-rate * delta));
      }

      // How far round the orbit has actually come: 1 behind, 0.5 side-on, 0 at
      // the nose. Everything about the framing is a function of this.
      const swung = (1 + Math.cos(angleDelta(behind, azimuth.current))) / 2;

      // The orbit comes in as it comes round.
      //
      // Not a nicety: at the full chase distance a side-on view sweeps a circle
      // 88 units wide through whatever is standing beside the road, and next to
      // a building — which is most places worth stopping — the camera ends up
      // inside a wall with the screen filled by one grey polygon. Pulled in, it
      // stays within the road corridor the whole way round, and a close shot is
      // the right shot anyway once the subject is the car rather than the road.
      const reach = ORBIT_REACH_MIN + (1 - ORBIT_REACH_MIN) * swung;
      const radius = Math.hypot(distance, height) * reach;
      const elevation = clamp(
        Math.atan2(height, distance) + look.pitch,
        MIN_ELEVATION,
        MAX_ELEVATION,
      );
      const ground = radius * Math.cos(elevation);

      desired.current.set(
        position.x + Math.cos(azimuth.current) * ground,
        radius * Math.sin(elevation),
        position.z + Math.sin(azimuth.current) * ground,
      );

      // 1 directly behind the car, 0 side-on and beyond. Sharper than `swung`
      // because the look-ahead has to be gone by the time the camera is abeam,
      // not merely halved.
      //
      // Measured from where the camera *is*, not from where the drag has got
      // to. Those are the same thing at rest and a long way apart during a fast
      // spin, and using the drag meant the framing was set for an angle the
      // camera had not reached: swing the orbit hard and the car left the frame
      // entirely, which is the exact failure this scaling exists to prevent.
      const frontality = Math.max(swung * 2 - 1, 0);
      const ahead = lookAhead * frontality;

      const forwardX = -Math.cos(azimuth.current);
      const forwardZ = -Math.sin(azimuth.current);
      focus.current.set(
        position.x + forwardX * ahead,
        CAR_EYE + (desired.current.y - CAR_EYE) * FRAME_BIAS * frontality,
        position.z + forwardZ * ahead,
      );
    }

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
