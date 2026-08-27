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
| Navigation anchors derived from laid-out plots | live |
| Ambient props | live |
| Junction rendering: tapered side roads | live |
| Confirmed dates; year-only and hidden dates | live |
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
- **A hidden date still has to exist.** The highway *is* chronology, and a
  district's off-ramp leaves the spine at the date its work began — so an entry
  with no date cannot be placed, and The Arcade, whose only member is one of the
  hidden ones, would have slid from 2022 to the far end of the map for want of
  one number nobody sees. `hideDate` suppresses display only; `start` stays and
  is never rendered.
- **A detour must bow away from off-ramps inside its span.** The bridge arcs to
  one side for its whole length and every district arcs to its own fixed side,
  so a detour opening over a ramp lays a road through that district's frontage.
  Moving The Lab four months later put the Concordia bridge two units from the
  buildings on the lab ramp; `layoutPlots` pushed one into a second rank to find
  room, which put it far enough from its own anchor that arriving there offered
  a neighbour instead. One content date change, three symptoms, two of them
  nowhere near content.
- **A junction is not a point.** A spur leaves the spine and stays alongside it
  for around fifty units before there is room for both to have their own kerbs
  and verges. Until then each road was drawing its flanking ribbons on top of
  its neighbour's — coplanar, identically coloured, at the same height — which
  is z-fighting, and it showed up as a stitched white slab at every off-ramp.
  The circular apron at the node was nowhere near big enough to cover it and
  never could be: at radius fifty it would be a lake of tarmac.
- **Measure the distance, do not pick it.** The first taper was a hand-picked
  46 and was two units short for the spurs and five short for the detour, which
  left a thinner version of the same artefact. `minorRoadClearance` computes it
  from the graph now, so content that changes the spacing of the world changes
  the taper with it.
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
- **An emissive box is a slab, not a sign.** The arcade marquee glowed on all
  six faces, so from any camera above eye level — which is most of them — it
  read as a flat lozenge of colour. A dark housing with one lit face reads as a
  lit sign from everywhere.
- **A field nothing reads fails silently and forever.** `ambient` sat in the
  schema for four milestones with every entry populating it and no renderer
  looking. Ignoring unknown ids is right at runtime and is exactly what hid it.
  If a schema field is optional at runtime, something has to assert the two
  lists have met.
- **Bounding circles lie about long thin things.** A radius round two parked
  cars reaches the kerb. Where only one direction is constrained, measure that
  direction.

---

## 5. Things waiting on Hussein

- **The About text.** `site.about` in `src/lib/site.ts` is deliberately empty
  and carries a `TODO(hussein)`. The panel falls back to the pitch, role and
  location already in that file, so nothing is invented and nothing is blank.
  Two or three short paragraphs in his own voice: where he is from, what he
  likes building, what he is looking for next.
- **Dates are done.** Every entry was walked through with Hussein on
  2026-08-27 and all the estimated-date `TODO(hussein)` markers are gone. Eight
  became bare years, three show no date at all, and the six job and education
  dates from the resume were confirmed unchanged. Two content `TODO(hussein)`
  markers remain and are *not* about dates: a YouTube URL on
  `transformer-cnn-study`, a GitHub URL on `telegram-bot`, screenshots for
  `games-and-apps`, and the stack bullets on `intellinote2`.
- **Media.** Only `project-car` has photographs. Every other media folder is
  empty; `npm run dev:preview` stands in for them.

---

## 6. Loose ends

- **The car is still primitives.** M4 replaces it with a `.glb` and there is no
  model in the repo, so it is blocked on Hussein supplying one or on a decision
  to sculpt a better silhouette from primitives instead. It now has tail lights
  and a boot lip, which is what it most needed, but the body is one box: no
  bonnet slope, no greenhouse taper, no arches.
- **M5, the showpiece, has not been started.** `showpiece` is in the schema and
  reserved; no entry sets it yet. Read DESIGN.md §9 before proposing anything.
- **`layoutPlots` still displaces buildings and leaves their graph anchors
  behind** — but nothing navigates by those any more. `packFrontage` slides a
  building along its frontage when the preferred spot is taken and does not move
  `graph.anchorByEntryId` with it, so the anchor keeps naming a stretch of road
  the building no longer stands beside. Most entries end up 28 units from their
  own building; the displaced ones 34-52.

  `PlotTransform` now records the road it fronts and where along it it actually
  landed, `anchorsForPlots` derives navigation anchors from that, and deep links
  and the map both use those. The graph's anchors remain the *input* the layout
  works from, which is correct — they are just not where the buildings ended up,
  and two tests in `tests/world-proximity.test.ts` now hold that line: every
  building is offerable somewhere, and arriving at a project puts you at that
  project. Both were negative-checked.
- **A thin hairline still flickers on markings seen at a grazing angle far
  down the road.** Sub-pixel geometry aliasing, not z-fighting — the polygon
  offset fixed the stitching. It would need either wider markings at distance
  or MSAA to go further, and neither is obviously worth it.
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
