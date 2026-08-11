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
  TextStyleProperties,
} from "#rich-text";
import type {
  BlockPlacement,
  BlockPresentationOverride,
  ChartBlockData,
  DocumentBlock,
  DocumentBlockKind,
  DocumentList,
  DocumentPageLayout,
  DocumentRow,
  DocumentStyle,
  DocumentStyleRegistry,
  ImageBlockData,
  ListItem,
  MediaSnapshotRef,
  RowLayout,
  TableCell,
  TableColumn,
  TableMerge,
  TableRow,
  VisualDimensions,
} from "../domain/model.js";

export class DocumentWireError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DocumentWireError";
  }
}

export const DOCUMENT_WIRE_LIMITS = {
  maxPayloadBytes: 1_048_576,
  maxStringBytes: 262_144,
  maxIdentifierBytes: 512,
  maxCollectionItems: 10_000,
  maxOperations: 1_000,
  maxRichTextOperations: 1_000,
  maxDepth: 32,
  maxNodes: 100_000,
} as const;

const byteLength = (value: string): number => Buffer.byteLength(value, "utf8");

/** Reject non-JSON values, cycles, pathological depth/counts, and large bodies. */
export const assertDocumentWireInput = (value: unknown, label: string): void => {
  const active = new WeakSet<object>();
  let nodes = 0;

  const visit = (item: unknown, path: string, depth: number): void => {
    nodes += 1;
    if (nodes > DOCUMENT_WIRE_LIMITS.maxNodes) {
      throw new DocumentWireError(`${label} exceeds the node limit`);
    }
    if (depth > DOCUMENT_WIRE_LIMITS.maxDepth) {
      throw new DocumentWireError(`${path} exceeds the nesting limit`);
    }
    if (item === null || typeof item === "boolean") return;
    if (typeof item === "string") {
      if (byteLength(item) > DOCUMENT_WIRE_LIMITS.maxStringBytes) {
        throw new DocumentWireError(`${path} exceeds the string size limit`);
      }
      return;
    }
    if (typeof item === "number") {
      if (!Number.isFinite(item)) throw new DocumentWireError(`${path} must be finite`);
      return;
    }
    if (typeof item !== "object") {
      throw new DocumentWireError(`${path} must contain only JSON values`);
    }

    if (active.has(item)) throw new DocumentWireError(`${path} must not be cyclic`);
    active.add(item);
    if (Array.isArray(item)) {
      if (item.length > DOCUMENT_WIRE_LIMITS.maxCollectionItems) {
        throw new DocumentWireError(`${path} exceeds the collection limit`);
      }
      item.forEach((child, index) => visit(child, `${path}[${index}]`, depth + 1));
    } else {
      const prototype = Object.getPrototypeOf(item);
      if (prototype !== Object.prototype && prototype !== null) {
        throw new DocumentWireError(`${path} must be a plain object`);
      }
      const ownKeys = Reflect.ownKeys(item);
      if (ownKeys.some((key) => typeof key === "symbol")) {
        throw new DocumentWireError(`${path} must not contain symbol fields`);
      }
      if (ownKeys.length > DOCUMENT_WIRE_LIMITS.maxCollectionItems) {
        throw new DocumentWireError(`${path} exceeds the field-count limit`);
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
    throw new DocumentWireError(`${label} must be JSON serializable`);
  }
  if (encoded === undefined) throw new DocumentWireError(`${label} must be a JSON value`);
  if (byteLength(encoded) > DOCUMENT_WIRE_LIMITS.maxPayloadBytes) {
    throw new DocumentWireError(`${label} exceeds the payload size limit`);
  }
};

export const requireRecord = (value: unknown, label: string): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new DocumentWireError(`${label} must be an object`);
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new DocumentWireError(`${label} must be a plain object`);
  }
  return value as Record<string, unknown>;
};

export const exactKeys = (
  value: Record<string, unknown>,
  allowed: readonly string[],
  label: string,
): void => {
  const allowedSet = new Set(allowed);
  const unknown = Object.keys(value).filter((key) => !allowedSet.has(key));
  if (unknown.length > 0) {
    throw new DocumentWireError(`${label} contains unknown fields: ${unknown.join(", ")}`);
  }
};

export const requireText = (value: unknown, label: string): string => {
  if (typeof value !== "string") throw new DocumentWireError(`${label} must be a string`);
  if (byteLength(value) > DOCUMENT_WIRE_LIMITS.maxStringBytes) {
    throw new DocumentWireError(`${label} exceeds the string size limit`);
  }
  return value;
};

export const requireString = (value: unknown, label: string): string => {
  const result = requireText(value, label);
  if (result.length === 0) throw new DocumentWireError(`${label} must be a non-empty string`);
  return result;
};

export const requireIdentifier = (value: unknown, label: string): string => {
  const result = requireString(value, label);
  if (byteLength(result) > DOCUMENT_WIRE_LIMITS.maxIdentifierBytes) {
    throw new DocumentWireError(`${label} exceeds the identifier size limit`);
  }
  return result;
};

export const requireBoolean = (value: unknown, label: string): boolean => {
  if (typeof value !== "boolean") throw new DocumentWireError(`${label} must be a boolean`);
  return value;
};

export const requireFiniteNumber = (value: unknown, label: string): number => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new DocumentWireError(`${label} must be a finite number`);
  }
  return value;
};

export const requireInteger = (value: unknown, label: string): number => {
  if (!Number.isSafeInteger(value)) throw new DocumentWireError(`${label} must be an integer`);
  return value as number;
};

export const requireNonNegativeInteger = (value: unknown, label: string): number => {
  const result = requireInteger(value, label);
  if (result < 0) throw new DocumentWireError(`${label} must be a non-negative integer`);
  return result;
};

export const requirePositiveInteger = (value: unknown, label: string): number => {
  const result = requireInteger(value, label);
  if (result <= 0) throw new DocumentWireError(`${label} must be a positive integer`);
  return result;
};

export const requireEnum = <T extends string>(
  value: unknown,
  allowed: readonly T[],
  label: string,
): T => {
  if (typeof value !== "string" || !allowed.includes(value as T)) {
    throw new DocumentWireError(`${label} must be one of: ${allowed.join(", ")}`);
  }
  return value as T;
};

const requireArray = (
  value: unknown,
  label: string,
  max: number = DOCUMENT_WIRE_LIMITS.maxCollectionItems,
): unknown[] => {
  if (!Array.isArray(value)) throw new DocumentWireError(`${label} must be an array`);
  if (value.length > max) throw new DocumentWireError(`${label} exceeds the collection limit`);
  return value;
};

const decodeIdentifierArray = (value: unknown, label: string): string[] =>
  requireArray(value, label).map((item, index) => requireIdentifier(item, `${label}[${index}]`));

export const decodeContextEntries = (value: unknown, label: string): ContextEntry[] =>
  requireArray(value, label).map((item, index) => {
    const entry = requireRecord(item, `${label}[${index}]`);
    exactKeys(entry, ["id", "kind"], `${label}[${index}]`);
    return {
      id: requireIdentifier(entry.id, `${label}[${index}].id`),
      kind: requireIdentifier(entry.kind, `${label}[${index}].kind`),
    };
  });

const decodePosition = (value: unknown, label: string): TextPosition => {
  const raw = requireRecord(value, label);
  exactKeys(raw, ["atomId", "offset"], label);
  return {
    atomId: requireIdentifier(raw.atomId, `${label}.atomId`),
    offset: requireNonNegativeInteger(raw.offset, `${label}.offset`),
  };
};

export const decodeTextRange = (value: unknown, label: string): TextRange => {
  const raw = requireRecord(value, label);
  exactKeys(raw, ["start", "end"], label);
  return {
    start: decodePosition(raw.start, `${label}.start`),
    end: decodePosition(raw.end, `${label}.end`),
  };
};

export const decodeTextStyleProperties = (value: unknown, label: string): TextStyleProperties => {
  const raw = requireRecord(value, label);
  exactKeys(raw, [
    "fontFamily", "fontSize", "fontWeight", "italic", "underline", "strike",
    "code", "color", "backgroundColor", "letterSpacing", "lineHeight",
  ], label);
  if (raw.fontFamily !== undefined) requireString(raw.fontFamily, `${label}.fontFamily`);
  if (raw.fontSize !== undefined && requireFiniteNumber(raw.fontSize, `${label}.fontSize`) <= 0) {
    throw new DocumentWireError(`${label}.fontSize must be positive`);
  }
  if (raw.fontWeight !== undefined && requireFiniteNumber(raw.fontWeight, `${label}.fontWeight`) <= 0) {
    throw new DocumentWireError(`${label}.fontWeight must be positive`);
  }
  for (const key of ["italic", "underline", "strike", "code"] as const) {
    if (raw[key] !== undefined) requireBoolean(raw[key], `${label}.${key}`);
  }
  for (const key of ["color", "backgroundColor"] as const) {
    if (raw[key] !== undefined) requireString(raw[key], `${label}.${key}`);
  }
  if (raw.letterSpacing !== undefined) requireFiniteNumber(raw.letterSpacing, `${label}.letterSpacing`);
  if (raw.lineHeight !== undefined && requireFiniteNumber(raw.lineHeight, `${label}.lineHeight`) <= 0) {
    throw new DocumentWireError(`${label}.lineHeight must be positive`);
  }
  return structuredClone(raw) as TextStyleProperties;
};

const decodeIndentation = (value: unknown, label: string): NonNullable<BlockPresentationOverride["indentation"]> => {
  const raw = requireRecord(value, label);
  exactKeys(raw, ["leftTwips", "rightTwips", "firstLineTwips"], label);
  return {
    leftTwips: requireNonNegativeInteger(raw.leftTwips, `${label}.leftTwips`),
    rightTwips: requireNonNegativeInteger(raw.rightTwips, `${label}.rightTwips`),
    firstLineTwips: requireInteger(raw.firstLineTwips, `${label}.firstLineTwips`),
  };
};

export const decodePresentation = (value: unknown, label: string): BlockPresentationOverride => {
  const raw = requireRecord(value, label);
  exactKeys(raw, [
    "alignment", "wrapping", "spacingBeforeTwips", "spacingAfterTwips",
    "lineHeight", "indentation", "keepWithNext", "keepTogether",
  ], label);
  if (raw.alignment !== undefined) requireEnum(raw.alignment, ["left", "center", "right", "justify"], `${label}.alignment`);
  if (raw.wrapping !== undefined) requireEnum(raw.wrapping, ["wrap", "no-wrap", "break-word"], `${label}.wrapping`);
  for (const key of ["spacingBeforeTwips", "spacingAfterTwips"] as const) {
    if (raw[key] !== undefined) requireNonNegativeInteger(raw[key], `${label}.${key}`);
  }
  if (raw.lineHeight !== undefined && requireFiniteNumber(raw.lineHeight, `${label}.lineHeight`) <= 0) {
    throw new DocumentWireError(`${label}.lineHeight must be positive`);
  }
  if (raw.indentation !== undefined) decodeIndentation(raw.indentation, `${label}.indentation`);
  for (const key of ["keepWithNext", "keepTogether"] as const) {
    if (raw[key] !== undefined) requireBoolean(raw[key], `${label}.${key}`);
  }
  return structuredClone(raw) as BlockPresentationOverride;
};

export const decodeDocumentStyle = (value: unknown, label: string): DocumentStyle => {
  const raw = requireRecord(value, label);
  exactKeys(raw, ["id", "name", "basedOnStyleId", "text", "block", "systemRole"], label);
  requireIdentifier(raw.id, `${label}.id`);
  requireString(raw.name, `${label}.name`);
  if (raw.basedOnStyleId !== undefined) requireIdentifier(raw.basedOnStyleId, `${label}.basedOnStyleId`);
  decodeTextStyleProperties(raw.text, `${label}.text`);
  decodePresentation(raw.block, `${label}.block`);
  if (raw.systemRole !== undefined) {
    requireEnum(raw.systemRole, [
      "heading-1", "heading-2", "heading-3", "heading-4", "heading-5", "heading-6",
    ], `${label}.systemRole`);
  }
  return structuredClone(raw) as unknown as DocumentStyle;
};

const BLOCK_KINDS = [
  "text", "code", "quote", "prompt", "divider", "callout", "list", "table", "image", "chart",
] as const satisfies readonly DocumentBlockKind[];

export const decodeStyleRegistry = (value: unknown, label: string): DocumentStyleRegistry => {
  const raw = requireRecord(value, label);
  exactKeys(raw, ["defaultStyleIdByBlockKind", "styles"], label);
  const defaults = requireRecord(raw.defaultStyleIdByBlockKind, `${label}.defaultStyleIdByBlockKind`);
  exactKeys(defaults, BLOCK_KINDS, `${label}.defaultStyleIdByBlockKind`);
  for (const kind of BLOCK_KINDS) requireIdentifier(defaults[kind], `${label}.defaultStyleIdByBlockKind.${kind}`);
  const styles = requireArray(raw.styles, `${label}.styles`, 1_000);
  if (styles.length === 0) throw new DocumentWireError(`${label}.styles must not be empty`);
  styles.forEach((style, index) => decodeDocumentStyle(style, `${label}.styles[${index}]`));
  return structuredClone(raw) as unknown as DocumentStyleRegistry;
};

export const decodePageLayout = (value: unknown, label: string): DocumentPageLayout => {
  const raw = requireRecord(value, label);
  exactKeys(raw, ["page", "margins", "pageNumber"], label);
  const page = requireRecord(raw.page, `${label}.page`);
  exactKeys(page, ["widthTwips", "heightTwips", "orientation"], `${label}.page`);
  requirePositiveInteger(page.widthTwips, `${label}.page.widthTwips`);
  requirePositiveInteger(page.heightTwips, `${label}.page.heightTwips`);
  requireEnum(page.orientation, ["portrait", "landscape"], `${label}.page.orientation`);
  const margins = requireRecord(raw.margins, `${label}.margins`);
  exactKeys(margins, ["topTwips", "rightTwips", "bottomTwips", "leftTwips"], `${label}.margins`);
  for (const key of ["topTwips", "rightTwips", "bottomTwips", "leftTwips"] as const) {
    requireNonNegativeInteger(margins[key], `${label}.margins.${key}`);
  }
  const pageNumber = requireRecord(raw.pageNumber, `${label}.pageNumber`);
  exactKeys(pageNumber, ["start", "format"], `${label}.pageNumber`);
  requirePositiveInteger(pageNumber.start, `${label}.pageNumber.start`);
  requireEnum(pageNumber.format, ["decimal", "roman-lower", "roman-upper"], `${label}.pageNumber.format`);
  return structuredClone(raw) as unknown as DocumentPageLayout;
};

const decodeRowLayoutWithoutTracks = (value: unknown, label: string): Omit<RowLayout, "tracks"> => {
  const raw = requireRecord(value, label);
  exactKeys(raw, ["blockGapTwips", "marginBeforeTwips", "marginAfterTwips"], label);
  return {
    blockGapTwips: requireNonNegativeInteger(raw.blockGapTwips, `${label}.blockGapTwips`),
    marginBeforeTwips: requireNonNegativeInteger(raw.marginBeforeTwips, `${label}.marginBeforeTwips`),
    marginAfterTwips: requireNonNegativeInteger(raw.marginAfterTwips, `${label}.marginAfterTwips`),
  };
};

export const decodeRowLayout = (value: unknown, label: string): RowLayout => {
  const raw = requireRecord(value, label);
  exactKeys(raw, ["blockGapTwips", "marginBeforeTwips", "marginAfterTwips", "tracks"], label);
  const base = decodeRowLayoutWithoutTracks({
    blockGapTwips: raw.blockGapTwips,
    marginBeforeTwips: raw.marginBeforeTwips,
    marginAfterTwips: raw.marginAfterTwips,
  }, label);
  const tracks = requireArray(raw.tracks, `${label}.tracks`).map((item, index) => {
    const track = requireRecord(item, `${label}.tracks[${index}]`);
    exactKeys(track, ["blockId", "widthUnits"], `${label}.tracks[${index}]`);
    return {
      blockId: requireIdentifier(track.blockId, `${label}.tracks[${index}].blockId`),
      widthUnits: requirePositiveInteger(track.widthUnits, `${label}.tracks[${index}].widthUnits`),
    };
  });
  return { ...base, tracks };
};

export const decodePlacement = (value: unknown, label: string): BlockPlacement => {
  const raw = requireRecord(value, label);
  const kind = requireEnum(raw.kind, ["after-block", "between-blocks", "in-row", "new-row"], `${label}.kind`);
  switch (kind) {
    case "after-block":
      exactKeys(raw, ["kind", "afterBlockId", "newRowId", "widthUnits"], label);
      requireIdentifier(raw.afterBlockId, `${label}.afterBlockId`);
      if (raw.newRowId !== undefined) requireIdentifier(raw.newRowId, `${label}.newRowId`);
      break;
    case "between-blocks":
      exactKeys(raw, ["kind", "beforeBlockId", "afterBlockId", "newRowId", "widthUnits"], label);
      requireIdentifier(raw.beforeBlockId, `${label}.beforeBlockId`);
      requireIdentifier(raw.afterBlockId, `${label}.afterBlockId`);
      if (raw.newRowId !== undefined) requireIdentifier(raw.newRowId, `${label}.newRowId`);
      break;
    case "in-row":
      exactKeys(raw, ["kind", "rowId", "afterBlockId", "widthUnits"], label);
      requireIdentifier(raw.rowId, `${label}.rowId`);
      if (raw.afterBlockId !== undefined) requireIdentifier(raw.afterBlockId, `${label}.afterBlockId`);
      break;
    case "new-row":
      exactKeys(raw, ["kind", "afterRowId", "rowId", "layout", "widthUnits"], label);
      requireIdentifier(raw.rowId, `${label}.rowId`);
      if (raw.afterRowId !== undefined) requireIdentifier(raw.afterRowId, `${label}.afterRowId`);
      if (raw.layout !== undefined) decodeRowLayoutWithoutTracks(raw.layout, `${label}.layout`);
      break;
  }
  if (raw.widthUnits !== undefined) requirePositiveInteger(raw.widthUnits, `${label}.widthUnits`);
  return structuredClone(raw) as unknown as BlockPlacement;
};

const decodeFormulaWireValue = (value: unknown, label: string, depth = 0): FormulaWireValue => {
  if (depth > DOCUMENT_WIRE_LIMITS.maxDepth) throw new DocumentWireError(`${label} exceeds the nesting limit`);
  const raw = requireRecord(value, label);
  const kind = requireEnum(raw.kind, ["null", "number", "text", "logic", "list", "record", "table"], `${label}.kind`);
  if (kind === "null") {
    exactKeys(raw, ["kind"], label);
  } else if (kind === "number") {
    exactKeys(raw, ["kind", "numerator", "denominator"], label);
    const numerator = requireString(raw.numerator, `${label}.numerator`);
    const denominator = requireString(raw.denominator, `${label}.denominator`);
    if (!/^-?(?:0|[1-9][0-9]*)$/.test(numerator)) throw new DocumentWireError(`${label}.numerator must be an integer string`);
    if (!/^[1-9][0-9]*$/.test(denominator)) throw new DocumentWireError(`${label}.denominator must be a positive integer string`);
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
      if (cells.length !== fields.length) throw new DocumentWireError(`${label}.rows[${rowIndex}] must match the field count`);
      return cells.map((cell, cellIndex) => decodeFormulaWireValue(cell, `${label}.rows[${rowIndex}][${cellIndex}]`, depth + 1));
    });
    if (kind === "list" && (fields.length !== 1 || fields[0] !== "value")) {
      throw new DocumentWireError(`${label} list values require one 'value' field`);
    }
    if (kind === "record" && rows.length !== 1) {
      throw new DocumentWireError(`${label} record values require exactly one row`);
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
    if (end < start) throw new DocumentWireError(`${label}.sourceRange.end must not precede start`);
  }
  return structuredClone(raw);
};

const decodeLinkTarget = (value: unknown, label: string): LinkTarget => {
  const raw = requireRecord(value, label);
  const kind = requireEnum(raw.kind, ["url", "resource", "evidence", "question", "data"], `${label}.kind`);
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
  const kind = requireEnum(raw.kind, ["text", "formula", "reference", "hard-break"], `${label}.kind`);
  requireIdentifier(raw.id, `${label}.id`);
  if (kind === "text") {
    exactKeys(raw, ["id", "kind", "text"], label);
    requireText(raw.text, `${label}.text`);
  } else if (kind === "formula") {
    exactKeys(raw, ["id", "kind", "expression", "acceptedValue", "displayText", "diagnostic"], label);
    requireString(raw.expression, `${label}.expression`);
    requireText(raw.displayText, `${label}.displayText`);
    if (raw.acceptedValue !== undefined) decodeFormulaWireValue(raw.acceptedValue, `${label}.acceptedValue`);
    if (raw.diagnostic !== undefined) decodeFormulaDiagnostic(raw.diagnostic, `${label}.diagnostic`);
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
  const kind = requireEnum(raw.kind, ["bold", "italic", "underline", "strike", "code", "style", "link"], `${label}.kind`);
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
  if (atoms.length === 0) throw new DocumentWireError(`${label}.atoms must not be empty`);
  atoms.forEach((atom, index) => decodeRichTextAtom(atom, `${label}.atoms[${index}]`));
  requireArray(raw.marks, `${label}.marks`).forEach((mark, index) =>
    decodeRichTextMark(mark, `${label}.marks[${index}]`));
  return structuredClone(raw) as unknown as RichContent;
};

const decodeFormulaSettlement = (value: unknown, label: string): FormulaAtomSettlement => {
  const raw = requireRecord(value, label);
  exactKeys(raw, ["acceptedValue", "displayText", "diagnostic"], label);
  requireText(raw.displayText, `${label}.displayText`);
  if (raw.acceptedValue !== undefined) decodeFormulaWireValue(raw.acceptedValue, `${label}.acceptedValue`);
  if (raw.diagnostic !== undefined) decodeFormulaDiagnostic(raw.diagnostic, `${label}.diagnostic`);
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
  "apply-formula-result": ["type", "atomId", "value", "displayText"],
};

export const decodeRichTextOperation = (value: unknown, label: string): RichTextOperation => {
  const raw = requireRecord(value, label);
  const type = requireString(raw.type, `${label}.type`) as RichTextOperation["type"];
  const keys = RICH_TEXT_OPERATION_KEYS[type];
  if (!keys) throw new DocumentWireError(`Unknown Rich Text operation: ${type}`);
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
      if (raw.trailingTextAtomId !== undefined) requireIdentifier(raw.trailingTextAtomId, `${label}.trailingTextAtomId`);
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
      requireArray(raw.targets, `${label}.targets`).forEach((target, index) => decodeLinkTarget(target, `${label}.targets[${index}]`));
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

export const decodeRichTextOperations = (value: unknown, label: string): RichTextOperation[] => {
  const items = requireArray(value, label, DOCUMENT_WIRE_LIMITS.maxRichTextOperations);
  if (items.length === 0) throw new DocumentWireError(`${label} must not be empty`);
  return items.map((item, index) => decodeRichTextOperation(item, `${label}[${index}]`));
};

export const decodeDimensions = (value: unknown, label: string): VisualDimensions => {
  const raw = requireRecord(value, label);
  exactKeys(raw, ["widthTwips", "heightTwips", "lockAspectRatio", "horizontalAlign"], label);
  if (raw.widthTwips !== undefined) requirePositiveInteger(raw.widthTwips, `${label}.widthTwips`);
  requirePositiveInteger(raw.heightTwips, `${label}.heightTwips`);
  requireBoolean(raw.lockAspectRatio, `${label}.lockAspectRatio`);
  requireEnum(raw.horizontalAlign, ["left", "center", "right", "stretch"], `${label}.horizontalAlign`);
  return structuredClone(raw) as unknown as VisualDimensions;
};

export const decodeMediaSnapshotRef = (value: unknown, label: string): MediaSnapshotRef => {
  const raw = requireRecord(value, label);
  exactKeys(raw, ["fileId", "version", "digest", "mimeType"], label);
  requireIdentifier(raw.fileId, `${label}.fileId`);
  requireIdentifier(raw.version, `${label}.version`);
  requireString(raw.digest, `${label}.digest`);
  requireString(raw.mimeType, `${label}.mimeType`);
  return structuredClone(raw) as unknown as MediaSnapshotRef;
};

const decodeImageData = (value: unknown, label: string): ImageBlockData => {
  const raw = requireRecord(value, label);
  exactKeys(raw, ["source", "dimensions", "alt", "decorative", "crop", "fit"], label);
  decodeMediaSnapshotRef(raw.source, `${label}.source`);
  decodeDimensions(raw.dimensions, `${label}.dimensions`);
  requireText(raw.alt, `${label}.alt`);
  requireBoolean(raw.decorative, `${label}.decorative`);
  if (raw.crop !== undefined) {
    const crop = requireRecord(raw.crop, `${label}.crop`);
    exactKeys(crop, ["left", "top", "right", "bottom"], `${label}.crop`);
    for (const key of ["left", "top", "right", "bottom"] as const) {
      const coordinate = requireFiniteNumber(crop[key], `${label}.crop.${key}`);
      if (coordinate < 0 || coordinate > 1) throw new DocumentWireError(`${label}.crop.${key} must be between 0 and 1`);
    }
  }
  requireEnum(raw.fit, ["contain", "cover", "stretch"], `${label}.fit`);
  return structuredClone(raw) as unknown as ImageBlockData;
};

const decodeChartData = (value: unknown, label: string): ChartBlockData => {
  const raw = requireRecord(value, label);
  exactKeys(raw, ["source", "specification", "dimensions", "snapshotDigest", "alt"], label);
  requireEnum(raw.source, ["literal", "formula", "analysis-result", "structured-data"], `${label}.source`);
  requireRecord(raw.specification, `${label}.specification`);
  decodeDimensions(raw.dimensions, `${label}.dimensions`);
  if (raw.snapshotDigest !== undefined) requireString(raw.snapshotDigest, `${label}.snapshotDigest`);
  requireText(raw.alt, `${label}.alt`);
  return structuredClone(raw) as unknown as ChartBlockData;
};

export const decodeListItem = (value: unknown, label: string, depth = 0): ListItem => {
  if (depth > DOCUMENT_WIRE_LIMITS.maxDepth) throw new DocumentWireError(`${label} exceeds the nesting limit`);
  const raw = requireRecord(value, label);
  exactKeys(raw, ["id", "checked", "rows", "children"], label);
  requireIdentifier(raw.id, `${label}.id`);
  if (raw.checked !== undefined) requireBoolean(raw.checked, `${label}.checked`);
  const rows = decodeRows(raw.rows, `${label}.rows`, depth + 1);
  if (rows.length === 0) throw new DocumentWireError(`${label}.rows must not be empty`);
  requireArray(raw.children, `${label}.children`).forEach((child, index) =>
    decodeListItem(child, `${label}.children[${index}]`, depth + 1));
  return structuredClone(raw) as unknown as ListItem;
};

const decodeDocumentList = (value: unknown, label: string, depth: number): DocumentList => {
  const raw = requireRecord(value, label);
  exactKeys(raw, ["id", "listKind", "start", "items"], label);
  requireIdentifier(raw.id, `${label}.id`);
  requireEnum(raw.listKind, ["bulleted", "numbered", "checklist"], `${label}.listKind`);
  if (raw.start !== undefined) requirePositiveInteger(raw.start, `${label}.start`);
  requireArray(raw.items, `${label}.items`).forEach((item, index) =>
    decodeListItem(item, `${label}.items[${index}]`, depth + 1));
  return structuredClone(raw) as unknown as DocumentList;
};

export const decodeTableRow = (value: unknown, label: string): TableRow => {
  const raw = requireRecord(value, label);
  exactKeys(raw, ["id", "minHeightTwips", "header"], label);
  requireIdentifier(raw.id, `${label}.id`);
  if (raw.minHeightTwips !== undefined) requirePositiveInteger(raw.minHeightTwips, `${label}.minHeightTwips`);
  requireBoolean(raw.header, `${label}.header`);
  return structuredClone(raw) as unknown as TableRow;
};

export const decodeTableColumn = (value: unknown, label: string): TableColumn => {
  const raw = requireRecord(value, label);
  exactKeys(raw, ["id", "width"], label);
  requireIdentifier(raw.id, `${label}.id`);
  const width = requireRecord(raw.width, `${label}.width`);
  const kind = requireEnum(width.kind, ["auto", "fixed"], `${label}.width.kind`);
  if (kind === "auto") exactKeys(width, ["kind"], `${label}.width`);
  else {
    exactKeys(width, ["kind", "twips"], `${label}.width`);
    requirePositiveInteger(width.twips, `${label}.width.twips`);
  }
  return structuredClone(raw) as unknown as TableColumn;
};

export const decodeTableCell = (value: unknown, label: string, depth = 0): TableCell => {
  const raw = requireRecord(value, label);
  exactKeys(raw, ["id", "rowId", "columnId", "rows", "verticalAlign"], label);
  requireIdentifier(raw.id, `${label}.id`);
  requireIdentifier(raw.rowId, `${label}.rowId`);
  requireIdentifier(raw.columnId, `${label}.columnId`);
  decodeRows(raw.rows, `${label}.rows`, depth + 1);
  requireEnum(raw.verticalAlign, ["top", "middle", "bottom"], `${label}.verticalAlign`);
  return structuredClone(raw) as unknown as TableCell;
};

export const decodeTableMerge = (value: unknown, label: string): TableMerge => {
  const raw = requireRecord(value, label);
  exactKeys(raw, ["id", "rootCellId", "coveredCellIds"], label);
  requireIdentifier(raw.id, `${label}.id`);
  requireIdentifier(raw.rootCellId, `${label}.rootCellId`);
  decodeIdentifierArray(raw.coveredCellIds, `${label}.coveredCellIds`);
  return structuredClone(raw) as unknown as TableMerge;
};

const decodeDocumentTable = (value: unknown, label: string, depth: number) => {
  const raw = requireRecord(value, label);
  exactKeys(raw, ["id", "columns", "rows", "cells", "merges"], label);
  requireIdentifier(raw.id, `${label}.id`);
  requireArray(raw.columns, `${label}.columns`).forEach((column, index) => decodeTableColumn(column, `${label}.columns[${index}]`));
  requireArray(raw.rows, `${label}.rows`).forEach((row, index) => decodeTableRow(row, `${label}.rows[${index}]`));
  requireArray(raw.cells, `${label}.cells`).forEach((cell, index) => decodeTableCell(cell, `${label}.cells[${index}]`, depth + 1));
  requireArray(raw.merges, `${label}.merges`).forEach((merge, index) => decodeTableMerge(merge, `${label}.merges[${index}]`));
  return structuredClone(raw);
};

export const decodeDocumentBlock = (value: unknown, label: string, depth = 0): DocumentBlock => {
  if (depth > DOCUMENT_WIRE_LIMITS.maxDepth) throw new DocumentWireError(`${label} exceeds the nesting limit`);
  const raw = requireRecord(value, label);
  const kind = requireEnum(raw.kind, BLOCK_KINDS, `${label}.kind`);
  requireIdentifier(raw.id, `${label}.id`);
  requireIdentifier(raw.styleId, `${label}.styleId`);
  if (raw.presentation !== undefined) decodePresentation(raw.presentation, `${label}.presentation`);
  const base = ["id", "kind", "styleId", "presentation"];
  if (kind === "text" || kind === "quote") {
    exactKeys(raw, [...base, "content"], label);
    decodeRichContent(raw.content, `${label}.content`);
  } else if (kind === "code") {
    exactKeys(raw, [...base, "language", "content"], label);
    if (raw.language !== undefined) requireString(raw.language, `${label}.language`);
    decodeRichContent(raw.content, `${label}.content`);
  } else if (kind === "prompt") {
    exactKeys(raw, [...base, "output"], label);
    const output = requireRecord(raw.output, `${label}.output`);
    exactKeys(output, ["outputId", "appliedRevision"], `${label}.output`);
    requireIdentifier(output.outputId, `${label}.output.outputId`);
    requirePositiveInteger(output.appliedRevision, `${label}.output.appliedRevision`);
  } else if (kind === "divider") {
    exactKeys(raw, base, label);
  } else if (kind === "callout") {
    exactKeys(raw, [...base, "tone", "rows"], label);
    requireEnum(raw.tone, ["info", "success", "warning", "danger", "neutral"], `${label}.tone`);
    decodeRows(raw.rows, `${label}.rows`, depth + 1);
  } else if (kind === "list") {
    exactKeys(raw, [...base, "list"], label);
    decodeDocumentList(raw.list, `${label}.list`, depth + 1);
  } else if (kind === "table") {
    exactKeys(raw, [...base, "table"], label);
    decodeDocumentTable(raw.table, `${label}.table`, depth + 1);
  } else if (kind === "image") {
    exactKeys(raw, [...base, "image"], label);
    decodeImageData(raw.image, `${label}.image`);
  } else {
    exactKeys(raw, [...base, "chart"], label);
    decodeChartData(raw.chart, `${label}.chart`);
  }
  return structuredClone(raw) as unknown as DocumentBlock;
};

export const decodeDocumentRow = (value: unknown, label: string, depth = 0): DocumentRow => {
  const raw = requireRecord(value, label);
  exactKeys(raw, ["id", "blocks", "layout"], label);
  requireIdentifier(raw.id, `${label}.id`);
  const blocks = requireArray(raw.blocks, `${label}.blocks`);
  if (blocks.length === 0) throw new DocumentWireError(`${label}.blocks must not be empty`);
  blocks.forEach((block, index) => decodeDocumentBlock(block, `${label}.blocks[${index}]`, depth + 1));
  decodeRowLayout(raw.layout, `${label}.layout`);
  return structuredClone(raw) as unknown as DocumentRow;
};

export const decodeRows = (value: unknown, label: string, depth = 0): DocumentRow[] => {
  if (depth > DOCUMENT_WIRE_LIMITS.maxDepth) throw new DocumentWireError(`${label} exceeds the nesting limit`);
  return requireArray(value, label).map((item, index) => decodeDocumentRow(item, `${label}[${index}]`, depth + 1));
};
