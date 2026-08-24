'use client';

import { useEffect, useRef } from 'react';

/**
 * Drag to look around.
 *
 * DESIGN.md §2.2 takes camera control away deliberately, so that every scene is
 * framed the way it was laid out and nobody ends up staring at the sky. That
 * still holds — this is a *nudge*, not an orbit: bounded, and it springs back
 * to the designed framing the moment you let go.
 *
 * Without it the garage is a room you cannot look around, which is a poor
 * showing for a room with things on the walls.
 */

export interface LookOffset {
  yaw: number;
  pitch: number;
  /** True while a pointer is down, so the spring holds off. */
  held: boolean;
}

/** Radians either side of the designed framing. Generous, not unlimited. */
export const LOOK_YAW_LIMIT = Math.PI * 0.75;
export const LOOK_PITCH_LIMIT = 0.5;

const YAW_PER_PIXEL = 0.0055;
const PITCH_PER_PIXEL = 0.0032;

function clamp(value: number, limit: number): number {
  return Math.min(Math.max(value, -limit), limit);
}

export function useLookAround(): React.RefObject<LookOffset> {
  const look = useRef<LookOffset>({ yaw: 0, pitch: 0, held: false });

  useEffect(() => {
    let pointer: number | null = null;
    let lastX = 0;
    let lastY = 0;

    const isOverlay = (target: EventTarget | null): boolean =>
      target instanceof Element && target.closest('button, a, [role="dialog"]') !== null;

    const onDown = (event: PointerEvent): void => {
      // Never steal a click from the HUD, a panel, or the map.
      if (isOverlay(event.target)) return;
      pointer = event.pointerId;
      lastX = event.clientX;
      lastY = event.clientY;
      look.current.held = true;
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
    };

    const onUp = (event: PointerEvent): void => {
      if (pointer !== event.pointerId) return;
      pointer = null;
      look.current.held = false;
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
