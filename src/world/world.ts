/**
 * The world, built once from content at module load.
 *
 * Both halves are pure functions of the entry list, so this is a constant — it
 * costs a millisecond and never changes at runtime. Importing it is what pulls
 * the world into the 3D bundle, which is why nothing in `src/doc/` may touch it.
 */

import { entries } from '@content/registry';
import { buildRoadGraph } from './graph';
import { layoutPlots } from './layout';

export const worldGraph = buildRoadGraph(entries);
export const worldPlots = layoutPlots(worldGraph, entries);
