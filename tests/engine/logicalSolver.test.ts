import { describe, expect, it } from "vitest";
import { createGrid, findNextStep, parseGivens, solveLogically } from "../../src/engine";

const EASY =
  "53..7...." +
  "6..195..." +
  ".98....6." +
  "8...6...3" +
  "4..8.3..1" +
  "7...2...6" +
  ".6....28." +
  "...419..5" +
  "....8..79";

describe("logical solver", () => {
  it("finds a first tier-one step without mutating the source grid", () => {
    const grid = createGrid(parseGivens(EASY));
    const before = Array.from(grid.values).join("");
    const step = findNextStep(grid);

    expect(step?.placements).toHaveLength(1);
    expect(Array.from(grid.values).join("")).toBe(before);
  });

  it("solves an easy puzzle with singles", () => {
    const result = solveLogically(createGrid(parseGivens(EASY)));

    expect(result.solved).toBe(true);
    expect(result.steps.length).toBeGreaterThan(0);
  });
});
