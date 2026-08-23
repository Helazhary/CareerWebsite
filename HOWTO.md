# How to work on this site

A practical guide for the person who owns this repo. No frontend expertise assumed.

---

## 1. The mental model

There are exactly two kinds of thing in this project:

- **Content** — everything a visitor reads. Lives in `content/`. Plain TypeScript
  objects. You will edit this constantly.
- **Engine** — everything that renders content. Lives in `src/`. You will edit
  this rarely, and mostly with Claude's help.

If you find yourself typing a project's name inside `src/`, something has gone
wrong. Content never belongs in the engine.

```
content/
  schema.ts          the contract — what fields an entry may have
  registry.ts        loads + validates every entry at build time
  skills.ts          the skills table on the resume page
  entries/
    qortova.ts       one file per job, degree, or project
    project-car.ts
    index.ts         GENERATED — never edit by hand
public/media/
  project-car/       images for that entry, referenced by filename
```

---

## 2. The daily loop

```bash
npm run dev
```

Opens http://localhost:3000. Edits appear immediately.

```bash
npm run check
```

Typecheck, lint, and tests in one go. **Run this before every commit.** CI runs
the same thing, so if it passes locally it passes in CI.

```bash
npm run build
```

Produces the real static site in `out/`. Rarely needed by hand — Cloudflare runs
it on every push.

---

## 3. Add a project

### The guided way

```bash
npm run new:project
```

It asks for the title, id, district, dates, tags, summary, and bullets, then:

- writes `content/entries/<id>.ts`
- creates `public/media/<id>/`
- regenerates `content/entries/index.ts`

Then run `npm run check` and look at http://localhost:3000/projects.

### The manual way

Copy an existing file in `content/entries/`, change the fields, and run:

```bash
npm run content:sync
```

That regenerates the index. Skipping it means your entry silently does not appear —
and CI will fail with "content index is in sync" to catch it.

### What each field means

| Field | Notes |
| --- | --- |
| `id` | kebab-case, **permanent** — it is the public URL `/projects/<id>` |
| `kind` | `project`, `job`, or `education` |
| `title` | Shown on the card, the page, and the building's sign |
| `subtitle` | Company or institution. Optional. |
| `start` / `end` | `YYYY-MM`. Use `'present'` for a current role. Omit `end` for ongoing personal work. |
| `district` | Which off-ramp it lives on: `garage`, `lab`, `agents`, `workshop`, `arcade`, or `highway` for jobs and degrees |
| `status` | `shipped`, `in-progress` (renders as a construction site), or `archived` |
| `skin` | The building's look. Usually matches the district. |
| `size` | `sm`, `md`, `lg` — how big the building is |
| `tags` | Tech used. Drives filtering. |
| `summary` | One line, under 200 chars. Also the page's meta description. |
| `bullets` | The whole body. Three to five. Concrete things built or measured. |
| `media` | Images. See below. |
| `links` | `repo`, `demo`, `video`, `writeup` — all optional |
| `featured` | Pins it to the landing page |

---

## 4. Add photos

1. Drop the files into `public/media/<entry id>/`.
2. List them in the entry's `media` array:

```ts
media: [
  { src: 'engine-bay.jpg', alt: 'The rebuilt M52 engine bay with new intake manifold' },
  { src: 'head-unit.jpg', alt: 'Android head unit running the voice assistant', caption: 'The assistant mid-response' },
],
```

`src` is the **filename only** — the folder is inferred from the entry id.

`alt` is required and the schema rejects anything under four characters. Describe
what is in the image, not what the project is called. Screen readers and search
engines both read it.

Keep images under ~300 KB each. Resize to about 1600px wide before committing —
a 6 MB phone photo will make the page slow for no visible benefit.

---

## 5. Edit, rename, or remove

**Edit** — open the file in `content/entries/`, change it, save. Done.

**Rename an id** — avoid this. The id is a live URL; changing it breaks any link
you already put in a job application. If you must, change the filename and the
`id` field together, then run `npm run content:sync`.

**Remove** — delete the file, delete its media folder, run `npm run content:sync`.

---

## 6. Change how it looks

**Colours** live in `src/app/globals.css` under `@theme`:

```css
@theme {
  --color-ink: #0b0d11;      /* page background */
  --color-surface: #14171e;  /* cards */
  --color-line: #242a36;     /* borders */
  --color-text: #e7eaf0;     /* body text */
  --color-muted: #8e97a8;    /* secondary text */
  --color-accent: #4c8dff;   /* links, buttons, highlights */
  --color-warn: #d9a441;     /* "in progress" badges */
}
```

Change a hex value and the whole site follows. This is the single place colour is
defined — nothing hardcodes a colour anywhere else.

**Your name, role, pitch, and links** live in `src/lib/site.ts`.

**The skills table** lives in `content/skills.ts`.

**Page layout** lives in `src/app/*/page.tsx` and the components in `src/doc/`.
This is the part worth asking Claude to change rather than hand-editing.

---

## 7. Deploy

Push to `main`. That is the whole process.

```bash
git add -A
git commit -m "Add NIR spectroscopy photos"
git push
```

Cloudflare Pages sees the commit, runs `npm run build`, and publishes `out/` to
helazhary.com. Takes about a minute. Pull requests get their own preview URL, so
you can look at a change before it goes live.

Setup steps, if it is not connected yet: `docs/CLOUDFLARE.md`.

---

## 8. Working with Claude on this repo

`CLAUDE.md` loads automatically every session and carries the architectural rules,
so you do not need to re-explain the project. `docs/DESIGN.md` has the full plan.

**Prompts that work well:**

> Add my NIR spectroscopy photos from ~/Pictures/nir/ to that project, resized and with proper alt text.

> The project cards feel cramped on mobile. Widen the spacing and check it at 375px.

> Change the accent colour to something closer to my car's blue, and show me both versions.

> Read docs/DESIGN.md §9 and start M1.

**Things worth saying:**

- *"Run `npm run check` when you're done"* — it will anyway, but saying it makes
  the pass/fail explicit in the transcript.
- *"Show me the page"* — Claude can start the dev server and look at the rendered
  result rather than guessing from the code.
- *"Don't touch the schema for this"* — keeps a small change small.

**Things to be wary of:**

- Asking for a big feature and a big refactor in one message. Split them.
- Letting a session run for hours. Start a fresh one per milestone; `CLAUDE.md`
  and `docs/DESIGN.md` carry the context forward better than a long transcript.
- Accepting content you did not verify. Claude wrote the first draft of your entry
  bullets from your resume — **read them before they go public.**

---

## 9. When something breaks

**`Invalid content entry "foo": ...`**
Your entry does not match the schema. The message names the field and the reason.
This is by design — it fails the build instead of shipping a broken page.

**A new project does not appear**
You did not run `npm run content:sync`.

**`npm run check` fails on lint after an edit**
Run `npx eslint . --fix` first; most issues are auto-fixable.

**The build works locally but Cloudflare fails**
Check the Cloudflare build log. Usually the Node version — it must be 22, set via
the `NODE_VERSION` environment variable in the Pages project settings.

**An image 404s**
The filename in `media[].src` must match the file in `public/media/<entry id>/`
exactly, including case. `Photo.JPG` and `photo.jpg` are different files on Linux.
