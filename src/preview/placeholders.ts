/**
 * Preview placeholders.
 *
 * Lets the site be judged as a finished thing before the real photographs,
 * links and write-ups exist — without a single invented fact reaching
 * production. Everything here is gated on `NEXT_PUBLIC_PREVIEW`, which is unset
 * in a normal build, so the placeholder path is dead code and gets dropped.
 *
 * Placeholders are deliberately, visibly placeholders. A grey card that says
 * PLACEHOLDER is honest; a stock photo of somebody else's robot arm is not, and
 * would eventually get shipped by accident.
 */

import type { Entry } from '@content/schema';

/**
 * Two locks, not one.
 *
 * The env var alone is a configuration away from shipping grey cards to
 * helazhary.com — set NEXT_PUBLIC_PREVIEW in the Cloudflare build and every
 * empty gallery fills with placeholders. Requiring a development build as well
 * makes that impossible regardless of how the deploy is configured: preview is
 * a thing you run locally, and a production bundle cannot express it.
 *
 * Taken as arguments so the rule can be tested directly. `process.env` is not
 * writable on Node 22, so a test that tried to set NODE_ENV to prove this
 * threw rather than asserting anything.
 */
export function isPreviewEnabled(nodeEnv: string | undefined, flag: string | undefined): boolean {
  return nodeEnv !== 'production' && flag === '1';
}

export const PREVIEW_MODE = isPreviewEnabled(
  process.env.NODE_ENV,
  process.env.NEXT_PUBLIC_PREVIEW,
);

/** How many placeholder frames to show for an entry with no media at all. */
const FRAMES_BY_SIZE: Record<Entry['size'], number> = { sm: 1, md: 2, lg: 3 };

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * An inline SVG stand-in. A data URI rather than a file on disk, so preview
 * mode cannot leave stray images in `public/` to be committed by mistake.
 */
export function placeholderImage(title: string, index: number, total: number): string {
  const label = escapeXml(title);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600">
  <rect width="800" height="600" fill="#171b23"/>
  <g fill="none" stroke="#2b3342" stroke-width="2">
    <path d="M0 0 L800 600 M800 0 L0 600"/>
  </g>
  <rect x="24" y="24" width="752" height="552" fill="none" stroke="#2b3342" stroke-width="3" stroke-dasharray="14 10"/>
  <text x="400" y="286" fill="#8e97a8" font-family="ui-monospace, monospace" font-size="26" text-anchor="middle">${label}</text>
  <text x="400" y="330" fill="#5b6474" font-family="ui-monospace, monospace" font-size="20" text-anchor="middle">PLACEHOLDER ${index + 1} / ${total}</text>
</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export interface PreviewMedia {
  readonly src: string;
  readonly alt: string;
  readonly caption?: string;
  readonly placeholder: boolean;
}

/**
 * Real media if the entry has any, placeholders if it does not.
 *
 * Never mixes the two: an entry with one real photograph shows one photograph,
 * not one photograph and two grey cards.
 */
export function previewMedia(entry: Entry): PreviewMedia[] {
  const real = entry.media.map((item) => ({
    src: `/media/${entry.id}/${item.src}`,
    alt: item.alt,
    caption: item.caption,
    placeholder: false,
  }));

  if (!PREVIEW_MODE || real.length > 0) return real;

  const total = FRAMES_BY_SIZE[entry.size];
  return Array.from({ length: total }, (_, index) => ({
    src: placeholderImage(entry.title, index, total),
    alt: `Placeholder image ${index + 1} of ${total} for ${entry.title}. No photograph has been added for this project yet.`,
    caption: 'Placeholder — preview mode only.',
    placeholder: true,
  }));
}
