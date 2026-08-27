import type { Entry } from '@content/schema';

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

/** '2026-03' -> 'Mar 2026'. '2026' -> '2026'. 'present' -> 'Present'. */
export function formatMonth(value: string): string {
  if (value === 'present') return 'Present';
  const [year, month] = value.split('-');
  // A bare year is deliberate, not missing data: it is written that way when
  // the month was never known. Do not dress it up with one.
  if (month === undefined) return year ?? value;
  const index = Number(month) - 1;
  return `${MONTHS[index] ?? month} ${year}`;
}

/** The year part of either form, for comparing a year against a year-month. */
function yearOf(value: string): string {
  return value.split('-')[0] ?? value;
}

export function formatRange(start: string, end?: string): string {
  if (!end) return formatMonth(start);
  if (end === start) return formatMonth(start);
  // '2023' with '2023-06' is one year, not a range across itself. Two bare
  // years that match collapse the same way "Jun 2024 – Jun 2024" always has.
  if (end !== 'present' && yearOf(start) === yearOf(end) && (!start.includes('-') || !end.includes('-'))) {
    return yearOf(start);
  }
  return `${formatMonth(start)} – ${formatMonth(end)}`;
}

/**
 * The date to show for an entry, or `null` when it shows none.
 *
 * `hideDate` suppresses display only. `start` still exists and still places the
 * entry in the world — see the schema. Every surface that shows a date goes
 * through here so that "no date" cannot mean "no date on three pages out of
 * four".
 */
export function entryDate(entry: Pick<Entry, 'start' | 'end' | 'hideDate'>): string | null {
  return entry.hideDate ? null : formatRange(entry.start, entry.end);
}
