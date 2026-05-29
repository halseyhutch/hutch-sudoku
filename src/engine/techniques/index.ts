import type { Technique } from "../types";
import { hiddenSingle } from "./hiddenSingle";
import { claiming, pointing } from "./lockedCandidates";
import { nakedSingle } from "./nakedSingle";
import { hiddenPair, hiddenTriple, nakedPair, nakedTriple } from "./pairsTriples";

export const TIER_ONE_TECHNIQUES: Technique[] = [nakedSingle, hiddenSingle];
export const TIER_TWO_TECHNIQUES: Technique[] = [pointing, claiming, nakedPair, hiddenPair, nakedTriple, hiddenTriple];
export const DEFAULT_TECHNIQUES: Technique[] = [...TIER_ONE_TECHNIQUES, ...TIER_TWO_TECHNIQUES];

export { claiming, hiddenPair, hiddenSingle, hiddenTriple, nakedPair, nakedSingle, nakedTriple, pointing };
