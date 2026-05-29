import { createGrid, isValidGrid } from "./grid";
import { findNextStep } from "./logicalSolver";
import type { Grid, Step } from "./types";

export function getHint(values: Uint8Array): Step | null {
  const grid = gridFromValues(values);
  if (!isValidGrid(grid)) {
    return null;
  }
  return findNextStep(grid);
}

function gridFromValues(values: Uint8Array): Grid {
  const grid = createGrid();
  grid.values = new Uint8Array(values);
  grid.given = Array<boolean>(values.length).fill(false);
  return grid;
}
