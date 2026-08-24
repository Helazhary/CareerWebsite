'use client';

import { useFrame } from '@react-three/fiber';
import { useCallback, useRef } from 'react';
import type { Group } from 'three';
import { DEFAULT_LAYOUT_OPTIONS } from './layout';
import { DEFAULT_DRIVE_OPTIONS, type DriveState, branchOptions, headingOf, positionOf, step } from './drive';
import { type InputBuffer, consumeFlip, consumeSteer } from './useDriveInput';
import { worldGraph, worldLamps, worldPlots, worldScenery } from './world';
import { WORLD_COLORS } from './palette';
import { Billboards } from './Billboards';
import { Environment } from './Environment';
import { GARAGE_DOOR_OFFSET, Garage } from './Garage';
import { RoadEnd } from './RoadEnd';
import { Roads } from './Roads';
import { Scenery } from './Scenery';
import { Plot } from './Plot';
import { Car } from './Car';
import { ChaseCamera } from './ChaseCamera';
import { Sun } from './Sun';
import { nearestPlot } from './proximity';
import { useLookAround } from './useLookAround';

/** What the DOM overlay needs. Updated on change, never per frame. */
export interface HudState {
  readonly nodeId: string;
  readonly choice: number;
  readonly branches: readonly { readonly edgeId: string; readonly district: string }[];
  readonly speed: number;
  /** World units still to run before the junction. Gates the prompt. */
  readonly distanceToJunction: number;
  /** The building the car is at, if any. */
  readonly nearbyEntryId: string | null;
}

/**
 * How far ahead a junction announces itself.
 *
 * The car is always heading toward *some* node, so an ungated prompt sits on
 * screen permanently and stops meaning anything. Roughly two seconds at full
 * speed: long enough to read and decide, short enough to be about this junction.
 */
const PROMPT_DISTANCE = 170;

/** A frame longer than this is a tab that was backgrounded, not a slow frame. */
const MAX_FRAME_SECONDS = 0.05;

/**
 * How fast the car's body catches up to the direction it is travelling.
 *
 * The drive model changes direction instantly, which is right — the car is on a
 * spline and its position must stay exact. But snapping the body 180° in one
 * frame is what made turning around feel like a glitch rather than a
 * manoeuvre. The body now swings round over about half a second while the
 * position stays wherever the model says it is.
 */
/**
 * The garage.
 *
 * There is no drive-out sequence: you are simply in the room, in control, and
 * you leave when you drive through the door. An automatic exit meant watching
 * a cutscene you could not look around during, and it dumped the car onto the
 * highway at full speed halfway across the map.
 */
// Must be shorter than the car's standing distance from the door, or the
// shutter is already up before anyone has touched a key.
const DOOR_OPENS_WITHIN = 9;
/** Crossing this clears the room for good; the shutter stays up behind you. */
const DOOR_CLEARED_BY = 6;
/** A garage is not somewhere you accelerate. */
const GARAGE_SPEED = 22;

const YAW_DAMPING = 7.5;
/** Below this the swing is over; snap and stop paying for the interpolation. */
const YAW_SETTLED = 0.004;

/** Shortest signed angle from `from` to `to`, in radians. */
function angleDelta(from: number, to: number): number {
  return Math.atan2(Math.sin(to - from), Math.cos(to - from));
}

export function Scene({
  input,
  onHud,
  stateRef,
  paused,
}: {
  input: React.RefObject<InputBuffer>;
  onHud: (hud: HudState) => void;
  stateRef: React.RefObject<DriveState>;
  /** True while a panel or the map is open. The car coasts to a stop. */
  paused: boolean;
}): React.JSX.Element {
  const carRef = useRef<Group>(null);
  const lastHud = useRef<string>('');
  const bodyYaw = useRef<number | null>(null);
  const lookRef = useLookAround();

  const spawnX = worldGraph.nodeById.get(worldGraph.spawnNodeId)?.position.x ?? 0;
  const doorX = spawnX + GARAGE_DOOR_OFFSET;

  // Latched: once out, the room never reclaims the camera, even if the viewer
  // turns around and drives back in through the open door.
  //
  // Assumed indoors and corrected on the first frame rather than read from the
  // drive state here — a ref must not be read during render. Scene's frame
  // callback registers before the camera's, so the camera never sees the wrong
  // framing, even when a deep link starts the car on the far side of the map.
  const leftGarage = useRef(false);
  const insideRef = useRef(true);
  const doorOpenRef = useRef(false);

  const publish = useCallback(
    (state: DriveState): void => {
      const edge = worldGraph.edgeById.get(state.edgeId);
      const remaining =
        edge === undefined
          ? Number.POSITIVE_INFINITY
          : (state.direction > 0 ? 1 - state.u : state.u) * edge.length;

      const branches = branchOptions(worldGraph, state).map((option) => ({
        edgeId: option.edgeId,
        district: option.district,
      }));

      const nearby = nearestPlot(
        positionOf(worldGraph, state),
        headingOf(worldGraph, state),
        worldPlots,
      );

      // Bucketed so the overlay re-renders on meaningful change, not at 60 Hz.
      const approaching = remaining < PROMPT_DISTANCE;
      const signature = `${state.targetNodeId}|${state.choice}|${branches
        .map((b) => b.edgeId)
        .join(',')}|${approaching}|${nearby?.entryId ?? ''}|${Math.round(state.speed / 10)}`;
      if (signature === lastHud.current) return;
      lastHud.current = signature;

      onHud({
        nodeId: state.targetNodeId,
        choice: state.choice,
        branches,
        speed: state.speed,
        distanceToJunction: approaching ? remaining : Number.POSITIVE_INFINITY,
        nearbyEntryId: nearby?.entryId ?? null,
      });
    },
    [onHud],
  );

  useFrame((_, delta) => {
    const inside = insideRef.current;
    const next = step(
      worldGraph,
      stateRef.current,
      {
        // A panel is a stop, not a pause: the car coasts down rather than
        // freezing mid-frame, and picks up again when the panel closes.
        throttle: paused ? false : input.current.throttle,
        steer: paused ? 0 : consumeSteer(input.current),
        flip: paused ? false : consumeFlip(input.current),
      },
      Math.min(delta, MAX_FRAME_SECONDS),
      // Held to a crawl indoors, so leaving is a manoeuvre rather than a
      // launch. Without this you arrive on the highway at full speed.
      inside ? { ...DEFAULT_DRIVE_OPTIONS, maxSpeed: GARAGE_SPEED } : DEFAULT_DRIVE_OPTIONS,
    );
    stateRef.current = next;

    const carX = positionOf(worldGraph, next).x;
    if (!leftGarage.current && carX > doorX + DOOR_CLEARED_BY) leftGarage.current = true;
    insideRef.current = !leftGarage.current;
    doorOpenRef.current = leftGarage.current || carX > doorX - DOOR_OPENS_WITHIN;

    const car = carRef.current;
    if (car !== null) {
      const position = positionOf(worldGraph, next);
      const heading = headingOf(worldGraph, next);
      car.position.set(position.x, 0, position.z);

      const target = Math.atan2(heading.x, heading.z);
      if (bodyYaw.current === null) {
        bodyYaw.current = target;
      } else {
        const difference = angleDelta(bodyYaw.current, target);
        bodyYaw.current =
          Math.abs(difference) < YAW_SETTLED
            ? target
            : bodyYaw.current + difference * (1 - Math.exp(-YAW_DAMPING * delta));
      }
      car.rotation.y = bodyYaw.current;

      // Lean into the turn. Small, but it is the difference between the car
      // rotating and the car turning.
      const swing = angleDelta(bodyYaw.current, target);
      car.rotation.z = Math.max(-0.16, Math.min(0.16, swing * 0.28));
    }

    publish(next);
  });

  return (
    <>
      {/* Far enough out that the fog reads as distance, not as a wall. The
          road running into it is the closing shot (DESIGN.md §2.3). */}
      <fog attach="fog" args={[WORLD_COLORS.fog, 320, 1450]} />

      {/* Dusk, per DESIGN.md §10: one neutral palette, restyled later.
          Kept dim enough that the lit windows, neon and signs actually read as
          light sources rather than as slightly paler paint. */}
      <ambientLight intensity={0.4} />
      <hemisphereLight args={['#8ea6cd', '#20281f', 1.05] as const} />
      <Sun follow={carRef} />

      <Environment />

      <Garage graph={worldGraph} openRef={doorOpenRef} />
      <Roads graph={worldGraph} halfWidth={DEFAULT_LAYOUT_OPTIONS.roadHalfWidth} />
      <Scenery items={worldScenery} lamps={worldLamps} />
      <Billboards graph={worldGraph} />
      <RoadEnd graph={worldGraph} />

      {worldPlots.map((transform) => (
        <Plot key={transform.entryId} transform={transform} />
      ))}

      <Car ref={carRef} />
      <ChaseCamera
        graph={worldGraph}
        stateRef={stateRef}
        interiorRef={insideRef}
        lookRef={lookRef}
      />
    </>
  );
}
