import {
  CELL_COUNT,
  PEERS,
  bit,
  cloneGrid,
  computeCandidates,
  createGrid,
  isValidGrid,
  singleDigitOf,
} from "./grid";
import type { Givens, Grid } from "./types";

export interface BruteSolveOptions {
  limit?: number;
  random?: () => number;
}

export interface BruteSolveResult {
  count: number;
  solution: Uint8Array | null;
}

export function solveOne(givens: Givens | Grid): Uint8Array | null {
  return countSolutions(givens, { limit: 1 }).solution;
}

export function hasUniqueSolution(givens: Givens | Grid): boolean {
  return countSolutions(givens, { limit: 2 }).count === 1;
}

export function countSolutions(
  givens: Givens | Grid,
  options: BruteSolveOptions = {},
): BruteSolveResult {
  const limit = options.limit ?? 2;
  const grid = "candidates" in givens ? cloneGrid(givens) : createGrid(givens);
  computeCandidates(grid);

  if (!isValidGrid(grid)) {
    return { count: 0, solution: null };
  }

  const result: BruteSolveResult = { count: 0, solution: null };
  search(grid, result, limit, options.random);
  return result;
}

export function fillSolvedGrid(random: () => number = Math.random): Uint8Array {
  const result = countSolutions(createGrid(), { limit: 1, random });
  if (!result.solution) {
    throw new Error("Failed to generate a solved grid.");
  }
  return result.solution;
}

function search(
  grid: Grid,
  result: BruteSolveResult,
  limit: number,
  random?: () => number,
): Uint8Array | null {
  computeCandidates(grid);
  const next = selectNextCell(grid);

  if (next === "contradiction") {
    return null;
  }

  if (next === "solved") {
    result.count++;
    result.solution ??= new Uint8Array(grid.values);
    return result.solution;
  }

  const digits = digitsForMask(grid.candidates[next], random);
  for (const digit of digits) {
    if (result.count >= limit) {
      break;
    }
    if (!canPlace(grid, next, digit)) {
      continue;
    }
    grid.values[next] = digit;
    search(grid, result, limit, random);
    grid.values[next] = 0;
    computeCandidates(grid);
  }

  computeCandidates(grid);
  return result.solution;
}

function selectNextCell(grid: Grid): number | "solved" | "contradiction" {
  let bestCell = -1;
  let bestCount = 10;

  for (let cell = 0; cell < CELL_COUNT; cell++) {
    if (grid.values[cell] !== 0) {
      continue;
    }
    const mask = grid.candidates[cell];
    const forced = singleDigitOf(mask);
    const count = forced === null ? countBits(mask) : 1;
    if (count === 0) {
      return "contradiction";
    }
    if (count < bestCount) {
      bestCell = cell;
      bestCount = count;
    }
  }

  return bestCell === -1 ? "solved" : bestCell;
}

function canPlace(grid: Grid, cell: number, digit: number): boolean {
  const digitBit = bit(digit);
  if ((grid.candidates[cell] & digitBit) === 0) {
    return false;
  }
  return PEERS[cell].every((peer) => grid.values[peer] !== digit);
}

function digitsForMask(mask: number, random?: () => number): number[] {
  const digits: number[] = [];
  for (let digit = 1; digit <= 9; digit++) {
    if (mask & bit(digit)) {
      digits.push(digit);
    }
  }
  if (random) {
    shuffle(digits, random);
  }
  return digits;
}

function shuffle<T>(items: T[], random: () => number): void {
  for (let index = items.length - 1; index > 0; index--) {
    const swapIndex = Math.floor(random() * (index + 1));
    [items[index], items[swapIndex]] = [items[swapIndex], items[index]];
  }
}

function countBits(mask: number): number {
  let count = 0;
  let remaining = mask;
  while (remaining) {
    remaining &= remaining - 1;
    count++;
  }
  return count;
}
