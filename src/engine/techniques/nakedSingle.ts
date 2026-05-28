import { digitsOf } from "../grid";
import type { Step, Technique } from "../types";

export const nakedSingle: Technique = {
  id: "naked-single",
  difficulty: 10,
  find(grid): Step | null {
    for (let cell = 0; cell < grid.values.length; cell++) {
      if (grid.values[cell] !== 0) {
        continue;
      }
      const digits = digitsOf(grid.candidates[cell]);
      if (digits.length !== 1) {
        continue;
      }
      const digit = digits[0];
      return {
        technique: "naked-single",
        placements: [{ cell, digit }],
        eliminations: [],
        highlights: [{ cells: [cell], digit, reason: "single remaining candidate" }],
        explanation: `${digit} is the only candidate left for cell ${cell}.`,
      };
    }

    return null;
  },
};
