// Validation — structural, referential, and semantic checks on RichContent.

import type {
  RichContent,
  RichTextLimits,
  RichTextDiagnostic,
  ValidationResult,
  RichTextAtom,
} from "./types.js";

export function validate(
  content: RichContent,
  limits: RichTextLimits,
): ValidationResult {
  const diagnostics = gatherDiagnostics(content, limits);
  return { ok: diagnostics.length === 0, diagnostics };
}

function gatherDiagnostics(
  content: RichContent,
  limits: RichTextLimits,
): RichTextDiagnostic[] {
  const diags: RichTextDiagnostic[] = [];

  const { atoms, marks } = content;

  // ── Structural ────────────────────────────────────────────────────────

  if (atoms.length === 0) {
    diags.push({ code: "atoms-empty", message: "atoms must have at least one entry" });
  }

  const atomIds = new Set<string>();
  for (const atom of atoms) {
    if (atomIds.has(atom.id)) {
      diags.push({
        code: "duplicate-atom-id",
        message: `Duplicate atom ID: ${atom.id}`,
      });
    }
    atomIds.add(atom.id);
  }

  const markIds = new Set<string>();
  for (const mark of marks) {
    if (markIds.has(mark.id)) {
      diags.push({
        code: "duplicate-mark-id",
        message: `Duplicate mark ID: ${mark.id}`,
      });
    }
    markIds.add(mark.id);
  }

  if (atoms.length > limits.maxAtomsPerContent) {
    diags.push({
      code: "too-many-atoms",
      message: `Atom count ${atoms.length} exceeds limit ${limits.maxAtomsPerContent}`,
    });
  }

  if (marks.length > limits.maxMarksPerContent) {
    diags.push({
      code: "too-many-marks",
      message: `Mark count ${marks.length} exceeds limit ${limits.maxMarksPerContent}`,
    });
  }

  // Build a map for fast lookup
  const atomMap = new Map<string, RichTextAtom>();
  for (const atom of atoms) {
    atomMap.set(atom.id, atom);
  }

  // ── Referential ───────────────────────────────────────────────────────

  for (const mark of marks) {
    const startAtom = atomMap.get(mark.range.start.atomId);
    const endAtom = atomMap.get(mark.range.end.atomId);

    if (!startAtom) {
      diags.push({
        code: "mark-range-start-not-found",
        message: `Mark ${mark.id}: start atom ${mark.range.start.atomId} not found`,
      });
      continue;
    }
    if (!endAtom) {
      diags.push({
        code: "mark-range-end-not-found",
        message: `Mark ${mark.id}: end atom ${mark.range.end.atomId} not found`,
      });
      continue;
    }

    // Check offset bounds on text atoms
    if (isTextAtom(startAtom) && mark.range.start.offset > startAtom.text.length) {
      diags.push({
        code: "mark-offset-out-of-bounds",
        message: `Mark ${mark.id}: start offset ${mark.range.start.offset} exceeds atom text length ${startAtom.text.length}`,
      });
    }
    if (mark.range.start.offset < 0) {
      diags.push({
        code: "mark-offset-negative",
        message: `Mark ${mark.id}: start offset ${mark.range.start.offset} is negative`,
      });
    }
    if (isTextAtom(endAtom) && mark.range.end.offset > endAtom.text.length) {
      diags.push({
        code: "mark-offset-out-of-bounds",
        message: `Mark ${mark.id}: end offset ${mark.range.end.offset} exceeds atom text length ${endAtom.text.length}`,
      });
    }
    if (mark.range.end.offset < 0) {
      diags.push({
        code: "mark-offset-negative",
        message: `Mark ${mark.id}: end offset ${mark.range.end.offset} is negative`,
      });
    }
  }

  // ── Semantic ──────────────────────────────────────────────────────────

  for (const mark of marks) {
    // Empty marks
    if (
      mark.range.start.atomId === mark.range.end.atomId &&
      mark.range.start.offset === mark.range.end.offset
    ) {
      diags.push({
        code: "empty-mark-range",
        message: `Mark ${mark.id}: start equals end (empty range)`,
      });
    }

    // Link marks must have targets
    if (mark.kind === "link") {
      if (!mark.targets || mark.targets.length === 0) {
        diags.push({
          code: "link-no-targets",
          message: `Link mark ${mark.id}: must have at least one target`,
        });
      }
    }

    // Check surrogate splits on text atoms
    const startAtom = atomMap.get(mark.range.start.atomId);
    const endAtom = atomMap.get(mark.range.end.atomId);
    if (startAtom && isTextAtom(startAtom)) {
      if (isSurrogateSplit(startAtom.text, mark.range.start.offset)) {
        diags.push({
          code: "surrogate-split",
          message: `Mark ${mark.id}: start offset ${mark.range.start.offset} splits a surrogate pair`,
        });
      }
    }
    if (endAtom && isTextAtom(endAtom)) {
      if (isSurrogateSplit(endAtom.text, mark.range.end.offset)) {
        diags.push({
          code: "surrogate-split",
          message: `Mark ${mark.id}: end offset ${mark.range.end.offset} splits a surrogate pair`,
        });
      }
    }
  }

  return diags;
}

function isTextAtom(atom: RichTextAtom): atom is { id: string; kind: "text"; text: string } {
  return atom.kind === "text";
}

function isSurrogateSplit(text: string, offset: number): boolean {
  if (offset <= 0 || offset >= text.length) return false;
  const code = text.charCodeAt(offset);
  // High surrogate (0xD800–0xDBFF) means the offset is in the middle of a pair
  return code >= 0xdc00 && code <= 0xdfff;
}