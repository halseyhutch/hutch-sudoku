import { describe, expect, it } from "vitest";
import { countSolutions, generatePuzzle } from "../../src/engine";

function seededRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

describe("generator", () => {
  it("generates a puzzle with a unique solution", () => {
    const puzzle = generatePuzzle({
      random: seededRandom(1234),
      symmetry: "none",
      minClues: 32,
    });

    expect(puzzle.givens.filter((value) => value !== 0).length).toBeGreaterThanOrEqual(32);
    expect(countSolutions(puzzle.givens, { limit: 2 }).count).toBe(1);
  });
});
