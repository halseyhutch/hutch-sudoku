import { describe, expect, it } from "vitest";
import { bandForScore, gradePuzzle, parseGivens } from "../../src/engine";

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

describe("grader", () => {
  it("grades the same puzzle repeatably", () => {
    const givens = parseGivens(EASY);
    const first = gradePuzzle(givens);
    const second = gradePuzzle(givens);

    expect(second.score).toBe(first.score);
    expect(second.band).toBe(first.band);
    expect(second.hardestTechnique).toBe(first.hardestTechnique);
    expect(first.solved).toBe(true);
  });

  it("maps numeric scores into difficulty bands", () => {
    expect(bandForScore(50)).toBe("Easy");
    expect(bandForScore(150)).toBe("Medium");
    expect(bandForScore(250)).toBe("Hard");
    expect(bandForScore(400)).toBe("Expert");
  });
});
