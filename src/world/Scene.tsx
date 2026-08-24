'use client';

import { useFrame } from '@react-three/fiber';
import { useCallback, useRef } from 'react';
import type { Group } from 'three';
import { DEFAULT_LAYOUT_OPTIONS } from './layout';
import { type DriveState, branchOptions, headingOf, positionOf, step } from './drive';
import { type InputBuffer, consumeFlip, consumeSteer } from './useDriveInput';
import { worldGraph, worldLamps, worldPlots, worldScenery } from './world';
import { WORLD_COLORS } from './palette';
import { Billboards } from './Billboards';
import { Environment } from './Environment';
import { RoadEnd } from './RoadEnd';
import { Roads } from './Roads';
import { Scenery } from './Scenery';
import { Plot } from './Plot';
import { Car } from './Car';
import { ChaseCamera } from './ChaseCamera';
import { Sun } from './Sun';
import { nearestPlot } from './proximity';

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
    );
    stateRef.current = next;

    const car = carRef.current;
    if (car !== null) {
      const position = positionOf(worldGraph, next);
      const heading = headingOf(worldGraph, next);
      car.position.set(position.x, 0, position.z);
      car.rotation.y = Math.atan2(heading.x, heading.z);
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

      <Roads graph={worldGraph} halfWidth={DEFAULT_LAYOUT_OPTIONS.roadHalfWidth} />
      <Scenery items={worldScenery} lamps={worldLamps} />
      <Billboards graph={worldGraph} />
      <RoadEnd graph={worldGraph} />

      {worldPlots.map((transform) => (
        <Plot key={transform.entryId} transform={transform} />
      ))}

      <Car ref={carRef} />
      <ChaseCamera graph={worldGraph} stateRef={stateRef} />
    </>
  );
}
