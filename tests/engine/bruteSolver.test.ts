import { describe, expect, it } from "vitest";
import { countSolutions, parseGivens, solveOne } from "../../src/engine";

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

const SOLUTION =
  "534678912" +
  "672195348" +
  "198342567" +
  "859761423" +
  "426853791" +
  "713924856" +
  "961537284" +
  "287419635" +
  "345286179";

describe("brute solver", () => {
  it("solves a known puzzle", () => {
    const solution = solveOne(parseGivens(EASY));

    expect(solution && Array.from(solution).join("")).toBe(SOLUTION);
  });

  it("counts unique solutions up to a limit", () => {
    expect(countSolutions(parseGivens(EASY), { limit: 2 }).count).toBe(1);
  });
});
