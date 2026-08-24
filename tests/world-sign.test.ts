import { describe, expect, it } from 'vitest';
import { entries } from '@content/registry';
import { DEFAULT_FIT, fitSign, wrapLines, type Measure } from '@/world/signText';

/** Stand-in for canvas text metrics: every glyph is 0.55em wide. */
const measure: Measure = (text, fontSize) => text.length * fontSize * 0.55;

describe('wrapLines', () => {
  it('breaks on words, never mid-word', () => {
    const lines = wrapLines('Pipelined RISC-V CPU', 100, 600, measure);
    for (const line of lines) expect(line.trim()).toBe(line);
    expect(lines.join(' ')).toBe('Pipelined RISC-V CPU');
  });

  it('keeps a short title on one line', () => {
    expect(wrapLines('IntelliNote2', 100, 2000, measure)).toEqual(['IntelliNote2']);
  });

  it('returns nothing for empty input', () => {
    expect(wrapLines('   ', 100, 600, measure)).toEqual([]);
  });

  it('lets an unbreakable word overflow rather than truncating it', () => {
    // fitSign responds by shrinking. Dropping characters from a project's
    // name would be the wrong answer.
    const lines = wrapLines('Supercalifragilistic', 100, 50, measure);
    expect(lines).toEqual(['Supercalifragilistic']);
  });
});

describe('fitSign', () => {
  it('never exceeds the line budget', () => {
    for (const entry of entries) {
      const { lines } = fitSign(entry.title, measure);
      expect(lines.length, `"${entry.title}" wrapped to ${lines.length} lines`).toBeLessThanOrEqual(
        DEFAULT_FIT.maxLines,
      );
    }
  });

  it('fits every real title inside the sign', () => {
    for (const entry of entries) {
      const { lines, fontSize } = fitSign(entry.title, measure);
      const height = lines.length * fontSize * DEFAULT_FIT.lineHeight;
      expect(height, `"${entry.title}" is too tall`).toBeLessThanOrEqual(DEFAULT_FIT.maxHeight);
      for (const line of lines) {
        expect(measure(line, fontSize), `"${line}" is too wide`).toBeLessThanOrEqual(DEFAULT_FIT.maxWidth);
      }
    }
  });

  it('preserves every character of the title', () => {
    for (const entry of entries) {
      const { lines } = fitSign(entry.title, measure);
      expect(lines.join(' ')).toBe(entry.title.trim().replace(/\s+/g, ' '));
    }
  });

  it('gives a short title a bigger face than a long one', () => {
    const short = fitSign('AUC', measure);
    const long = fitSign('Agentic Development Pipelines & AI Tooling', measure);
    expect(short.fontSize).toBeGreaterThan(long.fontSize);
  });

  it('degrades to the floor size rather than rendering nothing', () => {
    const absurd = fitSign('X'.repeat(400), measure);
    expect(absurd.fontSize).toBe(DEFAULT_FIT.minFontSize);
    expect(absurd.lines.length).toBeGreaterThan(0);
  });

  it('handles an empty title without throwing', () => {
    expect(fitSign('', measure).lines).toEqual([]);
  });
});
