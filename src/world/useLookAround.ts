'use client';

import { useEffect, useRef } from 'react';

/**
 * Drag to look around.
 *
 * DESIGN.md §2.2 takes camera control away deliberately, so that every scene is
 * framed the way it was laid out and nobody ends up staring at the sky. That
 * still holds — this is a *nudge*, not a free camera: elevation is clamped well
 * clear of the ground and the sky, and the view returns to the designed framing
 * on its own.
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
 * All the way round, either way.
 *
 * The old limit was 135°, from when this swivelled the camera in place: past
 * that you were looking at empty road with the car off screen entirely. An
 * orbit keeps the car in the middle of the frame at every angle, so there is
 * nothing left to protect the viewer from and a full circle is simply useful —
 * you can look at the front of your own car.
 */
export const LOOK_YAW_LIMIT = Math.PI;
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
      look.current.yaw = clamp(
        look.current.yaw - (event.clientX - lastX) * YAW_PER_PIXEL,
        LOOK_YAW_LIMIT,
      );
      look.current.pitch = clamp(
        look.current.pitch + (event.clientY - lastY) * PITCH_PER_PIXEL,
        LOOK_PITCH_LIMIT,
      );
      lastX = event.clientX;
      lastY = event.clientY;

      const elapsed = event.timeStamp - markTime;
      if (elapsed >= VELOCITY_WINDOW_MS) {
        look.current.velocityYaw = ((look.current.yaw - markX) / elapsed) * 1000;
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
