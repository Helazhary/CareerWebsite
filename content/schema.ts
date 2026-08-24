import { z } from 'zod';

/** Districts are the off-ramps of the world map. `highway` holds jobs + education. */
export const DISTRICTS = ['garage', 'lab', 'agents', 'workshop', 'arcade', 'highway'] as const;

/** Visual skin applied to a plot. Purely presentational — never branch logic on this. */
export const SKINS = ['garage', 'lab', 'server-room', 'workshop', 'arcade', 'office', 'campus'] as const;

const yearMonth = z
  .string()
  .regex(/^\d{4}-\d{2}$/, 'expected YYYY-MM, e.g. "2025-07"');

export const mediaSchema = z.object({
  /** Filename only. Resolved against /public/media/<entry id>/ */
  src: z.string().min(1),
  /** Required, and required to be meaningful. Accessibility is not optional here. */
  alt: z.string().min(4, 'alt text must actually describe the image'),
  caption: z.string().optional(),
});

export const linksSchema = z.object({
  repo: z.url().optional(),
  demo: z.url().optional(),
  video: z.url().optional(),
  writeup: z.url().optional(),
});

export const entrySchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/, 'lowercase kebab-case only'),
  kind: z.enum(['project', 'job', 'education']),
  title: z.string().min(1),
  /** Company or institution. */
  subtitle: z.string().optional(),
  start: yearMonth,
  end: z.union([yearMonth, z.literal('present')]).optional(),
  district: z.enum(DISTRICTS),
  /** 'in-progress' renders the plot as a construction site. */
  status: z.enum(['shipped', 'in-progress', 'archived']).default('shipped'),
  skin: z.enum(SKINS),
  size: z.enum(['sm', 'md', 'lg']).default('md'),
  tags: z.array(z.string().min(1)).min(1),
  /** One line. Panel headline and doc-mode card subtitle. */
  summary: z.string().min(1).max(200),
  /** The whole body of a project. Three to five is the sweet spot. */
  bullets: z.array(z.string().min(1)).min(1).max(8),
  media: z.array(mediaSchema).default([]),
  links: linksSchema.default({}),
  /**
   * Put this entry on a short bridge off the highway rather than on the spine.
   *
   * For time spent somewhere other than the main thread of a career — an
   * exchange semester, a secondment — where the detour says something a bullet
   * point cannot. Only meaningful for `highway` entries.
   */
  detour: z.boolean().default(false),
  /** Ids of ambient props to place around the plot, e.g. 'walking-robot'. */
  ambient: z.array(z.string()).default([]),
  /** Id of a registered interactive demo component. Reserved for M5. */
  showpiece: z.string().optional(),
  featured: z.boolean().default(false),
});

/** Validated, defaults applied. What the app consumes. */
export type Entry = z.infer<typeof entrySchema>;
/** What you write in content/entries/*.ts. Defaults optional. */
export type EntryInput = z.input<typeof entrySchema>;
export type Media = z.infer<typeof mediaSchema>;
export type District = (typeof DISTRICTS)[number];
