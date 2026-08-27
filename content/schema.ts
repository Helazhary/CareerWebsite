import { z } from 'zod';

/** Districts are the off-ramps of the world map. `highway` holds jobs + education. */
export const DISTRICTS = ['garage', 'lab', 'agents', 'workshop', 'arcade', 'highway'] as const;

/** Visual skin applied to a plot. Purely presentational — never branch logic on this. */
export const SKINS = ['garage', 'lab', 'server-room', 'workshop', 'arcade', 'office', 'campus'] as const;

/**
 * A date as written in content: a whole year, or a year and a month.
 *
 * Bare years exist because most of these dates were reconstructed from a resume
 * that lists none for projects. "2024" is a thing Hussein can actually confirm;
 * "February 2024" was a guess wearing a month for precision it never had.
 */
const partialDate = z
  .string()
  .regex(/^\d{4}(-\d{2})?$/, 'expected YYYY or YYYY-MM, e.g. "2025" or "2025-07"');

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
  /**
   * Where this sits on the timeline. Always present, because the highway *is*
   * chronology and an off-ramp leaves the spine at the date its district began
   * — an entry with nothing here cannot be placed.
   */
  start: partialDate,
  end: z.union([partialDate, z.literal('present')]).optional(),
  /**
   * Show no date anywhere: not on the card, the panel, or the resume.
   *
   * For work whose date is genuinely not known rather than merely imprecise.
   * `start` still positions it in the world — it has to, or the district it
   * belongs to has nothing to hang its off-ramp on, and The Arcade would slide
   * from 2022 to the far end of the map for want of one number nobody sees.
   * A hidden `start` is layout, not content: it is never rendered, and nothing
   * claims it is true.
   */
  hideDate: z.boolean().default(false),
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
