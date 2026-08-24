'use client';

import { useEffect, useRef } from 'react';

export interface InputBuffer {
  throttle: boolean;
  /** Consumed once per frame — steering is a decision, not a held state. */
  steer: -1 | 0 | 1;
}

/**
 * Take the pending steer and clear it. Steering is a decision, so it applies
 * once and then it is gone — holding the key does not keep turning.
 */
export function consumeSteer(buffer: InputBuffer): -1 | 0 | 1 {
  const pending = buffer.steer;
  buffer.steer = 0;
  return pending;
}

export function setThrottle(buffer: InputBuffer, throttle: boolean): void {
  buffer.throttle = throttle;
}

export function queueSteer(buffer: InputBuffer, steer: -1 | 1): void {
  buffer.steer = steer;
}

const THROTTLE_KEYS = new Set(['ArrowUp', 'KeyW', 'Space']);
const LEFT_KEYS = new Set(['ArrowLeft', 'KeyA']);
const RIGHT_KEYS = new Set(['ArrowRight', 'KeyD']);

/**
 * Keyboard and touch input, held outside React state.
 *
 * Input at 60 Hz through `useState` would re-render the whole tree every frame.
 * The frame loop reads this ref directly and re-renders nothing.
 */
export function useDriveInput(): React.RefObject<InputBuffer> {
  const buffer = useRef<InputBuffer>({ throttle: false, steer: 0 });

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.repeat) return;
      if (THROTTLE_KEYS.has(event.code)) {
        buffer.current.throttle = true;
        // Space scrolls the page otherwise, which is jarring mid-drive.
        if (event.code === 'Space') event.preventDefault();
      }
      if (LEFT_KEYS.has(event.code)) buffer.current.steer = -1;
      if (RIGHT_KEYS.has(event.code)) buffer.current.steer = 1;
    };

    const onKeyUp = (event: KeyboardEvent): void => {
      if (THROTTLE_KEYS.has(event.code)) buffer.current.throttle = false;
    };

    // Losing focus mid-drive would otherwise leave the throttle stuck on.
    const onBlur = (): void => {
      buffer.current.throttle = false;
      buffer.current.steer = 0;
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
  }, []);

  return buffer;
}
