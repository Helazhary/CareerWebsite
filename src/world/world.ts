/**
 * The world, built once from content at module load.
 *
 * Both halves are pure functions of the entry list, so this is a constant — it
 * costs a millisecond and never changes at runtime. Importing it is what pulls
 * the world into the 3D bundle, which is why nothing in `src/doc/` may touch it.
 */

import { entries } from '@content/registry';
import { buildRoadGraph } from './graph';
import { anchorsForPlots, layoutPlots } from './layout';
import { scatterLamps, scatterScenery } from './scatter';
import { buildTransitDiagram } from './transit';

export const worldGraph = buildRoadGraph(entries);
export const worldPlots = layoutPlots(worldGraph, entries);
/**
 * Where "take me to this project" actually goes.
 *
 * Derived from the laid-out plots, not from `worldGraph.anchorByEntryId` —
 * see `anchorsForPlots`. The graph's anchors are still the input the layout
 * works from; they are just not where the buildings ended up.
 */
export const worldAnchorByEntryId = anchorsForPlots(worldPlots);
/**
 * The map, as a transit diagram rather than a tracing of the roads.
 *
 * Built from the laid-out plots for the same reason `worldAnchorByEntryId` is:
 * the diagram has to show the order the buildings ended up in, not the order
 * they asked for.
 */
export const worldTransit = buildTransitDiagram(worldGraph, worldPlots);
export const worldScenery = scatterScenery(worldGraph, worldPlots);
export const worldLamps = scatterLamps(worldGraph);
