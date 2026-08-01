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
  AcceptedSlideValue,
  ChartShape,
  ElementPlacement,
  GeometryShape,
  ImageShape,
  ImageSnapshotRef,
  LineShape,
  NormalizedCrop,
  PromptContentShape,
  ShapeFrame,
  ShapePresentationOverride,
  ShapeTransform,
  Slide,
  SlideBackground,
  SlideCanvas,
  SlideColor,
  SlideGroup,
  SlideShape,
  SlideShapeKind,
  SlideStyle,
  SlideStyleRegistry,
  SlideVisualStyleProperties,
  TableShape,
  TextBoxPresentation,
  TextShape
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
  maxGroupDepth: 32,
  maxNodes: 100_000,
  maxFormulaDepth: 16,
  maxFormulaCells: 100_000
} as const;

const byteLength = (value: string): number => Buffer.byteLength(value, "utf8");
const RESERVED_RECORD_KEYS = new Set([
  ...Object.getOwnPropertyNames(Object.prototype),
  "prototype"
]);

/** Reject non-JSON values, cycles, excessive depth/counts, and large bodies. */
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
      const keys = Reflect.ownKeys(item);
      if (keys.some((key) => typeof key === "symbol")) {
        throw new SlideWireError(`${path} must not contain symbol fields`);
      }
      if (keys.length > SLIDE_WIRE_LIMITS.maxCollectionItems) {
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

export const requireRecord = (
  value: unknown,
  label: string
): Record<string, unknown> => {
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
  if (RESERVED_RECORD_KEYS.has(result)) {
    throw new SlideWireError(`${label} uses a reserved record key`);
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

export const requireNonNegativeNumber = (value: unknown, label: string): number => {
  const result = requireFiniteNumber(value, label);
  if (result < 0) throw new SlideWireError(`${label} must be non-negative`);
  return result;
};

export const requirePositiveNumber = (value: unknown, label: string): number => {
  const result = requireFiniteNumber(value, label);
  if (result <= 0) throw new SlideWireError(`${label} must be positive`);
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

export const decodeIdentifierArray = (value: unknown, label: string): string[] =>
  requireArray(value, label).map((item, index) =>
    requireIdentifier(item, `${label}[${index}]`));

export const decodeContextEntries = (value: unknown, label: string): ContextEntry[] =>
  requireArray(value, label).map((item, index) => {
    const entry = requireRecord(item, `${label}[${index}]`);
    exactKeys(entry, ["id", "kind"], `${label}[${index}]`);
    return {
      id: requireIdentifier(entry.id, `${label}[${index}].id`),
      kind: requireIdentifier(entry.kind, `${label}[${index}].kind`)
    };
  });

export const decodeSlideColor = (value: unknown, label: string): SlideColor => {
  const color = requireString(value, label);
  if (!/^#[0-9a-f]{8}$/.test(color)) {
    throw new SlideWireError(`${label} must be canonical lowercase #rrggbbaa`);
  }
  return color as SlideColor;
};

export const decodeSlideCanvas = (value: unknown, label: string): SlideCanvas => {
  const raw = requireRecord(value, label);
  exactKeys(raw, ["widthPt", "heightPt"], label);
  requirePositiveNumber(raw.widthPt, `${label}.widthPt`);
  requirePositiveNumber(raw.heightPt, `${label}.heightPt`);
  return structuredClone(raw) as unknown as SlideCanvas;
};

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
  exactKeys(raw, [
    "fontFamily", "fontSize", "fontWeight", "italic", "underline", "strike",
    "code", "color", "backgroundColor", "letterSpacing", "lineHeight"
  ], label);
  if (raw.fontFamily !== undefined) requireString(raw.fontFamily, `${label}.fontFamily`);
  for (const key of ["fontSize", "fontWeight", "lineHeight"] as const) {
    if (raw[key] !== undefined && requireFiniteNumber(raw[key], `${label}.${key}`) <= 0) {
      throw new SlideWireError(`${label}.${key} must be positive`);
    }
  }
  if (raw.letterSpacing !== undefined) {
    requireFiniteNumber(raw.letterSpacing, `${label}.letterSpacing`);
  }
  for (const key of ["italic", "underline", "strike", "code"] as const) {
    if (raw[key] !== undefined) requireBoolean(raw[key], `${label}.${key}`);
  }
  if (raw.color !== undefined) requireString(raw.color, `${label}.color`);
  if (raw.backgroundColor !== undefined) {
    requireString(raw.backgroundColor, `${label}.backgroundColor`);
  }
  return structuredClone(raw) as TextStyleProperties;
};

const decodeLinkTarget = (value: unknown, label: string): LinkTarget => {
  const raw = requireRecord(value, label);
  const kind = requireEnum(
    raw.kind,
    ["url", "resource", "evidence", "question", "data"],
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

export const decodeFormulaWireValue = (
  value: unknown,
  label: string,
  depth = 0,
  cellBudget = { count: 0 }
): FormulaWireValue => {
  if (depth > SLIDE_WIRE_LIMITS.maxFormulaDepth) {
    throw new SlideWireError(`${label} exceeds the Formula value nesting limit`);
  }
  cellBudget.count += 1;
  if (cellBudget.count > SLIDE_WIRE_LIMITS.maxFormulaCells) {
    throw new SlideWireError(`${label} exceeds the Formula value cell limit`);
  }
  const raw = requireRecord(value, label);
  const kind = requireEnum(
    raw.kind,
    ["null", "number", "text", "logic", "list", "record", "table"],
    `${label}.kind`
  );
  if (kind === "null") {
    exactKeys(raw, ["kind"], label);
  } else if (kind === "number") {
    exactKeys(raw, ["kind", "numerator", "denominator"], label);
    const numerator = requireString(raw.numerator, `${label}.numerator`);
    const denominator = requireString(raw.denominator, `${label}.denominator`);
    if (!/^-?(0|[1-9][0-9]*)$/.test(numerator)) {
      throw new SlideWireError(`${label}.numerator must be a canonical integer string`);
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
      return cells.map((cell, cellIndex) => decodeFormulaWireValue(
        cell,
        `${label}.rows[${rowIndex}][${cellIndex}]`,
        depth + 1,
        cellBudget
      ));
    });
    if (new Set(fields).size !== fields.length) {
      throw new SlideWireError(`${label}.fields must be unique`);
    }
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

const decodeRichTextAtom = (value: unknown, label: string): RichTextAtom => {
  const raw = requireRecord(value, label);
  const kind = requireEnum(
    raw.kind,
    ["text", "formula", "reference", "hard-break"],
    `${label}.kind`
  );
  requireIdentifier(raw.id, `${label}.id`);
  if (kind === "text") {
    exactKeys(raw, ["id", "kind", "text"], label);
    requireText(raw.text, `${label}.text`);
  } else if (kind === "formula") {
    exactKeys(raw, ["id", "kind", "expression", "acceptedValue", "displayText", "diagnostic"], label);
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
    ["bold", "italic", "underline", "strike", "code", "style", "link"],
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

const decodeFormulaSettlement = (
  value: unknown,
  label: string
): FormulaAtomSettlement => {
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
  "replace-range-with-atom": ["type", "range", "expectedText", "atom", "trailingTextAtomId"],
  "replace-content": ["type", "content"],
  "add-mark": ["type", "mark"],
  "remove-mark": ["type", "markId"],
  "set-link-targets": ["type", "markId", "targets"],
  "set-formula-expression": ["type", "atomId", "expression"],
  "apply-formula-settlement": ["type", "atomId", "settlement"],
  "apply-formula-result": ["type", "atomId", "value", "displayText"]
};

export const decodeRichTextOperation = (
  value: unknown,
  label: string
): RichTextOperation => {
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
  return items.map((item, index) =>
    decodeRichTextOperation(item, `${label}[${index}]`));
};

const decodeFill = (value: unknown, label: string): void => {
  const raw = requireRecord(value, label);
  const kind = requireEnum(raw.kind, ["none", "solid"], `${label}.kind`);
  if (kind === "none") exactKeys(raw, ["kind"], label);
  else {
    exactKeys(raw, ["kind", "color"], label);
    decodeSlideColor(raw.color, `${label}.color`);
  }
};

const decodeStroke = (value: unknown, label: string): void => {
  const raw = requireRecord(value, label);
  const kind = requireEnum(raw.kind, ["none", "stroke"], `${label}.kind`);
  if (kind === "none") exactKeys(raw, ["kind"], label);
  else {
    exactKeys(raw, ["kind", "color", "widthPt", "dash"], label);
    decodeSlideColor(raw.color, `${label}.color`);
    requirePositiveNumber(raw.widthPt, `${label}.widthPt`);
    requireEnum(raw.dash, ["solid", "dashed", "dotted"], `${label}.dash`);
  }
};

const decodeShadow = (value: unknown, label: string): void => {
  const raw = requireRecord(value, label);
  const kind = requireEnum(raw.kind, ["none", "drop"], `${label}.kind`);
  if (kind === "none") exactKeys(raw, ["kind"], label);
  else {
    exactKeys(raw, ["kind", "color", "offsetXPt", "offsetYPt", "blurPt"], label);
    decodeSlideColor(raw.color, `${label}.color`);
    requireFiniteNumber(raw.offsetXPt, `${label}.offsetXPt`);
    requireFiniteNumber(raw.offsetYPt, `${label}.offsetYPt`);
    requireNonNegativeNumber(raw.blurPt, `${label}.blurPt`);
  }
};

export const decodeVisualStyle = (
  value: unknown,
  label: string
): SlideVisualStyleProperties => {
  const raw = requireRecord(value, label);
  exactKeys(raw, ["opacity", "fill", "stroke", "shadow"], label);
  if (raw.opacity !== undefined) {
    const opacity = requireFiniteNumber(raw.opacity, `${label}.opacity`);
    if (opacity < 0 || opacity > 1) {
      throw new SlideWireError(`${label}.opacity must be between 0 and 1`);
    }
  }
  if (raw.fill !== undefined) decodeFill(raw.fill, `${label}.fill`);
  if (raw.stroke !== undefined) decodeStroke(raw.stroke, `${label}.stroke`);
  if (raw.shadow !== undefined) decodeShadow(raw.shadow, `${label}.shadow`);
  return structuredClone(raw) as unknown as SlideVisualStyleProperties;
};

export const decodeSlideStyle = (value: unknown, label: string): SlideStyle => {
  const raw = requireRecord(value, label);
  exactKeys(raw, ["id", "name", "basedOnStyleId", "visual", "text"], label);
  requireIdentifier(raw.id, `${label}.id`);
  requireString(raw.name, `${label}.name`);
  if (raw.basedOnStyleId !== undefined) {
    requireIdentifier(raw.basedOnStyleId, `${label}.basedOnStyleId`);
  }
  decodeVisualStyle(raw.visual, `${label}.visual`);
  decodeTextStyleProperties(raw.text, `${label}.text`);
  return structuredClone(raw) as unknown as SlideStyle;
};

export const SLIDE_SHAPE_KINDS = [
  "text", "prompt-content", "geometry", "line", "image", "table", "chart"
] as const satisfies readonly SlideShapeKind[];

export const decodeSlideStyleRegistry = (
  value: unknown,
  label: string
): SlideStyleRegistry => {
  const raw = requireRecord(value, label);
  exactKeys(raw, ["defaultStyleIdByShapeKind", "styles"], label);
  const defaults = requireRecord(
    raw.defaultStyleIdByShapeKind,
    `${label}.defaultStyleIdByShapeKind`
  );
  exactKeys(defaults, SLIDE_SHAPE_KINDS, `${label}.defaultStyleIdByShapeKind`);
  for (const kind of SLIDE_SHAPE_KINDS) {
    requireIdentifier(defaults[kind], `${label}.defaultStyleIdByShapeKind.${kind}`);
  }
  const styles = requireArray(raw.styles, `${label}.styles`);
  if (styles.length === 0) throw new SlideWireError(`${label}.styles must not be empty`);
  const decodedStyles = styles.map((style, index) =>
    decodeSlideStyle(style, `${label}.styles[${index}]`));
  const styleIds = new Set<string>();
  for (const style of decodedStyles) {
    if (styleIds.has(style.id)) {
      throw new SlideWireError(`${label}.styles contains duplicate ID ${style.id}`);
    }
    styleIds.add(style.id);
  }
  for (const kind of SLIDE_SHAPE_KINDS) {
    const defaultStyleId = defaults[kind] as string;
    if (!styleIds.has(defaultStyleId)) {
      throw new SlideWireError(
        `${label}.defaultStyleIdByShapeKind.${kind} must resolve to a Style`
      );
    }
  }
  const byId = new Map(decodedStyles.map((style) => [style.id, style]));
  for (const style of decodedStyles) {
    const ancestors = new Set([style.id]);
    let current = style;
    while (current.basedOnStyleId !== undefined) {
      const parent = byId.get(current.basedOnStyleId);
      if (!parent) {
        throw new SlideWireError(
          `${label}.styles.${style.id}.basedOnStyleId must resolve to a Style`
        );
      }
      if (ancestors.has(parent.id)) {
        throw new SlideWireError(`${label}.styles contains an inheritance cycle`);
      }
      ancestors.add(parent.id);
      current = parent;
    }
  }
  return structuredClone(raw) as unknown as SlideStyleRegistry;
};

export const decodeShapeFrame = (value: unknown, label: string): ShapeFrame => {
  const raw = requireRecord(value, label);
  exactKeys(raw, ["xPt", "yPt", "widthPt", "heightPt"], label);
  requireFiniteNumber(raw.xPt, `${label}.xPt`);
  requireFiniteNumber(raw.yPt, `${label}.yPt`);
  requirePositiveNumber(raw.widthPt, `${label}.widthPt`);
  requirePositiveNumber(raw.heightPt, `${label}.heightPt`);
  return structuredClone(raw) as unknown as ShapeFrame;
};

export const decodeShapeTransform = (
  value: unknown,
  label: string
): ShapeTransform => {
  const raw = requireRecord(value, label);
  exactKeys(raw, ["rotationDegrees", "flipHorizontal", "flipVertical"], label);
  const rotation = requireFiniteNumber(raw.rotationDegrees, `${label}.rotationDegrees`);
  if (rotation < 0 || rotation >= 360) {
    throw new SlideWireError(`${label}.rotationDegrees must be in [0, 360)`);
  }
  requireBoolean(raw.flipHorizontal, `${label}.flipHorizontal`);
  requireBoolean(raw.flipVertical, `${label}.flipVertical`);
  return structuredClone(raw) as unknown as ShapeTransform;
};

export const decodePresentation = (
  value: unknown,
  label: string
): ShapePresentationOverride => {
  const raw = requireRecord(value, label);
  exactKeys(raw, ["visual", "text"], label);
  if (raw.visual !== undefined) decodeVisualStyle(raw.visual, `${label}.visual`);
  if (raw.text !== undefined) decodeTextStyleProperties(raw.text, `${label}.text`);
  return structuredClone(raw) as unknown as ShapePresentationOverride;
};

export const decodeTextBox = (
  value: unknown,
  label: string
): TextBoxPresentation => {
  const raw = requireRecord(value, label);
  exactKeys(raw, ["paddingPt", "horizontalAlign", "verticalAlign", "overflow"], label);
  const padding = requireRecord(raw.paddingPt, `${label}.paddingPt`);
  exactKeys(padding, ["top", "right", "bottom", "left"], `${label}.paddingPt`);
  for (const edge of ["top", "right", "bottom", "left"] as const) {
    requireNonNegativeNumber(padding[edge], `${label}.paddingPt.${edge}`);
  }
  requireEnum(
    raw.horizontalAlign,
    ["left", "center", "right", "justify"],
    `${label}.horizontalAlign`
  );
  requireEnum(raw.verticalAlign, ["top", "middle", "bottom"], `${label}.verticalAlign`);
  requireEnum(raw.overflow, ["clip", "shrink"], `${label}.overflow`);
  return structuredClone(raw) as unknown as TextBoxPresentation;
};

export const decodeImageSnapshotRef = (
  value: unknown,
  label: string
): ImageSnapshotRef => {
  const raw = requireRecord(value, label);
  exactKeys(raw, ["fileId", "version", "digest", "mimeType"], label);
  requireIdentifier(raw.fileId, `${label}.fileId`);
  requireIdentifier(raw.version, `${label}.version`);
  requireString(raw.digest, `${label}.digest`);
  requireString(raw.mimeType, `${label}.mimeType`);
  return structuredClone(raw) as unknown as ImageSnapshotRef;
};

export const decodeNormalizedCrop = (
  value: unknown,
  label: string
): NormalizedCrop => {
  const raw = requireRecord(value, label);
  exactKeys(raw, ["left", "top", "right", "bottom"], label);
  for (const edge of ["left", "top", "right", "bottom"] as const) {
    const coordinate = requireFiniteNumber(raw[edge], `${label}.${edge}`);
    if (coordinate < 0 || coordinate >= 1) {
      throw new SlideWireError(`${label}.${edge} must be in [0, 1)`);
    }
  }
  if ((raw.left as number) + (raw.right as number) >= 1) {
    throw new SlideWireError(`${label} horizontal crop must leave positive width`);
  }
  if ((raw.top as number) + (raw.bottom as number) >= 1) {
    throw new SlideWireError(`${label} vertical crop must leave positive height`);
  }
  return structuredClone(raw) as unknown as NormalizedCrop;
};

export const decodeAcceptedValue = (
  value: unknown,
  label: string
): AcceptedSlideValue => {
  const raw = requireRecord(value, label);
  exactKeys(raw, ["value"], label);
  decodeFormulaWireValue(raw.value, `${label}.value`);
  return structuredClone(raw) as unknown as AcceptedSlideValue;
};

const decodeShapeBase = (raw: Record<string, unknown>, label: string): void => {
  requireIdentifier(raw.id, `${label}.id`);
  if (raw.elementKind !== "shape") {
    throw new SlideWireError(`${label}.elementKind must be shape`);
  }
  requireBoolean(raw.locked, `${label}.locked`);
  requireBoolean(raw.hidden, `${label}.hidden`);
  decodeShapeFrame(raw.frame, `${label}.frame`);
  decodeShapeTransform(raw.transform, `${label}.transform`);
  requireIdentifier(raw.styleId, `${label}.styleId`);
  if (raw.presentation !== undefined) {
    decodePresentation(raw.presentation, `${label}.presentation`);
  }
};

const SHAPE_BASE_KEYS = [
  "id", "elementKind", "locked", "hidden", "frame", "transform", "styleId",
  "presentation", "shapeKind"
] as const;

export const decodeOutputRef = (value: unknown, label: string): void => {
  const raw = requireRecord(value, label);
  exactKeys(raw, ["outputId", "appliedRevision"], label);
  requireIdentifier(raw.outputId, `${label}.outputId`);
  requirePositiveInteger(raw.appliedRevision, `${label}.appliedRevision`);
};

export const decodeGeometryDefinition = (value: unknown, label: string): void => {
  const raw = requireRecord(value, label);
  const kind = requireEnum(
    raw.kind,
    ["rectangle", "rounded-rectangle", "ellipse", "triangle", "diamond", "arrow"],
    `${label}.kind`
  );
  if (kind === "rounded-rectangle") {
    exactKeys(raw, ["kind", "cornerRadiusPt"], label);
    requireNonNegativeNumber(raw.cornerRadiusPt, `${label}.cornerRadiusPt`);
  } else {
    exactKeys(raw, ["kind"], label);
  }
};

export const decodeLineDefinition = (value: unknown, label: string): void => {
  const raw = requireRecord(value, label);
  exactKeys(raw, ["start", "end", "startDecoration", "endDecoration"], label);
  for (const pointName of ["start", "end"] as const) {
    const point = requireRecord(raw[pointName], `${label}.${pointName}`);
    exactKeys(point, ["x", "y"], `${label}.${pointName}`);
    for (const coordinate of ["x", "y"] as const) {
      const result = requireFiniteNumber(
        point[coordinate],
        `${label}.${pointName}.${coordinate}`
      );
      if (result < 0 || result > 1) {
        throw new SlideWireError(`${label}.${pointName}.${coordinate} must be in [0, 1]`);
      }
    }
  }
  requireEnum(
    raw.startDecoration,
    ["none", "arrow", "circle", "diamond"],
    `${label}.startDecoration`
  );
  requireEnum(
    raw.endDecoration,
    ["none", "arrow", "circle", "diamond"],
    `${label}.endDecoration`
  );
  const start = raw.start as { x: number; y: number };
  const end = raw.end as { x: number; y: number };
  if (start.x === end.x && start.y === end.y) {
    throw new SlideWireError(`${label} endpoints must differ`);
  }
};

export const decodeImageShapeData = (value: unknown, label: string): void => {
  const raw = requireRecord(value, label);
  exactKeys(raw, ["source", "crop", "fit", "alt", "decorative"], label);
  decodeImageSnapshotRef(raw.source, `${label}.source`);
  if (!(raw.source as ImageSnapshotRef).mimeType.startsWith("image/")) {
    throw new SlideWireError(`${label}.source.mimeType must start with image/`);
  }
  if (raw.crop !== undefined) decodeNormalizedCrop(raw.crop, `${label}.crop`);
  requireEnum(raw.fit, ["contain", "cover", "stretch"], `${label}.fit`);
  requireText(raw.alt, `${label}.alt`);
  requireBoolean(raw.decorative, `${label}.decorative`);
  if (raw.decorative === true && raw.alt !== "") {
    throw new SlideWireError(`${label}.alt must be empty for a decorative image`);
  }
  if (raw.decorative === false && !(raw.alt as string).trim()) {
    throw new SlideWireError(`${label}.alt is required for a non-decorative image`);
  }
};

export const decodeTableShapeData = (value: unknown, label: string): void => {
  const raw = requireRecord(value, label);
  exactKeys(raw, ["accepted", "presentation"], label);
  decodeAcceptedValue(raw.accepted, `${label}.accepted`);
  const accepted = raw.accepted as { value: FormulaWireValue };
  if (accepted.value.kind !== "table") {
    throw new SlideWireError(`${label}.accepted.value must be a table value`);
  }
  const presentation = requireRecord(raw.presentation, `${label}.presentation`);
  exactKeys(presentation, [
    "headerRow", "bandedRows", "firstColumnHeader", "lastColumnFooter",
    "columnWidthsPt"
  ], `${label}.presentation`);
  for (const key of [
    "headerRow", "bandedRows", "firstColumnHeader", "lastColumnFooter"
  ] as const) {
    requireBoolean(presentation[key], `${label}.presentation.${key}`);
  }
  if (presentation.columnWidthsPt !== undefined) {
    const widths = requireArray(
      presentation.columnWidthsPt,
      `${label}.presentation.columnWidthsPt`
    );
    widths.forEach((width, index) =>
        requirePositiveNumber(width, `${label}.presentation.columnWidthsPt[${index}]`));
    if (widths.length !== accepted.value.fields.length) {
      throw new SlideWireError(
        `${label}.presentation.columnWidthsPt must match the table field count`
      );
    }
  }
};

const decodeAxis = (value: unknown, label: string): void => {
  const raw = requireRecord(value, label);
  exactKeys(raw, ["label", "min", "max"], label);
  if (raw.label !== undefined) requireText(raw.label, `${label}.label`);
  const min = raw.min === undefined ? undefined : requireFiniteNumber(raw.min, `${label}.min`);
  const max = raw.max === undefined ? undefined : requireFiniteNumber(raw.max, `${label}.max`);
  if (min !== undefined && max !== undefined && min > max) {
    throw new SlideWireError(`${label}.min must not exceed max`);
  }
};

export const decodeChartShapeData = (value: unknown, label: string): void => {
  const raw = requireRecord(value, label);
  exactKeys(raw, ["accepted", "specification"], label);
  decodeAcceptedValue(raw.accepted, `${label}.accepted`);
  const accepted = raw.accepted as { value: FormulaWireValue };
  if (accepted.value.kind !== "list" &&
      accepted.value.kind !== "record" &&
      accepted.value.kind !== "table") {
    throw new SlideWireError(
      `${label}.accepted.value must be a list, record, or table value`
    );
  }
  const specification = requireRecord(raw.specification, `${label}.specification`);
  exactKeys(specification, ["kind", "title", "xAxis", "yAxis", "legend", "colors"], `${label}.specification`);
  requireEnum(
    specification.kind,
    ["bar", "line", "pie", "scatter", "area"],
    `${label}.specification.kind`
  );
  if (specification.title !== undefined) {
    requireText(specification.title, `${label}.specification.title`);
  }
  if (specification.xAxis !== undefined) {
    decodeAxis(specification.xAxis, `${label}.specification.xAxis`);
  }
  if (specification.yAxis !== undefined) {
    decodeAxis(specification.yAxis, `${label}.specification.yAxis`);
  }
  const legend = requireRecord(specification.legend, `${label}.specification.legend`);
  exactKeys(legend, ["position"], `${label}.specification.legend`);
  requireEnum(
    legend.position,
    ["top", "bottom", "left", "right", "none"],
    `${label}.specification.legend.position`
  );
  if (specification.colors !== undefined) {
    requireArray(specification.colors, `${label}.specification.colors`).forEach((color, index) =>
      decodeSlideColor(color, `${label}.specification.colors[${index}]`));
  }
};

export const decodeSlideShape = (value: unknown, label: string): SlideShape => {
  const raw = requireRecord(value, label);
  const kind = requireEnum(raw.shapeKind, SLIDE_SHAPE_KINDS, `${label}.shapeKind`);
  decodeShapeBase(raw, label);
  if (kind === "text") {
    exactKeys(raw, [...SHAPE_BASE_KEYS, "content", "textBox"], label);
    decodeRichContent(raw.content, `${label}.content`);
    decodeTextBox(raw.textBox, `${label}.textBox`);
  } else if (kind === "prompt-content") {
    exactKeys(raw, [...SHAPE_BASE_KEYS, "output", "textBox"], label);
    decodeOutputRef(raw.output, `${label}.output`);
    decodeTextBox(raw.textBox, `${label}.textBox`);
  } else if (kind === "geometry") {
    exactKeys(raw, [...SHAPE_BASE_KEYS, "geometry"], label);
    decodeGeometryDefinition(raw.geometry, `${label}.geometry`);
  } else if (kind === "line") {
    exactKeys(raw, [...SHAPE_BASE_KEYS, "line"], label);
    decodeLineDefinition(raw.line, `${label}.line`);
  } else if (kind === "image") {
    exactKeys(raw, [...SHAPE_BASE_KEYS, "image"], label);
    decodeImageShapeData(raw.image, `${label}.image`);
  } else if (kind === "table") {
    exactKeys(raw, [...SHAPE_BASE_KEYS, "table"], label);
    decodeTableShapeData(raw.table, `${label}.table`);
  } else {
    exactKeys(raw, [...SHAPE_BASE_KEYS, "chart"], label);
    decodeChartShapeData(raw.chart, `${label}.chart`);
  }
  return structuredClone(raw) as unknown as
    | TextShape
    | PromptContentShape
    | GeometryShape
    | LineShape
    | ImageShape
    | TableShape
    | ChartShape;
};

export const decodeSlideGroup = (value: unknown, label: string): SlideGroup => {
  const raw = requireRecord(value, label);
  exactKeys(raw, ["id", "elementKind", "locked", "hidden", "childElementIds"], label);
  requireIdentifier(raw.id, `${label}.id`);
  if (raw.elementKind !== "group") {
    throw new SlideWireError(`${label}.elementKind must be group`);
  }
  requireBoolean(raw.locked, `${label}.locked`);
  requireBoolean(raw.hidden, `${label}.hidden`);
  decodeIdentifierArray(raw.childElementIds, `${label}.childElementIds`);
  return structuredClone(raw) as unknown as SlideGroup;
};

export const decodePlacement = (value: unknown, label: string): ElementPlacement => {
  const raw = requireRecord(value, label);
  exactKeys(raw, ["parentGroupId", "afterElementId"], label);
  if (raw.parentGroupId !== undefined) {
    requireIdentifier(raw.parentGroupId, `${label}.parentGroupId`);
  }
  if (raw.afterElementId !== undefined) {
    requireIdentifier(raw.afterElementId, `${label}.afterElementId`);
  }
  return structuredClone(raw) as unknown as ElementPlacement;
};

export const decodeSlideBackground = (
  value: unknown,
  label: string
): SlideBackground => {
  const raw = requireRecord(value, label);
  const kind = requireEnum(raw.kind, ["transparent", "solid", "image"], `${label}.kind`);
  if (kind === "transparent") exactKeys(raw, ["kind"], label);
  else if (kind === "solid") {
    exactKeys(raw, ["kind", "color"], label);
    decodeSlideColor(raw.color, `${label}.color`);
  } else {
    exactKeys(raw, ["kind", "source", "fit"], label);
    decodeImageSnapshotRef(raw.source, `${label}.source`);
    if (!(raw.source as ImageSnapshotRef).mimeType.startsWith("image/")) {
      throw new SlideWireError(`${label}.source.mimeType must start with image/`);
    }
    requireEnum(raw.fit, ["contain", "cover", "stretch"], `${label}.fit`);
  }
  return structuredClone(raw) as unknown as SlideBackground;
};

export const decodeSlide = (value: unknown, label: string): Slide => {
  const raw = requireRecord(value, label);
  exactKeys(raw, ["id", "title", "background", "notes", "rootElementIds", "elements"], label);
  requireIdentifier(raw.id, `${label}.id`);
  if (raw.title !== undefined) requireText(raw.title, `${label}.title`);
  decodeSlideBackground(raw.background, `${label}.background`);
  decodeRichContent(raw.notes, `${label}.notes`);
  decodeIdentifierArray(raw.rootElementIds, `${label}.rootElementIds`);
  const elements = requireRecord(raw.elements, `${label}.elements`);
  if (Object.keys(elements).length > SLIDE_WIRE_LIMITS.maxCollectionItems) {
    throw new SlideWireError(`${label}.elements exceeds the collection limit`);
  }
  for (const [id, element] of Object.entries(elements)) {
    requireIdentifier(id, `${label}.elements key`);
    const candidate = requireRecord(element, `${label}.elements.${id}`);
    if (candidate.elementKind === "group") {
      decodeSlideGroup(candidate, `${label}.elements.${id}`);
    } else if (candidate.elementKind === "shape") {
      decodeSlideShape(candidate, `${label}.elements.${id}`);
    } else {
      throw new SlideWireError(`${label}.elements.${id}.elementKind must be group or shape`);
    }
    if (candidate.id !== id) {
      throw new SlideWireError(`${label}.elements.${id}.id must match its record key`);
    }
  }

  const completed = new Set<string>();
  const visit = (id: string, groupDepth: number, ancestors: Set<string>): void => {
    if (ancestors.has(id)) {
      throw new SlideWireError(`${label}.elements contains a Group cycle at ${id}`);
    }
    if (completed.has(id) || !Object.hasOwn(elements, id)) return;
    const element = elements[id] as Record<string, unknown>;
    if (element.elementKind !== "group") {
      completed.add(id);
      return;
    }
    const nextDepth = groupDepth + 1;
    if (nextDepth > SLIDE_WIRE_LIMITS.maxGroupDepth) {
      throw new SlideWireError(`${label}.elements exceeds the Group depth limit`);
    }
    const nextAncestors = new Set(ancestors).add(id);
    for (const childId of element.childElementIds as string[]) {
      visit(childId, nextDepth, nextAncestors);
    }
    completed.add(id);
  };
  for (const id of raw.rootElementIds as string[]) visit(id, 0, new Set());
  for (const id of Object.keys(elements)) visit(id, 0, new Set());

  const memberships = new Map<string, number>();
  const addMembership = (id: string, source: string): void => {
    if (!Object.hasOwn(elements, id)) {
      throw new SlideWireError(`${source} references missing element ${id}`);
    }
    memberships.set(id, (memberships.get(id) ?? 0) + 1);
  };
  for (const id of raw.rootElementIds as string[]) {
    addMembership(id, `${label}.rootElementIds`);
  }
  for (const [id, value] of Object.entries(elements)) {
    const element = value as Record<string, unknown>;
    if (element.elementKind !== "group") continue;
    const childIds = element.childElementIds as string[];
    if (childIds.length === 0) {
      throw new SlideWireError(`${label}.elements.${id} must not be an empty Group`);
    }
    if (new Set(childIds).size !== childIds.length) {
      throw new SlideWireError(`${label}.elements.${id} contains duplicate children`);
    }
    for (const childId of childIds) {
      addMembership(childId, `${label}.elements.${id}.childElementIds`);
    }
  }
  for (const id of Object.keys(elements)) {
    if ((memberships.get(id) ?? 0) !== 1) {
      throw new SlideWireError(`${label}.elements.${id} must have exactly one membership`);
    }
  }
  return structuredClone(raw) as unknown as Slide;
};
