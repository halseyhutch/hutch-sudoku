import type { Digit, Givens, Grid, Mask, Step, UnitKind } from "./types";

export const SIZE = 9;
export const CELL_COUNT = 81;
export const ALL: Mask = 0b1_1111_1111;

export const bit = (digit: number): Mask => {
  assertDigit(digit);
  return 1 << (digit - 1);
};

export const row = (cell: number): number => Math.floor(cell / SIZE);
export const col = (cell: number): number => cell % SIZE;
export const box = (cell: number): number =>
  Math.floor(row(cell) / 3) * 3 + Math.floor(col(cell) / 3);

export const popcount = (mask: Mask): number => {
  let count = 0;
  let remaining = mask;
  while (remaining) {
    remaining &= remaining - 1;
    count++;
  }
  return count;
};

export const digitsOf = (mask: Mask): Digit[] => {
  const digits: Digit[] = [];
  for (let digit = 1; digit <= SIZE; digit++) {
    if (mask & bit(digit)) {
      digits.push(digit as Digit);
    }
  }
  return digits;
};

export const singleDigitOf = (mask: Mask): Digit | null => {
  if (popcount(mask) !== 1) {
    return null;
  }
  return digitsOf(mask)[0] ?? null;
};

export const ROW_UNITS = buildLineUnits("row");
export const COLUMN_UNITS = buildLineUnits("column");
export const BOX_UNITS = buildBoxUnits();
export const UNITS = [...ROW_UNITS, ...COLUMN_UNITS, ...BOX_UNITS];
export const PEERS = buildPeers();

export function parseGivens(input: string): Givens {
  const chars = input.replace(/\s/g, "").split("");
  if (chars.length !== CELL_COUNT) {
    throw new Error(`Expected 81 cells, received ${chars.length}.`);
  }

  const givens = new Uint8Array(CELL_COUNT);
  chars.forEach((char, index) => {
    if (char === "." || char === "0") {
      givens[index] = 0;
      return;
    }
    const value = Number(char);
    assertDigit(value);
    givens[index] = value;
  });
  return givens;
}

export function serializeValues(values: Uint8Array): string {
  assertCellArray(values, "values");
  return Array.from(values, (value) => (value === 0 ? "." : String(value))).join("");
}

export function createGrid(givens?: Givens | number[]): Grid {
  const values = new Uint8Array(CELL_COUNT);
  const given = Array<boolean>(CELL_COUNT).fill(false);

  if (givens) {
    assertCellArray(givens, "givens");
    givens.forEach((value, index) => {
      if (value !== 0) {
        assertDigit(value);
        values[index] = value;
        given[index] = true;
      }
    });
  }

  const grid: Grid = {
    values,
    candidates: new Uint16Array(CELL_COUNT),
    given,
  };
  computeCandidates(grid);
  return grid;
}

export function cloneGrid(grid: Grid): Grid {
  return {
    values: new Uint8Array(grid.values),
    candidates: new Uint16Array(grid.candidates),
    given: [...grid.given],
  };
}

export function isSolved(grid: Grid): boolean {
  return grid.values.every((value) => value !== 0) && isValidGrid(grid);
}

export function isValidGrid(grid: Grid): boolean {
  return UNITS.every((unit) => {
    let seen = 0;
    for (const cell of unit.cells) {
      const value = grid.values[cell];
      if (value === 0) {
        continue;
      }
      const valueBit = bit(value);
      if (seen & valueBit) {
        return false;
      }
      seen |= valueBit;
    }
    return true;
  });
}

export function computeCandidates(grid: Grid): void {
  assertCellArray(grid.values, "values");
  assertCellArray(grid.candidates, "candidates");

  for (let cell = 0; cell < CELL_COUNT; cell++) {
    if (grid.values[cell] !== 0) {
      grid.candidates[cell] = 0;
      continue;
    }

    let mask = ALL;
    for (const peer of PEERS[cell]) {
      const value = grid.values[peer];
      if (value !== 0) {
        mask &= ~bit(value);
      }
    }
    grid.candidates[cell] = mask;
  }
}

export function applyStep(grid: Grid, step: Step): void {
  for (const { cell, digit } of step.placements) {
    assertCell(cell);
    assertDigit(digit);
    if (grid.given[cell] && grid.values[cell] !== digit) {
      throw new Error(`Cannot change given cell ${cell}.`);
    }
    if (grid.values[cell] !== 0 && grid.values[cell] !== digit) {
      throw new Error(`Cell ${cell} already contains ${grid.values[cell]}.`);
    }
    grid.values[cell] = digit;
  }

  computeCandidates(grid);

  for (const { cell, digit } of step.eliminations) {
    assertCell(cell);
    assertDigit(digit);
    if (grid.values[cell] === 0) {
      grid.candidates[cell] &= ~bit(digit);
    }
  }
}

function buildLineUnits(kind: Exclude<UnitKind, "box">) {
  return Array.from({ length: SIZE }, (_, index) => ({
    kind,
    index,
    cells: Array.from({ length: SIZE }, (__, offset) =>
      kind === "row" ? index * SIZE + offset : offset * SIZE + index,
    ),
  }));
}

function buildBoxUnits() {
  return Array.from({ length: SIZE }, (_, index) => {
    const top = Math.floor(index / 3) * 3;
    const left = (index % 3) * 3;
    const cells: number[] = [];
    for (let rowOffset = 0; rowOffset < 3; rowOffset++) {
      for (let colOffset = 0; colOffset < 3; colOffset++) {
        cells.push((top + rowOffset) * SIZE + left + colOffset);
      }
    }
    return { kind: "box" as const, index, cells };
  });
}

function buildPeers(): number[][] {
  return Array.from({ length: CELL_COUNT }, (_, cell) => {
    const peers = new Set<number>();
    for (const unit of UNITS) {
      if (!unit.cells.includes(cell)) {
        continue;
      }
      unit.cells.forEach((peer) => {
        if (peer !== cell) {
          peers.add(peer);
        }
      });
    }
    return [...peers].sort((a, b) => a - b);
  });
}

function assertCellArray(value: { length: number }, name: string): void {
  if (value.length !== CELL_COUNT) {
    throw new Error(`${name} must contain ${CELL_COUNT} cells.`);
  }
}

function assertCell(cell: number): void {
  if (!Number.isInteger(cell) || cell < 0 || cell >= CELL_COUNT) {
    throw new Error(`Invalid cell index: ${cell}.`);
  }
}

function assertDigit(value: number): asserts value is Digit {
  if (!Number.isInteger(value) || value < 1 || value > 9) {
    throw new Error(`Invalid digit: ${value}.`);
  }
}
