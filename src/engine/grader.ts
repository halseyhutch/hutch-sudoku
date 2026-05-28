import { createGrid } from "./grid";
import { solveLogically } from "./logicalSolver";
import type { Givens, Grid, Step } from "./types";

export type DifficultyBand = "Easy" | "Medium" | "Hard" | "Expert" | "Unrated";

export interface Grade {
  solved: boolean;
  score: number;
  band: DifficultyBand;
  hardestStep: Step | null;
  steps: Step[];
}

export function gradePuzzle(puzzle: Givens | Grid): Grade {
  const grid = "candidates" in puzzle ? puzzle : createGrid(puzzle);
  const result = solveLogically(grid);
  const hardestStep = result.steps.reduce<Step | null>((hardest, step) => {
    if (!hardest) {
      return step;
    }
    return stepScore(step) > stepScore(hardest) ? step : hardest;
  }, null);
  const score = result.steps.reduce((total, step) => total + stepScore(step), 0);

  return {
    solved: result.solved,
    score,
    band: result.solved ? bandForScore(score) : "Unrated",
    hardestStep,
    steps: result.steps,
  };
}

function stepScore(step: Step): number {
  switch (step.technique) {
    case "naked-single":
      return 1;
    case "hidden-single":
      return 2;
    default:
      return 10;
  }
}

function bandForScore(score: number): DifficultyBand {
  if (score < 90) {
    return "Easy";
  }
  if (score < 160) {
    return "Medium";
  }
  if (score < 260) {
    return "Hard";
  }
  return "Expert";
}
