import type { Metadata } from 'next';
import { projects } from '@content/registry';
import { DISTRICT_LABELS } from '@/lib/site';
import { EntryCard } from '@/doc/EntryCard';
import type { District } from '@content/schema';

export const metadata: Metadata = {
  title: 'Projects',
  description: 'Personal and academic projects across AI/ML, agentic tooling, robotics, and embedded systems.',
};

const ORDER: District[] = ['garage', 'lab', 'agents', 'workshop', 'arcade'];

export default function ProjectsPage() {
  const grouped = ORDER.map((district) => ({
    district,
    items: projects.filter((p) => p.district === district),
  })).filter((group) => group.items.length > 0);

  return (
    <div className="space-y-10">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Projects</h1>
        <p className="mt-2 text-muted">
          {projects.length} projects, grouped by the district they live in on the map.
        </p>
      </header>

      {grouped.map(({ district, items }) => (
        <section key={district}>
          <h2 className="mb-4 text-sm font-medium uppercase tracking-widest text-muted">
            {DISTRICT_LABELS[district]}
          </h2>
          <div className="grid gap-3">
            {items.map((entry) => (
              <EntryCard key={entry.id} entry={entry} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
