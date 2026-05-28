import type { Technique } from "../types";
import { hiddenSingle } from "./hiddenSingle";
import { nakedSingle } from "./nakedSingle";

export const TIER_ONE_TECHNIQUES: Technique[] = [nakedSingle, hiddenSingle];
export const DEFAULT_TECHNIQUES: Technique[] = [...TIER_ONE_TECHNIQUES];

export { hiddenSingle, nakedSingle };
