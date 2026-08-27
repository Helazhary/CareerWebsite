# CareerWebsite

Interactive career map for helazhary.com. A low-poly BMW E36 drives through a
stylized world where every building is a job, a degree, or a project. One click
escapes to a plain resume for anyone in a hurry.

Full design spec: `docs/DESIGN.md` (read it before architectural work; do not
load it for routine content edits).
Contributor guide: `HOWTO.md`.

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server on :3000 |
| `npm run dev:preview` | Dev server with placeholder media for entries that have no photos. Never affects a real build. |
| `npm run check` | typecheck + lint + test. Run before every commit. |
| `npm run build` | Static export into `out/` |
| `npm run new:project` | Scaffold a new content entry |
| `npm run content:sync` | Regenerate `content/entries/index.ts` |

## Hard rules

1. **Content is data.** Everything a viewer reads lives in `content/entries/*.ts`
   and is validated by `content/schema.ts`. Never hardcode a project's title,
   date, or copy into a component.
2. **No project-specific code in `src/world/`.** If a project needs something
   bespoke it registers a set piece or a showpiece into a registry. The renderer
   never learns the name of a project.
3. **Doc mode is the load-bearing mode.** It must work with no WebGL and render
   readable content without client-side JS. The 3D bundle is code-split and never
   enters the doc-mode bundle. Verify against `out/`, not by reasoning: no chunk
   referenced by `index.html` may contain `WebGLRenderer`.
4. **The pure layer stays pure.** `graph.ts`, `layout.ts`, `drive.ts`,
   `scatter.ts` and `signText.ts` have no Three.js, React or DOM imports. They
   are plain functions with unit tests, and every geometric invariant lives
   there — buildings never overlap, nothing grows in the road, the car can never
   leave the graph.
5. **Never invent content.** No dates, links, metrics or specifications that
   Hussein did not supply, not even as filler. Preview mode exists for that;
   see below. **Dates were confirmed entry by entry on 2026-08-27 and are
   closed** — never re-estimate one, and never add a month to an entry that
   carries only a year. That guess is exactly what the exercise removed.

## Conventions

- TypeScript strict. No `any`, no non-null assertions in app code.
- Entry ids are kebab-case and permanent — they are public URLs (`/projects/<id>`).
- Adding an entry file requires running `npm run content:sync`; CI fails if the
  generated index is stale.
- Images live in `public/media/<entry id>/` and are referenced by filename only.
- Alt text is required by the schema. Write a real description, not the title.
- Dates are `YYYY` or `YYYY-MM`. A bare year is a deliberate statement that the
  month is not known; it lands on that year's January for placement only.
- `start` is required on every entry even when nothing is shown, because the
  highway *is* chronology and an off-ramp is placed by the date its district
  began. `hideDate: true` suppresses display and nothing else.
- Every surface that shows a date goes through `entryDate()` in
  `src/lib/format.ts`, so "no date" cannot come to mean "no date on three pages
  out of four".

## Start here

`docs/HANDOFF.md` carries the live state: what is deployed, what is next, what
is waiting on Hussein, and the traps in verifying any of it in a browser. Read
it before picking anything up. `.claude/rules/world.md` is required reading
before touching `src/world/`.

## Current state

**Everything built is deployed and live on helazhary.com.** M4 (the real car
`.glb`) and M5 (a showpiece) remain, and **M4 is blocked**: there is no model in
the repo and it needs a decision from Hussein before anyone starts it.

- **M0** — content pipeline, doc mode, CI, hosting.
- **M1** — the world: road graph, plot layout, spline driving, junctions,
  chase camera, minimap, capability probe.
- **M2** — skin registry, canvas signs, construction sites, dusk lighting, and
  the car (paint sampled from Hussein's photographs, angel eye rings).
- **M2.5** — the environment. Added mid-build: the spec detailed plots and roads
  and nothing between them, so the world read as grey cubes on an empty plane.
  Scenery scatter, road markings, verges, street lamps, building massing.
- **M3** — project panels, `/p/<id>` deep links, the Montreal detour (a `detour`
  schema flag, not a special case), and the road running on into fog.
- **Since M3** — the garage you start inside, the intro overlay, the About
  panel, drag-to-look; a directional sunset with the pyramids silhouetted
  against it; tail lights on the car; the ambient prop kit; navigation anchors
  derived from where buildings actually landed; side roads that taper out of a
  junction instead of stitching against the spine; and dates confirmed by
  Hussein, including year-only and hidden ones.

See `docs/DESIGN.md` §9 for the full plan.

## How the world is put together

```
src/world/
  graph.ts        pure  entries -> junctions, spline edges, plot anchors
  layout.ts       pure  anchors -> building transforms, guaranteed not to overlap
  drive.ts        pure  the car's state machine; junction choice is the only input
  scatter.ts      pure  where trees, rocks and lamps stand
  signText.ts     pure  how a title is wrapped and sized to fit a sign
  skins/          the kit: one skin per schema `skin` value, plus shared parts
  skins/ambient   one prop per schema `ambient` id; unknown ids ignored
  *.tsx           the React Three Fiber layer
src/ui/           HUD and minimap — DOM over the canvas, not drawn into it
src/preview/      dev-only placeholder media. Dead code in a real build.
```

**Adding visual variety means registering a set piece in the kit**, never
extending a switch statement in `Plot.tsx`. A skin answers to a `skin` value, an
ambient prop to an id in an entry's `ambient` array; neither ever learns a
project's name.

## Preview mode

`npm run dev:preview` fills entries that have no photographs with visibly
labelled placeholder cards, so the site can be judged as a finished thing before
the real media exists.

It is gated on `NEXT_PUBLIC_PREVIEW`, unset in every real build, so the
placeholder path is eliminated as dead code. A test asserts it is off by
default. **Do not** work around this by putting fake content in
`content/entries/` — that ships.

## Things learned the hard way

Kept because they cost real time and are invisible in the code.

- **Splines must be arc-length parameterised.** Clamping endpoint control points
  instead of reflecting them makes `u=0.25` sit at 20% along, so the car changes
  speed mid-edge for no reason.
- **Ribbon geometry winding is load-bearing.** Reverse a vertex pair and the
  normals point at the ground: the mesh renders perfectly and is invisible from
  above.
- **Test final positions, not intermediate data.** The highway once rendered out
  of chronological order while the anchors it came from were correct, and the
  test asserting on anchors passed straight through the bug.
- **Anything spaced with `floor(length / spacing)` skips short segments
  entirely.** Street lamps missed exactly the stretches next to junctions.
- **Lint rules about render-time mutation are right.** Components created during
  render remount; effects that setState synchronously cascade. Use
  `useSyncExternalStore` for probes, and mutate input buffers in the module that
  owns them.
- **A junction is not a point.** A side road runs alongside the spine for about
  fifty units before there is room for both to have kerbs and verges. Drawing
  them coplanar over that stretch is z-fighting, and it looked like a stitched
  white slab at every off-ramp.
- **A field nothing reads fails silently and forever.** `ambient` sat in the
  schema for four milestones, populated by every entry, with no renderer looking
  at it. If a schema field is optional at runtime, a test has to assert that
  content and code have actually met.
- **Negative-check every new test.** Break the thing it guards and confirm it
  fails naming the right thing. A test written after the fix can pass
  vacuously and prove nothing.
- **Verifying in a browser has traps specific to this site.** Key handlers
  dispatch on `event.code`, and one tool sends events without it. See
  `docs/HANDOFF.md` §2 before trying to drive the car in a test.
