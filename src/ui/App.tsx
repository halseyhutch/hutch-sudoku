import { Eraser, FilePlus2, Grid3X3, Pencil, Redo2, Undo2 } from "lucide-react";
import type { Dispatch, ReactNode } from "react";
import { useEffect, useMemo, useReducer } from "react";
import { digitsOf } from "../engine";
import type { Digit } from "../engine";
import {
  conflictsFor,
  createInitialGame,
  gameReducer,
  isComplete,
  type GameAction,
  type GameState,
} from "../state/game";

const DIGITS: Digit[] = [1, 2, 3, 4, 5, 6, 7, 8, 9];

export function App() {
  const [state, dispatch] = useReducer(gameReducer, undefined, createInitialGame);
  const conflicts = useMemo(() => conflictsFor(state.values), [state.values]);
  const digitCounts = useMemo(() => countPlacedDigits(state.values), [state.values]);
  const complete = isComplete(state);

  useDesktopKeyboard(dispatch);

  return (
    <main className="app-shell">
      <section className="play-area" aria-label="Sudoku game">
        <header className="topbar">
          <div>
            <p className="eyebrow">Puzzle {state.puzzleNumber}</p>
            <h1>Sudoku</h1>
          </div>
          <div className="toolbar" aria-label="Game actions">
            <IconButton label="New game" onClick={() => dispatch({ type: "new-game" })}>
              <FilePlus2 />
            </IconButton>
          </div>
        </header>

        <div className="game-layout">
          <Board
            conflicts={conflicts}
            dispatch={dispatch}
            givens={state.givens}
            inputMode={state.inputMode}
            notes={state.notes}
            selectedCell={state.selectedCell}
            selectedDigit={state.selectedDigit}
            values={state.values}
          />

          <aside className="controls" aria-label="Controls">
            <div className="status-row" aria-live="polite">
              {complete ? "Complete" : conflicts.size > 0 ? "Conflicts shown" : "Ready"}
            </div>

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
            </div>

            <div className="mini-stats" aria-label="Progress">
              <Grid3X3 aria-hidden="true" />
              <span>{state.values.filter((value) => value !== 0).length}/81 filled</span>
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}

interface BoardProps {
  conflicts: Set<number>;
  dispatch: Dispatch<GameAction>;
  givens: Uint8Array;
  inputMode: GameState["inputMode"];
  notes: Uint16Array;
  selectedCell: number | null;
  selectedDigit: Digit | null;
  values: Uint8Array;
}

function Board({ conflicts, dispatch, givens, inputMode, notes, selectedCell, selectedDigit, values }: BoardProps) {
  return (
    <div className={inputMode === "digit-first" ? "board digit-mode" : "board"} role="grid" aria-label="Sudoku board">
      {Array.from({ length: 81 }, (_, cell) => {
        const value = values[cell];
        const selected = selectedCell === cell;
        const sameDigit = selectedDigit !== null && value === selectedDigit;
        const classes = [
          "cell",
          givens[cell] ? "given" : "",
          selected ? "selected" : "",
          sameDigit ? "same-digit" : "",
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
