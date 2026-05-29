import { UNITS, bit, box, col, computeCandidates, createGrid, generatePuzzle, getHint, parseGivens, row, singleDigitOf } from "../engine";
import type { DifficultyBand, Digit, Givens, Mask, Step } from "../engine";

export type PuzzleDifficulty = Extract<DifficultyBand, "Easy" | "Medium">;

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
  startedAt: string;
  hint: Step | null;
  hintLevel: 0 | 1 | 2 | 3;
  gradeBand: DifficultyBand;
  gradeScore: number;
  requestedDifficulty: PuzzleDifficulty;
  error: string | null;
  autoFillSingles: boolean;
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
  | { type: "new-game"; difficulty: PuzzleDifficulty }
  | { type: "request-hint" }
  | { type: "clear-hint" }
  | { type: "apply-hint" }
  | { type: "fill-notes" }
  | { type: "toggle-auto-singles" }
  | { type: "load-game"; state: GameState };

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
    startedAt: new Date().toISOString(),
    hint: null,
    hintLevel: 0,
    gradeBand: "Easy",
    gradeScore: 0,
    requestedDifficulty: "Easy",
    error: null,
    autoFillSingles: false,
  };
}

export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case "load-game":
      return action.state;
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
      return clearHint(undo(state));
    case "redo":
      return clearHint(redo(state));
    case "new-game":
      return createGeneratedGame(state, action.difficulty);
    case "request-hint":
      if (state.hint) {
        return { ...state, hintLevel: Math.min(3, state.hintLevel + 1) as 1 | 2 | 3 };
      }
      return { ...state, hint: getHint(state.values), hintLevel: 1 };
    case "clear-hint":
      return { ...state, hint: null, hintLevel: 0 };
    case "apply-hint":
      return applyHint(state);
    case "fill-notes":
      return {
        ...state,
        notes: computeNotes(state.values),
        hint: null,
        hintLevel: 0,
        error: null,
      };
    case "toggle-auto-singles":
      return applyAutomation({
        ...state,
        autoFillSingles: !state.autoFillSingles,
        hint: null,
        hintLevel: 0,
        error: null,
      });
  }
}

export function reviveGameState(saved: unknown): GameState | null {
  if (!saved || typeof saved !== "object") {
    return null;
  }

  const candidate = saved as Partial<GameState>;
  if (!isCellArray(candidate.givens) || !isCellArray(candidate.solution) || !isCellArray(candidate.values)) {
    return null;
  }

  return {
    givens: new Uint8Array(candidate.givens),
    solution: new Uint8Array(candidate.solution),
    values: new Uint8Array(candidate.values),
    notes: isCellArray(candidate.notes) ? new Uint16Array(candidate.notes) : new Uint16Array(81),
    selectedCell: typeof candidate.selectedCell === "number" ? candidate.selectedCell : firstEmptyCell(new Uint8Array(candidate.values)),
    selectedDigit: isDigit(candidate.selectedDigit) ? candidate.selectedDigit : null,
    pencilMode: Boolean(candidate.pencilMode),
    inputMode: candidate.inputMode === "digit-first" ? "digit-first" : "cell-first",
    undoStack: [],
    redoStack: [],
    puzzleNumber: Number.isInteger(candidate.puzzleNumber) ? candidate.puzzleNumber! : 1,
    startedAt: typeof candidate.startedAt === "string" ? candidate.startedAt : new Date().toISOString(),
    hint: null,
    hintLevel: 0,
    gradeBand: candidate.gradeBand ?? "Unrated",
    gradeScore: Number.isFinite(candidate.gradeScore) ? candidate.gradeScore! : 0,
    requestedDifficulty: candidate.requestedDifficulty === "Medium" ? "Medium" : "Easy",
    error: null,
    autoFillSingles: Boolean(candidate.autoFillSingles),
  };
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

function createGeneratedGame(state: GameState, difficulty: PuzzleDifficulty): GameState {
  try {
    const puzzle = generatePuzzle({
      difficulty,
      maxGradeAttempts: difficulty === "Easy" ? 25 : 150,
      minClues: difficulty === "Easy" ? 40 : 24,
      symmetry: difficulty === "Easy" ? "rotational" : "none",
    });
    const nextGame: GameState = {
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
      puzzleNumber: state.puzzleNumber + 1,
      startedAt: new Date().toISOString(),
      hint: null,
      hintLevel: 0,
      gradeBand: puzzle.grade.band,
      gradeScore: puzzle.grade.score,
      requestedDifficulty: difficulty,
      error: null,
      autoFillSingles: state.autoFillSingles,
    };
    return applyAutomation(nextGame);
  } catch {
    return {
      ...state,
      hint: null,
      hintLevel: 0,
      requestedDifficulty: difficulty,
      error: `Could not generate a ${difficulty} puzzle. Try again.`,
    };
  }
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
  const digitBit = bit(digit);
  values[cell] = 0;
  notes[cell] ^= digitBit;
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

  return applyAutomation({
    ...state,
    values,
    notes,
    selectedCell: move.cell,
    undoStack: state.undoStack.slice(0, -1),
    redoStack: [...state.redoStack, move],
  });
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

  return applyAutomation({
    ...state,
    values,
    notes,
    selectedCell: move.cell,
    undoStack: [...state.undoStack, move],
    redoStack: state.redoStack.slice(0, -1),
  });
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

  return applyAutomation({
    ...state,
    values,
    notes,
    selectedCell: cell,
    undoStack: [...state.undoStack, { cell, before, after }],
    redoStack: [],
    hint: null,
    hintLevel: 0,
    error: null,
  });
}

function applyHint(state: GameState): GameState {
  if (!state.hint) {
    return state;
  }

  let nextState = state;
  for (const placement of state.hint.placements) {
    nextState = applyDigit(nextState, placement.cell, placement.digit);
  }

  if (state.hint.eliminations.length > 0) {
    const notes = new Uint16Array(nextState.notes);
    let changed = false;
    for (const elimination of state.hint.eliminations) {
      const previous = notes[elimination.cell];
      notes[elimination.cell] &= ~bit(elimination.digit);
      changed ||= notes[elimination.cell] !== previous;
    }
    nextState = changed ? { ...nextState, notes } : nextState;
  }

  return applyAutomation({ ...nextState, hint: null, hintLevel: 0 });
}

function clearHint(state: GameState): GameState {
  return state.hint ? { ...state, hint: null, hintLevel: 0 } : state;
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

function isCellArray(value: unknown): value is ArrayLike<number> {
  return (
    typeof value === "object" &&
    value !== null &&
    "length" in value &&
    (value as { length: number }).length === 81
  );
}

function isDigit(value: unknown): value is Digit {
  return typeof value === "number" && value >= 1 && value <= 9 && Number.isInteger(value);
}

function applyAutomation(state: GameState): GameState {
  let values = state.values;
  let notes = state.notes;

  if (state.autoFillSingles && conflictsFor(values).size === 0) {
    const filled = fillSingles(values);
    values = filled.values;
    if (filled.changed) {
      notes = new Uint16Array(notes);
      filled.placements.forEach(({ cell, digit }) => {
        removePlacedDigitFromNotes(notes, cell, digit);
      });
    }
  }

  return values === state.values && notes === state.notes ? state : { ...state, values, notes };
}

function fillSingles(sourceValues: Uint8Array): { changed: boolean; placements: { cell: number; digit: Digit }[]; values: Uint8Array } {
  const values = new Uint8Array(sourceValues);
  const placements: { cell: number; digit: Digit }[] = [];
  let changed = false;

  for (let pass = 0; pass < 81; pass++) {
    const grid = createGrid(values);
    computeCandidates(grid);
    const placement = findSinglePlacement(grid);
    if (!placement) {
      break;
    }

    values[placement.cell] = placement.digit;
    placements.push(placement);
    changed = true;
  }

  return { changed, placements, values };
}

function findSinglePlacement(grid: ReturnType<typeof createGrid>): { cell: number; digit: Digit } | null {
  for (let cell = 0; cell < grid.values.length; cell++) {
    if (grid.values[cell] !== 0) {
      continue;
    }

    const digit = singleDigitOf(grid.candidates[cell]);
    if (digit !== null) {
      return { cell, digit };
    }
  }

  for (const unit of UNITS) {
    for (let digit = 1; digit <= 9; digit++) {
      const cells = unit.cells.filter((cell) => grid.values[cell] === 0 && (grid.candidates[cell] & bit(digit)) !== 0);
      if (cells.length === 1) {
        return { cell: cells[0], digit: digit as Digit };
      }
    }
  }

  return null;
}

function computeNotes(values: Uint8Array): Uint16Array {
  const grid = createGrid(values);
  computeCandidates(grid);
  return new Uint16Array(grid.candidates);
}

function removePlacedDigitFromNotes(notes: Uint16Array, cell: number, digit: Digit): void {
  const digitBit = bit(digit);
  notes[cell] = 0;
  for (let peer = 0; peer < notes.length; peer++) {
    if (peer !== cell && (row(peer) === row(cell) || col(peer) === col(cell) || box(peer) === box(cell))) {
      notes[peer] &= ~digitBit;
    }
  }
}
