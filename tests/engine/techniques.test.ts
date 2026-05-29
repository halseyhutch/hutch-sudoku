import { describe, expect, it } from "vitest";
import { applyStep, bit, createGrid, digitsOf } from "../../src/engine";
import { claiming, pointing } from "../../src/engine/techniques/lockedCandidates";
import { hiddenPair, hiddenTriple, nakedPair, nakedTriple } from "../../src/engine/techniques/pairsTriples";
import type { Grid, Mask } from "../../src/engine";

describe("tier two techniques", () => {
  it("finds pointing eliminations", () => {
    const grid = candidateGrid({
      0: mask(5),
      1: mask(5),
      3: mask(2, 5),
    });

    const step = pointing.find(grid);

    expect(step?.technique).toBe("pointing");
    expect(step?.eliminations).toEqual([{ cell: 3, digit: 5 }]);
  });

  it("finds claiming eliminations", () => {
    const grid = candidateGrid({
      0: mask(5),
      1: mask(5),
      9: mask(4, 5),
    });

    const step = claiming.find(grid);

    expect(step?.technique).toBe("claiming");
    expect(step?.eliminations).toEqual([{ cell: 9, digit: 5 }]);
  });

  it("finds naked pairs", () => {
    const grid = candidateGrid({
      0: mask(1, 2),
      1: mask(1, 2),
      2: mask(1, 2, 3),
    });

    const step = nakedPair.find(grid);

    expect(step?.technique).toBe("naked-pair");
    expect(step?.eliminations).toEqual([
      { cell: 2, digit: 1 },
      { cell: 2, digit: 2 },
    ]);
  });

  it("finds naked triples", () => {
    const grid = candidateGrid({
      0: mask(1, 2),
      1: mask(1, 3),
      2: mask(2, 3),
      3: mask(1, 2, 3, 4),
    });

    const step = nakedTriple.find(grid);

    expect(step?.technique).toBe("naked-triple");
    expect(step?.eliminations).toEqual([
      { cell: 3, digit: 1 },
      { cell: 3, digit: 2 },
      { cell: 3, digit: 3 },
    ]);
  });

  it("finds hidden pairs", () => {
    const grid = candidateGrid({
      0: mask(1, 2, 3),
      1: mask(1, 2, 4),
      2: mask(3, 4, 5),
    });

    const step = hiddenPair.find(grid);

    expect(step?.technique).toBe("hidden-pair");
    expect(step?.eliminations).toEqual([
      { cell: 0, digit: 3 },
      { cell: 1, digit: 4 },
    ]);
  });

  it("finds hidden triples", () => {
    const grid = candidateGrid({
      0: mask(1, 2, 4),
      1: mask(1, 3, 5),
      2: mask(2, 3, 6),
      3: mask(4, 5, 6, 7),
    });

    const step = hiddenTriple.find(grid);

    expect(step?.technique).toBe("hidden-triple");
    expect(step?.eliminations).toEqual([
      { cell: 0, digit: 4 },
      { cell: 1, digit: 5 },
      { cell: 2, digit: 6 },
    ]);
  });

  it("preserves prior eliminations when applying a later placement", () => {
    const grid = createGrid();
    grid.candidates[0] = mask(1, 2);

    applyStep(grid, {
      technique: "naked-pair",
      placements: [],
      eliminations: [{ cell: 0, digit: 2 }],
      highlights: [],
      explanation: "test elimination",
    });
    applyStep(grid, {
      technique: "naked-single",
      placements: [{ cell: 1, digit: 3 }],
      eliminations: [],
      highlights: [],
      explanation: "test placement",
    });

    expect(digitsOf(grid.candidates[0])).toEqual([1]);
  });
});

function candidateGrid(candidates: Record<number, Mask>): Grid {
  const grid: Grid = {
    values: new Uint8Array(81),
    candidates: new Uint16Array(81),
    given: Array<boolean>(81).fill(false),
  };

  Object.entries(candidates).forEach(([cell, candidateMask]) => {
    grid.candidates[Number(cell)] = candidateMask;
  });

  return grid;
}

function mask(...digits: number[]): Mask {
  return digits.reduce((result, digit) => result | bit(digit), 0);
}
