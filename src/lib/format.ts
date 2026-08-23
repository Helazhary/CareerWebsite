const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

/** '2026-03' -> 'Mar 2026'. 'present' -> 'Present'. */
export function formatMonth(value: string): string {
  if (value === 'present') return 'Present';
  const [year, month] = value.split('-');
  const index = Number(month) - 1;
  return `${MONTHS[index] ?? month} ${year}`;
}

export function formatRange(start: string, end?: string): string {
  if (!end) return formatMonth(start);
  if (end === start) return formatMonth(start);
  return `${formatMonth(start)} – ${formatMonth(end)}`;
}
