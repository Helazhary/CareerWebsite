import Link from 'next/link';
import { site } from '@/lib/site';
import { entries, projects } from '@content/registry';
import { EntryCard } from '@/doc/EntryCard';

export default function HomePage() {
  const featured = entries.filter((e) => e.featured);
  const recentProjects = projects.slice(0, 4);

  return (
    <div className="space-y-12">
      <section>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{site.name}</h1>
        <p className="mt-1 text-accent">{site.role}</p>
        <p className="mt-4 max-w-2xl text-muted">{site.pitch}</p>

        <div className="mt-6 flex flex-wrap gap-2">
          <Link
            href="/resume"
            className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-ink transition hover:opacity-90"
          >
            View resume
          </Link>
          <Link
            href="/projects"
            className="rounded-md border border-line px-4 py-2 text-sm text-muted transition hover:border-accent hover:text-text"
          >
            All projects
          </Link>
        </div>
      </section>

      {featured.length > 0 && (
        <section>
          <h2 className="mb-4 text-sm font-medium uppercase tracking-widest text-muted">
            Featured
          </h2>
          <div className="grid gap-3">
            {featured.map((entry) => (
              <EntryCard key={entry.id} entry={entry} />
            ))}
          </div>
        </section>
      )}

      <section>
        <div className="mb-4 flex items-baseline justify-between">
          <h2 className="text-sm font-medium uppercase tracking-widest text-muted">
            Recent projects
          </h2>
          <Link href="/projects" className="text-sm text-muted hover:text-accent">
            See all {projects.length} →
          </Link>
        </div>
        <div className="grid gap-3">
          {recentProjects.map((entry) => (
            <EntryCard key={entry.id} entry={entry} />
          ))}
        </div>
      </section>
    </div>
  );
}
