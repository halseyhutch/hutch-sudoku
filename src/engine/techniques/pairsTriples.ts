import { UNITS, bit, digitsOf, popcount } from "../grid";
import type { Digit, Elimination, Grid, Mask, Step, Technique, TechniqueId } from "../types";

export const nakedPair: Technique = nakedSubset("naked-pair", 2, 40);
export const nakedTriple: Technique = nakedSubset("naked-triple", 3, 50);
export const hiddenPair: Technique = hiddenSubset("hidden-pair", 2, 45);
export const hiddenTriple: Technique = hiddenSubset("hidden-triple", 3, 55);

function nakedSubset(id: TechniqueId, size: 2 | 3, difficulty: number): Technique {
  return {
    id,
    difficulty,
    find(grid): Step | null {
      for (const unit of UNITS) {
        const cells = unit.cells.filter(
          (cell) => grid.values[cell] === 0 && grid.candidates[cell] !== 0 && popcount(grid.candidates[cell]) <= size,
        );

        for (const subset of combinations(cells, size)) {
          const mask = subset.reduce((combined, cell) => combined | grid.candidates[cell], 0);
          if (popcount(mask) !== size) {
            continue;
          }

          const eliminations = unit.cells
            .filter((cell) => !subset.includes(cell) && grid.values[cell] === 0)
            .flatMap((cell) => eliminationsForMask(grid, cell, mask));

          if (eliminations.length > 0) {
            const digits = digitsOf(mask);
            return {
              technique: id,
              placements: [],
              eliminations,
              highlights: [
                { unit, reason: `${size === 2 ? "pair" : "triple"} unit` },
                { cells: subset, reason: `naked ${size === 2 ? "pair" : "triple"} cells` },
              ],
              explanation: `${digits.join("/")} appear only in ${subset.length} cells in ${unit.kind} ${
                unit.index + 1
              }, so they can be removed from the other cells in that unit.`,
            };
          }
        }
      }

      return null;
    },
  };
}

function hiddenSubset(id: TechniqueId, size: 2 | 3, difficulty: number): Technique {
  return {
    id,
    difficulty,
    find(grid): Step | null {
      for (const unit of UNITS) {
        for (const digits of combinations([1, 2, 3, 4, 5, 6, 7, 8, 9] as Digit[], size)) {
          const digitCells = digits.map((digit) => ({
            digit,
            cells: unit.cells.filter((cell) => grid.values[cell] === 0 && (grid.candidates[cell] & bit(digit)) !== 0),
          }));

          if (digitCells.some((entry) => entry.cells.length === 0 || entry.cells.length > size)) {
            continue;
          }

          const targetCells = unique(digitCells.flatMap((entry) => entry.cells));
          if (targetCells.length !== size) {
            continue;
          }

          const keepMask = digits.reduce<Mask>((mask, digit) => mask | bit(digit), 0);
          const eliminations = targetCells.flatMap((cell) => eliminationsForMask(grid, cell, grid.candidates[cell] & ~keepMask));

          if (eliminations.length > 0) {
            return {
              technique: id,
              placements: [],
              eliminations,
              highlights: [
                { unit, reason: `${size === 2 ? "pair" : "triple"} unit` },
                { cells: targetCells, reason: `hidden ${size === 2 ? "pair" : "triple"} cells` },
              ],
              explanation: `${digits.join("/")} are confined to ${targetCells.length} cells in ${unit.kind} ${
                unit.index + 1
              }, so other candidates can be removed from those cells.`,
            };
          }
        }
      }

      return null;
    },
  };
}

function eliminationsForMask(grid: Grid, cell: number, mask: Mask): Elimination[] {
  return digitsOf(grid.candidates[cell] & mask).map((digit) => ({ cell, digit }));
}

function combinations<T>(items: T[], size: number): T[][] {
  if (size === 0) {
    return [[]];
  }
  if (items.length < size) {
    return [];
  }

  const [first, ...rest] = items;
  return [
    ...combinations(rest, size - 1).map((combo) => [first, ...combo]),
    ...combinations(rest, size),
  ];
}

function unique(items: number[]): number[] {
  return [...new Set(items)].sort((a, b) => a - b);
}
