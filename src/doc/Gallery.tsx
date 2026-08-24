import Image from 'next/image';
import type { Entry } from '@content/schema';
import { previewMedia } from '@/preview/placeholders';

export function Gallery({ entry }: { entry: Entry }) {
  const items = previewMedia(entry);
  if (items.length === 0) return null;

  return (
    <ul className="mt-6 grid gap-4 sm:grid-cols-2">
      {items.map((item) => (
        <li key={item.src}>
          <div className="relative aspect-[4/3] overflow-hidden rounded-md border border-line bg-surface">
            <Image
              src={item.src}
              alt={item.alt}
              fill
              sizes="(max-width: 640px) 100vw, 50vw"
              className="object-cover"
              // Placeholders are inline SVG data URIs, which the optimiser has
              // nothing useful to do with.
              unoptimized={item.placeholder}
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
