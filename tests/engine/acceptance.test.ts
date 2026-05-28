import { describe, expect, it } from "vitest";
import { countSolutions, generatePuzzle } from "../../src/engine";

function seededRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

describe("engine core acceptance", () => {
  it("generates 1,000 puzzles with unique solutions", { timeout: 120_000 }, () => {
    const random = seededRandom(20260528);

    for (let index = 0; index < 1_000; index++) {
      const puzzle = generatePuzzle({
        random,
        symmetry: "none",
        minClues: 32,
      });

      expect(countSolutions(puzzle.givens, { limit: 2 }).count).toBe(1);
    }
  });
});
