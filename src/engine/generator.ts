import { CELL_COUNT } from "./grid";
import { countSolutions, fillSolvedGrid } from "./bruteSolver";
import { gradePuzzle, type DifficultyBand, type Grade } from "./grader";
import type { Givens } from "./types";

export interface GenerateOptions {
  random?: () => number;
  symmetry?: "none" | "rotational";
  minClues?: number;
  maxAttempts?: number;
  difficulty?: Exclude<DifficultyBand, "Unrated">;
  maxGradeAttempts?: number;
}

export interface GeneratedPuzzle {
  givens: Givens;
  solution: Uint8Array;
  grade: Grade;
}

export function generatePuzzle(options: GenerateOptions = {}): GeneratedPuzzle {
  const maxGradeAttempts = options.difficulty ? (options.maxGradeAttempts ?? 50) : 1;

  for (let gradeAttempt = 0; gradeAttempt < maxGradeAttempts; gradeAttempt++) {
    const puzzle = generateUniquePuzzle(options, options.difficulty);
    if (!options.difficulty || puzzle.grade.band === options.difficulty) {
      return puzzle;
    }
  }

  throw new Error(`Failed to generate a ${options.difficulty} puzzle.`);
}

function generateUniquePuzzle(options: GenerateOptions, difficulty?: Exclude<DifficultyBand, "Unrated">): GeneratedPuzzle {
  const random = options.random ?? Math.random;
  const symmetry = options.symmetry ?? "rotational";
  const minClues = options.minClues ?? 24;
  const maxAttempts = options.maxAttempts ?? 3;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const solution = fillSolvedGrid(random);
    const givens = new Uint8Array(solution);
    const groups = removalGroups(symmetry, random);

    for (const group of groups) {
      if (countClues(givens) - group.length < minClues) {
        continue;
      }

      const removed = group.map((cell) => givens[cell]);
      group.forEach((cell) => {
        givens[cell] = 0;
      });

      if (countSolutions(givens, { limit: 2 }).count !== 1) {
        group.forEach((cell, index) => {
          givens[cell] = removed[index];
        });
        continue;
      }

      if (difficulty && shouldStopRemoving(givens, difficulty)) {
        break;
      }
    }

    if (countSolutions(givens, { limit: 2 }).count === 1) {
      return { givens, solution, grade: gradePuzzle(givens) };
    }
  }

  throw new Error("Failed to generate a unique puzzle.");
}

function shouldStopRemoving(givens: Givens, difficulty: Exclude<DifficultyBand, "Unrated">): boolean {
  const grade = gradePuzzle(givens);
  if (!grade.solved) {
    return true;
  }

  switch (difficulty) {
    case "Easy":
      return grade.band === "Easy" && countClues(givens) <= 45;
    case "Medium":
      return grade.band === "Medium";
    case "Hard":
      return grade.band === "Hard";
    case "Expert":
      return grade.band === "Expert";
  }
}

function removalGroups(symmetry: GenerateOptions["symmetry"], random: () => number): number[][] {
  if (symmetry === "none") {
    return shuffled(
      Array.from({ length: CELL_COUNT }, (_, cell) => [cell]),
      random,
    );
  }

  const seen = new Set<number>();
  const groups: number[][] = [];
  for (let cell = 0; cell < CELL_COUNT; cell++) {
    if (seen.has(cell)) {
      continue;
    }
    const opposite = CELL_COUNT - 1 - cell;
    const group = cell === opposite ? [cell] : [cell, opposite];
    group.forEach((entry) => seen.add(entry));
    groups.push(group);
  }
  return shuffled(groups, random);
}

function shuffled<T>(items: T[], random: () => number): T[] {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index--) {
    const swapIndex = Math.floor(random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}

function countClues(givens: Givens): number {
  return givens.reduce((count, value) => count + (value === 0 ? 0 : 1), 0);
}
