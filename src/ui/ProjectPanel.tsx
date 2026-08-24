'use client';

import Link from 'next/link';
import { useEffect, useRef } from 'react';
import type { Entry } from '@content/schema';
import { LinkRow } from '@/doc/LinkRow';
import { StatusBadge } from '@/doc/StatusBadge';
import { Tags } from '@/doc/Tags';
import { formatRange } from '@/lib/format';
import { DISTRICT_LABELS } from '@/lib/site';
import { previewMedia } from '@/preview/placeholders';

/**
 * The project panel: what a building says when you stop at it.
 *
 * DOM over the canvas, not drawn into it. Text stays selectable, links stay
 * real links, a screen reader can read it, and none of it needs WebGL to lay
 * out. It also reuses the same components doc mode uses, so a project reads the
 * same way in both modes because it is literally the same code.
 */
export function ProjectPanel({
  entry,
  onClose,
}: {
  entry: Entry;
  onClose: () => void;
}): React.JSX.Element {
  const panel = useRef<HTMLDivElement>(null);
  const media = previewMedia(entry);

  // Move focus into the panel so a keyboard visitor is not left behind on the
  // canvas, and hand it back on close.
  useEffect(() => {
    const previous = document.activeElement;
    panel.current?.focus();
    return () => {
      if (previous instanceof HTMLElement) previous.focus();
    };
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.code === 'Escape') {
        event.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    // text-left is deliberate: the deep-link page centres its fallback copy,
    // and without this the panel inherits it.
    <div className="pointer-events-auto absolute inset-y-0 right-0 z-30 flex w-full max-w-md flex-col border-l border-line bg-ink/95 text-left backdrop-blur-md sm:max-w-lg">
      <div
        ref={panel}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={`${entry.title} — project details`}
        className="flex-1 overflow-y-auto p-5 focus:outline-none sm:p-6"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-widest text-muted">
              {DISTRICT_LABELS[entry.district] ?? entry.district}
            </p>
            <h2 className="mt-1 text-xl font-semibold tracking-tight sm:text-2xl">{entry.title}</h2>
            {entry.subtitle ? <p className="mt-0.5 text-accent">{entry.subtitle}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close panel"
            className="shrink-0 rounded border border-line px-2 py-1 text-xs text-muted transition hover:border-accent hover:text-accent"
          >
            Esc
          </button>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="font-mono text-xs text-muted">
            {formatRange(entry.start, entry.end)}
          </span>
          <StatusBadge status={entry.status} />
        </div>

        <p className="mt-4 text-muted">{entry.summary}</p>

        <ul className="mt-4 space-y-2">
          {entry.bullets.map((bullet) => (
            <li key={bullet} className="flex gap-2 text-sm">
              <span aria-hidden className="text-accent">•</span>
              <span>{bullet}</span>
            </li>
          ))}
        </ul>

        {media.length > 0 ? (
          <ul className="mt-5 grid gap-3 grid-cols-2">
            {media.map((item) => (
              <li key={item.src}>
                {/* Plain <img>: these are already sized, and next/image inside a
                    canvas overlay buys nothing. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.src}
                  alt={item.alt}
                  loading="lazy"
                  className="aspect-[4/3] w-full rounded-md border border-line object-cover"
                />
                {item.caption ? (
                  <p className="mt-1 text-[11px] text-muted">{item.caption}</p>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}

        <div className="mt-5">
          <Tags items={entry.tags} />
        </div>

        <LinkRow links={entry.links} />

        <Link
          href={`/projects/${entry.id}`}
          className="mt-6 inline-block rounded-md border border-line px-3 py-1.5 text-sm text-muted transition hover:border-accent hover:text-text"
        >
          Open the full page →
        </Link>
      </div>
    </div>
  );
}
