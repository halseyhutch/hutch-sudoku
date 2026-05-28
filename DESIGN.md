# Sudoku PWA — Design Document

> **Status:** Design / not yet implemented.
> **Audience:** Coding agents (and humans) picking this project up from scratch.
> **Last updated:** 2026-05-28

This document is the source of truth for building an offline-capable Sudoku web app.
Read it fully before writing code. Update it as decisions change.

---

## 1. Motivation & goals

The owner enjoyed a now-discontinued app, **Enjoy Sudoku**, whose distinguishing
feature was a **human-technique-based solver**: it could explain *why* the next
move is forced ("hidden single in column 3"), grade puzzles by the hardest
*logical* technique required, and give graded hints. We are rebuilding that
experience as a web app.

### Primary goals
1. **Play Sudoku offline**, including in airplane mode (the original use case is
   playing on a plane). Once loaded, the app must need **zero network**.
2. **Human-technique solver** that produces step-by-step *explanations*, not just
   the final answer.
3. **Difficulty grading** based on the hardest technique a puzzle requires.
4. **Graded hints** ("show me the next logical step and why").
5. Run as an installable **PWA on iPhone** (Add to Home Screen, fullscreen).

### Non-goals (v1)
- No accounts, no backend, no server-side anything. Everything runs client-side.
- No multiplayer, no ads, no analytics, no data collection.
- No App Store / native distribution (a native port may come later; see §13).

### Why web/PWA over native iOS
The owner develops on Windows, comes from a Python data-science background
(comfortable with edit-refresh loops, not Xcode), and primarily wants to play it
themselves offline. Web avoids the Mac requirement, the $99 Apple Developer fee,
code signing, and App Store review. The hard part — the solver/grader engine — is
identical work in either world. See §13 for the native-port path.

---

## 2. Target environment

- **Primary client:** iPhone Safari, installed via "Add to Home Screen."
- **Dev/secondary:** desktop browsers (Chrome/Edge/Firefox/Safari).
- **Offline:** must fully function with no network after first load.

### iOS PWA constraints (must respect these)
- PWAs can **only be installed via Safari** on iOS (not Chrome iOS).
- iOS may **evict cached storage** (Cache API / IndexedDB) under storage pressure
  or after long disuse. Implication: **code re-caches automatically on next online
  visit**, but **user progress must be resilient** — keep it in IndexedDB and offer
  an export/import (or later, optional sync). Never assume storage is permanent.
- Disable double-tap-zoom, long-press text selection, and the iOS callout menu on
  the grid (CSS `touch-action`, `user-select: none`, `-webkit-touch-callout: none`).
- No reliable push notifications; don't depend on them.
- Respect safe-area insets (notch / home indicator) with `env(safe-area-inset-*)`.

---

## 3. Tech stack

| Concern | Choice | Rationale |
|-|-|-|
| Language | **TypeScript** | Type safety; familiar to a Python dev; great for the engine |
| Build tool | **Vite** | Fast dev server, simple, first-class PWA plugin |
| PWA | **vite-plugin-pwa** (Workbox under the hood) | Generates service worker + manifest; precaches the app shell |
| UI framework | **React + TypeScript** (default) | Ubiquitous, maximal reference material for agents. *Svelte is a lighter alternative — see §14 open decisions* |
| Engine | **Pure TypeScript, framework-agnostic** | No UI imports; unit-testable headless; portable to a future native build |
| State | React state/reducer (or Zustand if it grows) | Game state is small; avoid over-engineering |
| Persistence | **IndexedDB** (via `idb` wrapper) for saved games/stats; localStorage for tiny prefs | IndexedDB survives better and holds structured data |
| Testing | **Vitest** | Vite-native; fast; ideal for the engine |
| Hosting | Any static host (GitHub Pages, Netlify, Cloudflare Pages) | App is fully static |

**Hard rule:** the engine (`src/engine/`) must never import React, the DOM, or any
browser API. It is pure functions and data. This keeps it testable and portable.

---

## 4. Architecture overview

```
┌─────────────────────────────────────────────┐
│ UI layer (React)                            │
│  BoardView · Keypad · HintPanel · Library   │
│  Settings · Stats                            │
├─────────────────────────────────────────────┤
│ App state / view-model                       │
│  game reducer · undo stack · selection       │
│  · pencil-mark mode · hint orchestration     │
├─────────────────────────────────────────────┤
│ SudokuEngine (pure TS, no UI)               │
│  Grid · Generator · BruteSolver ·            │
│  LogicalSolver · Techniques[] · Grader       │
├─────────────────────────────────────────────┤
│ Persistence (IndexedDB) + PWA service worker │
└─────────────────────────────────────────────┘
```

The UI talks to the engine through a thin facade. The engine knows nothing about
rendering. The view-model owns mutable game state (current entries, pencil marks,
undo history) and calls the engine for generation, validation, hints, and grading.

---

## 5. Engine design (the core)

This is the heart of the project and where most of the engineering value lives.
Design it carefully before writing techniques.

### 5.1 Representation

- The board is **81 cells**, indexed `0..80` (row-major: `index = row*9 + col`).
- Helpers: `row(i)`, `col(i)`, `box(i)`, and precomputed **peer sets** (the 20 cells
  that share a row, column, or box with a given cell). Precompute peers once as a
  constant — many techniques need them and recomputing is wasteful.
- **Candidates as a bitmask.** Each cell's possible values are a `number` used as a
  9-bit mask (bit `d-1` set means digit `d` is possible). This is the single most
  important design decision: it turns every technique into fast bitwise set
  operations instead of array juggling.

```ts
// Digit d (1..9) <-> bit (d-1)
type Mask = number;                 // bits 0..8
const bit = (d: number): Mask => 1 << (d - 1);
const ALL: Mask = 0b1_1111_1111;    // 511, all 9 candidates
const popcount = (m: Mask): number => { let c = 0; while (m) { m &= m - 1; c++; } return c; };
const digitsOf = (m: Mask): number[] => { const r: number[] = []; for (let d = 1; d <= 9; d++) if (m & bit(d)) r.push(d); return r; };
```

### 5.2 Core types

```ts
/** A puzzle as given: 0 = empty, 1..9 = clue. Length 81. */
type Givens = Uint8Array;

/** Mutable solving state. */
interface Grid {
  /** Solved/placed value per cell, 0 if empty. Length 81. */
  values: Uint8Array;
  /** Candidate bitmask per cell (only meaningful when values[i] === 0). Length 81. */
  candidates: Uint16Array;
  /** True if the clue is an original given (immutable in UI). Length 81. */
  given: boolean[];
}

/** What a technique did — powers BOTH hints and grading. */
interface Step {
  technique: TechniqueId;          // e.g. "hidden-single"
  /** Cells whose value gets set, with the digit. */
  placements: { cell: number; digit: number }[];
  /** Candidate eliminations this step justifies. */
  eliminations: { cell: number; digit: number }[];
  /** Cells/units to highlight to explain the step. */
  highlights: Highlight[];
  /** Human-readable explanation, e.g. "5 is the only place for 7 in box 4." */
  explanation: string;
}

type TechniqueId =
  | "naked-single" | "hidden-single"
  | "pointing" | "claiming"           // locked candidates
  | "naked-pair" | "naked-triple" | "hidden-pair" | "hidden-triple"
  | "x-wing" | "swordfish" | "xy-wing" | "simple-coloring" /* ... */;

interface Technique {
  id: TechniqueId;
  difficulty: number;               // base score, used by the grader
  /** Return the first applicable step, or null. Must NOT mutate the grid. */
  find(grid: Grid): Step | null;
}
```

**Contract for techniques:** `find` is **pure** — it inspects the grid and returns a
`Step` describing what *would* happen, without mutating. A separate `applyStep(grid, step)`
performs the mutation. This separation is what lets the same code drive hints
(describe without applying) and the auto-solver (describe then apply).

### 5.3 Components

- **`Generator`**
  1. Fill an empty grid with a complete valid solution via randomized backtracking.
  2. Remove cells (optionally with rotational symmetry for aesthetics), each time
     checking the puzzle still has a **unique solution** (via `BruteSolver`).
  3. Optionally loop generate→grade until the puzzle lands in a requested difficulty
     band.
- **`BruteSolver`** — backtracking solver. Two modes: "find one solution" and
  "count solutions up to 2" (for uniqueness checking — stop at 2). Used by the
  generator and as a correctness oracle in tests. Not used for hints/grading.
- **`LogicalSolver`** — drives the technique list. Repeatedly: recompute candidates,
  ask each `Technique.find` in difficulty order, apply the first hit, repeat until
  solved or stuck. Records the ordered list of `Step`s. If it gets stuck before
  solving, the puzzle requires a technique we haven't implemented (or guessing) —
  important signal for grading and generation.
- **`Grader`** — from the `Step` list: difficulty ≈ a function of the **hardest**
  technique used and **how often** hard techniques were needed. Map a numeric score
  to bands (Easy / Medium / Hard / Expert / …). Keep the exact formula configurable;
  tune it against a corpus of known-rated puzzles.
- **`computeCandidates(grid)`** — fills `candidates` from current `values` using
  peer constraints. Called at the start of each solver iteration. (Advanced
  techniques assume candidates are accurate.)

### 5.4 Hint orchestration (UI-facing)
`getHint(grid)` = run `LogicalSolver` for exactly one step against the *user's
current* board (respecting their pencil marks if we choose to), return the `Step`.
The UI can reveal it progressively: (1) which technique/region, (2) which cell,
(3) the full placement + explanation.

---

## 6. Technique catalog & implementation order

Implement in this order. After each tier the app is more capable and can grade a
wider range of puzzles. **Tiers 1–2 already make a satisfying, fully playable app
with real hints.**

| Tier | Techniques | Notes |
|-|-|-|
| 1 | Naked Single, Hidden Single | Solves most Easy puzzles; gets the hint loop working end-to-end |
| 2 | Locked Candidates (Pointing, Claiming), Naked/Hidden Pairs & Triples | Covers Easy–Medium |
| 3 | X-Wing, Swordfish, XY-Wing | Fish + basic chains; Hard |
| 4 | Simple Coloring, X-Cycles, XYZ-Wing, Naked/Hidden Quads | Expert |
| 5 | ALS, AIC / forcing chains, etc. | Long tail; diminishing returns — add as desired |

Each technique is its own file with its own unit tests built from known textbook
positions. Implement from the **prose descriptions** on sudokuwiki.org — do **not**
copy GPL code (see §12).

---

## 7. UI design

### Components
- **`BoardView`** — the 9×9 grid. Renders cell values, pencil marks (3×3 mini-grid),
  selection highlight, same-digit highlight, conflict highlight, and hint highlights.
  Keep cells **value-driven** (a plain `CellState` struct passed down); do **not**
  give each of 81 cells its own subscription/observable — that thrashes. Let the
  parent diff.
- **`Keypad`** — digits 1–9, erase, and a **pencil-mode toggle**.
- **`HintPanel`** — "Hint" button; reveals the next `Step` progressively with its
  explanation and highlights.
- **`Toolbar`** — undo/redo, new game, difficulty selector, notes auto-fill.
- **`Library` / `Stats` / `Settings`** — saved games, completion stats, themes,
  input-mode preference.

### Input model (decide early — affects the view-model)
Support both, common in good Sudoku apps:
- **Cell-first:** select a cell, then tap a digit.
- **Digit-first ("paint"):** select a digit, then tap cells to place/mark it.
Make it a setting; default to cell-first.

### Interaction details
- Long-press or a mode toggle for pencil marks.
- Undo/redo stack of moves (each entry = cell, old state, new state).
- Auto-conflict highlighting; optionally auto-remove pencil marks when a peer is set
  (a setting).
- Haptics aren't reliable on iOS web; don't rely on them.

---

## 8. PWA / offline

- Use **vite-plugin-pwa** in `injectManifest` or `generateSW` mode to:
  - **Precache the app shell** (HTML/JS/CSS/icons) so the app boots offline.
  - Provide a **web app manifest** (name, icons incl. 180×180 Apple touch icon,
    `display: standalone`, theme/background colors, portrait orientation).
- Because puzzle generation is **on-device**, the app is fully functional offline
  with no puzzle pre-download needed. Optionally pre-generate and cache a small set
  of daily puzzles for variety.
- Add an "Add to Home Screen" hint for first-time iOS Safari visitors (iOS doesn't
  show an install prompt automatically).
- Test the offline path explicitly: load once, kill network (DevTools offline / real
  airplane mode), confirm full play + hints + generation still work.

---

## 9. Persistence

- **IndexedDB** (via the `idb` library) for: in-progress game (so it survives reload),
  saved/finished games, and stats (games played, win rate, time, best times per
  difficulty).
- **localStorage** for tiny prefs (theme, input mode).
- Provide **export/import** (JSON download/upload) so progress survives iOS cache
  eviction. This is the pragmatic substitute for cloud sync in v1.

---

## 10. Suggested project structure

```
sudoku-pwa/
├── DESIGN.md                     # this file
├── index.html
├── package.json
├── vite.config.ts                # + vite-plugin-pwa config
├── public/
│   ├── icons/                    # PWA icons incl. apple-touch-icon-180.png
│   └── manifest.webmanifest      # (or generated by the plugin)
├── src/
│   ├── engine/                   # PURE TS — no UI, no DOM
│   │   ├── grid.ts               # Grid, masks, peers, computeCandidates, applyStep
│   │   ├── bruteSolver.ts
│   │   ├── generator.ts
│   │   ├── logicalSolver.ts
│   │   ├── grader.ts
│   │   ├── techniques/
│   │   │   ├── index.ts          # ordered technique registry
│   │   │   ├── nakedSingle.ts
│   │   │   ├── hiddenSingle.ts
│   │   │   ├── lockedCandidates.ts
│   │   │   ├── pairsTriples.ts
│   │   │   ├── xWing.ts
│   │   │   └── ...
│   │   └── types.ts              # Grid, Step, Technique, etc.
│   ├── state/                    # view-model: game reducer, undo, selection
│   ├── ui/                       # React components
│   │   ├── BoardView.tsx
│   │   ├── Cell.tsx
│   │   ├── Keypad.tsx
│   │   ├── HintPanel.tsx
│   │   └── ...
│   ├── persistence/              # IndexedDB wrappers, export/import
│   └── main.tsx
└── tests/                        # Vitest; engine tests mirror src/engine
```

---

## 11. Build / dev / deploy

```bash
npm create vite@latest sudoku-pwa -- --template react-ts
cd sudoku-pwa
npm install
npm install -D vite-plugin-pwa
npm install idb
# dev:    npm run dev      (edit-refresh loop, works on Windows)
# test:   npm run test     (vitest)
# build:  npm run build    (static output in dist/)
# deploy: push dist/ to any static host (GitHub Pages / Netlify / Cloudflare Pages)
```

No Mac, no Xcode, no signing, no app review. To install on iPhone: open the
deployed URL in **Safari** → Share → **Add to Home Screen**.

---

## 12. Licensing / IP caveats (important)

- Reference implementations **Sudoku Explainer** (Nicolas Juillerat) and **HoDoKu**
  are **GPL**. You may *study* them, but **do not copy their code** — implement
  techniques from the prose descriptions on **sudokuwiki.org** to keep this project
  free of GPL obligations.
- Sudoku rules and technique *names* are not protected. Do **not** reuse the original
  app's name, branding, icons, or assets. Pick an original name.

---

## 13. Milestones (build order with acceptance criteria)

1. **Engine core (headless).** Grid + masks + peers, BruteSolver, Generator with
   uniqueness check. ✅ *Accept:* generate 1,000 puzzles in a test; each has exactly
   one solution (verified by the count-to-2 solver).
2. **Playable UI.** BoardView + Keypad, selection, digit entry, pencil marks,
   conflict highlight, undo/redo, new-game. ✅ *Accept:* can play a generated puzzle
   to completion in the browser.
3. **Logical solver + Tier 1–2 techniques.** Steps with explanations. ✅ *Accept:*
   solver solves all Easy/Medium puzzles using only logic; each step has correct
   highlights + explanation (unit-tested on known positions).
4. **Hint system.** "Next step" reveals one `Step` progressively. ✅ *Accept:* on any
   solvable position, hint matches what the solver would do and highlights the right
   cells.
5. **Grading + targeted generation.** ✅ *Accept:* generator returns a puzzle within a
   requested difficulty band; grading is stable/repeatable for a given puzzle.
6. **PWA + offline.** Service worker, manifest, install. ✅ *Accept:* with network
   disabled, the installed app boots, generates, plays, and hints.
7. **Persistence + polish.** IndexedDB save/resume, stats, export/import, themes,
   safe-area handling, anti-zoom CSS. ✅ *Accept:* close & reopen resumes the game;
   export/import round-trips.
8. **Tier 3+ techniques** (X-Wing, Swordfish, XY-Wing, …) — incremental; each widens
   gradable/hint-able range.

### Future / optional
- **Native iOS port:** the engine's design (bitmask + Step/Technique) ports directly
  to Swift. Reuse the *design*, rewrite the UI in SwiftUI. Only worth it for crisper
  touch, App Store distribution, or eviction-proof permanence.

---

## 14. Open decisions (resolve before/at kickoff)

- **UI framework:** React+TS (default, most reference material) vs **Svelte** (less
  boilerplate, lighter — very good for a single-grid app). Engine is framework-
  agnostic either way, so this only affects the UI layer.
- **Symmetry in generation:** rotational symmetry (prettier) vs none (simpler/faster).
- **Difficulty bands & exact grading formula:** tune against a rated corpus.
- **Pencil-mark automation:** auto-fill candidates? auto-remove on placement? (settings)
- **App name.**

---

## 15. Glossary (for agents new to Sudoku solving)

- **Peer:** a cell sharing a row, column, or box with a given cell (20 per cell).
- **Candidate:** a digit still legally placeable in an empty cell.
- **Naked single:** a cell with exactly one candidate.
- **Hidden single:** a digit with exactly one possible cell within a unit (row/col/box).
- **Locked candidates (pointing/claiming):** a digit confined to one box's
  intersection with a line, letting you eliminate it elsewhere on that box or line.
- **Unit:** a row, column, or box (9 cells that must contain 1–9 exactly once).
```
