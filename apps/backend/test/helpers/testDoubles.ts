import type { Logger, LogLevel } from "../../src/0-platform/observability/logger.js";
import type { FormulaLimits } from "../../src/0-platform/formula/limits.js";
import type { Usage } from "../../src/0-platform/intelligence/types.js";

export interface CapturedLog {
  level: LogLevel;
  message: string;
  data?: unknown;
}

export class CapturingLogger implements Logger {
  readonly entries: CapturedLog[] = [];

  debug(message: string, data?: unknown): void {
    this.entries.push({ level: "debug", message, data });
  }

  info(message: string, data?: unknown): void {
    this.entries.push({ level: "info", message, data });
  }

  warn(message: string, data?: unknown): void {
    this.entries.push({ level: "warn", message, data });
  }

  error(message: string, data?: unknown): void {
    this.entries.push({ level: "error", message, data });
  }
}

export const ZERO_USAGE: Usage = {
  promptTokens: 0,
  completionTokens: 0,
  totalTokens: 0,
  reasoningTokens: 0
};

export const TEST_FORMULA_LIMITS: FormulaLimits = {
  maxSourceBytes: 65_536,
  maxTokens: 4_096,
  maxNodes: 2_048,
  maxDepth: 64,
  maxSteps: 1_000_000,
  maxCallDepth: 32,
  maxFields: 256,
  maxRows: 100_000,
  maxCells: 1_000_000,
  maxOutputBytes: 1_048_576,
  maxIntegerBits: 4_096,
  maxPowerMagnitude: 1_000,
  maxRoundingPlaces: 20
};
