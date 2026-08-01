// RichText — the central runtime object for rich text operations.
// Mark factories are methods on this class — single source of truth for
// how bold, italic, etc. are defined.
// Receives Logger for timing and diagnostics.

import { randomUUID } from "node:crypto";
import type { Logger } from "#platform/observability/logger.js";
import type {
  RichText,
  RichTextConfig,
  RichContent,
  RichTextAtom,
  RichTextMark,
  SimpleRangeMark,
  StyleMark,
  LinkMark,
  TextRange,
  TextStyleProperties,
  LinkTarget,
  ValidationResult,
  ApplyResult,
  FormulaAuthoringResult,
  ResolvedStyling,
  ResolvedStyleRange,
  RichTextIdFactory,
  RichTextOperation,
} from "./types.js";
import { DEFAULT_CONFIG } from "./types.js";
import { overlay as overlayStyles } from "./styles.js";
import { markToProperties } from "./styles.js";
import { validate as validateContent } from "./validate.js";
import { normalize as normalizeContent } from "./normalize.js";
import { applyOperations } from "./operations.js";
import { formulaFromDelimitedRange } from "./formula-authoring.js";
import { clone as cloneContent } from "./clone.js";
import { plainText as extractPlainText } from "./plain-text.js";
import { encode as encodeContent } from "./codec.js";
import { decode as decodeContent } from "./codec.js";

class RichTextImpl implements RichText {
  readonly config: RichTextConfig;
  private readonly logger: Logger;

  constructor(config: RichTextConfig, logger: Logger) {
    this.config = config;
    this.logger = logger;
  }

  // ── Mark factories ────────────────────────────────────────────────────

  bold(range: TextRange, id?: string): SimpleRangeMark<"bold"> {
    return { id: id ?? randomUUID(), kind: "bold", range };
  }

  italic(range: TextRange, id?: string): SimpleRangeMark<"italic"> {
    return { id: id ?? randomUUID(), kind: "italic", range };
  }

  underline(range: TextRange, id?: string): SimpleRangeMark<"underline"> {
    return { id: id ?? randomUUID(), kind: "underline", range };
  }

  strike(range: TextRange, id?: string): SimpleRangeMark<"strike"> {
    return { id: id ?? randomUUID(), kind: "strike", range };
  }

  code(range: TextRange, id?: string): SimpleRangeMark<"code"> {
    return { id: id ?? randomUUID(), kind: "code", range };
  }

  link(targets: LinkTarget[], range: TextRange, id?: string): LinkMark {
    return { id: id ?? randomUUID(), kind: "link", range, targets };
  }

  style(props: TextStyleProperties, range: TextRange, id?: string): StyleMark {
    return { id: id ?? randomUUID(), kind: "style", range, properties: props };
  }

  fullRangeMark(
    kind: "bold" | "italic" | "underline" | "strike" | "code",
    atoms: RichTextAtom[],
    id?: string,
  ): SimpleRangeMark<string> {
    const range = fullAtomRange(atoms);
    const markId = id ?? randomUUID();
    return { id: markId, kind, range };
  }

  fullRangeStyle(
    props: TextStyleProperties,
    atoms: RichTextAtom[],
    id?: string,
  ): StyleMark {
    const range = fullAtomRange(atoms);
    const markId = id ?? randomUUID();
    return { id: markId, kind: "style", range, properties: props };
  }

  // ── Mark overlay ──────────────────────────────────────────────────────

  overlayMarks(
    authoritative: RichTextMark[],
    supplementary: RichTextMark[],
    atoms: RichTextAtom[],
  ): RichTextMark[] {
    const start = performance.now();

    const snappedAuthoritative = snapMarksToAtoms(authoritative, atoms);
    const snappedSupplementary = snapMarksToAtoms(supplementary, atoms);
    const atomOrder = createAtomOrder(atoms);

    // Collect all range boundaries from both lists
    const boundaries = collectRangeBoundaries(
      snappedAuthoritative,
      snappedSupplementary,
      atoms,
    );

    // If no boundaries, return empty
    if (boundaries.length < 2) {
      this.logger.debug("rich-text.overlayMarks", {
        durationMs: Math.round(performance.now() - start),
        authCount: authoritative.length,
        suppCount: supplementary.length,
        resultCount: 0,
      });
      return [];
    }

    const resultMarks: RichTextMark[] = [];

    for (let i = 0; i < boundaries.length - 1; i++) {
      const segment: TextRange = {
        start: boundaries[i],
        end: boundaries[i + 1],
      };

      // Skip empty segments
      if (
        segment.start.atomId === segment.end.atomId &&
        segment.start.offset === segment.end.offset
      ) continue;

      // Gather marks covering this segment from each list
      const authCovering = snappedAuthoritative.filter((mark) =>
        rangeCovers(mark.range, segment, atomOrder)
      );
      const suppCovering = snappedSupplementary.filter((mark) =>
        rangeCovers(mark.range, segment, atomOrder)
      );

      // Build merged properties: start from supplementary, overlay authoritative
      let merged: TextStyleProperties = {};
      for (const mark of suppCovering) {
        merged = overlayStyles(merged, markToProperties(mark));
      }
      for (const mark of authCovering) {
        merged = overlayStyles(merged, markToProperties(mark));
      }

      // Carry forward non-style marks from authoritative (auth wins)
      // and supplementary (only where auth doesn't have one of the same kind)
      const carriedMarks = carryForwardMarks(
        authCovering,
        suppCovering,
        segment,
        i,
        merged,
      );
      for (const cm of carriedMarks) {
        resultMarks.push(cm);
      }

      // The flattened style is last so it remains the resolved value even
      // when a semantic mark (for example bold) expresses the same property.
      if (hasAnyProperty(merged)) {
        resultMarks.push({
          id: `$rich-text-overlay:${i}:style`,
          kind: "style",
          range: segment,
          properties: merged,
        } satisfies StyleMark);
      }
    }

    // Deduplicate and sort
    const result = deduplicateAndSortMarks(resultMarks);
    this.logger.debug("rich-text.overlayMarks", {
      durationMs: Math.round(performance.now() - start),
      authCount: authoritative.length,
      suppCount: supplementary.length,
      resultCount: result.length,
    });
    return result;
  }

  // ── Style resolution ──────────────────────────────────────────────────

  resolveStyling(content: RichContent): ResolvedStyling {
    const start = performance.now();
    const atoms = content.atoms;
    // Snap mark ranges to whole non-text atoms
    const snappedMarks = snapMarksToAtoms(content.marks, atoms);

    // Collect all range boundaries from snapped marks
    const atomOrder = createAtomOrder(atoms);
    const boundaries = collectRangeBoundaries(snappedMarks, [], atoms);

    if (boundaries.length < 2) {
      this.logger.debug("rich-text.resolveStyling", {
        durationMs: Math.round(performance.now() - start),
        atomCount: atoms.length,
        markCount: content.marks.length,
        rangeCount: 0,
      });
      return { ranges: [], plainText: extractPlainText(atoms), links: [] };
    }

    const ranges: ResolvedStyleRange[] = [];
    const allLinks: LinkTarget[] = [];

    for (let i = 0; i < boundaries.length - 1; i++) {
      const segment: TextRange = {
        start: boundaries[i],
        end: boundaries[i + 1],
      };

      if (
        segment.start.atomId === segment.end.atomId &&
        segment.start.offset === segment.end.offset
      ) continue;

      // Start from config defaults
      let resolved: TextStyleProperties = { ...this.config.defaults };

      // Mark array order is the explicit rendering order. Callers and overlay
      // results control precedence without allowing opaque IDs to affect it.
      const covering = snappedMarks.filter((mark) =>
        rangeCovers(mark.range, segment, atomOrder)
      );

      const activeMarks: string[] = [];
      const links: LinkTarget[] = [];

      for (const mark of covering) {
        activeMarks.push(mark.id);
        resolved = overlayStyles(resolved, markToProperties(mark));
        if (mark.kind === "link") {
          links.push(...(mark as LinkMark).targets);
        }
      }

      allLinks.push(...links);

      ranges.push({
        range: segment,
        properties: resolved,
        activeMarks,
        links: links.length > 0 ? links : undefined,
      });
    }

    const result = {
      ranges,
      plainText: extractPlainText(atoms),
      links: allLinks,
    };
    this.logger.debug("rich-text.resolveStyling", {
      durationMs: Math.round(performance.now() - start),
      atomCount: atoms.length,
      markCount: content.marks.length,
      rangeCount: ranges.length,
    });
    return result;
  }

  // ── Pure operations ───────────────────────────────────────────────────

  validate(content: RichContent): ValidationResult {
    const start = performance.now();
    const result = validateContent(content, this.config.limits);
    if (!result.ok) {
      this.logger.debug("rich-text.validate failed", {
        durationMs: Math.round(performance.now() - start),
        atomCount: content.atoms.length,
        markCount: content.marks.length,
        diagnosticCount: result.diagnostics.length,
      });
    }
    return result;
  }

  normalize(content: RichContent): RichContent {
    return normalizeContent(content);
  }

  apply(content: RichContent, operations: RichTextOperation[]): ApplyResult {
    const start = performance.now();
    const result = applyOperations(content, operations);
    this.logger.debug("rich-text.apply", {
      durationMs: Math.round(performance.now() - start),
      atomCount: content.atoms.length,
      markCount: content.marks.length,
      operationCount: operations.length,
      ops: operations.map((o) => o.type),
    });
    return result;
  }

  formulaFromDelimitedRange(
    content: RichContent,
    range: TextRange,
    ids: RichTextIdFactory,
  ): FormulaAuthoringResult {
    return formulaFromDelimitedRange(content, range, ids);
  }

  clone(content: RichContent, ids: RichTextIdFactory): RichContent {
    return cloneContent(content, ids);
  }

  plainText(atoms: RichTextAtom[]): string {
    return extractPlainText(atoms);
  }

  // ── Codec ─────────────────────────────────────────────────────────────

  encode(content: RichContent): Uint8Array {
    return encodeContent(content);
  }

  decode(bytes: Uint8Array): RichContent {
    return decodeContent(bytes);
  }
}

// ── Factory ───────────────────────────────────────────────────────────────

export function createRichText(config: RichTextConfig, logger: Logger): RichText {
  return new RichTextImpl(config, logger);
}

// ── Internal helpers ─────────────────────────────────────────────────────

function fullAtomRange(atoms: RichTextAtom[]): TextRange {
  if (atoms.length === 0) {
    throw new Error("Cannot compute fullRange on empty atoms list");
  }

  const first = atoms[0];
  const last = atoms[atoms.length - 1];

  return {
    start: { atomId: first.id, offset: 0 },
    end: {
      atomId: last.id,
      offset: last.kind === "text"
        ? last.text.length
        : last.kind === "formula" || last.kind === "reference"
          ? last.displayText.length
          : 0,
    },
  };
}

function collectRangeBoundaries(
  marksA: RichTextMark[],
  marksB: RichTextMark[],
  atoms: RichTextAtom[],
): { atomId: string; offset: number }[] {
  const points = new Map<string, Set<number>>();

  function addPoint(atomId: string, offset: number): void {
    let set = points.get(atomId);
    if (!set) {
      set = new Set();
      points.set(atomId, set);
    }
    set.add(offset);
  }

  for (const mark of [...marksA, ...marksB]) {
    addPoint(mark.range.start.atomId, mark.range.start.offset);
    addPoint(mark.range.end.atomId, mark.range.end.offset);
  }

  // Flatten in canonical atom order. Atom IDs are opaque identifiers and
  // therefore cannot be used to determine document position.
  const result: { atomId: string; offset: number }[] = [];
  for (const atom of atoms) {
    const offsets = points.get(atom.id);
    if (!offsets) continue;
    for (const offset of [...offsets].sort((a, b) => a - b)) {
      result.push({ atomId: atom.id, offset });
    }
    points.delete(atom.id);
  }

  const unknownAtomId = points.keys().next().value as string | undefined;
  if (unknownAtomId !== undefined) {
    throw new Error(`Mark range references unknown atom: ${unknownAtomId}`);
  }

  return result;
}

type AtomOrder = ReadonlyMap<string, number>;

function createAtomOrder(atoms: RichTextAtom[]): AtomOrder {
  return new Map(atoms.map((atom, index) => [atom.id, index]));
}

function comparePositions(
  left: TextRange["start"],
  right: TextRange["start"],
  atomOrder: AtomOrder,
): number {
  const leftIndex = atomOrder.get(left.atomId);
  const rightIndex = atomOrder.get(right.atomId);
  if (leftIndex === undefined) {
    throw new Error(`Text position references unknown atom: ${left.atomId}`);
  }
  if (rightIndex === undefined) {
    throw new Error(`Text position references unknown atom: ${right.atomId}`);
  }
  return leftIndex === rightIndex
    ? left.offset - right.offset
    : leftIndex - rightIndex;
}

function rangeCovers(
  markRange: TextRange,
  segment: TextRange,
  atomOrder: AtomOrder,
): boolean {
  return (
    comparePositions(markRange.start, segment.start, atomOrder) <= 0 &&
    comparePositions(markRange.end, segment.end, atomOrder) >= 0
  );
}

function hasAnyProperty(props: TextStyleProperties): boolean {
  return Object.values(props).some((v) => v !== undefined);
}

function carryForwardMarks(
  authCovering: RichTextMark[],
  suppCovering: RichTextMark[],
  segment: TextRange,
  segmentIndex: number,
  merged: TextStyleProperties,
): RichTextMark[] {
  const result: RichTextMark[] = [];
  const nonStyleKinds = new Set<string>();
  let markIndex = 0;

  const nextId = (kind: string): string =>
    `$rich-text-overlay:${segmentIndex}:${markIndex++}:${kind}`;

  // Auth non-style marks carry forward (they win)
  for (const mark of authCovering) {
    if (mark.kind !== "style" && mark.kind !== "link") {
      nonStyleKinds.add(mark.kind);
      if (markMatchesMergedProperties(mark, merged)) {
        result.push({
          id: nextId(mark.kind),
          kind: mark.kind,
          range: segment,
        } as RichTextMark);
      }
    }
    if (mark.kind === "link") {
      result.push({
        id: nextId(mark.kind),
        kind: "link",
        range: segment,
        targets: (mark as LinkMark).targets,
      } satisfies LinkMark);
    }
  }

  // Supplementary non-style marks only where auth doesn't have the same kind
  for (const mark of suppCovering) {
    if (mark.kind !== "style" && mark.kind !== "link") {
      if (
        !nonStyleKinds.has(mark.kind) &&
        markMatchesMergedProperties(mark, merged)
      ) {
        result.push({
          id: nextId(mark.kind),
          kind: mark.kind,
          range: segment,
        } as RichTextMark);
      }
    }
  }

  return result;
}

function markMatchesMergedProperties(
  mark: RichTextMark,
  merged: TextStyleProperties,
): boolean {
  const properties = markToProperties(mark);
  return (Object.keys(properties) as (keyof TextStyleProperties)[]).every(
    (key) => properties[key] === merged[key],
  );
}

function snapMarksToAtoms(
  marks: RichTextMark[],
  atoms: RichTextAtom[],
): RichTextMark[] {
  const atomMap = new Map(atoms.map((a) => [a.id, a]));

  return marks.map((mark) => {
    const startAtom = atomMap.get(mark.range.start.atomId);
    const endAtom = atomMap.get(mark.range.end.atomId);
    if (!startAtom || !endAtom) return mark;

    let { start, end } = mark.range;

    // Snap start to 0 if start atom is non-text
    if (startAtom.kind !== "text") {
      start = { atomId: start.atomId, offset: 0 };
    } else if (start.offset > startAtom.text.length) {
      start = { atomId: start.atomId, offset: startAtom.text.length };
    }

    // Snap end to whole atom if end atom is non-text
    if (endAtom.kind !== "text") {
      const endLen = endAtom.kind === "formula" || endAtom.kind === "reference"
        ? endAtom.displayText.length
        : 0;
      end = { atomId: end.atomId, offset: endLen };
    } else if (end.offset > endAtom.text.length) {
      end = { atomId: end.atomId, offset: endAtom.text.length };
    }

    if (start !== mark.range.start || end !== mark.range.end) {
      return { ...mark, range: { start, end } } as RichTextMark;
    }
    return mark;
  });
}

function deduplicateAndSortMarks(marks: RichTextMark[]): RichTextMark[] {
  // Simple deduplication by JSON value
  const seen = new Set<string>();
  const result: RichTextMark[] = [];

  for (const mark of marks) {
    const key = JSON.stringify(mark);
    if (!seen.has(key)) {
      seen.add(key);
      result.push(mark);
    }
  }

  return result;
}
