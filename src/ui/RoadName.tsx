'use client';

import { DISTRICT_LABELS } from '@/lib/site';

/**
 * The name of the road you have just turned onto, briefly, in white.
 *
 * Fires on a change of *district*, not of edge. The spine is cut into a
 * separate edge between every pair of features on it, so announcing each one
 * would flash "The Highway" a dozen times on a single straight run — which is
 * how a wayfinding cue turns into a nag.
 *
 * No state and no timer: the label is keyed by district, so React remounts it
 * exactly when the district changes and the CSS animation in `globals.css`
 * runs once and leaves it at zero opacity. A timer here would mean calling
 * `setState` from an effect, which the lint rules rightly refuse — and the
 * cascading render it warns about would land on the overlay that sits above a
 * running 3D canvas.
 *
 * `hidden` hides rather than unmounts, for the same reason: unmounting would
 * replay the flash every time a project panel was closed. It also *pauses* the
 * animation instead of merely covering it — the car spawns on the highway, so
 * without this the one flash that teaches you the feature exists plays out
 * silently behind the intro card and is over before anyone takes the wheel.
 * Pausing a finished animation does nothing, so closing a panel mid-drive still
 * does not replay it.
 */
export function RoadName({
  district,
  hidden,
}: {
  /** District of the road the car is on right now. */
  district: string | null;
  /** The intro card is up, or a panel is: say nothing. */
  hidden: boolean;
}): React.JSX.Element | null {
  if (district === null) return null;

  return (
    <div
      className={`pointer-events-none absolute inset-x-0 top-16 z-10 flex justify-center px-4 sm:top-20 ${
        hidden ? 'invisible' : ''
      }`}
    >
      <p
        key={district}
        className={`road-name ${hidden ? 'is-held' : ''} text-center text-xl font-medium uppercase tracking-[0.2em] text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.85)] sm:text-2xl`}
      >
        {DISTRICT_LABELS[district] ?? district}
      </p>
    </div>
  );
}
