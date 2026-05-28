import { CELL_COUNT } from "./grid";
import { countSolutions, fillSolvedGrid } from "./bruteSolver";
import type { Givens } from "./types";

export interface GenerateOptions {
  random?: () => number;
  symmetry?: "none" | "rotational";
  minClues?: number;
  maxAttempts?: number;
}

export interface GeneratedPuzzle {
  givens: Givens;
  solution: Uint8Array;
}

export function generatePuzzle(options: GenerateOptions = {}): GeneratedPuzzle {
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
      }
    }

    if (countSolutions(givens, { limit: 2 }).count === 1) {
      return { givens, solution };
    }
  }

  throw new Error("Failed to generate a unique puzzle.");
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
