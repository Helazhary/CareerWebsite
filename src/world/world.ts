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
export const worldScenery = scatterScenery(worldGraph, worldPlots);
export const worldLamps = scatterLamps(worldGraph);
