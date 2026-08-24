'use client';

import { site } from '@/lib/site';

/**
 * The instructions card.
 *
 * DESIGN.md §1 forbids a forced tutorial and a loading gate, so this is
 * neither: it is one dismissible card that never returns unless asked for, and
 * the world is already rendered and running behind it. Nothing is waiting on
 * the reader to click.
 */

interface Control {
  readonly keys: readonly string[];
  readonly label: string;
}

const CONTROLS: readonly Control[] = [
  { keys: ['W', '↑'], label: 'Hold to drive' },
  { keys: ['←', '→'], label: 'Choose a turning at a junction' },
  { keys: ['S', '↓'], label: 'Turn the car around' },
  { keys: ['⏎'], label: 'Open the building you have stopped at' },
  { keys: ['M'], label: 'Open the map — click anything to travel there' },
  { keys: ['drag'], label: 'Look around; let go and the view settles back' },
  { keys: ['Esc'], label: 'Close whatever is open' },
];

export function IntroOverlay({
  onStart,
  startLabel,
}: {
  onStart: () => void;
  /** Differs between the opening sequence and a later look at the controls. */
  startLabel: string;
}): React.JSX.Element {
  return (
    <div className="pointer-events-auto absolute inset-0 z-40 flex items-center justify-center bg-ink/55 p-4 backdrop-blur-md">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="How to get around"
        className="w-full max-w-lg rounded-xl border border-line bg-surface/85 p-6 shadow-2xl sm:p-8"
      >
        <p className="text-xs uppercase tracking-widest text-muted">{site.location}</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">{site.name}</h1>
        <p className="mt-1 text-accent">{site.role}</p>

        <p className="mt-4 text-sm leading-relaxed text-muted">
          Every building is a job, a degree or a project. The highway runs left to right in date
          order, so driving straight through reads like the resume. The turnings lead to the
          personal work.
        </p>

        <dl className="mt-6 space-y-2.5">
          {CONTROLS.map((control) => (
            <div key={control.label} className="flex items-baseline gap-3">
              <dt className="flex w-24 shrink-0 gap-1">
                {control.keys.map((key) => (
                  <kbd
                    key={key}
                    className="rounded border border-line bg-ink/60 px-1.5 py-0.5 font-mono text-[11px] text-text"
                  >
                    {key}
                  </kbd>
                ))}
              </dt>
              <dd className="text-sm text-muted">{control.label}</dd>
            </div>
          ))}
        </dl>

        <p className="mt-5 text-xs text-muted">
          In a hurry? <span className="text-text">Fast Track</span> swaps to the plain resume at any
          time.
        </p>

        <button
          type="button"
          onClick={onStart}
          autoFocus
          className="mt-6 w-full rounded-md bg-accent px-4 py-2.5 text-sm font-medium text-ink transition hover:opacity-90"
        >
          {startLabel}
        </button>
      </div>
    </div>
  );
}
