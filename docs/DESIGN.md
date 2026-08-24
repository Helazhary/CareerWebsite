# helazhary.com — Design Specification

> An interactive career map. Drive a low-poly BMW E36 through a small stylized
> world where every building is a job, a degree, or a project.
> One click escapes to a plain resume for anyone in a hurry.

Status: **M0 built and deployed. M1 (the 3D world) not started.**
Owner: Hussein Elazhary
Domain: helazhary.com (Cloudflare)

---

## 1. Goals & non-goals

**Goals**
1. Make a hiring manager remember the site five minutes after closing it.
2. Serve a 90-second reader as well as a 10-minute explorer, from one content source.
3. Adding a project = one content file + a media folder. No engine changes, ever.
4. The repository itself is a portfolio piece: typed, tested, CI-gated, statically served.

**Non-goals**
- A driving game. There is no physics, no lap time, no score.
- Free-roam exploration. The viewer can never get lost or stuck.
- Photorealism. The world is deliberately low-poly and stylized.
- A CMS, a backend, or user accounts.

**The anti-annoyance contract** (treat these as acceptance criteria)
- Name and title are on screen before any heavy asset loads.
- `Resume` and `Projects` buttons are visible in the first frame, always.
- No forced tutorial. No audio by default. No loading gate.
- Any building is reachable in under ~4 seconds of held input, or 1 click on the minimap.
- Every project is independently linkable and readable without WebGL.

---

## 2. World model

### 2.1 Roads are a graph, not a line

The world is a **road graph**: nodes are junctions, edges are Catmull-Rom splines.
The car is constrained to the spline — it does not steer. Holding forward advances
`t` along the current edge; releasing coasts to a stop with easing.

At a junction, a HUD prompt appears (`◀ The Lab │ Highway ▶`) and the viewer
picks a branch. This gives genuine branching exploration while making it
structurally impossible to drive off the road, clip a curb, or reach empty space.

Controls: `←/→` or `A/D`, or two large thumb zones on touch. `Esc` closes any panel.
`M` opens the minimap. `Tab` cycles focusable plots for keyboard-only navigation.

### 2.2 Camera

Elevated three-quarter chase camera, fixed pitch, fixed distance, damped follow.
Reads as 2.5D. No user camera control — one less thing to get wrong, and it
guarantees every scene is framed the way it was designed.

### 2.3 The map

```
                ┌─ THE LAB ─────────────┐          ┌─ AGENT ALLEY ────────────┐
                │ [Transformer vs CNN]  │          │ [MCP Dev Pipelines]      │
                │ [NIR Spectroscopy] 🚧 │          │ [Telegram Bot]           │
                │ [Chess Digitization]  │          │ [IntelliNote2]           │
                └───────────┬───────────┘          └────────────┬─────────────┘
                            │              ╭─ Montreal ─╮       │
  ╔═══════╗ ╔═══════╗ ╔═════╧═╗            │ Concordia  │   ╔═══╧═══╗ ╔════════╗
  ║GARAGE ║ ║  AUC  ║ ║DARWINZ║            ╰─────┬──────╯   ║BRIGHT-║ ║DARWINZ ║
  ║ start ║ ║CAMPUS ║ ║  '22  ║                  │          ║SKIES  ║ ║  '25   ║
 ═╩═══════╩═╩═══════╩═╩═══════╩══════════════════╧══════════╩═══════╩═╩════════╩═══▶
       ▲                  M A I N   H I G H W A Y   ( 2021 → now )                fog
    spawn                                                                    "still driving"
 ══════════════════════════════════╤════════════════════════╤═══════════════════════
              ╔═══════════╗ ╔══════╧════════════╗           │
              ║GRADUATION ║ ║     QORTOVA       ║   ┌───────┴────────────┐
              ║  Feb 2026 ║ ║  (largest bldg)   ║   │ THE WORKSHOP       │
              ╚═══════════╝ ╚═══════════════════╝   │ [Robot arms]       │
                                                    │ [Pan-tilt turret]  │
                                                    │ [Door lock / ESP32]│
                                                    │ [RISC-V bench]     │
                                                    └─ THE ARCADE ───────┘
                                                       [Android apps]
                                                       [Unity / Godot games]
```

**The highway is chronology.** Education and employment sit on it in date order,
so driving straight through reads exactly like the resume.
**Off-ramps are domains.** Personal projects group by field in cul-de-sac districts.

Narrative beats worth preserving:
- The world **starts in the garage**, with the real car. You drive out of your own
  garage into your career.
- The **Montreal detour** is a short bridge off the highway with snow — the
  Concordia exchange semester, told visually instead of as a bullet.
- **Darwinz appears twice** (2022 and 2025). Same building, second visit, sign
  reads "welcome back." It communicates a rehire without claiming anything.
- **Qortova is the largest structure**, and the road continues past it into fog.
  The closing CTA is "still driving," not "get in touch."

### 2.4 Districts

| District id | Look | Contents |
|---|---|---|
| `garage` | Roll-up door, lift, tools, real E36 photos on the wall | Project Car w/ AI head unit |
| `lab` | Clean white research block, screens with loss curves | Transformer–CNN study, NIR Spectroscopy API, Chess Digitization |
| `agents` | Dim server room, green terminal glow, cable trays | MCP dev pipelines, Telegram bot, IntelliNote2 |
| `workshop` | Corrugated units, roll-up doors | Robot arms, pan-tilt turret, door lock / ESP32, RISC-V bench |
| `arcade` | A short neon alley, 3–4 cabinets | Android apps, Unity / Godot games — screenshots + outbound links only |
| `highway` | Offices and campus halls | Jobs and education |

### 2.5 Plots: one primitive, many skins

Every building is the same `<Plot>` component:

```
<Plot footprint size skin signText status ambient onEnter />
```

The **sign text is rendered to a canvas texture at runtime** from the content
title. Adding a project produces a readable, correctly-signed building with zero
art work. This is the single mechanism that makes the site modular.

`status: 'in-progress'` renders the plot as a **construction site** — scaffolding,
crane, "coming soon" sign. Projects can go on the map before they are finished;
flipping one field completes them.

### 2.6 The car

Two-stage plan, so asset work never blocks the build:

1. **Now** — a blocky low-poly E36 assembled from primitives in code. Correct
   proportions, kidney-grille silhouette, paint colour sampled from the real photos.
2. **Later** — drop in a `.glb` behind the same `<Car/>` component. One-line swap.

The real photos live inside the garage as the automotive project's gallery.

---

## 3. Two audiences, one content source

### 3.1 Modes

**Drive mode** — the world.
**Fast Track (doc mode)** — plain HTML/CSS. No WebGL. Prints correctly.
Screen-reader clean. Sub-second load. Same content objects.

Auto-select doc mode on: mobile, `prefers-reduced-motion`, no WebGL,
or a failed capability probe. Serve it silently as the good version — never as an
apology or a "your browser is not supported" message.

### 3.2 Routes

| Route | Drive mode | Doc mode |
|---|---|---|
| `/` | World, car at the garage | Landing + summary |
| `/p/<id>` | Camera at that plot, panel open | Redirects to `/projects/<id>` |
| `/resume` | — | Full resume |
| `/projects` | — | All project cards, filterable by district/tag |
| `/projects/<id>` | — | Single project |

Deep links matter practically: pasting `helazhary.com/p/nir-spectroscopy` into an
application is the site earning its keep.

### 3.3 Contact

GitHub, LinkedIn, and email only. Email obfuscated against scrapers.
**Phone number stays off the public site** — it ships in the PDF sent directly to
employers. This keeps the site 100% static with no stateful surface.

---

## 4. Content schema

Content is typed data validated by Zod at build time. A malformed entry **fails
the build with a precise error** rather than producing a broken page.

```ts
// content/schema.ts
import { z } from 'zod';

export const Media = z.object({
  src: z.string(),                    // relative to /public/media/<id>/
  alt: z.string().min(4),             // accessibility is enforced, not optional
  caption: z.string().optional(),
});

export const Links = z.object({
  repo: z.string().url().optional(),
  demo: z.string().url().optional(),
  video: z.string().url().optional(), // e.g. unlisted YouTube walkthrough
  writeup: z.string().url().optional(),
});

export const Entry = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  kind: z.enum(['project', 'job', 'education']),
  title: z.string(),
  subtitle: z.string().optional(),               // company or institution
  start: z.string().regex(/^\d{4}-\d{2}$/),
  end: z.union([z.string().regex(/^\d{4}-\d{2}$/), z.literal('present')]).optional(),
  district: z.enum(['garage','lab','agents','workshop','arcade','highway']),
  status: z.enum(['shipped','in-progress','archived']).default('shipped'),
  skin: z.enum(['garage','lab','server-room','workshop','arcade','office','campus']),
  size: z.enum(['sm','md','lg']).default('md'),
  tags: z.array(z.string()).min(1),
  summary: z.string().max(200),                  // panel headline + doc card
  bullets: z.array(z.string()).min(1).max(8),    // the whole body: 3-5 bullets
  media: z.array(Media).default([]),
  links: Links.default({}),
  ambient: z.array(z.string()).default([]),      // prop ids, e.g. 'walking-robot'
  showpiece: z.string().optional(),              // registered interactive component id
  featured: z.boolean().default(false),
});
```

**Content weight (decided).** Entries are deliberately light: a title, three to
five bullets, and one or two images. `body` is short markdown, not an essay.
Only the Transformer–CNN study carries a `video` link (unlisted YouTube), and it
renders as a plain outbound link — no embedded player, and the local HTML site is
not hosted. This keeps each project to roughly one sitting.

Adding a project:

```
npm run new:project
```

scaffolds `content/entries/<id>.ts` and `public/media/<id>/`. Fill in the blanks.
The building appears on the next build.

---

## 5. Architecture

```
├── content/
│   ├── schema.ts            # Zod schemas — the contract
│   ├── registry.ts          # imports + validates all entries
│   └── entries/*.ts         # one file per job / degree / project
├── src/
│   ├── world/               # the 3D layer — written once, then frozen
│   │   ├── graph.ts         # pure: entries -> nodes, edges, splines
│   │   ├── layout.ts        # pure: district -> plot transforms
│   │   ├── Scene.tsx
│   │   ├── Car.tsx
│   │   ├── Plot.tsx
│   │   ├── Camera.tsx
│   │   └── Junction.tsx
│   ├── ui/                  # HUD, project panel, mode toggle, minimap
│   ├── doc/                 # Fast Track document mode
│   ├── showpieces/          # registry of optional interactive demos
│   └── app/                 # Next.js routes
├── scripts/new-project.ts
├── tests/                   # graph.ts and layout.ts, pure-function tests
└── .github/workflows/ci.yml
```

**The load-bearing rule: no project-specific code in the renderer.** If a project
needs something bespoke, it registers a set piece or a showpiece into a registry.
It never forks the engine.

`graph.ts` and `layout.ts` are pure functions with no Three.js imports, so they
are unit-testable in Node. Given N entries in a district: roads connect, plots do
not overlap, every plot is reachable, and the spline is continuous. These are the
things that actually break when project #10 gets added.

---

## 6. Stack

| Concern | Choice | Why |
|---|---|---|
| Framework | Next.js, static export | No server, no runtime, no secrets |
| 3D | React Three Fiber + drei | Declarative; the scene is components, not imperative GL |
| Language | TypeScript, `strict` | Build-time guarantees over runtime debugging |
| Styling | Tailwind | Doc mode stays small and consistent |
| Validation | Zod | Bad content fails the build, loudly |
| Tests | Vitest (units) + Playwright (smoke) | Layout logic is testable like backend code |
| Hosting | Cloudflare Pages | Free, fast, already where the domain lives |

---

## 7. Security & engineering practices

The site is fully static: no server, no database, no runtime secrets. The entire
attack surface is a CDN serving immutable files. That is the honest answer to
"is it secure," and it is a better one than any hardening checklist on a dynamic app.

- Strict CSP, no `unsafe-inline`, no `unsafe-eval`
- Subresource integrity on any external asset
- No third-party analytics scripts (privacy-preserving, self-hosted counts only)
- HSTS, `X-Content-Type-Options`, `Referrer-Policy: strict-origin-when-cross-origin`
- Email obfuscated; no phone number, no physical address
- Dependabot + `npm audit` gated in CI
- Branch protection on `main`, signed commits, PR-only merges
- CI on every PR: typecheck → lint → unit tests → build → Lighthouse budget → audit
- `SECURITY.md`, `CONTRIBUTING.md`, meaningful commit history

---

## 8. Budgets

| Metric | Budget |
|---|---|
| Doc-mode initial JS | < 200 KB gzipped |
| Doc-mode LCP (4G) | < 1.5 s |
| Drive-mode time-to-interactive | < 4 s on a mid-range laptop |
| Drive-mode frame rate | 60 fps desktop, 30 fps floor |
| Total 3D asset payload | < 4 MB, lazy-loaded after first paint |
| Lighthouse a11y (doc mode) | 100 |

The 3D bundle is code-split and never loads in doc mode.

---

## 9. Build order

**M0 — Ship a real portfolio with zero 3D.**
Repo, CI, schema, all content entries written, doc mode complete, deployed to
helazhary.com. *You now have a working site you can put in a job application.*
Everything after this is upside, and you are never without a link.

**M1 — The world, in grey boxes.** Road graph, car, camera, junctions, minimap.
No art. Prove the navigation feels good before making it pretty.

**M2 — Skins and props.** Plot skins per district, canvas signs, ambient props,
construction sites, lighting, fog.

**M2.5 — The environment.** Added after M2, when the world turned out to read
as grey cubes on an empty plane. The plots and roads were specified in detail
and everything *between* them was not, so there was nothing to build against.
Covers: road surface detail and markings, verges, ground variation, planting
and street furniture scattered by a pure seeded function, and enough massing
variety that a building stops reading as a cube. Scatter is instanced from the
start — this is where the draw-call budget in §8 is actually spent.

**M3 — Panels and polish.** Project panels, deep links, mode transitions,
keyboard nav, the Montreal detour, the fog ending.

**M4 — The real car.** Swap the primitive E36 for a proper `.glb`.

**M5 — The showpiece.** One project gets a genuine interactive demo.
Deferred by decision; the schema already has the `showpiece` hook.

---

## 10. Open items

- [ ] Showpiece project not yet chosen (candidates: E36 AI head unit, chess
      digitization CV overlay, IntelliNote2 live editor, RISC-V pipeline stepper)
- [ ] IntelliNote2 is not on the resume yet — add it there too?
- [ ] Telegram bot repo not yet pushed to GitHub
- [ ] Art direction: palette and time of day. Deferred by decision — v1 ships a
      single neutral dusk palette and is restyled later.

**Resolved:** the Arcade is a short alley, not a full district — sample
screenshots and outbound links where they exist. The Transformer–CNN video is an
outbound link, not an embed. All nine projects ship in v1 at light content weight.
