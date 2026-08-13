// FormulaLimits — all values come from config, none hardcoded in the engine.

export interface FormulaLimits {
  readonly maxSourceBytes: number;
  readonly maxTokens: number;
  readonly maxNodes: number;
  readonly maxDepth: number;
  readonly maxSteps: number;
  readonly maxCallDepth: number;
  readonly maxFields: number;
  readonly maxRows: number;
  readonly maxCells: number;
  readonly maxOutputBytes: number;
  readonly maxIntegerBits: number;
  readonly maxPowerMagnitude: number;
  readonly maxRoundingPlaces: number;
}
