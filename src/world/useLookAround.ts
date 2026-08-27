'use client';

import { useEffect, useRef } from 'react';

/**
 * Drag to look around.
 *
 * DESIGN.md §2.2 takes camera control away deliberately, so that every scene is
 * framed the way it was laid out and nobody ends up staring at the sky.
 *
 * What survives of that is the *return*: elevation is still clamped well clear
 * of the ground and the sky, and the view always drifts back to the designed
 * framing on its own. What has gone is the cap on yaw. A full circle around the
 * car turned out to be the thing people reach for first — it is their car —
 * and an orbit that stops short of it reads as broken rather than as restraint.
 *
 * Without it the garage is a room you cannot look around, which is a poor
 * showing for a room with things on the walls.
 *
 * What this hook owns is the *intent*: how far the viewer has dragged, how fast
 * they were going when they let go, and how long ago that was. Turning that
 * into a camera position is `ChaseCamera`'s job, and the two models it uses are
 * different — outdoors the camera orbits the car, indoors it stays put and
 * turns its head, because a room is smaller than the chase radius.
 */

export interface LookOffset {
  /** Azimuth away from directly behind the car. */
  yaw: number;
  /** Elevation away from the designed camera height. */
  pitch: number;
  /** True while a pointer is down, so nothing springs back mid-drag. */
  held: boolean;
  /** Radians per second at the moment of release. Decayed by the camera. */
  velocityYaw: number;
  velocityPitch: number;
  /** Seconds since release, accumulated by the camera. Reset on every drag. */
  idle: number;
}

/**
 * Yaw does not have a limit. It wraps.
 *
 * This has now been wrong twice in the same direction. First it was capped at
 * 135°, from when the camera swivelled in place and looking further meant
 * losing the car off the edge of the frame. Then it was "fixed" to ±180°,
 * which is not a full circle — it is a wall at the back of the car that you
 * hit and cannot drag past, and it feels exactly like the 135° one did.
 *
 * An orbit keeps the car centred at every angle, so there is nothing to protect
 * the viewer from. Yaw accumulates freely and is folded back into (-π, π] so
 * that the drift home always takes the short way round rather than unwinding
 * three turns of dragging.
 */
/** Elevation is still bounded. The ground and the sky are not framings. */
export const LOOK_PITCH_LIMIT = 0.5;

const YAW_PER_PIXEL = 0.0055;
const PITCH_PER_PIXEL = 0.0032;

/**
 * Velocity is measured over a window rather than from the last event.
 *
 * A single pointermove can arrive with a sub-millisecond delta, and dividing by
 * that produces a flick of several hundred radians a second from a slow drag.
 */
const VELOCITY_WINDOW_MS = 90;

function clamp(value: number, limit: number): number {
  return Math.min(Math.max(value, -limit), limit);
}

/** Into (-π, π], so a spin past the back of the car keeps going. */
function wrapAngle(value: number): number {
  const wrapped = (value + Math.PI) % (Math.PI * 2);
  return (wrapped < 0 ? wrapped + Math.PI * 2 : wrapped) - Math.PI;
}

/** Shortest signed way from `from` to `to`, for velocity across the wrap. */
function angleDelta(from: number, to: number): number {
  return wrapAngle(to - from);
}

export function useLookAround(): React.RefObject<LookOffset> {
  const look = useRef<LookOffset>({
    yaw: 0,
    pitch: 0,
    held: false,
    velocityYaw: 0,
    velocityPitch: 0,
    idle: 0,
  });

  useEffect(() => {
    let pointer: number | null = null;
    let lastX = 0;
    let lastY = 0;
    let markX = 0;
    let markY = 0;
    let markTime = 0;

    const isOverlay = (target: EventTarget | null): boolean =>
      target instanceof Element && target.closest('button, a, [role="dialog"]') !== null;

    const onDown = (event: PointerEvent): void => {
      // Never steal a click from the HUD, a panel, or the map.
      if (isOverlay(event.target)) return;
      pointer = event.pointerId;
      lastX = event.clientX;
      lastY = event.clientY;
      markX = look.current.yaw;
      markY = look.current.pitch;
      markTime = event.timeStamp;
      look.current.held = true;
      look.current.idle = 0;
      look.current.velocityYaw = 0;
      look.current.velocityPitch = 0;
    };

    const onMove = (event: PointerEvent): void => {
      if (pointer !== event.pointerId) return;
      // Drag left and the camera swings round to the car's right-hand side, so
      // the flank that comes into view is the one you dragged towards.
      look.current.yaw = wrapAngle(look.current.yaw + (event.clientX - lastX) * YAW_PER_PIXEL);
      look.current.pitch = clamp(
        look.current.pitch + (event.clientY - lastY) * PITCH_PER_PIXEL,
        LOOK_PITCH_LIMIT,
      );
      lastX = event.clientX;
      lastY = event.clientY;

      const elapsed = event.timeStamp - markTime;
      if (elapsed >= VELOCITY_WINDOW_MS) {
        // Shortest arc, or a drag straight through the back of the car reads as
        // a 360°-per-second flick in the opposite direction.
        look.current.velocityYaw = (angleDelta(markX, look.current.yaw) / elapsed) * 1000;
        look.current.velocityPitch = ((look.current.pitch - markY) / elapsed) * 1000;
        markX = look.current.yaw;
        markY = look.current.pitch;
        markTime = event.timeStamp;
      }
    };

    const onUp = (event: PointerEvent): void => {
      if (pointer !== event.pointerId) return;
      pointer = null;
      look.current.held = false;
      look.current.idle = 0;
      // A drag that ended in a pause is a deliberate stop, not a flick.
      if (event.timeStamp - markTime > VELOCITY_WINDOW_MS * 2) {
        look.current.velocityYaw = 0;
        look.current.velocityPitch = 0;
      }
    };

    window.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, []);

  return look;
}
