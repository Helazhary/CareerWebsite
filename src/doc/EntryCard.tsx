import Link from 'next/link';
import type { Entry } from '@content/schema';
import { formatRange } from '@/lib/format';
import { DISTRICT_LABELS } from '@/lib/site';
import { StatusBadge } from './StatusBadge';
import { Tags } from './Tags';

export function EntryCard({ entry }: { entry: Entry }) {
  return (
    <article className="rounded-lg border border-line bg-surface p-4 transition hover:border-accent/50">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="font-medium">
          <Link href={`/projects/${entry.id}`} className="hover:text-accent">
            {entry.title}
          </Link>
          {entry.subtitle ? <span className="text-muted"> · {entry.subtitle}</span> : null}
        </h3>
        <span className="shrink-0 font-mono text-xs text-muted">
          {formatRange(entry.start, entry.end)}
        </span>
      </div>

      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted">
        <span>{DISTRICT_LABELS[entry.district]}</span>
        <StatusBadge status={entry.status} />
      </div>

      <p className="mt-2 text-sm text-muted">{entry.summary}</p>

      <div className="mt-3">
        <Tags items={entry.tags} />
      </div>
    </article>
  );
}
