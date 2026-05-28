import { describe, expect, it } from "vitest";
import { ALL, PEERS, bit, createGrid, digitsOf, parseGivens, popcount } from "../../src/engine";

describe("grid primitives", () => {
  it("maps masks to digits", () => {
    expect(bit(1)).toBe(1);
    expect(bit(9)).toBe(256);
    expect(popcount(ALL)).toBe(9);
    expect(digitsOf(bit(2) | bit(8))).toEqual([2, 8]);
  });

  it("precomputes 20 peers for every cell", () => {
    expect(PEERS).toHaveLength(81);
    expect(PEERS.every((peers) => peers.length === 20)).toBe(true);
  });

  it("computes candidates from placed values", () => {
    const givens = parseGivens(
      "53..7...." +
        "6..195..." +
        ".98....6." +
        "8...6...3" +
        "4..8.3..1" +
        "7...2...6" +
        ".6....28." +
        "...419..5" +
        "....8..79",
    );
    const grid = createGrid(givens);

    expect(digitsOf(grid.candidates[2])).toEqual([1, 2, 4]);
  });
});
