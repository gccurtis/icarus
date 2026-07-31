// Rich Text types — the canonical content model for inline text in Icarus.
// Rich Text owns atoms, marks, positions, ranges, and the operations that
// manipulate them. It does NOT own blocks, containers, layouts, or resources.

import type { FormulaWireValue } from "#formula";

// ── Content ──────────────────────────────────────────────────────────────

export interface RichContent {
  readonly atoms: RichTextAtom[];
  readonly marks: RichTextMark[];
}

// ── Atoms ────────────────────────────────────────────────────────────────

export type RichTextAtom =
  | TextAtom
  | FormulaAtom
  | ReferenceAtom
  | HardBreakAtom;

export interface TextAtom {
  readonly id: string;
  readonly kind: "text";
  readonly text: string;
}

export interface FormulaAtom {
  readonly id: string;
  readonly kind: "formula";
  readonly expression: string;
  readonly acceptedValue?: FormulaWireValue;
  readonly displayText: string;
  readonly diagnostic?: RichTextFormulaDiagnostic;
}

export interface ReferenceAtom {
  readonly id: string;
  readonly kind: "reference";
  readonly target: LinkTarget;
  readonly displayText: string;
}

export interface HardBreakAtom {
  readonly id: string;
  readonly kind: "hard-break";
}

// ── Position & Range ─────────────────────────────────────────────────────

export interface TextPosition {
  readonly atomId: string;
  /** UTF-16 code units, half-open */
  readonly offset: number;
}

export interface TextRange {
  readonly start: TextPosition;
  readonly end: TextPosition;
}

// ── Marks ────────────────────────────────────────────────────────────────

export type RichTextMark =
  | SimpleRangeMark<"bold">
  | SimpleRangeMark<"italic">
  | SimpleRangeMark<"underline">
  | SimpleRangeMark<"strike">
  | SimpleRangeMark<"code">
  | StyleMark
  | LinkMark;

export interface SimpleRangeMark<TKind extends string> {
  readonly id: string;
  readonly kind: TKind;
  readonly range: TextRange;
}

export interface StyleMark {
  readonly id: string;
  readonly kind: "style";
  readonly range: TextRange;
  readonly properties: TextStyleProperties;
}

export interface LinkMark {
  readonly id: string;
  readonly kind: "link";
  readonly range: TextRange;
  readonly targets: LinkTarget[];
}

// ── Style Properties ─────────────────────────────────────────────────────

/** All properties are optional. Used everywhere — config defaults,
 *  mark properties, overlay input, overlay output. */
export interface TextStyleProperties {
  readonly fontFamily?: string;
  /** em-relative */
  readonly fontSize?: number;
  readonly fontWeight?: number;
  readonly italic?: boolean;
  readonly underline?: boolean;
  readonly strike?: boolean;
  /** Implies monospace font family */
  readonly code?: boolean;
  readonly color?: string;
  readonly backgroundColor?: string;
  readonly letterSpacing?: number;
  readonly lineHeight?: number;
}

// ── Link Targets ─────────────────────────────────────────────────────────

export type LinkTarget =
  | { readonly kind: "url"; readonly href: string }
  | { readonly kind: "resource"; readonly resourceKind: string; readonly resourceId: string; readonly locator?: string }
  | { readonly kind: "evidence"; readonly evidenceId: string }
  | { readonly kind: "question"; readonly questionId: string }
  | { readonly kind: "data"; readonly entryId: string; readonly locator?: string };

// ── Formula Diagnostic ───────────────────────────────────────────────────

export interface RichTextFormulaDiagnostic {
  readonly code: string;
  readonly message: string;
  readonly sourceRange?: { readonly start: number; readonly end: number };
}

// ── Configuration ────────────────────────────────────────────────────────

export interface RichTextConfig {
  readonly defaults: TextStyleProperties;
  readonly limits: RichTextLimits;
}

export interface RichTextLimits {
  readonly maxAtomsPerContent: number;
  readonly maxMarksPerContent: number;
  readonly maxMarkRangeSpan: number;
}

export const DEFAULT_LIMITS: RichTextLimits = {
  maxAtomsPerContent: 10000,
  maxMarksPerContent: 5000,
  maxMarkRangeSpan: 1000,
};

export const DEFAULT_STYLE: TextStyleProperties = {
  fontFamily: "system-ui, sans-serif",
  fontSize: 1.0,
  fontWeight: 400,
  italic: false,
  underline: false,
  strike: false,
  code: false,
  color: "inherit",
  backgroundColor: "transparent",
  letterSpacing: 0,
  lineHeight: 1.5,
};

export const DEFAULT_CONFIG: RichTextConfig = {
  defaults: DEFAULT_STYLE,
  limits: DEFAULT_LIMITS,
};

// ── Result Types ─────────────────────────────────────────────────────────

export interface ValidationResult {
  readonly ok: boolean;
  readonly diagnostics: RichTextDiagnostic[];
}

export interface RichTextDiagnostic {
  readonly code: string;
  readonly message: string;
  readonly position?: TextPosition;
  readonly range?: TextRange;
}

export interface ApplyResult {
  readonly content: RichContent;
  readonly inverse: RichTextOperation[];
  readonly footprint: Footprint;
}

export interface Footprint {
  readonly affectedAtomIds: string[];
  readonly dirtyRange?: TextRange;
}

// ── Resolved Styling ─────────────────────────────────────────────────────

export interface ResolvedStyleRange {
  readonly range: TextRange;
  readonly properties: TextStyleProperties;
  readonly activeMarks: string[];
  readonly links?: LinkTarget[];
}

export interface ResolvedStyling {
  readonly ranges: ResolvedStyleRange[];
  readonly plainText: string;
  readonly links: LinkTarget[];
}

// ── Change Operations ────────────────────────────────────────────────────

export type RichTextOperation =
  // Text editing
  | { readonly type: "insert-text"; readonly at: TextPosition; readonly text: string }
  | { readonly type: "delete-range"; readonly range: TextRange }
  | { readonly type: "replace-range"; readonly range: TextRange; readonly text: string }
  // Atoms
  | { readonly type: "insert-atom"; readonly at: TextPosition; readonly atom: RichTextAtom }
  | { readonly type: "delete-atom"; readonly atomId: string }
  // Marks
  | { readonly type: "add-mark"; readonly mark: RichTextMark }
  | { readonly type: "remove-mark"; readonly markId: string }
  | { readonly type: "set-link-targets"; readonly markId: string; readonly targets: LinkTarget[] }
  // Formula
  | { readonly type: "set-formula-expression"; readonly atomId: string; readonly expression: string }
  | { readonly type: "apply-formula-result"; readonly atomId: string; readonly value: FormulaWireValue; readonly displayText: string };

// ── RichText Interface ───────────────────────────────────────────────────

export interface RichText {
  readonly config: RichTextConfig;

  // Mark factories
  bold(range: TextRange, id?: string): SimpleRangeMark<"bold">;
  italic(range: TextRange, id?: string): SimpleRangeMark<"italic">;
  underline(range: TextRange, id?: string): SimpleRangeMark<"underline">;
  strike(range: TextRange, id?: string): SimpleRangeMark<"strike">;
  code(range: TextRange, id?: string): SimpleRangeMark<"code">;
  link(targets: LinkTarget[], range: TextRange, id?: string): LinkMark;
  style(props: TextStyleProperties, range: TextRange, id?: string): StyleMark;
  fullRangeMark(kind: "bold" | "italic" | "underline" | "strike" | "code", atoms: RichTextAtom[], id?: string): SimpleRangeMark<string>;
  fullRangeStyle(props: TextStyleProperties, atoms: RichTextAtom[], id?: string): StyleMark;

  // Mark overlay
  overlayMarks(authoritative: RichTextMark[], supplementary: RichTextMark[]): RichTextMark[];

  // Style resolution
  resolveStyling(content: RichContent): ResolvedStyling;

  // Pure operations
  validate(content: RichContent): ValidationResult;
  normalize(content: RichContent): RichContent;
  apply(content: RichContent, operations: RichTextOperation[]): ApplyResult;
  clone(content: RichContent, ids: RichTextIdFactory): RichContent;
  plainText(atoms: RichTextAtom[]): string;

  // Codec
  encode(content: RichContent): Uint8Array;
  decode(bytes: Uint8Array): RichContent;
}

// ── ID Factory ───────────────────────────────────────────────────────────

export interface RichTextIdFactory {
  atomId(): string;
  markId(): string;
}