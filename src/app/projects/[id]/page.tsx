import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { entries, getEntry } from '@content/registry';
import { entryDate } from '@/lib/format';
import { DISTRICT_LABELS } from '@/lib/site';
import { StatusBadge } from '@/doc/StatusBadge';
import { Tags } from '@/doc/Tags';
import { Gallery } from '@/doc/Gallery';
import { LinkRow } from '@/doc/LinkRow';

type Params = { id: string };

export function generateStaticParams(): Params[] {
  return entries.map((entry) => ({ id: entry.id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { id } = await params;
  const entry = getEntry(id);
  if (!entry) return {};
  return { title: entry.title, description: entry.summary };
}

export default async function EntryPage({ params }: { params: Promise<Params> }) {
  const { id } = await params;
  const entry = getEntry(id);
  if (!entry) notFound();
  const date = entryDate(entry);

  return (
    <article>
      <Link href="/projects" className="text-sm text-muted hover:text-accent">
        ← All projects
      </Link>

      <header className="mt-4">
        <h1 className="text-2xl font-semibold tracking-tight">{entry.title}</h1>
        {entry.subtitle ? <p className="mt-1 text-accent">{entry.subtitle}</p> : null}

        <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-muted">
          {date === null ? null : <span className="font-mono text-xs">{date}</span>}
          <span>{DISTRICT_LABELS[entry.district]}</span>
          <StatusBadge status={entry.status} />
        </div>

        <p className="mt-4 text-muted">{entry.summary}</p>
      </header>

      <ul className="mt-6 space-y-2.5">
        {entry.bullets.map((bullet) => (
          <li key={bullet} className="flex gap-3 text-sm leading-relaxed">
            <span aria-hidden className="mt-2 h-1 w-1 shrink-0 rounded-full bg-accent" />
            <span>{bullet}</span>
          </li>
        ))}
      </ul>

      <LinkRow links={entry.links} />
      <Gallery entry={entry} />

      <div className="mt-8 border-t border-line pt-5">
        <Tags items={entry.tags} />
      </div>
    </article>
  );
}
