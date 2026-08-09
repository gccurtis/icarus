// Rich Text — platform capability for inline text content and styling.

export { createRichText } from "./engine.js";
export type { RichText } from "./types.js";
export type {
  RichContent,
  RichTextAtom,
  TextAtom,
  FormulaAtom,
  ReferenceAtom,
  HardBreakAtom,
  TextPosition,
  TextRange,
  RichTextMark,
  SimpleRangeMark,
  StyleMark,
  LinkMark,
  TextStyleProperties,
  LinkTarget,
  RichTextFormulaDiagnostic,
  RichTextConfig,
  RichTextLimits,
  ResolvedStyling,
  ResolvedStyleRange,
  RichTextOperation,
  ValidationResult,
  RichTextDiagnostic,
  ApplyResult,
  Footprint,
  FormulaAuthoringResult,
  FormulaAtomSettlement,
  RichTextIdFactory,
} from "./types.js";
export { DEFAULT_CONFIG, DEFAULT_STYLE, DEFAULT_LIMITS } from "./types.js";
