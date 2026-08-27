# Handoff — 2026-08-27

The live state of the project. Read this first, then `CLAUDE.md`, then
`docs/DESIGN.md` §9 for the milestone plan and `.claude/rules/world.md` before
touching anything in `src/world/`.

---

## 1. Where it stands

**Everything built is deployed.** `main` and `origin/main` are level, the
working tree is clean, CI is green, and helazhary.com is serving it.

| | State |
| --- | --- |
| M0 — content pipeline, doc mode, CI, hosting | live |
| M1 — road graph, driving, camera, minimap | live |
| M2 — skins, signs, construction sites, dusk lighting, the car | live |
| M2.5 — environment: textures, sky, hills, scenery, billboards | live |
| M3 — project panels, `/p/<id>`, Montreal detour, fog ending | live |
| Garage, intro overlay, About panel, drag-to-look | live |
| Directional sunset, the pyramids | live |
| Car tail lights, garage lighting | live |
| Ambient props | live |
| Navigation anchors derived from laid-out plots | live |
| Junction rendering: side roads taper out of the mouth | live |
| Dates confirmed by Hussein; year-only and hidden dates | live |
| Transit-diagram map, orbit camera, animated U-turn, road-name flash | built and verified |
| Pyramids and desert brought in close | built and verified |
| **M4 — the real car `.glb`** | **not started, blocked** |
| **M5 — a showpiece** | **not started** |

### What to pick up next

**M4 is parked by Hussein, not blocked.** On 2026-08-27 he said he is keeping
the primitives car as it is for now — other things matter more. The decision
described below is still the decision when it comes back.

There is no `.glb` anywhere in the repo. Either he supplies a low-poly E36 to
drop into `public/models/`, or he agrees to sculpt a better silhouette from
primitives instead — and heavy work on the primitives body is thrown away if a
model is coming. `Car.tsx` is written to have a `.glb` slotted in behind the
same component. He also has a standing wish list for whatever the car becomes:
the blue it already wears, the angel-eye rings it already has, **gold/bronze
split-spoke rims**, and the boot spoiler.

A route was scoped and half-proven before he parked it: `three`'s
`GLTFExporter` runs in plain Node with a six-line `FileReader` shim and writes
a valid GLB, so a build script could generate the car from a table of
cross-sections with no Blender and no new dependency.

**There is uncommitted scratch from that spike still in the tree**, all of it
predating the decision to park M4: `src/world/carBody.ts`,
`scripts/build-car.mjs`, `tests/world-car-body.test.ts`, an empty
`public/models/`, and a `build:car` script added to `package.json`. The test
runs and passes as part of `npm run check`, so it is not inert — but nothing in
`src/world/` imports `carBody.ts` and the rendered car is still the primitives
one in `Car.tsx`. Decide whether to commit or delete it before it becomes
folklore.

**M5 has not been proposed.** `showpiece` is in the schema and reserved; no
entry sets it. Read DESIGN.md §9 and come back with a proposal before building.

---

## 2. Running and verifying it

```bash
npm run dev      # :3000
npm run check    # typecheck + lint + test. Read the WHOLE output.
```

### Driving the site in a browser is full of traps

Every key handler in this codebase dispatches on `event.code`. That one fact
cost a previous session an entire evening, so:

- **The in-app Browser pane cannot drive this site.** `computer {action:
  "key"}` delivers events that are `isTrusted: true` but carry `code: ""`, so
  `W`, `M`, `S` and `Escape` all do nothing. The site is fine. A whole session
  was spent hunting a "W does not move the car" bug that never existed.
- **Use Playwright.** `page.keyboard.down('w')` sets `code` properly, and it is
  the only way to *hold* a key for a measured duration rather than tap it.
  The Playwright MCP is not always connected; when it is not, driving it from a
  script works just as well and is what was used on 2026-08-27:

  ```js
  // npm i playwright && npx playwright install chromium, in a scratch dir
  const browser = await chromium.launch({
    headless: true,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  ```

  The viewport matters: **drive mode is skipped under 900×520**, so a default
  800×600 page silently gives you doc mode and nothing to look at. Then click
  "Drive it instead", click "Take the wheel", and drive.

- **Software rendering runs the world in slow motion.** Swiftshader manages a
  few frames a second, so anything measured in wall-clock time is wrong by a
  large factor: a screenshot alone can take seconds, and an 0.8s U-turn is not
  0.8s of anything. Judge *ordering and framing* from a script, not duration.
  Two real bugs and one false alarm came out of exactly this distinction — see
  "two clocks" in §5.
- **Dismiss the intro overlay first.** `showControls` starts `true`, which sets
  `paused` in `WorldCanvas`, which forces `throttle: false` in `Scene`. The car
  genuinely cannot move until "Take the wheel" is clicked, and that looks
  exactly like a broken throttle.
- **Reading the car's position costs you a pause.** The minimap marker only
  updates while the map is open, and an open map pauses the car. Read, close,
  drive, reopen, read.
- **Deep links are the cheap way to inspect a place.** `/p/<id>` puts the car
  at that building. Press Escape to dismiss the panel and look around.

### The Browser pane must actually be *displayed*

The in-app Browser pane renders nothing while it is hidden, and this is not a
cosmetic problem — the page stops compositing, which means:

- `computer {action: "screenshot"}` fails outright with "the Browser pane is not
  displayed".
- The R3F canvas never gets sized. It sits at the default 300×150 and no frames
  are drawn, so `HudState` is never published and the whole HUD renders empty.
- **CSS transitions and animations never advance.** Every `getComputedStyle`
  read of a transitioned property returns the value it had before the change,
  forever. This looks exactly like a stylesheet that is not matching, and cost
  a session a while: the fix is to read a property with *no* transition on it
  (`font-weight` worked) to prove the rule applies.

So a hidden pane can verify DOM structure, class matching and static geometry,
and nothing else at all. Anything about the 3D world needs the pane displayed.

### Stale processes survive a session ending

`next dev` will refuse to start and name the PID to kill. Playwright errors
with `Browser is already in use` and needs `pkill -f mcp-chrome-<id>`.

### Verifying doc mode

Rule 3 in `CLAUDE.md` is verified against `out/`, never by reasoning:

```bash
npm run build && cd out && for f in $(grep -o '/_next/static/chunks/[^"]*\.js' index.html | sort -u); do grep -l "WebGLRenderer" ".$f"; done
```

Any path printed is a violation.

---

## 3. Waiting on Hussein

Nothing here may be invented or filled with a plausible guess (`CLAUDE.md`
rule 5). Preview mode exists precisely so the site can be judged without it.

- **The About text.** `site.about` in `src/lib/site.ts` is deliberately empty
  with a `TODO(hussein)`. The panel falls back to the pitch, role and location
  already in that file, so nothing is invented and nothing looks blank. Wants
  two or three short paragraphs in his own voice: where he is from, what he
  likes building, what he is looking for next.
- **Media.** Only `project-car` has photographs. Every other folder under
  `public/media/` is empty and `npm run dev:preview` stands in for them.
- **Four content `TODO(hussein)` markers**, none of them about dates: a YouTube
  URL on `transformer-cnn-study`, a GitHub URL on `telegram-bot`, screenshots
  for `games-and-apps`, and the stack bullets on `intellinote2`.
- **The M4 decision** described in §1.

### Grouping instead of chronology — asked about, not decided

On 2026-08-27 Hussein said he does not care much for the chronological ordering
and would rather see similar projects grouped together, and asked what his
options are *later*. Nothing was changed. He has not chosen; do not choose for
him.

What is available, cheapest first:

1. **Move entries between districts.** A pure content edit in
   `content/entries/`. Districts *are* the grouping axis — `lab`, `agents`,
   `workshop` and `arcade` each get their own off-ramp with their own buildings
   — so this is the whole feature for anything that just wants regrouping. The
   roads, the plots, the map and the minimap all relay themselves. No code.
2. **Add a district.** One entry in the `DISTRICTS` enum in `content/schema.ts`,
   a label in `DISTRICT_LABELS` (`src/lib/site.ts`), a tint in `DISTRICT_TINT`
   (`src/world/palette.ts`), and a side in `DISTRICT_SIDE` (`src/world/graph.ts`).
   Small and mechanical.
3. **Stop placing off-ramps by date.** This is the only real code work, and the
   only option that changes what the world *means*. `buildRoadGraph` places each
   district's junction at the x of that district's earliest entry
   (`graph.ts`, around the `rawX` helper). Replacing that with an explicit order
   makes the spine a sequence of themes rather than a timeline.

Worth saying out loud before anyone does 3: **the highway being chronological is
the premise of the whole map** — DESIGN.md §2.3 is "driving straight reads
exactly like the resume". That is a good thing to change deliberately and a bad
thing to change by accident. Options 1 and 2 group projects without touching it,
because the spine holds jobs and education while the districts hold everything
else. Try those first.

None of this reopens dates. Every entry keeps its `start` regardless, because
`hideDate` hides a date and does not remove one.

### Dates are finished — do not reopen them

Every entry was walked through with Hussein on **2026-08-27**. All the
`TODO(hussein): dates are ESTIMATED` markers are gone and must not come back.
Eight entries are bare years, three show no date at all, and the six job and
education dates from his resume were confirmed unchanged with month precision.

**Never re-estimate a date, and never add a month to an entry that carries only
a year** — that guess is exactly what the exercise removed.

---

## 4. Known loose ends

- **A station label can cross a neighbouring line on the map.** The Agent Alley
  labels lean down-right across the elbow where The Lab drops away from the
  trunk. It is legible — the lines are told apart by colour, and the labels sit
  on top — but it is the one place the diagram looks crowded. A real fix means
  label collision avoidance, which is a great deal of work for the return.
  Raising `ROW` in `transit.ts` buys room at the cost of a taller diagram.
- **The car is primitives.** It has tail lights and a boot lip, which is what it
  most needed, but the body is one box: no bonnet slope, no greenhouse taper, no
  arches. See M4 above.
- **Wayfinding while *driving* is still unsolved.** The transit map answers
  "what is on this road and where am I in that order", but it is a modal that
  pauses the car, so it cannot help at the moment of choosing a junction. The
  junction prompt names the branches and the road-name flash confirms the choice
  after the fact. If it still feels confusing, the two candidates that were
  scoped and not built are **junction signs in the world** (reusing the canvas
  sign kit in `signText.ts`/`signTexture.ts`) and an **always-on corner strip**
  showing the current line only.
- **A thin hairline flickers on road markings seen at a grazing angle far down
  the road.** Sub-pixel geometry aliasing, not z-fighting — the polygon offset
  fixed the stitching. Going further needs wider markings at distance or MSAA,
  and neither looks worth it.
- **Agent Alley is congested by construction.** The agents junction and the
  Concordia detour's exit are 46 units apart — the spine's minimum gap — so
  three roads share a short stretch. Much cleaner than it was, but it is the
  busiest spot on the map and the first place a junction change will show.
- **`layoutPlots` displaces buildings and leaves their graph anchors behind.**
  This is by design and nothing navigates by those anchors any more, but it
  surprises people. `packFrontage` slides a building along its frontage when
  the spot it wanted is taken; `graph.anchorByEntryId` does not move with it.
  Most entries end up 28 units from their own building, displaced ones 34–52.
  `PlotTransform` records where the building actually landed, `anchorsForPlots`
  derives navigation anchors from that, and deep links and the map use those.
  The graph's anchors remain the *input* the layout works from, which is
  correct — they are the spot a building asked for.

---

## 5. Things learned the hard way

Kept because they cost real time and are invisible in the finished code. The
ones about the pure layer are also listed as invariants in
`.claude/rules/world.md`.

### Geometry and layout

- **A junction is not a point.** A spur leaves the spine and stays alongside it
  for about fifty units before there is room for both roads to have their own
  kerbs and verges. Until then each was drawing its flanking ribbons on top of
  its neighbour's — coplanar, identically coloured, same height — which is
  z-fighting, and it showed as a stitched white slab at every off-ramp. The
  circular apron at the node could never cover it: at radius fifty it is a lake
  of tarmac.
- **Measure the distance, do not pick it.** The first taper was a hand-picked
  46 and was two units short for the spurs and five for the detour, leaving a
  thinner version of the same artefact. `minorRoadClearance` computes it from
  the graph, so content that changes the spacing of the world changes the taper
  with it.
- **A detour must bow away from off-ramps inside its span.** The bridge arcs to
  one side for its whole length and each district arcs to its own fixed side, so
  a detour opening over a ramp lays a road through that district's frontage.
  **One content date change produced three symptoms, two of them nowhere near
  content:** moving The Lab four months later put the Concordia bridge two units
  from the buildings on the lab ramp, `layoutPlots` pushed one into a second
  rank to find room, and that put it far enough from its own anchor that
  arriving there offered a neighbour instead.
- **A hidden date still has to exist.** The highway *is* chronology and an
  off-ramp leaves the spine at the date its district began, so an entry with no
  date cannot be placed. The Arcade's only member is one of the hidden ones and
  would have slid from 2022 to the far end of the map for want of a number
  nobody sees. `hideDate` suppresses display only.
- **Bounding circles lie about long thin things.** A radius round two parked
  cars reaches the kerb. Where only one direction is constrained, measure that
  direction.
- **Anything spaced with `floor(length / spacing)` skips short segments.**
  Street lamps missed exactly the stretches beside junctions, twice.
- **Splines must be arc-length parameterised**, and endpoint control points
  reflect rather than clamp.
- **Test final positions, not intermediate data.** The highway once rendered out
  of chronological order while the anchors it came from were perfectly correct.

### Rendering

- **The camera far plane must clear the backdrop.** At 2400 with a sky dome of
  radius 2600 the dome was clipped and the canvas clear colour showed through as
  a black mountain. It raycast against nothing and survived recolouring all 456
  meshes, because nothing was being drawn there. It is 9000 now.
- **Distant scenery must follow the camera.** The hills were centred on the
  world origin while the world runs to x≈1300, so driving east brought you
  within 65 units of a 170-unit ridge.
- **Ribbon geometry winding is load-bearing.** Reverse a vertex pair and the
  normals point at the ground: the mesh renders perfectly and is invisible from
  above. This is what made the centre dashes disappear.
- **A shadow-casting light that follows the car makes every shadow crawl.** Snap
  the shadow volume to whole texels.
- **A dark silhouette needs a light background.** The pyramids sat opposite the
  sun, where the sky is nearly their own value — and two of the three were
  shorter than the ridge in front of them, so they were not merely hard to see,
  they were not on screen from anywhere.
- **An emissive box is a slab, not a sign.** The arcade marquee glowed on all
  six faces, so from any camera above eye level it read as a flat lozenge. A
  dark housing with one lit face reads as a lit sign from everywhere.
- **An emissive fixture is not the light coming off it.** The garage lamp hung
  1.6 below the ceiling at intensity 900 with decay 2 — 350 at the ceiling
  against 10 at the floor. Hang lamps low or the surface above them blows out.
- **The chase camera never leaves the back of the car.** Detail on the front is
  detail nobody sees; tail lights did more for the car reading as a car than
  everything on the nose put together.
- **`useLoader` suspends.** Without a `<Suspense>` boundary the suspension
  propagates out of the `<Canvas>` and blanks the entire scene.
- **Damp the angle, not the position.** The chase camera swinging 180° round
  the car interpolates a point 88 units away; lerping the *position* takes the
  chord, which flies the camera straight through the car. Damping the azimuth
  and placing the camera on the circle is an arc.
- **A camera that swivels in place is not a camera that looks around.** The
  first drag-to-look kept the camera still and rotated its focus, so dragging
  slid the car out of frame — a neck, not an orbit, and it read as broken long
  before anyone could say why. Orbiting keeps the subject centred, which is also
  what makes a full 360° safe to allow.
- **A spring that starts on pointer-up cannot be held.** The old look decayed
  from the instant you let go and was home in a third of a second, so looking at
  a building meant keeping the mouse button down. A hold before the drift back
  is the difference between a nudge and a fight.
- **Two clocks, and they are not interchangeable.** `ChaseCamera` runs on both
  on purpose. Anything that must stay in step with the car — the azimuth
  swinging round behind it, the follow lerp — uses the *clamped* delta the drive
  model uses, or on a slow machine the camera finishes a U-turn before the
  U-turn does. Anything promised to a person — how long a look is held before it
  drifts back — uses the raw delta, or a 1.6 second hold lasts six seconds at
  ten frames a second and the spring never starts. Both mistakes were made in
  one sitting, in opposite directions.
- **An orbit camera has to give up its look-ahead as it comes round.** Aiming
  thirty units past the car and eighteen above it is the right framing from
  behind and puts the car off the bottom of the screen from the side. Scaling
  both by `cos(yaw)` was the difference between "the car stays centred" being
  true and being a comment.
- **Capping the height of a full-width SVG letterboxes it.** `w-full` with
  `max-h` keeps the element full width and shrinks the drawing to fit the cap,
  so the map drew at 600px inside a 1020px modal with dead space either side.
  Lead with the height and let the viewBox aspect set the width.

### Process

- **A field nothing reads fails silently and forever.** `ambient` sat in the
  schema for four milestones with every entry populating it and no renderer
  looking. Ignoring unknown ids is right at runtime and is exactly what hid it.
  If a schema field is optional at runtime, something has to assert the two
  lists have met.
- **Negative-check every new test.** Break the thing it guards and confirm it
  fails, and fails naming the right thing. Several tests here were written
  against bugs that were already fixed and would have passed vacuously.
- **Read the whole `npm run check` output.** A previous session tailed three
  lines, cut off the pass/fail count, and pushed a branch with two failing tests
  that CI then caught.
- **A negative check can pass and still prove nothing.** Reversing the
  next-stop comparison in `transit.ts` broke the feature and every test still
  passed — the case the test happened to sample never exercised that branch.
  The break has to be caught by a test that fails *naming the right thing*; if
  every test survives the break, the test is not the guard you thought it was,
  and the fix is a new test, not a shrug.
- **`npm run check` cannot see.** It has nothing to say about a camera, a
  silhouette, or a label that overlaps a line. Anything visual needs a browser
  with the pane displayed, and if that is not available the honest report is
  "built, not seen" — not "done".

---

## 6. Deploying

Push to `main`; Cloudflare builds and publishes. It is a **Worker serving static
assets**, not Pages — config is `wrangler.jsonc` and the Worker is named
`careerwebsite`. Full notes in `docs/CLOUDFLARE.md`.

Run `npm run check` first and read all of it. Watch CI with
`gh run watch "$(gh run list --limit 1 --json databaseId -q '.[0].databaseId')"`.
