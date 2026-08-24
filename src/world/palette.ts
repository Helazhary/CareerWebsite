/**
 * M1 is deliberately untextured: grey boxes, one tint per district for
 * orientation only. Art direction lands in M2 (DESIGN.md §9) — nothing here is
 * meant to survive it.
 */

import type { District } from '@content/schema';

export const WORLD_COLORS = {
  sky: '#0e131c',
  fog: '#0e131c',
  ground: '#1d2430',
  road: '#39424f',
  kerb: '#6b7690',
  centreLine: '#98a2b8',
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
