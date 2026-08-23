import type { Entry } from '@content/schema';

export function StatusBadge({ status }: { status: Entry['status'] }) {
  if (status === 'shipped') return null;
  const label = status === 'in-progress' ? 'In progress' : 'Archived';
  return (
    <span className="rounded border border-warn/40 px-1.5 py-0.5 text-[11px] text-warn">
      {label}
    </span>
  );
}
