/**
 * Which building the car is at. Pure — no three, no react, no DOM.
 *
 * Deciding this in a pure function rather than with a physics trigger volume
 * keeps it testable, and keeps the rule that the car has no collision: nothing
 * in the world reacts to the car, the car works out where it is.
 */

import type { Vec2 } from './graph';
import type { PlotTransform } from './layout';

export interface ProximityOptions {
  /** How close the car must be for a building to offer itself. */
  readonly reach: number;
  /**
   * How far behind the car a building may be and still count, as a dot product
   * against the heading. Slightly negative so a building level with the car
   * still registers — it is in view, just not ahead.
   */
  readonly minAlignment: number;
}

export const DEFAULT_PROXIMITY: ProximityOptions = {
  reach: 52,
  minAlignment: -0.35,
};

/**
 * The building the car is closest to, or nothing.
 *
 * A building the car has already driven past does not count: offering to open
 * something that is now behind you reads as the world nagging.
 */
export function nearestPlot(
  position: Vec2,
  heading: Vec2,
  plots: readonly PlotTransform[],
  options: Partial<ProximityOptions> = {},
): PlotTransform | undefined {
  const config: ProximityOptions = { ...DEFAULT_PROXIMITY, ...options };

  let best: PlotTransform | undefined;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const plot of plots) {
    const dx = plot.position.x - position.x;
    const dz = plot.position.z - position.z;
    const distance = Math.hypot(dx, dz);
    if (distance > config.reach + plot.radius) continue;
    if (distance === 0) return plot;

    const alignment = (dx / distance) * heading.x + (dz / distance) * heading.z;
    if (alignment < config.minAlignment) continue;

    // Measure to the building's face, so a large plot is not beaten by a small
    // one that happens to have its centre slightly closer.
    const effective = distance - plot.radius;
    if (effective < bestDistance) {
      bestDistance = effective;
      best = plot;
    }
  }

  return best;
}
