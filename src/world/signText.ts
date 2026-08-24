/**
 * Sign text layout. Pure — no canvas, no DOM, no three.
 *
 * DESIGN.md §2.5 makes the sign the mechanism that keeps the site modular:
 * adding a project produces a readable, correctly-signed building with zero art
 * work. That only holds if the layout copes with whatever a title turns out to
 * be, so the fitting logic lives here where it can be tested against the real
 * titles rather than eyeballed in a scene.
 */

/** Measures a string at a given font size, in the same units as `maxWidth`. */
export type Measure = (text: string, fontSize: number) => number;

export interface SignLayout {
  readonly lines: readonly string[];
  readonly fontSize: number;
}

export interface FitOptions {
  readonly maxWidth: number;
  readonly maxHeight: number;
  readonly maxLines: number;
  readonly maxFontSize: number;
  readonly minFontSize: number;
  /** Multiple of font size between baselines. */
  readonly lineHeight: number;
}

export const DEFAULT_FIT: FitOptions = {
  maxWidth: 1024,
  maxHeight: 256,
  maxLines: 3,
  maxFontSize: 132,
  minFontSize: 34,
  lineHeight: 1.16,
};

/**
 * Greedy word wrap at a fixed font size.
 *
 * A single word longer than the line is left overflowing rather than
 * hyphenated or dropped — `fitSign` responds by trying a smaller size, which
 * is the correct fix. Silently truncating a project's name would not be.
 */
export function wrapLines(text: string, fontSize: number, maxWidth: number, measure: Measure): string[] {
  const words = text.split(/\s+/).filter((word) => word.length > 0);
  if (words.length === 0) return [];

  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const candidate = current === '' ? word : `${current} ${word}`;
    if (current !== '' && measure(candidate, fontSize) > maxWidth) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current !== '') lines.push(current);
  return lines;
}

/**
 * Largest font size at which the whole title fits the sign.
 *
 * Steps down rather than solving analytically because text measurement is not
 * linear in font size once kerning is involved. At the floor it accepts the
 * overflow: a slightly cramped sign is better than a blank one.
 */
export function fitSign(text: string, measure: Measure, options: Partial<FitOptions> = {}): SignLayout {
  const config: FitOptions = { ...DEFAULT_FIT, ...options };
  const trimmed = text.trim();
  if (trimmed === '') return { lines: [], fontSize: config.minFontSize };

  for (let fontSize = config.maxFontSize; fontSize >= config.minFontSize; fontSize -= 2) {
    const lines = wrapLines(trimmed, fontSize, config.maxWidth, measure);
    if (lines.length > config.maxLines) continue;
    if (lines.length * fontSize * config.lineHeight > config.maxHeight) continue;
    if (lines.some((line) => measure(line, fontSize) > config.maxWidth)) continue;
    return { lines, fontSize };
  }

  // Nothing fit. Show it at the floor size rather than showing nothing.
  return {
    lines: wrapLines(trimmed, config.minFontSize, config.maxWidth, measure).slice(0, config.maxLines),
    fontSize: config.minFontSize,
  };
}
