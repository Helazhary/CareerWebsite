'use client';

import { useEffect, useRef } from 'react';
import { site } from '@/lib/site';

/**
 * Who is driving.
 *
 * Everything a viewer can reach in the world is a project, a job or a degree —
 * the record, not the person. This is the one panel allowed to be personal.
 *
 * Falls back to the pitch and location already in `site.ts` when `about` is
 * empty, so it is never blank and never invented.
 */
export function AboutPanel({ onClose }: { onClose: () => void }): React.JSX.Element {
  const panel = useRef<HTMLDivElement>(null);
  const paragraphs = site.about.length > 0 ? site.about : [site.pitch];
  const email = `${site.emailUser}@${site.emailDomain}`;

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
    <div className="pointer-events-auto absolute inset-y-0 right-0 z-30 flex w-full max-w-md flex-col border-l border-line bg-ink/95 text-left backdrop-blur-md sm:max-w-lg">
      <div
        ref={panel}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label="About Hussein Elazhary"
        className="flex-1 overflow-y-auto p-5 focus:outline-none sm:p-6"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-widest text-muted">About</p>
            <h2 className="mt-1 text-xl font-semibold tracking-tight sm:text-2xl">{site.name}</h2>
            <p className="mt-0.5 text-accent">{site.role}</p>
            <p className="mt-0.5 text-sm text-muted">{site.location}</p>
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

        <div className="mt-5 space-y-3 text-sm leading-relaxed text-muted">
          {paragraphs.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </div>

        <ul className="mt-6 flex flex-wrap gap-2">
          {[
            { href: site.github, label: 'GitHub' },
            { href: site.linkedin, label: 'LinkedIn' },
            { href: `mailto:${email}`, label: 'Email' },
          ].map((link) => (
            <li key={link.label}>
              <a
                href={link.href}
                target={link.label === 'Email' ? undefined : '_blank'}
                rel="noopener noreferrer"
                className="inline-block rounded-md border border-line px-3 py-1.5 text-sm text-muted transition hover:border-accent hover:text-text"
              >
                {link.label}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
