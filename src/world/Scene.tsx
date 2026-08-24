'use client';

import { useFrame } from '@react-three/fiber';
import { useCallback, useRef } from 'react';
import type { Group } from 'three';
import { DEFAULT_LAYOUT_OPTIONS } from './layout';
import { type DriveState, branchOptions, headingOf, positionOf, step } from './drive';
import { type InputBuffer, consumeSteer } from './useDriveInput';
import { worldGraph, worldPlots } from './world';
import { WORLD_COLORS } from './palette';
import { Roads } from './Roads';
import { Plot } from './Plot';
import { Car } from './Car';
import { ChaseCamera } from './ChaseCamera';

/** What the DOM overlay needs. Updated on change, never per frame. */
export interface HudState {
  readonly nodeId: string;
  readonly choice: number;
  readonly branches: readonly { readonly edgeId: string; readonly district: string }[];
  readonly speed: number;
  /** World units still to run before the junction. Gates the prompt. */
  readonly distanceToJunction: number;
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
}: {
  input: React.RefObject<InputBuffer>;
  onHud: (hud: HudState) => void;
  stateRef: React.RefObject<DriveState>;
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

      // Bucketed so the overlay re-renders on meaningful change, not at 60 Hz.
      const approaching = remaining < PROMPT_DISTANCE;
      const signature = `${state.targetNodeId}|${state.choice}|${branches
        .map((b) => b.edgeId)
        .join(',')}|${approaching}|${Math.round(state.speed / 10)}`;
      if (signature === lastHud.current) return;
      lastHud.current = signature;

      onHud({
        nodeId: state.targetNodeId,
        choice: state.choice,
        branches,
        speed: state.speed,
        distanceToJunction: approaching ? remaining : Number.POSITIVE_INFINITY,
      });
    },
    [onHud],
  );

  useFrame((_, delta) => {
    const next = step(
      worldGraph,
      stateRef.current,
      { throttle: input.current.throttle, steer: consumeSteer(input.current) },
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
      <color attach="background" args={[WORLD_COLORS.sky]} />
      {/* Far enough out that the fog reads as distance, not as a wall. The
          road running into it is the closing shot (DESIGN.md §2.3). */}
      <fog attach="fog" args={[WORLD_COLORS.fog, 340, 1150]} />

      <ambientLight intensity={0.75} />
      <hemisphereLight args={['#9fb4d4', '#141922', 1.35] as const} />
      <directionalLight position={[160, 220, 90]} intensity={2.1} castShadow />

      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[6000, 6000]} />
        <meshStandardMaterial color={WORLD_COLORS.ground} roughness={1} />
      </mesh>

      <Roads graph={worldGraph} halfWidth={DEFAULT_LAYOUT_OPTIONS.roadHalfWidth} />

      {worldPlots.map((transform) => (
        <Plot key={transform.entryId} transform={transform} />
      ))}

      <Car ref={carRef} />
      <ChaseCamera graph={worldGraph} stateRef={stateRef} />
    </>
  );
}
