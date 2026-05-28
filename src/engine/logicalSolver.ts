import { applyStep, cloneGrid, computeCandidates, isSolved } from "./grid";
import { DEFAULT_TECHNIQUES } from "./techniques";
import type { Grid, SolveResult, Step, Technique } from "./types";

export interface LogicalSolveOptions {
  techniques?: Technique[];
  maxSteps?: number;
}

export function solveLogically(grid: Grid, options: LogicalSolveOptions = {}): SolveResult {
  const working = cloneGrid(grid);
  const techniques = options.techniques ?? DEFAULT_TECHNIQUES;
  const maxSteps = options.maxSteps ?? 500;
  const steps: Step[] = [];

  for (let stepIndex = 0; stepIndex < maxSteps; stepIndex++) {
    computeCandidates(working);
    if (isSolved(working)) {
      return { solved: true, steps, grid: working };
    }

    const step = findNextStep(working, techniques);
    if (!step) {
      return { solved: false, steps, grid: working };
    }

    applyStep(working, step);
    steps.push(step);
  }

  return { solved: isSolved(working), steps, grid: working };
}

export function findNextStep(
  grid: Grid,
  techniques: Technique[] = DEFAULT_TECHNIQUES,
): Step | null {
  computeCandidates(grid);
  for (const technique of techniques) {
    const step = technique.find(grid);
    if (step) {
      return step;
    }
  }
  return null;
}
