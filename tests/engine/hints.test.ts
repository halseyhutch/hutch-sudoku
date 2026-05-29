import { describe, expect, it } from "vitest";
import { getHint, parseGivens } from "../../src/engine";

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

describe("hints", () => {
  it("returns the next logical step for current board values", () => {
    const hint = getHint(parseGivens(EASY));

    expect(hint?.placements.length).toBeGreaterThan(0);
    expect(hint?.explanation).toContain("only");
  });

  it("does not return a hint for an invalid board", () => {
    const values = parseGivens(EASY);
    values[2] = 5;

    expect(getHint(values)).toBeNull();
  });
});
