import type { ContextEntry } from "#context";
import type { FormulaWireValue } from "#formula";
import type {
  FormulaAtomSettlement,
  LinkTarget,
  RichContent,
  RichTextAtom,
  RichTextMark,
  RichTextOperation,
  TextPosition,
  TextRange,
  TextStyleProperties
} from "#rich-text";
import type {
  BoxAppearance,
  DeckDesignToken,
  DeckTheme,
  DeckThemePalette,
  DeckThemeTypography,
  ElementContainerRef,
  ElementFrame,
  ElementPlacement,
  Layout,
  LayoutSlot,
  Master,
  MediaSnapshotRef,
  PromptCreateTarget,
  PromptSite,
  RichContentTarget,
  Slide,
  SlideBackground,
  SlideBorder,
  SlideCanvas,
  SlideChartData,
  SlideChartLabel,
  SlideElement,
  SlideElementKind,
  SlideFill,
  SlideGeometry,
  SlideImageData,
  SlideLine,
  SlideStyle,
  SlideTable,
  SlideTableCell,
  SlideTableColumn,
  SlideTableMerge,
  SlideTableRow,
  SlideTextSource,
  ThemeValue
} from "../domain/model.js";

export class SlideWireError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SlideWireError";
  }
}

export const SLIDE_WIRE_LIMITS = {
  maxPayloadBytes: 1_048_576,
  maxStringBytes: 262_144,
  maxIdentifierBytes: 512,
  maxCollectionItems: 10_000,
  maxOperations: 1_000,
  maxRichTextOperations: 1_000,
  maxDepth: 32,
  maxNodes: 100_000
} as const;

const byteLength = (value: string): number => Buffer.byteLength(value, "utf8");

/** Reject non-JSON values, cycles, pathological depth/counts, and large bodies. */
export const assertSlideWireInput = (value: unknown, label: string): void => {
  const active = new WeakSet<object>();
  let nodes = 0;

  const visit = (item: unknown, path: string, depth: number): void => {
    nodes += 1;
    if (nodes > SLIDE_WIRE_LIMITS.maxNodes) {
      throw new SlideWireError(`${label} exceeds the node limit`);
    }
    if (depth > SLIDE_WIRE_LIMITS.maxDepth) {
      throw new SlideWireError(`${path} exceeds the nesting limit`);
    }
    if (item === null || typeof item === "boolean") return;
    if (typeof item === "string") {
      if (byteLength(item) > SLIDE_WIRE_LIMITS.maxStringBytes) {
        throw new SlideWireError(`${path} exceeds the string size limit`);
      }
      return;
    }
    if (typeof item === "number") {
      if (!Number.isFinite(item)) throw new SlideWireError(`${path} must be finite`);
      return;
    }
    if (typeof item !== "object") {
      throw new SlideWireError(`${path} must contain only JSON values`);
    }

    if (active.has(item)) throw new SlideWireError(`${path} must not be cyclic`);
    active.add(item);
    if (Array.isArray(item)) {
      if (item.length > SLIDE_WIRE_LIMITS.maxCollectionItems) {
        throw new SlideWireError(`${path} exceeds the collection limit`);
      }
      item.forEach((child, index) => visit(child, `${path}[${index}]`, depth + 1));
    } else {
      const prototype = Object.getPrototypeOf(item);
      if (prototype !== Object.prototype && prototype !== null) {
        throw new SlideWireError(`${path} must be a plain object`);
      }
      const ownKeys = Reflect.ownKeys(item);
      if (ownKeys.some((key) => typeof key === "symbol")) {
        throw new SlideWireError(`${path} must not contain symbol fields`);
      }
      if (ownKeys.length > SLIDE_WIRE_LIMITS.maxCollectionItems) {
        throw new SlideWireError(`${path} exceeds the field-count limit`);
      }
      for (const [key, child] of Object.entries(item as Record<string, unknown>)) {
        visit(child, `${path}.${key}`, depth + 1);
      }
    }
    active.delete(item);
  };

  visit(value, label, 0);
  let encoded: string | undefined;
  try {
    encoded = JSON.stringify(value);
  } catch {
    throw new SlideWireError(`${label} must be JSON serializable`);
  }
  if (encoded === undefined) throw new SlideWireError(`${label} must be a JSON value`);
  if (byteLength(encoded) > SLIDE_WIRE_LIMITS.maxPayloadBytes) {
    throw new SlideWireError(`${label} exceeds the payload size limit`);
  }
};

// ── Primitives ───────────────────────────────────────────────────────────

export const requireRecord = (value: unknown, label: string): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new SlideWireError(`${label} must be an object`);
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new SlideWireError(`${label} must be a plain object`);
  }
  return value as Record<string, unknown>;
};

export const exactKeys = (
  value: Record<string, unknown>,
  allowed: readonly string[],
  label: string
): void => {
  const allowedSet = new Set(allowed);
  const unknown = Object.keys(value).filter((key) => !allowedSet.has(key));
  if (unknown.length > 0) {
    throw new SlideWireError(`${label} contains unknown fields: ${unknown.join(", ")}`);
  }
};

export const requireText = (value: unknown, label: string): string => {
  if (typeof value !== "string") throw new SlideWireError(`${label} must be a string`);
  if (byteLength(value) > SLIDE_WIRE_LIMITS.maxStringBytes) {
    throw new SlideWireError(`${label} exceeds the string size limit`);
  }
  return value;
};

export const requireString = (value: unknown, label: string): string => {
  const result = requireText(value, label);
  if (result.length === 0) throw new SlideWireError(`${label} must be a non-empty string`);
  return result;
};

export const requireIdentifier = (value: unknown, label: string): string => {
  const result = requireString(value, label);
  if (byteLength(result) > SLIDE_WIRE_LIMITS.maxIdentifierBytes) {
    throw new SlideWireError(`${label} exceeds the identifier size limit`);
  }
  return result;
};

export const requireBoolean = (value: unknown, label: string): boolean => {
  if (typeof value !== "boolean") throw new SlideWireError(`${label} must be a boolean`);
  return value;
};

export const requireFiniteNumber = (value: unknown, label: string): number => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new SlideWireError(`${label} must be a finite number`);
  }
  return value;
};

/**
 * Slide geometry is in points and deliberately non-integral — half-point
 * positions are ordinary — so lengths are finite positives, not integers. This
 * is the one place Slides diverges from Document's twips, which are integral.
 */
export const requirePositiveLength = (value: unknown, label: string): number => {
  const result = requireFiniteNumber(value, label);
  if (result <= 0) throw new SlideWireError(`${label} must be a positive number`);
  return result;
};

export const requireInteger = (value: unknown, label: string): number => {
  if (!Number.isSafeInteger(value)) throw new SlideWireError(`${label} must be an integer`);
  return value as number;
};

export const requireNonNegativeInteger = (value: unknown, label: string): number => {
  const result = requireInteger(value, label);
  if (result < 0) throw new SlideWireError(`${label} must be a non-negative integer`);
  return result;
};

export const requirePositiveInteger = (value: unknown, label: string): number => {
  const result = requireInteger(value, label);
  if (result <= 0) throw new SlideWireError(`${label} must be a positive integer`);
  return result;
};

export const requireEnum = <T extends string>(
  value: unknown,
  allowed: readonly T[],
  label: string
): T => {
  if (typeof value !== "string" || !allowed.includes(value as T)) {
    throw new SlideWireError(`${label} must be one of: ${allowed.join(", ")}`);
  }
  return value as T;
};

export const requireArray = (
  value: unknown,
  label: string,
  max: number = SLIDE_WIRE_LIMITS.maxCollectionItems
): unknown[] => {
  if (!Array.isArray(value)) throw new SlideWireError(`${label} must be an array`);
  if (value.length > max) throw new SlideWireError(`${label} exceeds the collection limit`);
  return value;
};

export const decodeContextEntry = (value: unknown, label: string): ContextEntry => {
  const entry = requireRecord(value, label);
  exactKeys(entry, ["id", "kind"], label);
  return {
    id: requireIdentifier(entry.id, `${label}.id`),
    kind: requireIdentifier(entry.kind, `${label}.kind`)
  };
};

export const decodeContextEntries = (value: unknown, label: string): ContextEntry[] =>
  requireArray(value, label).map((item, index) =>
    decodeContextEntry(item, `${label}[${index}]`));

// ── Rich Text ────────────────────────────────────────────────────────────
//
// Hand-decoded here rather than shared with Document, because a capability owns
// its own wire layer. The shapes are Rich Text's, so these must track
// `#rich-text` — a mismatch is caught by the round-trip assertions in
// slides-wire.test.ts, which build values through the engine's own types.

const decodePosition = (value: unknown, label: string): TextPosition => {
  const raw = requireRecord(value, label);
  exactKeys(raw, ["atomId", "offset"], label);
  return {
    atomId: requireIdentifier(raw.atomId, `${label}.atomId`),
    offset: requireNonNegativeInteger(raw.offset, `${label}.offset`)
  };
};

export const decodeTextRange = (value: unknown, label: string): TextRange => {
  const raw = requireRecord(value, label);
  exactKeys(raw, ["start", "end"], label);
  return {
    start: decodePosition(raw.start, `${label}.start`),
    end: decodePosition(raw.end, `${label}.end`)
  };
};

export const decodeTextStyleProperties = (
  value: unknown,
  label: string
): TextStyleProperties => {
  const raw = requireRecord(value, label);
  exactKeys(
    raw,
    [
      "fontFamily", "fontSize", "fontWeight", "italic", "underline", "strike",
      "code", "color", "backgroundColor", "letterSpacing", "lineHeight"
    ],
    label
  );
  if (raw.fontFamily !== undefined) requireString(raw.fontFamily, `${label}.fontFamily`);
  if (raw.fontSize !== undefined) requireFiniteNumber(raw.fontSize, `${label}.fontSize`);
  if (raw.fontWeight !== undefined) requireFiniteNumber(raw.fontWeight, `${label}.fontWeight`);
  for (const flag of ["italic", "underline", "strike", "code"] as const) {
    if (raw[flag] !== undefined) requireBoolean(raw[flag], `${label}.${flag}`);
  }
  if (raw.color !== undefined) requireString(raw.color, `${label}.color`);
  if (raw.backgroundColor !== undefined) {
    requireString(raw.backgroundColor, `${label}.backgroundColor`);
  }
  if (raw.letterSpacing !== undefined) {
    requireFiniteNumber(raw.letterSpacing, `${label}.letterSpacing`);
  }
  if (raw.lineHeight !== undefined) requireFiniteNumber(raw.lineHeight, `${label}.lineHeight`);
  return structuredClone(raw) as unknown as TextStyleProperties;
};

const decodeFormulaWireValue = (
  value: unknown,
  label: string,
  depth = 0
): FormulaWireValue => {
  if (depth > SLIDE_WIRE_LIMITS.maxDepth) {
    throw new SlideWireError(`${label} exceeds the nesting limit`);
  }
  const raw = requireRecord(value, label);
  const kind = requireEnum(
    raw.kind,
    ["null", "number", "text", "logic", "list", "record", "table"] as const,
    `${label}.kind`
  );
  if (kind === "null") {
    exactKeys(raw, ["kind"], label);
  } else if (kind === "number") {
    exactKeys(raw, ["kind", "numerator", "denominator"], label);
    const numerator = requireString(raw.numerator, `${label}.numerator`);
    const denominator = requireString(raw.denominator, `${label}.denominator`);
    if (!/^-?(?:0|[1-9][0-9]*)$/.test(numerator)) {
      throw new SlideWireError(`${label}.numerator must be an integer string`);
    }
    if (!/^[1-9][0-9]*$/.test(denominator)) {
      throw new SlideWireError(`${label}.denominator must be a positive integer string`);
    }
  } else if (kind === "text") {
    exactKeys(raw, ["kind", "value"], label);
    requireText(raw.value, `${label}.value`);
  } else if (kind === "logic") {
    exactKeys(raw, ["kind", "value"], label);
    requireBoolean(raw.value, `${label}.value`);
  } else {
    exactKeys(raw, ["kind", "fields", "rows"], label);
    const fields = requireArray(raw.fields, `${label}.fields`).map((field, index) =>
      requireString(field, `${label}.fields[${index}]`));
    const rows = requireArray(raw.rows, `${label}.rows`).map((row, rowIndex) => {
      const cells = requireArray(row, `${label}.rows[${rowIndex}]`);
      if (cells.length !== fields.length) {
        throw new SlideWireError(`${label}.rows[${rowIndex}] must match the field count`);
      }
      return cells.map((cell, cellIndex) =>
        decodeFormulaWireValue(cell, `${label}.rows[${rowIndex}][${cellIndex}]`, depth + 1));
    });
    if (kind === "list" && (fields.length !== 1 || fields[0] !== "value")) {
      throw new SlideWireError(`${label} list values require one 'value' field`);
    }
    if (kind === "record" && rows.length !== 1) {
      throw new SlideWireError(`${label} record values require exactly one row`);
    }
  }
  return structuredClone(raw) as unknown as FormulaWireValue;
};

const decodeFormulaDiagnostic = (value: unknown, label: string) => {
  const raw = requireRecord(value, label);
  exactKeys(raw, ["code", "message", "sourceRange"], label);
  requireIdentifier(raw.code, `${label}.code`);
  requireString(raw.message, `${label}.message`);
  if (raw.sourceRange !== undefined) {
    const range = requireRecord(raw.sourceRange, `${label}.sourceRange`);
    exactKeys(range, ["start", "end"], `${label}.sourceRange`);
    const start = requireNonNegativeInteger(range.start, `${label}.sourceRange.start`);
    const end = requireNonNegativeInteger(range.end, `${label}.sourceRange.end`);
    if (end < start) {
      throw new SlideWireError(`${label}.sourceRange.end must not precede start`);
    }
  }
  return structuredClone(raw);
};

const decodeLinkTarget = (value: unknown, label: string): LinkTarget => {
  const raw = requireRecord(value, label);
  const kind = requireEnum(
    raw.kind,
    ["url", "resource", "evidence", "question", "data"] as const,
    `${label}.kind`
  );
  if (kind === "url") {
    exactKeys(raw, ["kind", "href"], label);
    requireString(raw.href, `${label}.href`);
  } else if (kind === "resource") {
    exactKeys(raw, ["kind", "resourceKind", "resourceId", "locator"], label);
    requireIdentifier(raw.resourceKind, `${label}.resourceKind`);
    requireIdentifier(raw.resourceId, `${label}.resourceId`);
    if (raw.locator !== undefined) requireText(raw.locator, `${label}.locator`);
  } else if (kind === "evidence") {
    exactKeys(raw, ["kind", "evidenceId"], label);
    requireIdentifier(raw.evidenceId, `${label}.evidenceId`);
  } else if (kind === "question") {
    exactKeys(raw, ["kind", "questionId"], label);
    requireIdentifier(raw.questionId, `${label}.questionId`);
  } else {
    exactKeys(raw, ["kind", "entryId", "locator"], label);
    requireIdentifier(raw.entryId, `${label}.entryId`);
    if (raw.locator !== undefined) requireText(raw.locator, `${label}.locator`);
  }
  return structuredClone(raw) as unknown as LinkTarget;
};

const decodeRichTextAtom = (value: unknown, label: string): RichTextAtom => {
  const raw = requireRecord(value, label);
  const kind = requireEnum(
    raw.kind,
    ["text", "formula", "reference", "hard-break"] as const,
    `${label}.kind`
  );
  requireIdentifier(raw.id, `${label}.id`);
  if (kind === "text") {
    exactKeys(raw, ["id", "kind", "text"], label);
    requireText(raw.text, `${label}.text`);
  } else if (kind === "formula") {
    exactKeys(
      raw,
      ["id", "kind", "expression", "acceptedValue", "displayText", "diagnostic"],
      label
    );
    requireString(raw.expression, `${label}.expression`);
    requireText(raw.displayText, `${label}.displayText`);
    if (raw.acceptedValue !== undefined) {
      decodeFormulaWireValue(raw.acceptedValue, `${label}.acceptedValue`);
    }
    if (raw.diagnostic !== undefined) {
      decodeFormulaDiagnostic(raw.diagnostic, `${label}.diagnostic`);
    }
  } else if (kind === "reference") {
    exactKeys(raw, ["id", "kind", "target", "displayText"], label);
    decodeLinkTarget(raw.target, `${label}.target`);
    requireText(raw.displayText, `${label}.displayText`);
  } else {
    exactKeys(raw, ["id", "kind"], label);
  }
  return structuredClone(raw) as unknown as RichTextAtom;
};

const decodeRichTextMark = (value: unknown, label: string): RichTextMark => {
  const raw = requireRecord(value, label);
  const kind = requireEnum(
    raw.kind,
    ["bold", "italic", "underline", "strike", "code", "style", "link"] as const,
    `${label}.kind`
  );
  requireIdentifier(raw.id, `${label}.id`);
  decodeTextRange(raw.range, `${label}.range`);
  if (kind === "style") {
    exactKeys(raw, ["id", "kind", "range", "properties"], label);
    decodeTextStyleProperties(raw.properties, `${label}.properties`);
  } else if (kind === "link") {
    exactKeys(raw, ["id", "kind", "range", "targets"], label);
    requireArray(raw.targets, `${label}.targets`).forEach((target, index) =>
      decodeLinkTarget(target, `${label}.targets[${index}]`));
  } else {
    exactKeys(raw, ["id", "kind", "range"], label);
  }
  return structuredClone(raw) as unknown as RichTextMark;
};

export const decodeRichContent = (value: unknown, label: string): RichContent => {
  const raw = requireRecord(value, label);
  exactKeys(raw, ["atoms", "marks"], label);
  const atoms = requireArray(raw.atoms, `${label}.atoms`);
  if (atoms.length === 0) throw new SlideWireError(`${label}.atoms must not be empty`);
  atoms.forEach((atom, index) => decodeRichTextAtom(atom, `${label}.atoms[${index}]`));
  requireArray(raw.marks, `${label}.marks`).forEach((mark, index) =>
    decodeRichTextMark(mark, `${label}.marks[${index}]`));
  return structuredClone(raw) as unknown as RichContent;
};

const decodeFormulaSettlement = (value: unknown, label: string): FormulaAtomSettlement => {
  const raw = requireRecord(value, label);
  exactKeys(raw, ["acceptedValue", "displayText", "diagnostic"], label);
  requireText(raw.displayText, `${label}.displayText`);
  if (raw.acceptedValue !== undefined) {
    decodeFormulaWireValue(raw.acceptedValue, `${label}.acceptedValue`);
  }
  if (raw.diagnostic !== undefined) {
    decodeFormulaDiagnostic(raw.diagnostic, `${label}.diagnostic`);
  }
  return structuredClone(raw) as unknown as FormulaAtomSettlement;
};

const RICH_TEXT_OPERATION_KEYS: Record<RichTextOperation["type"], readonly string[]> = {
  "insert-text": ["type", "at", "text"],
  "delete-range": ["type", "range"],
  "replace-range": ["type", "range", "text"],
  "insert-atom": ["type", "at", "atom"],
  "delete-atom": ["type", "atomId"],
  "replace-range-with-atom": [
    "type", "range", "expectedText", "atom", "trailingTextAtomId"
  ],
  "replace-content": ["type", "content"],
  "add-mark": ["type", "mark"],
  "remove-mark": ["type", "markId"],
  "set-link-targets": ["type", "markId", "targets"],
  "set-formula-expression": ["type", "atomId", "expression"],
  "apply-formula-settlement": ["type", "atomId", "settlement"],
  "apply-formula-result": ["type", "atomId", "value", "displayText"]
};

export const decodeRichTextOperation = (value: unknown, label: string): RichTextOperation => {
  const raw = requireRecord(value, label);
  const type = requireString(raw.type, `${label}.type`) as RichTextOperation["type"];
  const keys = RICH_TEXT_OPERATION_KEYS[type];
  if (!keys) throw new SlideWireError(`Unknown Rich Text operation: ${type}`);
  exactKeys(raw, keys, label);
  switch (type) {
    case "insert-text":
      decodePosition(raw.at, `${label}.at`);
      requireText(raw.text, `${label}.text`);
      break;
    case "delete-range":
      decodeTextRange(raw.range, `${label}.range`);
      break;
    case "replace-range":
      decodeTextRange(raw.range, `${label}.range`);
      requireText(raw.text, `${label}.text`);
      break;
    case "insert-atom":
      decodePosition(raw.at, `${label}.at`);
      decodeRichTextAtom(raw.atom, `${label}.atom`);
      break;
    case "delete-atom":
      requireIdentifier(raw.atomId, `${label}.atomId`);
      break;
    case "replace-range-with-atom":
      decodeTextRange(raw.range, `${label}.range`);
      requireString(raw.expectedText, `${label}.expectedText`);
      decodeRichTextAtom(raw.atom, `${label}.atom`);
      if (raw.trailingTextAtomId !== undefined) {
        requireIdentifier(raw.trailingTextAtomId, `${label}.trailingTextAtomId`);
      }
      break;
    case "replace-content":
      decodeRichContent(raw.content, `${label}.content`);
      break;
    case "add-mark":
      decodeRichTextMark(raw.mark, `${label}.mark`);
      break;
    case "remove-mark":
      requireIdentifier(raw.markId, `${label}.markId`);
      break;
    case "set-link-targets":
      requireIdentifier(raw.markId, `${label}.markId`);
      requireArray(raw.targets, `${label}.targets`).forEach((target, index) =>
        decodeLinkTarget(target, `${label}.targets[${index}]`));
      break;
    case "set-formula-expression":
      requireIdentifier(raw.atomId, `${label}.atomId`);
      requireString(raw.expression, `${label}.expression`);
      break;
    case "apply-formula-settlement":
      requireIdentifier(raw.atomId, `${label}.atomId`);
      decodeFormulaSettlement(raw.settlement, `${label}.settlement`);
      break;
    case "apply-formula-result":
      requireIdentifier(raw.atomId, `${label}.atomId`);
      decodeFormulaWireValue(raw.value, `${label}.value`);
      requireText(raw.displayText, `${label}.displayText`);
      break;
  }
  return structuredClone(raw) as unknown as RichTextOperation;
};

export const decodeRichTextOperations = (
  value: unknown,
  label: string
): RichTextOperation[] => {
  const items = requireArray(value, label, SLIDE_WIRE_LIMITS.maxRichTextOperations);
  if (items.length === 0) throw new SlideWireError(`${label} must not be empty`);
  return items.map((item, index) => decodeRichTextOperation(item, `${label}[${index}]`));
};

// ── Canvas, theme and styling ────────────────────────────────────────────

export const decodeCanvas = (value: unknown, label: string): SlideCanvas => {
  const raw = requireRecord(value, label);
  exactKeys(raw, ["widthPt", "heightPt"], label);
  return {
    widthPt: requirePositiveLength(raw.widthPt, `${label}.widthPt`),
    heightPt: requirePositiveLength(raw.heightPt, `${label}.heightPt`)
  };
};

const decodeThemeValue = <T>(
  value: unknown,
  label: string,
  decodeLiteral: (raw: unknown, label: string) => T
): ThemeValue<T> => {
  const raw = requireRecord(value, label);
  const kind = requireEnum(raw.kind, ["literal", "token"] as const, `${label}.kind`);
  if (kind === "literal") {
    exactKeys(raw, ["kind", "value"], label);
    return { kind, value: decodeLiteral(raw.value, `${label}.value`) };
  }
  exactKeys(raw, ["kind", "tokenId"], label);
  return { kind, tokenId: requireIdentifier(raw.tokenId, `${label}.tokenId`) };
};

const decodeColorValue = (value: unknown, label: string): ThemeValue<string> =>
  decodeThemeValue(value, label, requireString);

export const decodeDesignToken = (value: unknown, label: string): DeckDesignToken => {
  const raw = requireRecord(value, label);
  const kind = requireEnum(raw.kind, ["color", "font", "length"] as const, `${label}.kind`);
  const id = requireIdentifier(raw.id, `${label}.id`);
  const name = requireString(raw.name, `${label}.name`);
  if (kind === "color") {
    exactKeys(raw, ["id", "kind", "name", "value"], label);
    return { id, kind, name, value: requireString(raw.value, `${label}.value`) };
  }
  if (kind === "font") {
    exactKeys(raw, ["id", "kind", "name", "family"], label);
    return { id, kind, name, family: requireString(raw.family, `${label}.family`) };
  }
  exactKeys(raw, ["id", "kind", "name", "valuePt"], label);
  return { id, kind, name, valuePt: requireFiniteNumber(raw.valuePt, `${label}.valuePt`) };
};

export const decodePalette = (value: unknown, label: string): DeckThemePalette => {
  const raw = requireRecord(value, label);
  exactKeys(raw, ["background", "surface", "text", "accent"], label);
  return {
    background: decodeColorValue(raw.background, `${label}.background`),
    surface: decodeColorValue(raw.surface, `${label}.surface`),
    text: decodeColorValue(raw.text, `${label}.text`),
    accent: decodeColorValue(raw.accent, `${label}.accent`)
  };
};

export const decodeTypography = (value: unknown, label: string): DeckThemeTypography => {
  const raw = requireRecord(value, label);
  exactKeys(raw, ["headingFontFamily", "bodyFontFamily", "baseFontSizePt"], label);
  return {
    headingFontFamily: decodeThemeValue(
      raw.headingFontFamily,
      `${label}.headingFontFamily`,
      requireString
    ),
    bodyFontFamily: decodeThemeValue(
      raw.bodyFontFamily,
      `${label}.bodyFontFamily`,
      requireString
    ),
    baseFontSizePt: decodeThemeValue(
      raw.baseFontSizePt,
      `${label}.baseFontSizePt`,
      requireFiniteNumber
    )
  };
};

export const decodeTheme = (value: unknown, label: string): DeckTheme => {
  const raw = requireRecord(value, label);
  exactKeys(raw, ["name", "tokens", "palette", "typography"], label);
  const tokensRaw = requireRecord(raw.tokens, `${label}.tokens`);
  const tokens: Record<string, DeckDesignToken> = {};
  for (const [key, token] of Object.entries(tokensRaw)) {
    const decoded = decodeDesignToken(token, `${label}.tokens.${key}`);
    if (decoded.id !== key) {
      throw new SlideWireError(`${label}.tokens.${key} is keyed by a different ID`);
    }
    tokens[key] = decoded;
  }
  return {
    name: requireString(raw.name, `${label}.name`),
    tokens,
    palette: decodePalette(raw.palette, `${label}.palette`),
    typography: decodeTypography(raw.typography, `${label}.typography`)
  };
};

const decodeFill = (value: unknown, label: string): SlideFill => {
  const raw = requireRecord(value, label);
  const kind = requireEnum(raw.kind, ["none", "solid"] as const, `${label}.kind`);
  if (kind === "none") {
    exactKeys(raw, ["kind"], label);
    return { kind };
  }
  exactKeys(raw, ["kind", "color"], label);
  return { kind, color: decodeColorValue(raw.color, `${label}.color`) };
};

const decodeBorder = (value: unknown, label: string): SlideBorder => {
  const raw = requireRecord(value, label);
  exactKeys(raw, ["widthPt", "style", "color"], label);
  return {
    widthPt: requirePositiveLength(raw.widthPt, `${label}.widthPt`),
    style: requireEnum(raw.style, ["solid", "dashed", "dotted"] as const, `${label}.style`),
    color: decodeColorValue(raw.color, `${label}.color`)
  };
};

export const decodeBoxAppearance = (value: unknown, label: string): BoxAppearance => {
  const raw = requireRecord(value, label);
  exactKeys(
    raw,
    ["fill", "border", "paddingPt", "cornerRadiusPt", "shadow", "textAlign", "verticalAlign"],
    label
  );
  return {
    ...(raw.fill !== undefined ? { fill: decodeFill(raw.fill, `${label}.fill`) } : {}),
    ...(raw.border !== undefined
      ? { border: decodeBorder(raw.border, `${label}.border`) }
      : {}),
    ...(raw.paddingPt !== undefined
      ? { paddingPt: requireFiniteNumber(raw.paddingPt, `${label}.paddingPt`) }
      : {}),
    ...(raw.cornerRadiusPt !== undefined
      ? { cornerRadiusPt: requireFiniteNumber(raw.cornerRadiusPt, `${label}.cornerRadiusPt`) }
      : {}),
    ...(raw.shadow !== undefined
      ? { shadow: requireBoolean(raw.shadow, `${label}.shadow`) }
      : {}),
    ...(raw.textAlign !== undefined
      ? {
          textAlign: requireEnum(
            raw.textAlign,
            ["left", "center", "right", "justify"] as const,
            `${label}.textAlign`
          )
        }
      : {}),
    ...(raw.verticalAlign !== undefined
      ? {
          verticalAlign: requireEnum(
            raw.verticalAlign,
            ["top", "middle", "bottom"] as const,
            `${label}.verticalAlign`
          )
        }
      : {})
  };
};

export const decodeBackground = (value: unknown, label: string): SlideBackground => {
  const raw = requireRecord(value, label);
  const kind = requireEnum(raw.kind, ["inherit", "solid", "image"] as const, `${label}.kind`);
  if (kind === "inherit") {
    exactKeys(raw, ["kind"], label);
    return { kind };
  }
  if (kind === "solid") {
    exactKeys(raw, ["kind", "color"], label);
    return { kind, color: decodeColorValue(raw.color, `${label}.color`) };
  }
  exactKeys(raw, ["kind", "source", "fit"], label);
  return {
    kind,
    source: decodeMediaSnapshotRef(raw.source, `${label}.source`),
    fit: requireEnum(raw.fit, ["contain", "cover", "stretch"] as const, `${label}.fit`)
  };
};

export const decodeSlideStyle = (value: unknown, label: string): SlideStyle => {
  const raw = requireRecord(value, label);
  exactKeys(raw, ["id", "name", "basedOnStyleId", "systemRole", "text", "box"], label);
  return {
    id: requireIdentifier(raw.id, `${label}.id`),
    name: requireString(raw.name, `${label}.name`),
    ...(raw.basedOnStyleId !== undefined
      ? { basedOnStyleId: requireIdentifier(raw.basedOnStyleId, `${label}.basedOnStyleId`) }
      : {}),
    ...(raw.systemRole !== undefined
      ? { systemRole: requireEnum(raw.systemRole, ["normal"] as const, `${label}.systemRole`) }
      : {}),
    ...(raw.text !== undefined
      ? { text: decodeTextStyleProperties(raw.text, `${label}.text`) }
      : {}),
    ...(raw.box !== undefined ? { box: decodeBoxAppearance(raw.box, `${label}.box`) } : {})
  };
};

export const SLIDE_ELEMENT_KINDS = [
  "group", "text", "table", "chart", "image", "geometry", "line"
] as const satisfies readonly SlideElementKind[];

// ── Geometry and placement ───────────────────────────────────────────────

export const decodeFrame = (value: unknown, label: string): ElementFrame => {
  const raw = requireRecord(value, label);
  exactKeys(raw, ["xPt", "yPt", "widthPt", "heightPt"], label);
  return {
    xPt: requireFiniteNumber(raw.xPt, `${label}.xPt`),
    yPt: requireFiniteNumber(raw.yPt, `${label}.yPt`),
    widthPt: requirePositiveLength(raw.widthPt, `${label}.widthPt`),
    heightPt: requirePositiveLength(raw.heightPt, `${label}.heightPt`)
  };
};

export const decodePlacement = (value: unknown, label: string): ElementPlacement => {
  const raw = requireRecord(value, label);
  const kind = requireEnum(raw.kind, ["free", "slot"] as const, `${label}.kind`);
  if (kind === "free") {
    exactKeys(raw, ["kind", "frame"], label);
    return { kind, frame: decodeFrame(raw.frame, `${label}.frame`) };
  }
  exactKeys(raw, ["kind", "slotId"], label);
  return { kind, slotId: requireIdentifier(raw.slotId, `${label}.slotId`) };
};

export const decodeContainerRef = (value: unknown, label: string): ElementContainerRef => {
  const raw = requireRecord(value, label);
  const kind = requireEnum(raw.kind, ["slide", "master", "layout"] as const, `${label}.kind`);
  if (kind === "slide") {
    exactKeys(raw, ["kind", "slideId"], label);
    return { kind, slideId: requireIdentifier(raw.slideId, `${label}.slideId`) };
  }
  if (kind === "master") {
    exactKeys(raw, ["kind", "masterId"], label);
    return { kind, masterId: requireIdentifier(raw.masterId, `${label}.masterId`) };
  }
  exactKeys(raw, ["kind", "layoutId"], label);
  return { kind, layoutId: requireIdentifier(raw.layoutId, `${label}.layoutId`) };
};

export const decodeMediaSnapshotRef = (value: unknown, label: string): MediaSnapshotRef => {
  const raw = requireRecord(value, label);
  exactKeys(raw, ["fileId", "version", "digest", "mimeType"], label);
  return {
    fileId: requireIdentifier(raw.fileId, `${label}.fileId`),
    version: requireIdentifier(raw.version, `${label}.version`),
    digest: requireIdentifier(raw.digest, `${label}.digest`),
    mimeType: requireString(raw.mimeType, `${label}.mimeType`)
  };
};

// ── Text sources and addressing ──────────────────────────────────────────

export const decodeDerivedOutputRef = (value: unknown, label: string) => {
  const raw = requireRecord(value, label);
  exactKeys(raw, ["outputId", "appliedRevision"], label);
  return {
    outputId: requireIdentifier(raw.outputId, `${label}.outputId`),
    appliedRevision: requirePositiveInteger(raw.appliedRevision, `${label}.appliedRevision`)
  };
};

export const decodeTextSource = (value: unknown, label: string): SlideTextSource => {
  const raw = requireRecord(value, label);
  const kind = requireEnum(raw.kind, ["rich", "prompt"] as const, `${label}.kind`);
  if (kind === "rich") {
    exactKeys(raw, ["kind", "content"], label);
    return { kind, content: decodeRichContent(raw.content, `${label}.content`) };
  }
  exactKeys(raw, ["kind", "output"], label);
  return { kind, output: decodeDerivedOutputRef(raw.output, `${label}.output`) };
};

export const decodePromptSite = (value: unknown, label: string): PromptSite => {
  const raw = requireRecord(value, label);
  const kind = requireEnum(raw.kind, ["element-body", "table-cell"] as const, `${label}.kind`);
  if (kind === "element-body") {
    exactKeys(raw, ["kind", "container", "elementId"], label);
    return {
      kind,
      container: decodeContainerRef(raw.container, `${label}.container`),
      elementId: requireIdentifier(raw.elementId, `${label}.elementId`)
    };
  }
  exactKeys(raw, ["kind", "container", "elementId", "cellId"], label);
  return {
    kind,
    container: decodeContainerRef(raw.container, `${label}.container`),
    elementId: requireIdentifier(raw.elementId, `${label}.elementId`),
    cellId: requireIdentifier(raw.cellId, `${label}.cellId`)
  };
};

export const decodeRichContentTarget = (
  value: unknown,
  label: string
): RichContentTarget => {
  const raw = requireRecord(value, label);
  const kind = requireEnum(
    raw.kind,
    ["element-body", "table-cell", "chart-label", "slide-notes"] as const,
    `${label}.kind`
  );
  if (kind === "slide-notes") {
    exactKeys(raw, ["kind", "slideId"], label);
    return { kind, slideId: requireIdentifier(raw.slideId, `${label}.slideId`) };
  }
  if (kind === "element-body") {
    exactKeys(raw, ["kind", "container", "elementId"], label);
    return {
      kind,
      container: decodeContainerRef(raw.container, `${label}.container`),
      elementId: requireIdentifier(raw.elementId, `${label}.elementId`)
    };
  }
  if (kind === "table-cell") {
    exactKeys(raw, ["kind", "container", "elementId", "cellId"], label);
    return {
      kind,
      container: decodeContainerRef(raw.container, `${label}.container`),
      elementId: requireIdentifier(raw.elementId, `${label}.elementId`),
      cellId: requireIdentifier(raw.cellId, `${label}.cellId`)
    };
  }
  exactKeys(raw, ["kind", "container", "elementId", "labelId"], label);
  return {
    kind,
    container: decodeContainerRef(raw.container, `${label}.container`),
    elementId: requireIdentifier(raw.elementId, `${label}.elementId`),
    labelId: requireIdentifier(raw.labelId, `${label}.labelId`)
  };
};

export const decodePromptCreateTarget = (
  value: unknown,
  label: string
): PromptCreateTarget => {
  const raw = requireRecord(value, label);
  const kind = requireEnum(raw.kind, ["new-text-element", "existing"] as const, `${label}.kind`);
  if (kind === "existing") {
    exactKeys(raw, ["kind", "site"], label);
    return { kind, site: decodePromptSite(raw.site, `${label}.site`) };
  }
  // No element ID: the service allocates it at freeze and returns it. A caller
  // naming an identifier for something that does not exist is the bug this
  // shape exists to prevent.
  exactKeys(raw, ["kind", "container", "placement", "styleId", "parentGroupId"], label);
  return {
    kind,
    container: decodeContainerRef(raw.container, `${label}.container`),
    placement: decodePlacement(raw.placement, `${label}.placement`),
    ...(raw.styleId !== undefined
      ? { styleId: requireIdentifier(raw.styleId, `${label}.styleId`) }
      : {}),
    ...(raw.parentGroupId !== undefined
      ? { parentGroupId: requireIdentifier(raw.parentGroupId, `${label}.parentGroupId`) }
      : {})
  };
};

// ── Tables, charts, media, shapes ────────────────────────────────────────

export const decodeTableRow = (value: unknown, label: string): SlideTableRow => {
  const raw = requireRecord(value, label);
  exactKeys(raw, ["id", "minHeightPt", "header"], label);
  return {
    id: requireIdentifier(raw.id, `${label}.id`),
    ...(raw.minHeightPt !== undefined
      ? { minHeightPt: requirePositiveLength(raw.minHeightPt, `${label}.minHeightPt`) }
      : {}),
    header: requireBoolean(raw.header, `${label}.header`)
  };
};

export const decodeTableColumn = (value: unknown, label: string): SlideTableColumn => {
  const raw = requireRecord(value, label);
  exactKeys(raw, ["id", "width"], label);
  const width = requireRecord(raw.width, `${label}.width`);
  const kind = requireEnum(width.kind, ["auto", "fixed"] as const, `${label}.width.kind`);
  if (kind === "auto") {
    exactKeys(width, ["kind"], `${label}.width`);
    return { id: requireIdentifier(raw.id, `${label}.id`), width: { kind } };
  }
  exactKeys(width, ["kind", "widthPt"], `${label}.width`);
  return {
    id: requireIdentifier(raw.id, `${label}.id`),
    width: { kind, widthPt: requirePositiveLength(width.widthPt, `${label}.width.widthPt`) }
  };
};

export const decodeTableCell = (value: unknown, label: string): SlideTableCell => {
  const raw = requireRecord(value, label);
  exactKeys(raw, ["id", "rowId", "columnId", "body", "verticalAlign", "styleId"], label);
  return {
    id: requireIdentifier(raw.id, `${label}.id`),
    rowId: requireIdentifier(raw.rowId, `${label}.rowId`),
    columnId: requireIdentifier(raw.columnId, `${label}.columnId`),
    body: decodeTextSource(raw.body, `${label}.body`),
    verticalAlign: requireEnum(
      raw.verticalAlign,
      ["top", "middle", "bottom"] as const,
      `${label}.verticalAlign`
    ),
    ...(raw.styleId !== undefined
      ? { styleId: requireIdentifier(raw.styleId, `${label}.styleId`) }
      : {})
  };
};

export const decodeTableMerge = (value: unknown, label: string): SlideTableMerge => {
  const raw = requireRecord(value, label);
  exactKeys(raw, ["id", "rootCellId", "coveredCellIds"], label);
  return {
    id: requireIdentifier(raw.id, `${label}.id`),
    rootCellId: requireIdentifier(raw.rootCellId, `${label}.rootCellId`),
    coveredCellIds: requireArray(raw.coveredCellIds, `${label}.coveredCellIds`).map(
      (id, index) => requireIdentifier(id, `${label}.coveredCellIds[${index}]`)
    )
  };
};

const decodeTable = (value: unknown, label: string): SlideTable => {
  const raw = requireRecord(value, label);
  exactKeys(raw, ["id", "columns", "rows", "cells", "merges"], label);
  return {
    id: requireIdentifier(raw.id, `${label}.id`),
    columns: requireArray(raw.columns, `${label}.columns`).map((column, index) =>
      decodeTableColumn(column, `${label}.columns[${index}]`)),
    rows: requireArray(raw.rows, `${label}.rows`).map((row, index) =>
      decodeTableRow(row, `${label}.rows[${index}]`)),
    cells: requireArray(raw.cells, `${label}.cells`).map((cell, index) =>
      decodeTableCell(cell, `${label}.cells[${index}]`)),
    merges: requireArray(raw.merges, `${label}.merges`).map((merge, index) =>
      decodeTableMerge(merge, `${label}.merges[${index}]`))
  };
};

const decodeChartLabel = (value: unknown, label: string): SlideChartLabel => {
  const raw = requireRecord(value, label);
  exactKeys(raw, ["id", "role", "content"], label);
  return {
    id: requireIdentifier(raw.id, `${label}.id`),
    role: requireIdentifier(raw.role, `${label}.role`),
    content: decodeRichContent(raw.content, `${label}.content`)
  };
};

const decodeChart = (value: unknown, label: string): SlideChartData => {
  const raw = requireRecord(value, label);
  exactKeys(raw, ["source", "specification", "labels", "alt"], label);
  return {
    source: requireEnum(raw.source, ["literal"] as const, `${label}.source`),
    specification: requireRecord(raw.specification, `${label}.specification`),
    labels: requireArray(raw.labels, `${label}.labels`).map((item, index) =>
      decodeChartLabel(item, `${label}.labels[${index}]`)),
    alt: requireText(raw.alt, `${label}.alt`)
  };
};

const decodeImage = (value: unknown, label: string): SlideImageData => {
  const raw = requireRecord(value, label);
  exactKeys(raw, ["source", "alt", "decorative", "crop", "fit"], label);
  let crop: SlideImageData["crop"];
  if (raw.crop !== undefined) {
    const cropRaw = requireRecord(raw.crop, `${label}.crop`);
    exactKeys(cropRaw, ["left", "top", "right", "bottom"], `${label}.crop`);
    crop = {
      left: requireFiniteNumber(cropRaw.left, `${label}.crop.left`),
      top: requireFiniteNumber(cropRaw.top, `${label}.crop.top`),
      right: requireFiniteNumber(cropRaw.right, `${label}.crop.right`),
      bottom: requireFiniteNumber(cropRaw.bottom, `${label}.crop.bottom`)
    };
  }
  return {
    source: decodeMediaSnapshotRef(raw.source, `${label}.source`),
    alt: requireText(raw.alt, `${label}.alt`),
    decorative: requireBoolean(raw.decorative, `${label}.decorative`),
    ...(crop ? { crop } : {}),
    fit: requireEnum(raw.fit, ["contain", "cover", "stretch"] as const, `${label}.fit`)
  };
};

const decodeGeometry = (value: unknown, label: string): SlideGeometry => {
  const raw = requireRecord(value, label);
  exactKeys(raw, ["shape", "appearance"], label);
  return {
    shape: requireEnum(
      raw.shape,
      ["rectangle", "rounded-rectangle", "ellipse", "triangle", "diamond", "arrow", "chevron"] as const,
      `${label}.shape`
    ),
    appearance: decodeBoxAppearance(raw.appearance, `${label}.appearance`)
  };
};

const decodePoint = (value: unknown, label: string) => {
  const raw = requireRecord(value, label);
  exactKeys(raw, ["xPt", "yPt"], label);
  return {
    xPt: requireFiniteNumber(raw.xPt, `${label}.xPt`),
    yPt: requireFiniteNumber(raw.yPt, `${label}.yPt`)
  };
};

const decodeLine = (value: unknown, label: string): SlideLine => {
  const raw = requireRecord(value, label);
  exactKeys(raw, ["start", "end", "widthPt", "style", "color", "startCap", "endCap"], label);
  return {
    start: decodePoint(raw.start, `${label}.start`),
    end: decodePoint(raw.end, `${label}.end`),
    widthPt: requirePositiveLength(raw.widthPt, `${label}.widthPt`),
    style: requireEnum(raw.style, ["solid", "dashed", "dotted"] as const, `${label}.style`),
    color: decodeColorValue(raw.color, `${label}.color`),
    startCap: requireEnum(raw.startCap, ["none", "arrow", "dot"] as const, `${label}.startCap`),
    endCap: requireEnum(raw.endCap, ["none", "arrow", "dot"] as const, `${label}.endCap`)
  };
};

// ── Elements ─────────────────────────────────────────────────────────────

const ELEMENT_BASE_KEYS = [
  "id", "kind", "parentGroupId", "zIndex", "placement",
  "rotationDegrees", "locked", "hidden", "styleId"
] as const;

const ELEMENT_KEYS: Record<SlideElementKind, readonly string[]> = {
  group: [...ELEMENT_BASE_KEYS, "name"],
  text: [...ELEMENT_BASE_KEYS, "body"],
  table: [...ELEMENT_BASE_KEYS, "table"],
  chart: [...ELEMENT_BASE_KEYS, "chart"],
  image: [...ELEMENT_BASE_KEYS, "image"],
  geometry: [...ELEMENT_BASE_KEYS, "geometry"],
  line: [...ELEMENT_BASE_KEYS, "line"]
};

export const decodeElement = (value: unknown, label: string): SlideElement => {
  const raw = requireRecord(value, label);
  const kind = requireEnum(raw.kind, SLIDE_ELEMENT_KINDS, `${label}.kind`);
  exactKeys(raw, ELEMENT_KEYS[kind], label);

  const base = {
    id: requireIdentifier(raw.id, `${label}.id`),
    // Absent optionals must stay absent rather than becoming explicit
    // `undefined`: the canonical digest sorts keys and drops undefined, so an
    // explicit key would change nothing in the digest but everything in a
    // deepEqual, and the reducer distinguishes "no parent" from "parent set".
    ...(raw.parentGroupId !== undefined
      ? { parentGroupId: requireIdentifier(raw.parentGroupId, `${label}.parentGroupId`) }
      : {}),
    zIndex: requireNonNegativeInteger(raw.zIndex, `${label}.zIndex`),
    placement: decodePlacement(raw.placement, `${label}.placement`),
    ...(raw.rotationDegrees !== undefined
      ? { rotationDegrees: requireFiniteNumber(raw.rotationDegrees, `${label}.rotationDegrees`) }
      : {}),
    locked: requireBoolean(raw.locked, `${label}.locked`),
    hidden: requireBoolean(raw.hidden, `${label}.hidden`),
    ...(raw.styleId !== undefined
      ? { styleId: requireIdentifier(raw.styleId, `${label}.styleId`) }
      : {})
  };

  switch (kind) {
    case "group":
      return {
        ...base,
        kind,
        ...(raw.name !== undefined ? { name: requireString(raw.name, `${label}.name`) } : {})
      };
    case "text":
      return { ...base, kind, body: decodeTextSource(raw.body, `${label}.body`) };
    case "table":
      return { ...base, kind, table: decodeTable(raw.table, `${label}.table`) };
    case "chart":
      return { ...base, kind, chart: decodeChart(raw.chart, `${label}.chart`) };
    case "image":
      return { ...base, kind, image: decodeImage(raw.image, `${label}.image`) };
    case "geometry":
      return { ...base, kind, geometry: decodeGeometry(raw.geometry, `${label}.geometry`) };
    case "line":
      return { ...base, kind, line: decodeLine(raw.line, `${label}.line`) };
  }
};

const decodeElementRecord = (
  value: unknown,
  label: string
): Record<string, SlideElement> => {
  const raw = requireRecord(value, label);
  const elements: Record<string, SlideElement> = {};
  for (const [key, element] of Object.entries(raw)) {
    const decoded = decodeElement(element, `${label}.${key}`);
    if (decoded.id !== key) {
      throw new SlideWireError(`${label}.${key} is keyed by a different ID than it carries`);
    }
    elements[key] = decoded;
  }
  return elements;
};

// ── Containers ───────────────────────────────────────────────────────────

export const decodeLayoutSlot = (value: unknown, label: string): LayoutSlot => {
  const raw = requireRecord(value, label);
  exactKeys(raw, ["id", "name", "frame", "accepts"], label);
  return {
    id: requireIdentifier(raw.id, `${label}.id`),
    name: requireString(raw.name, `${label}.name`),
    frame: decodeFrame(raw.frame, `${label}.frame`),
    accepts: requireArray(raw.accepts, `${label}.accepts`).map((kind, index) =>
      requireEnum(kind, SLIDE_ELEMENT_KINDS, `${label}.accepts[${index}]`))
  };
};

export const decodeMaster = (value: unknown, label: string): Master => {
  const raw = requireRecord(value, label);
  exactKeys(raw, ["id", "name", "background", "elements"], label);
  return {
    id: requireIdentifier(raw.id, `${label}.id`),
    name: requireString(raw.name, `${label}.name`),
    background: decodeBackground(raw.background, `${label}.background`),
    elements: decodeElementRecord(raw.elements, `${label}.elements`)
  };
};

export const decodeLayout = (value: unknown, label: string): Layout => {
  const raw = requireRecord(value, label);
  exactKeys(raw, ["id", "name", "masterId", "background", "elements", "slots"], label);
  const slotsRaw = requireRecord(raw.slots, `${label}.slots`);
  const slots: Record<string, LayoutSlot> = {};
  for (const [key, slot] of Object.entries(slotsRaw)) {
    const decoded = decodeLayoutSlot(slot, `${label}.slots.${key}`);
    if (decoded.id !== key) {
      throw new SlideWireError(`${label}.slots.${key} is keyed by a different ID`);
    }
    slots[key] = decoded;
  }
  return {
    id: requireIdentifier(raw.id, `${label}.id`),
    name: requireString(raw.name, `${label}.name`),
    masterId: requireIdentifier(raw.masterId, `${label}.masterId`),
    ...(raw.background !== undefined
      ? { background: decodeBackground(raw.background, `${label}.background`) }
      : {}),
    elements: decodeElementRecord(raw.elements, `${label}.elements`),
    slots
  };
};

export const decodeSlide = (value: unknown, label: string): Slide => {
  const raw = requireRecord(value, label);
  exactKeys(raw, ["id", "layoutId", "title", "background", "notes", "elements"], label);
  return {
    id: requireIdentifier(raw.id, `${label}.id`),
    layoutId: requireIdentifier(raw.layoutId, `${label}.layoutId`),
    ...(raw.title !== undefined ? { title: requireText(raw.title, `${label}.title`) } : {}),
    ...(raw.background !== undefined
      ? { background: decodeBackground(raw.background, `${label}.background`) }
      : {}),
    // Notes are authored only, so they are Rich Content rather than a source.
    notes: decodeRichContent(raw.notes, `${label}.notes`),
    elements: decodeElementRecord(raw.elements, `${label}.elements`)
  };
};
