import { describe, expect, it } from "vitest";
import { bit } from "../../src/engine";
import { conflictsFor, createInitialGame, gameReducer, isComplete } from "../../src/state/game";

describe("game reducer", () => {
  it("places digits, supports undo and redo", () => {
    const selected = gameReducer(createInitialGame(), { type: "select-cell", cell: 2 });
    const placed = gameReducer(selected, { type: "select-digit", digit: 4 });

    expect(placed.values[2]).toBe(4);
    expect(placed.undoStack).toHaveLength(1);

    const undone = gameReducer(placed, { type: "undo" });
    expect(undone.values[2]).toBe(0);
    expect(undone.redoStack).toHaveLength(1);

    const redone = gameReducer(undone, { type: "redo" });
    expect(redone.values[2]).toBe(4);
  });

  it("toggles pencil notes without placing a value", () => {
    const selected = gameReducer(createInitialGame(), { type: "select-cell", cell: 2 });
    const pencil = gameReducer(selected, { type: "toggle-pencil" });
    const noted = gameReducer(pencil, { type: "select-digit", digit: 4 });

    expect(noted.values[2]).toBe(0);
    expect(noted.notes[2]).toBe(bit(4));
  });

  it("adds a note when digit-first mode and pencil mode are both active", () => {
    const state = createInitialGame();
    const digitMode = gameReducer(state, { type: "toggle-input-mode" });
    const selectedDigit = gameReducer(digitMode, { type: "select-digit", digit: 4 });
    const pencil = gameReducer(selectedDigit, { type: "toggle-pencil" });
    const noted = gameReducer(pencil, { type: "select-cell", cell: 2 });

    expect(noted.values[2]).toBe(0);
    expect(noted.notes[2]).toBe(bit(4));
  });

  it("does not overwrite a placed digit when adding notes", () => {
    const selected = gameReducer(createInitialGame(), { type: "select-cell", cell: 2 });
    const placed = gameReducer(selected, { type: "select-digit", digit: 4 });
    const pencil = gameReducer(placed, { type: "toggle-pencil" });
    const attemptedNote = gameReducer(pencil, { type: "select-digit", digit: 7 });

    expect(attemptedNote.values[2]).toBe(4);
    expect(attemptedNote.notes[2]).toBe(0);
  });

  it("finds row, column, and box conflicts", () => {
    const state = createInitialGame();
    const values = new Uint8Array(state.values);
    values[2] = 5;

    expect(conflictsFor(values).has(0)).toBe(true);
    expect(conflictsFor(values).has(2)).toBe(true);
  });

  it("detects completed puzzles", () => {
    const state = createInitialGame();

    expect(isComplete({ ...state, values: new Uint8Array(state.solution) })).toBe(true);
  });
});
