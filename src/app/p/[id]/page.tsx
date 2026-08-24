import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { entries, getEntry } from '@content/registry';
import { site } from '@/lib/site';
import { DeepLink } from '@/world/DeepLink';

/**
 * Deep link into the world: `/p/<id>` opens drive mode at that building with
 * its panel up, and falls back to the project's document when the world cannot
 * run (DESIGN.md §3.2).
 *
 * This is the site earning its keep — pasting helazhary.com/p/nir-spectroscopy
 * into an application. Which means it has to work as a static file with no
 * server, and it has to work with JavaScript switched off.
 */
export function generateStaticParams(): { id: string }[] {
  return entries.map((entry) => ({ id: entry.id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const entry = getEntry(id);
  if (entry === undefined) return {};
  return {
    title: entry.title,
    description: entry.summary,
    alternates: { canonical: `${site.url}/projects/${entry.id}/` },
    openGraph: { title: entry.title, description: entry.summary, type: 'article' },
  };
}

export default async function DeepLinkPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const entry = getEntry(id);
  if (entry === undefined) notFound();

  return (
    <div className="mx-auto max-w-2xl py-16 text-center">
      {/* Server-rendered, so this is what a crawler and a JS-less visitor get.
          The world replaces it client-side when it can run. */}
      <h1 className="text-2xl font-semibold tracking-tight">{entry.title}</h1>
      <p className="mt-3 text-muted">{entry.summary}</p>
      <p className="mt-6 text-sm text-muted">
        Opening this in the world…{' '}
        <a href={`/projects/${entry.id}/`} className="text-accent underline">
          read it as a page instead
        </a>
      </p>
      <DeepLink entryId={entry.id} />
    </div>
  );
}
