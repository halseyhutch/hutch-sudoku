export type CellIndex = number;
export type Digit = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
export type Mask = number;
export type Givens = Uint8Array;

export type UnitKind = "row" | "column" | "box";

export interface Grid {
  values: Uint8Array;
  candidates: Uint16Array;
  given: boolean[];
}

export interface Placement {
  cell: CellIndex;
  digit: Digit;
}

export interface Elimination {
  cell: CellIndex;
  digit: Digit;
}

export interface Highlight {
  cells?: CellIndex[];
  unit?: {
    kind: UnitKind;
    index: number;
  };
  digit?: Digit;
  reason: string;
}

export type TechniqueId =
  | "naked-single"
  | "hidden-single"
  | "pointing"
  | "claiming"
  | "naked-pair"
  | "naked-triple"
  | "hidden-pair"
  | "hidden-triple"
  | "x-wing"
  | "swordfish"
  | "xy-wing"
  | "simple-coloring";

export interface Step {
  technique: TechniqueId;
  placements: Placement[];
  eliminations: Elimination[];
  highlights: Highlight[];
  explanation: string;
}

export interface Technique {
  id: TechniqueId;
  difficulty: number;
  find(grid: Grid): Step | null;
}

export interface SolveResult {
  solved: boolean;
  steps: Step[];
  grid: Grid;
}
