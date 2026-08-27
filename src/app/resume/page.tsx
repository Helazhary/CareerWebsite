import type { Metadata } from 'next';
import Link from 'next/link';
import { jobs, education, projects } from '@content/registry';
import { skillGroups } from '@content/skills';
import { entryDate } from '@/lib/format';
import { site } from '@/lib/site';
import type { Entry } from '@content/schema';

export const metadata: Metadata = {
  title: 'Resume',
  description: site.pitch,
};

function Role({ entry }: { entry: Entry }) {
  const date = entryDate(entry);

  return (
    <article className="border-l border-line pl-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-medium">
          {entry.title}
          {entry.subtitle ? <span className="text-muted"> · {entry.subtitle}</span> : null}
        </h3>
        {date === null ? null : (
          <span className="font-mono text-xs text-muted">{date}</span>
        )}
      </div>
      <ul className="mt-2 space-y-1.5">
        {entry.bullets.map((bullet) => (
          <li key={bullet} className="flex gap-2.5 text-sm leading-relaxed text-muted">
            <span aria-hidden className="mt-2 h-1 w-1 shrink-0 rounded-full bg-accent" />
            <span>{bullet}</span>
          </li>
        ))}
      </ul>
    </article>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-4 text-sm font-medium uppercase tracking-widest text-muted">{title}</h2>
      <div className="space-y-6">{children}</div>
    </section>
  );
}

export default function ResumePage() {
  return (
    <div className="space-y-10">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{site.name}</h1>
        <p className="mt-1 text-accent">{site.role}</p>
        <p className="mt-3 max-w-2xl text-sm text-muted">{site.pitch}</p>
      </header>

      <Section title="Education">
        {education.map((entry) => (
          <Role key={entry.id} entry={entry} />
        ))}
      </Section>

      <Section title="Experience">
        {jobs.map((entry) => (
          <Role key={entry.id} entry={entry} />
        ))}
      </Section>

      <Section title="Skills">
        <dl className="space-y-3">
          {skillGroups.map((group) => (
            <div key={group.label} className="grid gap-1 sm:grid-cols-[10rem_1fr]">
              <dt className="text-sm font-medium">{group.label}</dt>
              <dd className="text-sm text-muted">{group.items.join(' · ')}</dd>
            </div>
          ))}
        </dl>
      </Section>

      <Section title="Projects">
        <ul className="space-y-2">
          {projects.map((entry) => (
            <li key={entry.id} className="grid gap-0.5 sm:grid-cols-[1fr_auto] sm:gap-4">
              <Link href={`/projects/${entry.id}`} className="text-sm hover:text-accent">
                <span className="font-medium">{entry.title}</span>
                <span className="text-muted"> — {entry.summary}</span>
              </Link>
              {entryDate(entry) === null ? null : (
                <span className="font-mono text-xs text-muted">{entryDate(entry)}</span>
              )}
            </li>
          ))}
        </ul>
      </Section>
    </div>
  );
}
