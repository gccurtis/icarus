import type {
  Logger,
  LogDetail,
  LogLevel,
  LogOptions
} from "../../src/0-platform/observability/logger.js";
import type { FormulaLimits } from "../../src/0-platform/formula/limits.js";
import type { Usage } from "../../src/0-platform/intelligence/types.js";

export interface CapturedLog {
  level: LogLevel;
  message: string;
  data?: unknown;
  /** Absent means the call was unlabelled, which the Logger reads as `shape`. */
  detail?: LogDetail;
}

/**
 * Captures every record regardless of label — a test asserting that content is
 * only ever written under a `content` label needs to see the records a
 * configured FileLogger would have dropped.
 */
export class CapturingLogger implements Logger {
  readonly entries: CapturedLog[] = [];

  debug(message: string, data?: unknown, options?: LogOptions): void {
    this.capture("debug", message, data, options);
  }

  info(message: string, data?: unknown, options?: LogOptions): void {
    this.capture("info", message, data, options);
  }

  warn(message: string, data?: unknown, options?: LogOptions): void {
    this.capture("warn", message, data, options);
  }

  error(message: string, data?: unknown, options?: LogOptions): void {
    this.capture("error", message, data, options);
  }

  /** Records labelled `content`; unlabelled ones the Logger treats as `shape`. */
  get contentEntries(): readonly CapturedLog[] {
    return this.entries.filter(entry => entry.detail === "content");
  }

  /** What a shape-only build would keep. */
  get shapeEntries(): readonly CapturedLog[] {
    return this.entries.filter(entry => entry.detail !== "content");
  }

  private capture(
    level: LogLevel,
    message: string,
    data: unknown,
    options?: LogOptions
  ): void {
    // `detail` is omitted rather than defaulted so an entry serializes exactly
    // as it did before the label existed.
    this.entries.push({
      level,
      message,
      data,
      ...(options?.detail !== undefined ? { detail: options.detail } : {})
    });
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
