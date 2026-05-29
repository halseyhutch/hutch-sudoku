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
    expect(puzzle.grade.band).not.toBe("Unrated");
  });

  it("can target an Easy puzzle", () => {
    const puzzle = generatePuzzle({
      random: seededRandom(5678),
      symmetry: "none",
      minClues: 40,
      difficulty: "Easy",
      maxGradeAttempts: 10,
    });

    expect(puzzle.grade.band).toBe("Easy");
    expect(countSolutions(puzzle.givens, { limit: 2 }).count).toBe(1);
  });

  it("can target a Medium puzzle", () => {
    const puzzle = generatePuzzle({
      random: seededRandom(9012),
      symmetry: "none",
      minClues: 24,
      difficulty: "Medium",
      maxGradeAttempts: 100,
    });

    expect(puzzle.grade.band).toBe("Medium");
    expect(countSolutions(puzzle.givens, { limit: 2 }).count).toBe(1);
  });

  it("can target a Medium puzzle with app generation settings", () => {
    const puzzle = generatePuzzle({
      random: seededRandom(3456),
      symmetry: "none",
      minClues: 24,
      difficulty: "Medium",
      maxGradeAttempts: 150,
    });

    expect(puzzle.grade.band).toBe("Medium");
    expect(countSolutions(puzzle.givens, { limit: 2 }).count).toBe(1);
  });
});
