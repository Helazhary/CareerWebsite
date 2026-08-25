/**
 * M1 is deliberately untextured: grey boxes, one tint per district for
 * orientation only. Art direction lands in M2 (DESIGN.md §9) — nothing here is
 * meant to survive it.
 */

import type { District } from '@content/schema';

/**
 * Where the sun is, as a compass direction on the ground plane.
 *
 * Shared, because the sky and the key light have to agree. They did not: the
 * sky said sunset while the light sat 37° up, which is mid-afternoon. And the
 * sky's warm band was painted right around the horizon in every direction at
 * once, so there was nowhere the sun actually *was* — a sunset with no sun in
 * it reads as haze.
 */
export const SUN_DIRECTION = { x: -0.864, z: 0.504 } as const;
/** Low. This is the whole point of a dusk palette. */
export const SUN_ELEVATION = 0.12;

export const WORLD_COLORS = {
  sky: '#131a26',
  /**
   * Matched to the sky just above the horizon. Fog that does not match what is
   * behind it turns the far ground into a visible dark band — the exact "wall
   * at the edge of the world" it is supposed to hide.
   */
  fog: '#4c4550',
  ground: '#232b26',
  /** Distant hills. Sits between the fog and the sky so it reads as far away. */
  horizon: '#1a2030',
  /** Lit by the last of the sun, a shade above the hills behind them. */
  /** A shade lighter than the hills, so they read as nearer and catch the sun. */
  pyramid: '#2b2735',
  road: '#39424f',
  kerb: '#6b7690',
  centreLine: '#b9c2d4',
  edgeLine: '#7d879b',
  /** Mown grass along the roadside, between kerb and open ground. */
  verge: '#2b3a2e',
  /** A detour is somewhere else. Snow says that without a caption. */
  snowRoad: '#5c6473',
  snowVerge: '#c9d2de',
  snowKerb: '#e6ecf4',
  /**
   * Sampled from Hussein's own photos of the car (DESIGN.md §2.6), taking the
   * median of paint-coloured pixels across three shots in different light:
   * overcast, harsh sun and shade. All three agree on hue ~215°. Kept
   * deliberately darker than the sampled midtone because scene lighting lifts
   * it. The paint code is not recorded anywhere — this matches the photographs,
   * it does not claim to name the colour.
   */
  car: '#2b4576',
  carGlass: '#1a2130',
  /**
   * Tail lights. The chase camera looks at the back of this car for the entire
   * visit and there was nothing there — one flat face of the body box, which at
   * dusk is a dark rectangle. Lit rather than painted, so the car reads as a car
   * from behind at the distance the camera actually sits.
   */
  carTail: '#c2182b',
  carIndicator: '#d97316',
  tyre: '#15181f',
} as const;

/** Neutral greys with just enough hue to tell districts apart while driving. */
export const DISTRICT_TINT: Record<District, string> = {
  highway: '#79839a',
  garage: '#a08a6d',
  lab: '#6d9490',
  agents: '#7b83a8',
  workshop: '#9a8168',
  arcade: '#8d7399',
};
