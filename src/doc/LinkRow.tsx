import type { Entry } from '@content/schema';

const LABELS: Record<keyof Entry['links'], string> = {
  repo: 'Source',
  demo: 'Live demo',
  video: 'Video walkthrough',
  writeup: 'Write-up',
};

export function LinkRow({ links }: { links: Entry['links'] }) {
  const present = (Object.keys(LABELS) as (keyof Entry['links'])[]).filter((k) => links[k]);
  if (present.length === 0) return null;

  return (
    <ul className="mt-5 flex flex-wrap gap-2">
      {present.map((key) => (
        <li key={key}>
          <a
            href={links[key]}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block rounded-md border border-line px-3 py-1.5 text-sm text-muted transition hover:border-accent hover:text-text"
          >
            {LABELS[key]} ↗
          </a>
        </li>
      ))}
    </ul>
  );
}
