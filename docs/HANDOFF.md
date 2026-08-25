# Handoff — 2026-08-24

Written at the end of a long session so the next one can pick up cleanly.
Read this, then `CLAUDE.md`, then `docs/DESIGN.md` §9 for the milestone plan.

---

## 1. Where the project stands

**M0–M3 are built and everything on `main` is deployed.** `main` and
`origin/main` are level; the working tree is clean.

| Milestone | State |
| --- | --- |
| M0 — content pipeline, doc mode, CI, hosting | live |
| M1 — road graph, driving, camera, minimap | live |
| M2 — skins, signs, construction sites, dusk lighting, the car | live |
| M2.5 — environment: textures, sky, hills, scenery, billboards | live |
| M3 — project panels, `/p/<id>`, Montreal detour, fog ending | live |
| Garage / intro / About / look-around | live |
| Directional sunset; the pyramids | live |
| Car tail lights; garage lighting | live |
| M4 — real car `.glb` | not started |
| M5 — showpiece | not started |

---

## 2. The "W does not move the car" bug — CLOSED, it was never real

Verified by hand on 2026-08-24: hold `W` and the car drives. Measured with the
minimap marker, `x` goes from `-90` to `+123.4` over a three-second hold.

**It was the test harness, not the app.** Every driving test in the previous
session used synthetic `KeyboardEvent`s. Every key handler in this codebase
dispatches on `event.code`, and the harness was delivering events with `code`
set to the empty string, so no key did anything.

### If you are about to test driving, read this first

- **The in-app Browser pane's `computer {action: "key"}` cannot drive this
  site.** Its key events arrive `isTrusted: true` but with `code: ""`. `W`, `M`,
  `S`, `Escape` — none of them fire. This is not a bug in the site.
- **Use the Playwright MCP instead.** `page.keyboard.down('w')` sets `code`
  correctly and works. `browser_run_code_unsafe` is how you hold a key for a
  measured duration; `browser_press_key` only taps.
- **Dismiss the intro overlay first.** `showControls` starts `true`, which makes
  `paused` true in `WorldCanvas`, which forces `throttle: false` in `Scene`. The
  car genuinely cannot move until "Take the wheel" is clicked. This alone looks
  exactly like the bug.
- **Reading position costs you a pause.** The minimap marker only updates while
  the map is open, and having the map open pauses the car. Read, close, drive,
  reopen, read.

### Stale processes will block you

Both the dev server and the Playwright Chrome survive a session ending. `next
dev` refuses to start and names the PID to kill; Playwright errors with
`Browser is already in use` and you have to `pkill -f mcp-chrome-<id>`.

---

## 3. Uncommitted work

None. The sunset work described below was verified and committed as
`54e6a7b`.

The sky and the key light had disagreed: the sky said dusk while the light sat
37° above the horizon, which lights the world like mid-afternoon. `SUN_DIRECTION`
and `SUN_ELEVATION` now live in `palette.ts` and both derive from them. The sky
is directional — `SKY_SUNWARD` and `SKY_AWAY` blended per vertex by how much
that part of the sky faces the sun — because a warm band painted evenly around
the whole horizon has no sun in it and reads as haze.

Checked in the browser both ways. Sunward: orange through magenta into deep
blue over the hills. Away: a warm rim on the horizon under a night sky, warm-lit
buildings, long shadows across the road.

---
## 4. Bugs fixed, worth not re-introducing

These cost real time and are invisible in the finished code.

- **The camera far plane must clear the backdrop.** It was 2400 with a sky dome
  of radius 2600, so the dome was clipped away and the canvas clear colour
  showed through as a black mountain hanging over the world. It raycast against
  nothing and survived recolouring all 456 meshes, because nothing was being
  drawn there. It is now 9000. The pyramids at 2400+ were invisible for the
  same reason.
- **Distant scenery must follow the camera.** The hills were centred on the
  world origin while the world runs to x≈1300, so driving east brought you
  within 65 units of a 170-unit ridge.
- **Ribbon geometry winding is load-bearing.** Reversing a vertex pair points
  the normals at the ground: the mesh renders perfectly and is invisible from
  above. This is what made the road centre dashes disappear.
- **A shadow-casting light that follows the car makes every shadow crawl.**
  Snap the shadow volume to whole texels. This was the "jittery movement".
- **Anything spaced with `floor(length / spacing)` skips short segments.**
  Street lamps missed exactly the stretches beside junctions, twice.
- **`useLoader` suspends.** Without a `<Suspense>` boundary the suspension
  propagates out of the `<Canvas>` and blanks the entire scene.
- **Splines must be arc-length parameterised**, and endpoint control points
  must reflect rather than clamp.
- **Test final positions, not intermediate data.** The highway once rendered
  out of chronological order while its anchors were perfectly correct.
- **A dark silhouette needs a light background.** The pyramids were placed
  opposite the sun, where the sky is nearly their own value. Two of the three
  were also shorter than the ridge in front of them, so they were not merely
  hard to see, they were not on screen from anywhere.
- **An emissive fixture is not the same as the light coming off it.** The
  garage lamp hung 1.6 below the ceiling at intensity 900 with decay 2, which
  is 350 at the ceiling against 10 at the floor. Hang lamps low, or the surface
  nearest them blows out.
- **The chase camera never leaves the back of the car.** Detail on the front is
  detail nobody sees. Tail lights did more for the car reading as a car than
  everything on the nose put together.

---

## 5. Things waiting on Hussein

- **The About text.** `site.about` in `src/lib/site.ts` is deliberately empty
  and carries a `TODO(hussein)`. The panel falls back to the pitch, role and
  location already in that file, so nothing is invented and nothing is blank.
  Two or three short paragraphs in his own voice: where he is from, what he
  likes building, what he is looking for next.
- **Estimated dates.** Several entries in `content/entries/` still carry
  `TODO(hussein)` comments marking dates that were estimated from the resume
  and need confirming before they are truthful.
- **Media.** Only `project-car` has photographs. Every other media folder is
  empty; `npm run dev:preview` stands in for them.

---

## 6. Loose ends

- **Ambient props are not rendered.** `riscv-cpu` declares `'oscilloscope'` and
  `project-car` declares `'toolbox'` and `'car-lift'` in their `ambient`
  arrays. Unknown ids are ignored safely, so this is harmless — but it is a
  schema field doing nothing.
- **`layoutPlots` displaces buildings and leaves their anchors behind.** It
  pushes plots apart to stop them overlapping and never moves the entry's road
  anchor to follow. Most entries sit 28 units from their own building; the
  displaced ones sit at 34–52. Two are far enough out that a *neighbour's*
  building is closer to their anchor than their own — `transformer-cnn-study`
  (own 34.7, chess-digitization 28.0) and `agentic-dev-pipelines` (own 35.2,
  telegram-bot 32.9).

  The visible symptom today is small: deep-linking to `/p/transformer-cnn-study/`
  opens the right panel, but closing it leaves "Real-Life Chess Digitization" on
  the prompt. Every building is still reachable by driving — that is now
  asserted in `tests/world-proximity.test.ts`, so if a future layout change
  strands one, it fails loudly instead of silently.

  The proper fix is in the pure layer: either cap the displacement, or move the
  anchor with the plot so "arrive at this building" means the point of road
  beside where the building actually ended up. Weighting `nearestPlot` by
  alignment does **not** work — the margin is 19.7 against 13.0 in effective
  distance, and the weighting needed to close that would let a building 40 units
  ahead beat one 15 units beside you.
- **`npm run dev:preview` fills empty galleries with placeholder cards.** Use
  plain `npm run dev` to see the site as it actually ships.

---

## 7. Deploying

Push to `main`; Cloudflare builds and publishes. It is a **Worker serving
static assets**, not Pages — config is `wrangler.jsonc`, and the Worker is
named `careerwebsite`. Full notes in `docs/CLOUDFLARE.md`.

Before deploying, run `npm run check`, and **read the whole output**. A
previous session tailed three lines, cut off the pass/fail count, and pushed a
branch with two failing tests that CI then caught.
