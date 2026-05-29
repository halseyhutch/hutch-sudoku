import { Download, Eraser, FilePlus2, Lightbulb, Moon, Pencil, Redo2, Sun, Undo2, Upload, X } from "lucide-react";
import type { Dispatch, ReactNode } from "react";
import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import { digitsOf } from "../engine";
import type { Digit } from "../engine";
import {
  exportCurrentGame,
  importGameFile,
  loadCurrentGame,
  loadStats,
  loadThemePreference,
  recordCompletedGame,
  saveCurrentGame,
  saveThemePreference,
  type GameStats,
  type ThemePreference,
} from "../persistence/gameStorage";
import {
  conflictsFor,
  createInitialGame,
  gameReducer,
  isComplete,
  type GameAction,
  type GameState,
  type PuzzleDifficulty,
} from "../state/game";

const DIGITS: Digit[] = [1, 2, 3, 4, 5, 6, 7, 8, 9];

export function App() {
  const [state, dispatch] = useReducer(gameReducer, undefined, createInitialGame);
  const [newGameOpen, setNewGameOpen] = useState(false);
  const [generatingDifficulty, setGeneratingDifficulty] = useState<PuzzleDifficulty | null>(null);
  const [storageMessage, setStorageMessage] = useState<string | null>(null);
  const [stats, setStats] = useState<GameStats | null>(null);
  const [theme, setTheme] = useState<ThemePreference>(() => loadThemePreference());
  const hydrated = useRef(false);
  const importInputRef = useRef<HTMLInputElement>(null);
  const conflicts = useMemo(() => conflictsFor(state.values), [state.values]);
  const digitCounts = useMemo(() => countPlacedDigits(state.values), [state.values]);
  const hintMarks = useMemo(() => marksForHint(state.hint, state.hintLevel), [state.hint, state.hintLevel]);
  const complete = isComplete(state);

  useDesktopKeyboard(dispatch);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    saveThemePreference(theme);
  }, [theme]);

  useEffect(() => {
    if (!storageMessage) {
      return;
    }
    const handle = window.setTimeout(() => setStorageMessage(null), 2800);
    return () => window.clearTimeout(handle);
  }, [storageMessage]);

  useEffect(() => {
    let active = true;
    loadStats()
      .then((loadedStats) => {
        if (active) {
          setStats(loadedStats);
        }
      })
      .catch(() => {
        if (active) {
          setStorageMessage("Stats could not be loaded.");
        }
      });
    loadCurrentGame()
      .then((saved) => {
        if (active && saved) {
          dispatch({ type: "load-game", state: saved });
        }
      })
      .catch(() => {
        if (active) {
          setStorageMessage("Saved game could not be loaded.");
        }
      })
      .finally(() => {
        if (active) {
          hydrated.current = true;
        }
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!complete) {
      return;
    }
    recordCompletedGame(state)
      .then(setStats)
      .catch(() => setStorageMessage("Stats could not be saved."));
  }, [complete, state]);

  useEffect(() => {
    if (!hydrated.current) {
      return;
    }
    const handle = window.setTimeout(() => {
      saveCurrentGame(state).catch(() => setStorageMessage("Game could not be saved."));
    }, 250);
    return () => window.clearTimeout(handle);
  }, [state]);

  return (
    <main className="app-shell">
      <section className="play-area" aria-label="Sudoku game">
        <header className="topbar">
          <div className="top-status" aria-live="polite">
            {complete ? "Complete" : conflicts.size > 0 ? "Conflicts shown" : `${state.gradeBand} (${state.gradeScore})`}
          </div>
          <div className="toolbar" aria-label="Game actions">
            <IconButton
              label={theme === "light" ? "Switch to dark theme" : "Switch to light theme"}
              onClick={() => setTheme((current) => (current === "light" ? "dark" : "light"))}
            >
              {theme === "light" ? <Moon /> : <Sun />}
            </IconButton>
            <IconButton label="Export game" onClick={() => void handleExport(state, setStorageMessage)}>
              <Download />
            </IconButton>
            <IconButton label="Import game" onClick={() => importInputRef.current?.click()}>
              <Upload />
            </IconButton>
            <IconButton label="New game" onClick={() => setNewGameOpen((open) => !open)}>
              <FilePlus2 />
            </IconButton>
          </div>
          <input
            accept="application/json"
            className="file-input"
            ref={importInputRef}
            type="file"
            onChange={(event) => {
              const file = event.currentTarget.files?.[0];
              event.currentTarget.value = "";
              if (!file) {
                return;
              }
              void handleImport(file, dispatch, setStorageMessage);
            }}
          />
        </header>

        <div className="game-layout">
          <Board
            conflicts={conflicts}
            dispatch={dispatch}
            givens={state.givens}
            inputMode={state.inputMode}
            hintMarks={hintMarks}
            notes={state.notes}
            selectedCell={state.selectedCell}
            selectedDigit={state.selectedDigit}
            values={state.values}
          />

          <aside className="controls" aria-label="Controls">
            {state.error ? (
              <div className="error-row" role="status">
                {state.error}
              </div>
            ) : null}
            <div className="segmented" role="group" aria-label="Input mode">
              <button
                className={state.inputMode === "cell-first" ? "active" : ""}
                type="button"
                onClick={() => state.inputMode !== "cell-first" && dispatch({ type: "toggle-input-mode" })}
              >
                Cell
              </button>
              <button
                className={state.inputMode === "digit-first" ? "active" : ""}
                type="button"
                onClick={() => state.inputMode !== "digit-first" && dispatch({ type: "toggle-input-mode" })}
              >
                Digit
              </button>
            </div>

            <div className="keypad" aria-label="Digit keypad">
              {DIGITS.map((digit) => (
                <button
                  aria-label={`Digit ${digit}`}
                  className={[
                    "digit",
                    state.selectedDigit === digit ? "selected" : "",
                    digitCounts[digit] >= 9 ? "complete" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  key={digit}
                  onClick={() => dispatch({ type: "select-digit", digit })}
                  type="button"
                >
                  {digit}
                </button>
              ))}
            </div>

            <div className="tool-row">
              <IconButton label="Undo" disabled={state.undoStack.length === 0} onClick={() => dispatch({ type: "undo" })}>
                <Undo2 />
              </IconButton>
              <IconButton label="Redo" disabled={state.redoStack.length === 0} onClick={() => dispatch({ type: "redo" })}>
                <Redo2 />
              </IconButton>
              <IconButton
                active={state.pencilMode}
                label={state.pencilMode ? "Turn notes off" : "Turn notes on"}
                onClick={() => dispatch({ type: "toggle-pencil" })}
              >
                <Pencil />
              </IconButton>
              <IconButton label="Erase cell" onClick={() => dispatch({ type: "erase" })}>
                <Eraser />
              </IconButton>
              <IconButton
                label={state.hint && state.hintLevel < 3 ? "More hint" : state.hint ? "Hint shown" : "Hint"}
                onClick={() => dispatch({ type: "request-hint" })}
              >
                <Lightbulb />
              </IconButton>
            </div>

            <HintPanel dispatch={dispatch} hint={state.hint} hintLevel={state.hintLevel} />

            <StatsPanel stats={stats} />

            <div className="automation-controls" aria-label="Automation">
              <button className="automation-button" type="button" onClick={() => dispatch({ type: "fill-notes" })}>
                Auto-fill notes
              </button>
              <label className="toggle-row">
                <input
                  checked={state.autoFillSingles}
                  onChange={() => dispatch({ type: "toggle-auto-singles" })}
                  type="checkbox"
                />
                <span>Auto-fill singles</span>
              </label>
            </div>
          </aside>
        </div>
        {newGameOpen ? (
          <NewGameChooser
            currentDifficulty={state.requestedDifficulty}
            disabled={generatingDifficulty !== null}
            onClose={() => setNewGameOpen(false)}
            onStart={(difficulty) => {
              void handleNewGame(difficulty, dispatch, setNewGameOpen, setGeneratingDifficulty);
            }}
          />
        ) : null}
        {storageMessage ? (
          <div className="toast-overlay" role="status" aria-live="polite">
            {storageMessage}
          </div>
        ) : null}
        {generatingDifficulty ? <GeneratingOverlay difficulty={generatingDifficulty} /> : null}
      </section>
    </main>
  );
}

function StatsPanel({ stats }: { stats: GameStats | null }) {
  if (!stats) {
    return null;
  }

  return (
    <section className="stats-panel" aria-label="Stats">
      <div>
        <strong>{stats.gamesCompleted}</strong>
        <span>done</span>
      </div>
      <div>
        <strong>{stats.gamesCompletedByDifficulty.Easy ?? 0}</strong>
        <span>easy</span>
      </div>
      <div>
        <strong>{stats.gamesCompletedByDifficulty.Medium ?? 0}</strong>
        <span>medium</span>
      </div>
      <div>
        <strong>{formatBestTime(stats)}</strong>
        <span>best</span>
      </div>
    </section>
  );
}

function formatBestTime(stats: GameStats): string {
  const best = Math.min(
    stats.bestTimeMsByDifficulty.Easy ?? Number.POSITIVE_INFINITY,
    stats.bestTimeMsByDifficulty.Medium ?? Number.POSITIVE_INFINITY,
  );
  if (!Number.isFinite(best)) {
    return "--";
  }
  const minutes = Math.floor(best / 60000);
  const seconds = Math.floor((best % 60000) / 1000);
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

async function handleNewGame(
  difficulty: PuzzleDifficulty,
  dispatch: Dispatch<GameAction>,
  setNewGameOpen: (open: boolean) => void,
  setGeneratingDifficulty: (difficulty: PuzzleDifficulty | null) => void,
): Promise<void> {
  setNewGameOpen(false);
  setGeneratingDifficulty(difficulty);
  await new Promise((resolve) => window.requestAnimationFrame(() => window.requestAnimationFrame(resolve)));
  dispatch({ type: "new-game", difficulty });
  setGeneratingDifficulty(null);
}

async function handleExport(state: GameState, setStorageMessage: (message: string | null) => void): Promise<void> {
  try {
    const blob = await exportCurrentGame(state);
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `sudoku-save-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    setStorageMessage("Game exported.");
  } catch {
    setStorageMessage("Game could not be exported.");
  }
}

async function handleImport(
  file: File,
  dispatch: Dispatch<GameAction>,
  setStorageMessage: (message: string | null) => void,
): Promise<void> {
  try {
    const imported = await importGameFile(file);
    if (!imported) {
      setStorageMessage("Import file was not a valid saved game.");
      return;
    }
    dispatch({ type: "load-game", state: imported });
    await saveCurrentGame(imported);
    setStorageMessage("Game imported.");
  } catch {
    setStorageMessage("Game could not be imported.");
  }
}

interface BoardProps {
  conflicts: Set<number>;
  dispatch: Dispatch<GameAction>;
  givens: Uint8Array;
  hintMarks: Map<number, HintMark>;
  inputMode: GameState["inputMode"];
  notes: Uint16Array;
  selectedCell: number | null;
  selectedDigit: Digit | null;
  values: Uint8Array;
}

function Board({ conflicts, dispatch, givens, hintMarks, inputMode, notes, selectedCell, selectedDigit, values }: BoardProps) {
  return (
    <div className={inputMode === "digit-first" ? "board digit-mode" : "board"} role="grid" aria-label="Sudoku board">
      {Array.from({ length: 81 }, (_, cell) => {
        const value = values[cell];
        const selected = selectedCell === cell;
        const sameDigit = selectedDigit !== null && value === selectedDigit;
        const hintMark = hintMarks.get(cell);
        const classes = [
          "cell",
          givens[cell] ? "given" : "",
          selected ? "selected" : "",
          sameDigit ? "same-digit" : "",
          hintMark ? `hint-${hintMark}` : "",
          conflicts.has(cell) ? "conflict" : "",
        ]
          .filter(Boolean)
          .join(" ");

        return (
          <button
            aria-label={`Row ${Math.floor(cell / 9) + 1}, column ${(cell % 9) + 1}${value ? `, ${value}` : ", empty"}`}
            className={classes}
            data-testid={`cell-${cell}`}
            key={cell}
            onClick={() => dispatch({ type: "select-cell", cell })}
            role="gridcell"
            type="button"
          >
            {value ? (
              <span className="value">{value}</span>
            ) : (
              <Notes digitMode={inputMode === "digit-first"} mask={notes[cell]} selectedDigit={selectedDigit} />
            )}
          </button>
        );
      })}
    </div>
  );
}

function HintPanel({
  dispatch,
  hint,
  hintLevel,
}: {
  dispatch: Dispatch<GameAction>;
  hint: GameState["hint"];
  hintLevel: GameState["hintLevel"];
}) {
  return (
    <section className="hint-panel" aria-label="Hint">
      {hint ? (
        <div className="hint-copy" aria-live="polite">
          <div className="hint-title-row">
            <strong>{techniqueLabel(hint.technique)}</strong>
            <IconButton label="Clear hint" onClick={() => dispatch({ type: "clear-hint" })}>
              <X />
            </IconButton>
          </div>
          <p>{hintText(hint, hintLevel)}</p>
          {hintLevel >= 3 ? (
            <button className="apply-hint" type="button" onClick={() => dispatch({ type: "apply-hint" })}>
              Apply
            </button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function NewGameChooser({
  currentDifficulty,
  disabled,
  onClose,
  onStart,
}: {
  currentDifficulty: PuzzleDifficulty;
  disabled: boolean;
  onClose: () => void;
  onStart: (difficulty: PuzzleDifficulty) => void;
}) {
  const difficulties: PuzzleDifficulty[] = ["Easy", "Medium"];

  return (
    <div className="new-game-popover" role="dialog" aria-label="New puzzle">
      <div className="new-game-header">
        <strong>New puzzle</strong>
        <IconButton label="Close new puzzle chooser" onClick={onClose}>
          <X />
        </IconButton>
      </div>
      <div className="difficulty-options" role="group" aria-label="Difficulty">
        {difficulties.map((difficulty) => (
          <button
            className={difficulty === currentDifficulty ? "difficulty-option active" : "difficulty-option"}
            disabled={disabled}
            key={difficulty}
            type="button"
            onClick={() => onStart(difficulty)}
          >
            {difficulty}
          </button>
        ))}
      </div>
    </div>
  );
}

function GeneratingOverlay({ difficulty }: { difficulty: PuzzleDifficulty }) {
  return (
    <div className="generating-overlay" role="status" aria-live="polite">
      <div className="spinner" aria-hidden="true" />
      <span>Generating {difficulty}</span>
    </div>
  );
}

function Notes({
  digitMode,
  mask,
  selectedDigit,
}: {
  digitMode: boolean;
  mask: number;
  selectedDigit: Digit | null;
}) {
  const digits = digitsOf(mask);
  return (
    <span className="notes" aria-hidden="true">
      {DIGITS.map((digit) => (
        <span className={digitMode && selectedDigit === digit && digits.includes(digit) ? "note-match" : ""} key={digit}>
          {digits.includes(digit) ? digit : ""}
        </span>
      ))}
    </span>
  );
}

interface IconButtonProps {
  active?: boolean;
  children: ReactNode;
  disabled?: boolean;
  label: string;
  onClick: () => void;
}

function IconButton({ active = false, children, disabled = false, label, onClick }: IconButtonProps) {
  return (
    <button
      aria-label={label}
      className={active ? "icon-button active" : "icon-button"}
      disabled={disabled}
      onClick={onClick}
      title={label}
      type="button"
    >
      {children}
    </button>
  );
}

function useDesktopKeyboard(dispatch: Dispatch<GameAction>): void {
  useEffect(() => {
    const isDesktopPointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    if (!isDesktopPointer) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.altKey || event.ctrlKey || event.metaKey) {
        return;
      }

      const digit = Number(event.key);
      if (digit >= 1 && digit <= 9) {
        event.preventDefault();
        dispatch({ type: "enter-digit", digit: digit as Digit });
        return;
      }

      if (event.key === "Backspace" || event.key === "Delete" || event.key === "0") {
        event.preventDefault();
        dispatch({ type: "erase" });
        return;
      }

      if (event.key.toLowerCase() === "n") {
        event.preventDefault();
        dispatch({ type: "toggle-pencil" });
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [dispatch]);
}

function countPlacedDigits(values: Uint8Array): Record<Digit, number> {
  const counts = Object.fromEntries(DIGITS.map((digit) => [digit, 0])) as Record<Digit, number>;
  values.forEach((value) => {
    if (value >= 1 && value <= 9) {
      counts[value as Digit]++;
    }
  });
  return counts;
}

type HintMark = "focus" | "placement" | "elimination";

function marksForHint(hint: GameState["hint"], hintLevel: GameState["hintLevel"]): Map<number, HintMark> {
  const marks = new Map<number, HintMark>();
  if (!hint || hintLevel < 2) {
    return marks;
  }

  for (const highlight of hint.highlights) {
    highlight.cells?.forEach((cell) => marks.set(cell, "focus"));
  }
  if (hintLevel >= 3) {
    hint.eliminations.forEach((elimination) => marks.set(elimination.cell, "elimination"));
    hint.placements.forEach((placement) => marks.set(placement.cell, "placement"));
  }
  return marks;
}

function techniqueLabel(technique: string): string {
  return technique
    .split("-")
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(" ");
}

function hintText(hint: NonNullable<GameState["hint"]>, hintLevel: GameState["hintLevel"]): string {
  if (hintLevel <= 1) {
    return `There is a ${techniqueLabel(hint.technique)} available.`;
  }

  if (hintLevel === 2) {
    const focus = hint.highlights.flatMap((highlight) => [
      ...(highlight.cells ?? []).map(cellLabel),
      ...(highlight.unit ? [unitLabel(highlight.unit)] : []),
    ]);
    const uniqueFocus = [...new Set(focus)];
    return uniqueFocus.length > 0 ? `Focus on ${uniqueFocus.join(", ")}.` : "Look at the highlighted area.";
  }

  return formatHintAnswer(hint);
}

function cellLabel(cell: number): string {
  return `r${Math.floor(cell / 9) + 1}c${(cell % 9) + 1}`;
}

function unitLabel(unit: { kind: string; index: number }): string {
  return `${unit.kind} ${unit.index + 1}`;
}

function formatHintAnswer(hint: NonNullable<GameState["hint"]>): string {
  if (hint.placements.length > 0) {
    return hint.placements
      .map((placement) => `${placement.digit} is the only candidate left for ${cellLabel(placement.cell)}.`)
      .join(" ");
  }

  if (hint.eliminations.length > 0) {
    return hint.eliminations
      .map((elimination) => `remove ${elimination.digit} from ${cellLabel(elimination.cell)}`)
      .join(", ");
  }

  return hint.explanation;
}
