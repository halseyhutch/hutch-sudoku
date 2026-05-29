import { createGrid } from "./grid";
import { solveLogically } from "./logicalSolver";
import type { Givens, Grid, Step, TechniqueId } from "./types";

export type DifficultyBand = "Easy" | "Medium" | "Hard" | "Expert" | "Unrated";

export interface GradingConfig {
  bands: {
    easyMax: number;
    mediumMax: number;
    hardMax: number;
  };
  hardStepRepeatWeight: number;
}

export interface Grade {
  solved: boolean;
  score: number;
  band: DifficultyBand;
  hardestStep: Step | null;
  hardestTechnique: TechniqueId | null;
  steps: Step[];
}

export const DEFAULT_GRADING_CONFIG: GradingConfig = {
  bands: {
    easyMax: 110,
    mediumMax: 190,
    hardMax: 300,
  },
  hardStepRepeatWeight: 0.35,
};

export const TECHNIQUE_SCORES: Record<TechniqueId, number> = {
  "naked-single": 10,
  "hidden-single": 20,
  pointing: 35,
  claiming: 38,
  "naked-pair": 50,
  "hidden-pair": 55,
  "naked-triple": 70,
  "hidden-triple": 78,
  "x-wing": 110,
  swordfish: 140,
  "xy-wing": 145,
  "simple-coloring": 160,
};

export function gradePuzzle(puzzle: Givens | Grid): Grade {
  const grid = "candidates" in puzzle ? puzzle : createGrid(puzzle);
  const result = solveLogically(grid);
  const hardestStep = result.steps.reduce<Step | null>((hardest, step) => {
    if (!hardest) {
      return step;
    }
    return stepScore(step) > stepScore(hardest) ? step : hardest;
  }, null);
  const score = result.solved ? scoreSteps(result.steps) : 0;

  return {
    solved: result.solved,
    score,
    band: result.solved ? bandForScore(score) : "Unrated",
    hardestStep,
    hardestTechnique: hardestStep?.technique ?? null,
    steps: result.steps,
  };
}

function stepScore(step: Step): number {
  return TECHNIQUE_SCORES[step.technique];
}

function scoreSteps(steps: Step[], config: GradingConfig = DEFAULT_GRADING_CONFIG): number {
  if (steps.length === 0) {
    return 0;
  }

  const hardest = Math.max(...steps.map(stepScore));
  const repeatPressure = steps.reduce((total, step) => {
    const score = stepScore(step);
    return total + Math.max(0, score - 20) * config.hardStepRepeatWeight;
  }, 0);
  const lengthPressure = Math.max(0, steps.length - 45) * 0.5;

  return Math.round(hardest + repeatPressure + lengthPressure);
}

export function bandForScore(score: number, config: GradingConfig = DEFAULT_GRADING_CONFIG): DifficultyBand {
  if (score <= config.bands.easyMax) {
    return "Easy";
  }
  if (score <= config.bands.mediumMax) {
    return "Medium";
  }
  if (score <= config.bands.hardMax) {
    return "Hard";
  }
  return "Expert";
}
