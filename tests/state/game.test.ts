import { describe, expect, it } from "vitest";
import { bit, digitsOf } from "../../src/engine";
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

  it("requests and applies a placement hint", () => {
    const hinted = gameReducer(createInitialGame(), { type: "request-hint" });

    expect(hinted.hint?.placements).toHaveLength(1);
    expect(hinted.hintLevel).toBe(1);

    const placement = hinted.hint!.placements[0];
    const applied = gameReducer(hinted, { type: "apply-hint" });

    expect(applied.values[placement.cell]).toBe(placement.digit);
    expect(applied.hint).toBeNull();
    expect(applied.hintLevel).toBe(0);
    expect(applied.undoStack.length).toBeGreaterThan(0);
  });

  it("reveals hints incrementally", () => {
    const first = gameReducer(createInitialGame(), { type: "request-hint" });
    const second = gameReducer(first, { type: "request-hint" });
    const third = gameReducer(second, { type: "request-hint" });
    const fourth = gameReducer(third, { type: "request-hint" });

    expect(first.hintLevel).toBe(1);
    expect(second.hint).toBe(first.hint);
    expect(second.hintLevel).toBe(2);
    expect(third.hintLevel).toBe(3);
    expect(fourth.hintLevel).toBe(3);
  });

  it("starts a medium puzzle without crashing", () => {
    const state = gameReducer(createInitialGame(), { type: "new-game", difficulty: "Medium" });

    expect(state.requestedDifficulty).toBe("Medium");
    expect(state.gradeBand).toBe("Medium");
    expect(state.error).toBeNull();
  });

  it("fills pencil notes from current candidates on request", () => {
    const state = gameReducer(createInitialGame(), { type: "fill-notes" });

    expect(digitsOf(state.notes[2])).toEqual([1, 2, 4]);
  });

  it("removes an existing note in digit-first pencil mode", () => {
    const withNotes = gameReducer(createInitialGame(), { type: "fill-notes" });
    const digitMode = gameReducer(withNotes, { type: "toggle-input-mode" });
    const selectedDigit = gameReducer(digitMode, { type: "select-digit", digit: 4 });
    const pencil = gameReducer(selectedDigit, { type: "toggle-pencil" });
    const removed = gameReducer(pencil, { type: "select-cell", cell: 2 });
    const restored = gameReducer(removed, { type: "select-cell", cell: 2 });

    expect(digitsOf(removed.notes[2])).toEqual([1, 2]);
    expect(digitsOf(restored.notes[2])).toEqual([1, 2, 4]);
  });

  it("auto-fills naked singles", () => {
    const state = gameReducer(createInitialGame(), { type: "toggle-auto-singles" });

    expect(state.autoFillSingles).toBe(true);
    expect(state.values[40]).toBe(5);
  });

  it("auto-fills hidden singles in a box", () => {
    const values = new Uint8Array(81);
    values[28] = 1;
    values[65] = 1;
    values[12] = 1;
    values[24] = 1;

    const state = gameReducer(
      {
        ...createInitialGame(),
        givens: new Uint8Array(81),
        values,
        notes: new Uint16Array(81),
      },
      { type: "toggle-auto-singles" },
    );

    expect(state.values[0]).toBe(1);
  });

  it("re-evaluates auto-fill singles after each placed digit", () => {
    const values = new Uint8Array(81);
    values[1] = 2;
    values[2] = 3;
    values[3] = 4;
    values[4] = 5;
    values[5] = 6;
    values[6] = 7;
    values[7] = 8;

    const base = {
      ...createInitialGame(),
      givens: new Uint8Array(81),
      values,
      notes: new Uint16Array(81),
      selectedCell: 8,
    };
    const enabled = gameReducer(base, { type: "toggle-auto-singles" });
    const erased = gameReducer(enabled, { type: "erase" });
    const placed = gameReducer({ ...erased, selectedCell: 8 }, { type: "select-digit", digit: 9 });

    expect(placed.values[0]).toBe(1);
  });

  it("updates notes after auto-filled singles place digits", () => {
    const values = new Uint8Array(81);
    values[1] = 2;
    values[2] = 3;
    values[3] = 4;
    values[4] = 5;
    values[5] = 6;
    values[6] = 7;
    values[7] = 8;

    const withNotes = gameReducer(
      {
        ...createInitialGame(),
        givens: new Uint8Array(81),
        values,
        notes: new Uint16Array(81),
        selectedCell: 8,
      },
      { type: "fill-notes" },
    );
    const enabledSingles = gameReducer(withNotes, { type: "toggle-auto-singles" });
    const placed = gameReducer({ ...enabledSingles, selectedCell: 8 }, { type: "select-digit", digit: 9 });

    expect(placed.values[0]).toBe(1);
    expect(digitsOf(placed.notes[9])).not.toContain(1);
  });
});
