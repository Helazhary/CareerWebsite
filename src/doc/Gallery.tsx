import Image from 'next/image';
import type { Entry } from '@content/schema';

export function Gallery({ entry }: { entry: Entry }) {
  if (entry.media.length === 0) return null;

  return (
    <ul className="mt-6 grid gap-4 sm:grid-cols-2">
      {entry.media.map((item) => (
        <li key={item.src}>
          <div className="relative aspect-[4/3] overflow-hidden rounded-md border border-line bg-surface">
            <Image
              src={`/media/${entry.id}/${item.src}`}
              alt={item.alt}
              fill
              sizes="(max-width: 640px) 100vw, 50vw"
              className="object-cover"
            />
          </div>
          {item.caption ? (
            <p className="mt-1.5 text-xs text-muted">{item.caption}</p>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
