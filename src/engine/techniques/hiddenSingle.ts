import { UNITS, bit } from "../grid";
import type { Digit, Step, Technique } from "../types";

export const hiddenSingle: Technique = {
  id: "hidden-single",
  difficulty: 20,
  find(grid): Step | null {
    for (const unit of UNITS) {
      for (let digit = 1; digit <= 9; digit++) {
        const digitBit = bit(digit);
        const cells = unit.cells.filter(
          (cell) => grid.values[cell] === 0 && (grid.candidates[cell] & digitBit) !== 0,
        );

        if (cells.length !== 1) {
          continue;
        }

        const cell = cells[0];
        return {
          technique: "hidden-single",
          placements: [{ cell, digit: digit as Digit }],
          eliminations: [],
          highlights: [
            { unit, digit: digit as Digit, reason: "only possible cell in unit" },
            { cells: [cell], digit: digit as Digit, reason: "placement cell" },
          ],
          explanation: `${digit} can only go in cell ${cell} within ${unit.kind} ${unit.index + 1}.`,
        };
      }
    }

    return null;
  },
};
