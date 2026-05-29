import { openDB, type DBSchema } from "idb";
import { reviveGameState, type GameState } from "../state/game";

const DB_NAME = "sudoku-pwa";
const DB_VERSION = 2;
const CURRENT_GAME_KEY = "current-game";
const STATS_KEY = "stats";

interface SudokuDb extends DBSchema {
  games: {
    key: string;
    value: PersistedGame;
  };
  stats: {
    key: string;
    value: GameStats;
  };
}

export type ThemePreference = "light" | "dark";

export interface GameStats {
  bestTimeMsByDifficulty: Partial<Record<GameState["requestedDifficulty"], number>>;
  completedKeys: string[];
  gamesCompleted: number;
  gamesCompletedByDifficulty: Partial<Record<GameState["requestedDifficulty"], number>>;
}

export interface PersistedGame {
  autoFillSingles: boolean;
  givens: number[];
  gradeBand: GameState["gradeBand"];
  gradeScore: number;
  inputMode: GameState["inputMode"];
  notes: number[];
  pencilMode: boolean;
  puzzleNumber: number;
  requestedDifficulty: GameState["requestedDifficulty"];
  selectedCell: number | null;
  selectedDigit: GameState["selectedDigit"];
  solution: number[];
  startedAt: string;
  savedAt: string;
  values: number[];
}

export async function loadCurrentGame(): Promise<GameState | null> {
  const db = await getDb();
  const saved = await db.get("games", CURRENT_GAME_KEY);
  return saved ? reviveGameState(saved) : null;
}

export async function saveCurrentGame(state: GameState): Promise<void> {
  const db = await getDb();
  await db.put("games", toPersistedGame(state), CURRENT_GAME_KEY);
}

export async function exportCurrentGame(state: GameState): Promise<Blob> {
  return new Blob([JSON.stringify(toPersistedGame(state), null, 2)], {
    type: "application/json",
  });
}

export async function importGameFile(file: File): Promise<GameState | null> {
  const parsed = JSON.parse(await file.text()) as unknown;
  return reviveGameState(parsed);
}

export async function loadStats(): Promise<GameStats> {
  const db = await getDb();
  return (await db.get("stats", STATS_KEY)) ?? emptyStats();
}

export async function recordCompletedGame(state: GameState): Promise<GameStats> {
  const db = await getDb();
  const stats = (await db.get("stats", STATS_KEY)) ?? emptyStats();
  const key = puzzleKey(state);

  if (stats.completedKeys.includes(key)) {
    return stats;
  }

  const elapsedMs = Math.max(0, Date.now() - Date.parse(state.startedAt));
  const difficulty = state.requestedDifficulty;
  const next: GameStats = {
    completedKeys: [...stats.completedKeys, key],
    gamesCompleted: stats.gamesCompleted + 1,
    gamesCompletedByDifficulty: {
      ...stats.gamesCompletedByDifficulty,
      [difficulty]: (stats.gamesCompletedByDifficulty[difficulty] ?? 0) + 1,
    },
    bestTimeMsByDifficulty: {
      ...stats.bestTimeMsByDifficulty,
      [difficulty]: Math.min(stats.bestTimeMsByDifficulty[difficulty] ?? Number.POSITIVE_INFINITY, elapsedMs),
    },
  };
  await db.put("stats", next, STATS_KEY);
  return next;
}

export function loadThemePreference(): ThemePreference {
  return localStorage.getItem("sudoku-theme") === "dark" ? "dark" : "light";
}

export function saveThemePreference(theme: ThemePreference): void {
  localStorage.setItem("sudoku-theme", theme);
}

async function getDb() {
  return openDB<SudokuDb>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains("games")) {
        db.createObjectStore("games");
      }
      if (!db.objectStoreNames.contains("stats")) {
        db.createObjectStore("stats");
      }
    },
  });
}

function toPersistedGame(state: GameState): PersistedGame {
  return {
    autoFillSingles: state.autoFillSingles,
    givens: Array.from(state.givens),
    gradeBand: state.gradeBand,
    gradeScore: state.gradeScore,
    inputMode: state.inputMode,
    notes: Array.from(state.notes),
    pencilMode: state.pencilMode,
    puzzleNumber: state.puzzleNumber,
    requestedDifficulty: state.requestedDifficulty,
    selectedCell: state.selectedCell,
    selectedDigit: state.selectedDigit,
    solution: Array.from(state.solution),
    startedAt: state.startedAt,
    savedAt: new Date().toISOString(),
    values: Array.from(state.values),
  };
}

function emptyStats(): GameStats {
  return {
    bestTimeMsByDifficulty: {},
    completedKeys: [],
    gamesCompleted: 0,
    gamesCompletedByDifficulty: {},
  };
}

function puzzleKey(state: GameState): string {
  return Array.from(state.givens).join("");
}
