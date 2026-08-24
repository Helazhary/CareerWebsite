'use client';

import { useSyncExternalStore } from 'react';

/**
 * Capability probe for drive mode.
 *
 * Doc mode is served silently as the good version, never as an apology or a
 * "your browser is not supported" message (DESIGN.md §3.1). Nothing here
 * renders a warning; it only answers whether the world should mount.
 */

let webglResult: boolean | undefined;

function probeWebGL(): boolean {
  if (typeof document === 'undefined') return false;
  try {
    const canvas = document.createElement('canvas');
    return Boolean(
      canvas.getContext('webgl2') ??
        canvas.getContext('webgl') ??
        canvas.getContext('experimental-webgl'),
    );
  } catch {
    // Some privacy modes throw rather than returning null.
    return false;
  }
}

/**
 * Cached: creating a throwaway canvas and a GL context on every render would be
 * absurd, and the answer cannot change within a page view.
 */
export function hasWebGL(): boolean {
  webglResult ??= probeWebGL();
  return webglResult;
}

/**
 * Whether to open in the world without being asked.
 *
 * Deliberately conservative: a phone, a coarse pointer, a small viewport or a
 * stated preference for reduced motion all mean the reader gets the document.
 * They can still choose to drive.
 */
let autoDriveResult: boolean | undefined;

export function shouldAutoDrive(): boolean {
  if (typeof window === 'undefined') return false;
  autoDriveResult ??=
    !window.matchMedia('(prefers-reduced-motion: reduce)').matches &&
    !window.matchMedia('(pointer: coarse)').matches &&
    window.innerWidth >= 900 &&
    window.innerHeight >= 520 &&
    hasWebGL();
  return autoDriveResult;
}

/**
 * Read the probe the way React wants an external system read.
 *
 * These components are prerendered into the static HTML, so the answer differs
 * between server and client by definition. `useSyncExternalStore` is what makes
 * that a supported difference rather than a hydration mismatch.
 */
const neverChanges = (): (() => void) => () => {};
const notOnTheServer = (): boolean => false;

export function useHasWebGL(): boolean {
  return useSyncExternalStore(neverChanges, hasWebGL, notOnTheServer);
}

export function useShouldAutoDrive(): boolean {
  return useSyncExternalStore(neverChanges, shouldAutoDrive, notOnTheServer);
}
