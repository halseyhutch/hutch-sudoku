import { bit, box, col, generatePuzzle, parseGivens, row } from "../engine";
import type { Digit, Givens, Mask } from "../engine";

export interface CellSnapshot {
  value: number;
  notes: Mask;
}

export interface Move {
  cell: number;
  before: CellSnapshot;
  after: CellSnapshot;
}

export interface GameState {
  givens: Givens;
  solution: Uint8Array;
  values: Uint8Array;
  notes: Uint16Array;
  selectedCell: number | null;
  selectedDigit: Digit | null;
  pencilMode: boolean;
  inputMode: "cell-first" | "digit-first";
  undoStack: Move[];
  redoStack: Move[];
  puzzleNumber: number;
}

export type GameAction =
  | { type: "select-cell"; cell: number }
  | { type: "select-digit"; digit: Digit }
  | { type: "enter-digit"; digit: Digit }
  | { type: "erase" }
  | { type: "toggle-note"; digit: Digit }
  | { type: "toggle-pencil" }
  | { type: "toggle-input-mode" }
  | { type: "undo" }
  | { type: "redo" }
  | { type: "new-game" };

const STARTER =
  "53..7...." +
  "6..195..." +
  ".98....6." +
  "8...6...3" +
  "4..8.3..1" +
  "7...2...6" +
  ".6....28." +
  "...419..5" +
  "....8..79";

const STARTER_SOLUTION =
  "534678912" +
  "672195348" +
  "198342567" +
  "859761423" +
  "426853791" +
  "713924856" +
  "961537284" +
  "287419635" +
  "345286179";

export function createInitialGame(): GameState {
  const givens = parseGivens(STARTER);
  return {
    givens,
    solution: parseGivens(STARTER_SOLUTION),
    values: new Uint8Array(givens),
    notes: new Uint16Array(81),
    selectedCell: firstEmptyCell(givens),
    selectedDigit: null,
    pencilMode: false,
    inputMode: "cell-first",
    undoStack: [],
    redoStack: [],
    puzzleNumber: 1,
  };
}

export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case "select-cell": {
      const digit = state.inputMode === "digit-first" ? state.selectedDigit : valueAsDigit(state.values[action.cell]);
      const selected = { ...state, selectedCell: action.cell, selectedDigit: digit };
      return state.inputMode === "digit-first" && state.selectedDigit && !state.givens[action.cell]
        ? state.pencilMode
          ? toggleNoteAtCell(selected, action.cell, state.selectedDigit)
          : applyDigit(selected, action.cell, state.selectedDigit)
        : selected;
    }
    case "select-digit":
      return state.inputMode === "digit-first"
        ? { ...state, selectedDigit: action.digit }
        : enterAtSelected(state, action.digit);
    case "enter-digit":
      return enterAtSelected(state, action.digit);
    case "erase":
      return eraseSelected(state);
    case "toggle-note":
      return toggleNoteAtSelected(state, action.digit);
    case "toggle-pencil":
      return { ...state, pencilMode: !state.pencilMode };
    case "toggle-input-mode":
      return {
        ...state,
        inputMode: state.inputMode === "cell-first" ? "digit-first" : "cell-first",
        selectedDigit: null,
      };
    case "undo":
      return undo(state);
    case "redo":
      return redo(state);
    case "new-game":
      return createGeneratedGame(state.puzzleNumber + 1);
  }
}

export function conflictsFor(values: Uint8Array): Set<number> {
  const conflicts = new Set<number>();
  for (let cell = 0; cell < values.length; cell++) {
    const value = values[cell];
    if (value === 0) {
      continue;
    }
    for (let other = cell + 1; other < values.length; other++) {
      if (
        values[other] === value &&
        (row(cell) === row(other) || col(cell) === col(other) || box(cell) === box(other))
      ) {
        conflicts.add(cell);
        conflicts.add(other);
      }
    }
  }
  return conflicts;
}

export function isComplete(state: GameState): boolean {
  return state.values.every((value, cell) => value !== 0 && value === state.solution[cell]);
}

function createGeneratedGame(puzzleNumber: number): GameState {
  const puzzle = generatePuzzle({ symmetry: "rotational", minClues: 32 });
  return {
    givens: puzzle.givens,
    solution: puzzle.solution,
    values: new Uint8Array(puzzle.givens),
    notes: new Uint16Array(81),
    selectedCell: firstEmptyCell(puzzle.givens),
    selectedDigit: null,
    pencilMode: false,
    inputMode: "cell-first",
    undoStack: [],
    redoStack: [],
    puzzleNumber,
  };
}

function enterAtSelected(state: GameState, digit: Digit): GameState {
  if (state.selectedCell === null) {
    return { ...state, selectedDigit: digit };
  }
  if (state.pencilMode) {
    return toggleNoteAtSelected(state, digit);
  }
  return applyDigit({ ...state, selectedDigit: digit }, state.selectedCell, digit);
}

function applyDigit(state: GameState, cell: number, digit: Digit): GameState {
  if (state.givens[cell] || state.values[cell] === digit) {
    return state;
  }

  const before = snapshot(state, cell);
  const values = new Uint8Array(state.values);
  const notes = new Uint16Array(state.notes);
  values[cell] = digit;
  notes[cell] = 0;

  const digitBit = bit(digit);
  for (let peer = 0; peer < values.length; peer++) {
    if (peer !== cell && (row(peer) === row(cell) || col(peer) === col(cell) || box(peer) === box(cell))) {
      notes[peer] &= ~digitBit;
    }
  }

  return commitMove(state, cell, before, { value: digit, notes: 0 }, values, notes);
}

function eraseSelected(state: GameState): GameState {
  if (state.selectedCell === null || state.givens[state.selectedCell]) {
    return state;
  }

  const cell = state.selectedCell;
  const before = snapshot(state, cell);
  if (before.value === 0 && before.notes === 0) {
    return state;
  }

  const values = new Uint8Array(state.values);
  const notes = new Uint16Array(state.notes);
  values[cell] = 0;
  notes[cell] = 0;
  return commitMove(state, cell, before, { value: 0, notes: 0 }, values, notes);
}

function toggleNoteAtSelected(state: GameState, digit: Digit): GameState {
  if (state.selectedCell === null || state.givens[state.selectedCell]) {
    return state;
  }

  return toggleNoteAtCell(state, state.selectedCell, digit);
}

function toggleNoteAtCell(state: GameState, cell: number, digit: Digit): GameState {
  if (state.givens[cell] || state.values[cell] !== 0) {
    return state;
  }

  const before = snapshot(state, cell);
  const values = new Uint8Array(state.values);
  const notes = new Uint16Array(state.notes);
  values[cell] = 0;
  notes[cell] ^= bit(digit);
  return commitMove(state, cell, before, { value: 0, notes: notes[cell] }, values, notes);
}

function undo(state: GameState): GameState {
  const move = state.undoStack.at(-1);
  if (!move) {
    return state;
  }

  const values = new Uint8Array(state.values);
  const notes = new Uint16Array(state.notes);
  values[move.cell] = move.before.value;
  notes[move.cell] = move.before.notes;

  return {
    ...state,
    values,
    notes,
    selectedCell: move.cell,
    undoStack: state.undoStack.slice(0, -1),
    redoStack: [...state.redoStack, move],
  };
}

function redo(state: GameState): GameState {
  const move = state.redoStack.at(-1);
  if (!move) {
    return state;
  }

  const values = new Uint8Array(state.values);
  const notes = new Uint16Array(state.notes);
  values[move.cell] = move.after.value;
  notes[move.cell] = move.after.notes;

  return {
    ...state,
    values,
    notes,
    selectedCell: move.cell,
    undoStack: [...state.undoStack, move],
    redoStack: state.redoStack.slice(0, -1),
  };
}

function commitMove(
  state: GameState,
  cell: number,
  before: CellSnapshot,
  after: CellSnapshot,
  values: Uint8Array,
  notes: Uint16Array,
): GameState {
  if (before.value === after.value && before.notes === after.notes) {
    return state;
  }

  return {
    ...state,
    values,
    notes,
    selectedCell: cell,
    undoStack: [...state.undoStack, { cell, before, after }],
    redoStack: [],
  };
}

function snapshot(state: GameState, cell: number): CellSnapshot {
  return {
    value: state.values[cell],
    notes: state.notes[cell],
  };
}

function firstEmptyCell(values: Uint8Array): number | null {
  const index = values.findIndex((value) => value === 0);
  return index === -1 ? null : index;
}

function valueAsDigit(value: number): Digit | null {
  return value >= 1 && value <= 9 ? (value as Digit) : null;
}
