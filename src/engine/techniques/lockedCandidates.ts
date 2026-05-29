import { BOX_UNITS, COLUMN_UNITS, ROW_UNITS, bit, box, col, row } from "../grid";
import type { Digit, Elimination, Step, Technique } from "../types";

export const pointing: Technique = {
  id: "pointing",
  difficulty: 30,
  find(grid): Step | null {
    for (const boxUnit of BOX_UNITS) {
      for (let digit = 1; digit <= 9; digit++) {
        const candidateCells = cellsWithCandidate(grid, boxUnit.cells, digit);
        if (candidateCells.length < 2) {
          continue;
        }

        const rows = new Set(candidateCells.map(row));
        if (rows.size === 1) {
          const targetRow = row(candidateCells[0]);
          const eliminations = ROW_UNITS[targetRow].cells
            .filter((cell) => box(cell) !== boxUnit.index && hasCandidate(grid, cell, digit))
            .map((cell) => ({ cell, digit: digit as Digit }));
          if (eliminations.length > 0) {
            return pointingStep(boxUnit.index, "row", targetRow, candidateCells, eliminations, digit as Digit);
          }
        }

        const cols = new Set(candidateCells.map(col));
        if (cols.size === 1) {
          const targetColumn = col(candidateCells[0]);
          const eliminations = COLUMN_UNITS[targetColumn].cells
            .filter((cell) => box(cell) !== boxUnit.index && hasCandidate(grid, cell, digit))
            .map((cell) => ({ cell, digit: digit as Digit }));
          if (eliminations.length > 0) {
            return pointingStep(boxUnit.index, "column", targetColumn, candidateCells, eliminations, digit as Digit);
          }
        }
      }
    }

    return null;
  },
};

export const claiming: Technique = {
  id: "claiming",
  difficulty: 32,
  find(grid): Step | null {
    const lineUnits = [...ROW_UNITS, ...COLUMN_UNITS];
    for (const lineUnit of lineUnits) {
      for (let digit = 1; digit <= 9; digit++) {
        const candidateCells = cellsWithCandidate(grid, lineUnit.cells, digit);
        if (candidateCells.length < 2) {
          continue;
        }

        const boxes = new Set(candidateCells.map(box));
        if (boxes.size !== 1) {
          continue;
        }

        const targetBox = box(candidateCells[0]);
        const eliminations = BOX_UNITS[targetBox].cells
          .filter((cell) => !lineUnit.cells.includes(cell) && hasCandidate(grid, cell, digit))
          .map((cell) => ({ cell, digit: digit as Digit }));

        if (eliminations.length > 0) {
          return {
            technique: "claiming",
            placements: [],
            eliminations,
            highlights: [
              { unit: lineUnit, digit: digit as Digit, reason: "candidate confined to one box" },
              { unit: BOX_UNITS[targetBox], digit: digit as Digit, reason: "box receiving eliminations" },
              { cells: candidateCells, digit: digit as Digit, reason: "claiming cells" },
            ],
            explanation: `${digit} in ${lineUnit.kind} ${lineUnit.index + 1} is confined to box ${
              targetBox + 1
            }, so ${digit} can be removed from the rest of that box.`,
          };
        }
      }
    }

    return null;
  },
};

function pointingStep(
  boxIndex: number,
  lineKind: "row" | "column",
  lineIndex: number,
  candidateCells: number[],
  eliminations: Elimination[],
  digit: Digit,
): Step {
  const lineUnit = lineKind === "row" ? ROW_UNITS[lineIndex] : COLUMN_UNITS[lineIndex];
  return {
    technique: "pointing",
    placements: [],
    eliminations,
    highlights: [
      { unit: BOX_UNITS[boxIndex], digit, reason: "candidate confined to one line" },
      { unit: lineUnit, digit, reason: "line receiving eliminations" },
      { cells: candidateCells, digit, reason: "pointing cells" },
    ],
    explanation: `${digit} in box ${boxIndex + 1} is confined to ${lineKind} ${
      lineIndex + 1
    }, so ${digit} can be removed from the rest of that ${lineKind}.`,
  };
}

function cellsWithCandidate(grid: { values: Uint8Array; candidates: Uint16Array }, cells: number[], digit: number): number[] {
  return cells.filter((cell) => hasCandidate(grid, cell, digit));
}

function hasCandidate(grid: { values: Uint8Array; candidates: Uint16Array }, cell: number, digit: number): boolean {
  return grid.values[cell] === 0 && (grid.candidates[cell] & bit(digit)) !== 0;
}
