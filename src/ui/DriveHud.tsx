'use client';

import Link from 'next/link';
import { entries } from '@content/registry';
import type { HudState } from '@/world/Scene';
import { DISTRICT_LABELS, site } from '@/lib/site';
import { type InputBuffer, queueFlip, queueSteer, setThrottle } from '@/world/useDriveInput';

/**
 * The DOM overlay. Plain HTML on top of the canvas, so the name, the title and
 * the two escape hatches are on screen in the first frame — before a single
 * byte of the 3D bundle has parsed (DESIGN.md §1, the anti-annoyance contract).
 */
/** Titles by id, built once. The HUD reads content; it does not embed it. */
const TITLES = new Map(entries.map((entry) => [entry.id, entry.title]));

export function DriveHud({
  hud,
  input,
  onExit,
  onOpenMap,
  onOpenEntry,
  panelOpen,
}: {
  hud: HudState | null;
  input: React.RefObject<InputBuffer>;
  onExit: () => void;
  onOpenMap: () => void;
  onOpenEntry: (entryId: string) => void;
  panelOpen: boolean;
}): React.JSX.Element {
  const branches = hud?.branches ?? [];
  // A choice, and close enough for it to be about the junction in front of you.
  const atJunction = branches.length > 1 && Number.isFinite(hud?.distanceToJunction ?? Infinity);

  const nearbyId = hud?.nearbyEntryId ?? null;
  const nearby = nearbyId === null ? undefined : TITLES.get(nearbyId);

  const press = (steer: -1 | 1) => () => queueSteer(input.current, steer);
  const hold = (throttle: boolean) => () => setThrottle(input.current, throttle);

  return (
    <>
      {/* Identity. Always up, never covered. */}
      <header className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-4 p-4 sm:p-6">
        <div>
          <p className="text-sm font-semibold text-text sm:text-base">{site.name}</p>
          <p className="text-xs text-muted sm:text-sm">{site.role}</p>
        </div>
        <nav className="pointer-events-auto flex gap-2">
          <button
            type="button"
            onClick={onOpenMap}
            className="rounded border border-line bg-surface/85 px-3 py-1.5 text-xs font-medium text-text backdrop-blur transition hover:border-accent hover:text-accent sm:text-sm"
          >
            Map
          </button>
          <button
            type="button"
            onClick={onExit}
            className="rounded border border-line bg-surface/85 px-3 py-1.5 text-xs font-medium text-muted backdrop-blur transition hover:border-accent hover:text-accent sm:text-sm"
          >
            Fast Track
          </button>
          <Link
            href="/resume"
            className="rounded border border-line bg-surface/85 px-3 py-1.5 text-xs font-medium text-text backdrop-blur transition hover:border-accent hover:text-accent sm:text-sm"
          >
            Resume
          </Link>
          <Link
            href="/projects"
            className="rounded border border-line bg-surface/85 px-3 py-1.5 text-xs font-medium text-text backdrop-blur transition hover:border-accent hover:text-accent sm:text-sm"
          >
            Projects
          </Link>
        </nav>
      </header>

      {/* What you are standing at. An offer, not an interruption — the panel
          never opens itself as you drive past. */}
      {nearby !== undefined && nearbyId !== null && !panelOpen ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-40 z-10 flex justify-center px-4 sm:bottom-44">
          <button
            type="button"
            onClick={() => onOpenEntry(nearbyId)}
            className="pointer-events-auto flex items-center gap-2 rounded-full border border-line bg-surface/90 px-4 py-2 text-xs backdrop-blur transition hover:border-accent sm:text-sm"
          >
            <kbd className="rounded border border-line px-1.5 py-0.5 font-mono text-[11px]">
              ⏎
            </kbd>
            <span className="font-medium text-text">{nearby}</span>
          </button>
        </div>
      ) : null}

      {/* Junction prompt: ◀ The Lab │ Highway ▶ */}
      {atJunction ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-24 z-10 flex justify-center px-4 sm:bottom-28">
          <div className="flex items-center gap-1 rounded-full border border-line bg-surface/90 px-2 py-1.5 text-xs backdrop-blur sm:text-sm">
            {branches.map((branch, index) => {
              const chosen = index === hud?.choice;
              return (
                <span
                  key={branch.edgeId}
                  className={
                    chosen
                      ? 'rounded-full bg-accent px-3 py-1 font-medium text-ink'
                      : 'rounded-full px-3 py-1 text-muted'
                  }
                >
                  {index === 0 ? '◀ ' : ''}
                  {DISTRICT_LABELS[branch.district] ?? branch.district}
                  {index === branches.length - 1 ? ' ▶' : ''}
                </span>
              );
            })}
          </div>
        </div>
      ) : null}

      {/* Touch zones. Large, thumb-reachable, hidden on pointer devices. */}
      <div className="absolute inset-x-0 bottom-0 z-10 flex h-24 touch-none select-none gap-2 p-3 sm:hidden">
        <button
          type="button"
          aria-label="Turn left at the next junction"
          onPointerDown={press(-1)}
          className="flex-1 rounded-lg border border-line bg-surface/70 text-lg text-text backdrop-blur active:bg-surface"
        >
          ◀
        </button>
        <button
          type="button"
          aria-label="Turn the car around"
          onPointerDown={() => queueFlip(input.current)}
          className="flex-1 rounded-lg border border-line bg-surface/70 text-sm text-text backdrop-blur active:bg-surface"
        >
          ↻
        </button>
        <button
          type="button"
          aria-label="Drive forward"
          onPointerDown={hold(true)}
          onPointerUp={hold(false)}
          onPointerLeave={hold(false)}
          onPointerCancel={hold(false)}
          className="flex-[2] rounded-lg border border-line bg-surface/70 text-sm font-medium text-text backdrop-blur active:bg-surface"
        >
          Hold to drive
        </button>
        <button
          type="button"
          aria-label="Turn right at the next junction"
          onPointerDown={press(1)}
          className="flex-1 rounded-lg border border-line bg-surface/70 text-lg text-text backdrop-blur active:bg-surface"
        >
          ▶
        </button>
      </div>

      {/* Keyboard hint, desktop only. No tutorial, no gate — one line. */}
      <p className="pointer-events-none absolute inset-x-0 bottom-4 z-10 hidden text-center text-xs text-muted sm:block">
        Hold <kbd className="rounded border border-line px-1">W</kbd> to drive ·{' '}
        <kbd className="rounded border border-line px-1">←</kbd>{' '}
        <kbd className="rounded border border-line px-1">→</kbd> at a junction ·{' '}
        <kbd className="rounded border border-line px-1">S</kbd> to turn around ·{' '}
        <kbd className="rounded border border-line px-1">M</kbd> for the map
      </p>
    </>
  );
}
