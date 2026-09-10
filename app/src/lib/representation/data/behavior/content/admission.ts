import type { ContentBlock } from "$representation/data/types/content/content-block";
import {
  isStoredChoice,
  isStoredRowId
} from "$representation/data/behavior/core/stored";
import {
  currentFormat,
  currentFormulaValue,
  exact,
  finite,
  identifier,
  natural,
  recordOf,
  text
} from "$representation/data/behavior/content/admission-values";
import {
  currentAtom,
  currentHole,
  currentMark,
  currentScope
} from "$representation/data/behavior/content/admission-inline";

export {
  currentActor,
  currentFormat,
  currentFormulaValue,
  currentResourceRef
} from "$representation/data/behavior/content/admission-values";
export {
  currentMark,
  currentMarkLink
} from "$representation/data/behavior/content/admission-inline";

const atomDisplay = (value: unknown): string | undefined => {
  const atom = recordOf(value);
  if (atom?.kind === "literal") return atom.text as string;
  if (atom?.kind === "formula") return atom.lastResolvedDisplay as string;
  if (atom?.kind === "template" && typeof atom.name === "string") return `{${atom.name}}`;
  return undefined;
};

const currentBlock = (value: unknown, depth = 0): value is ContentBlock => {
  const block = recordOf(value);
  if (block === undefined || depth > 12 || !identifier(block.id)) return false;
  if (block.type === "text") {
    if (!exact(
      block,
      ["id", "type", "variant", "atoms", "display", "marks"],
      ["level", "listStyle", "checked", "language", "style", "resolvedAt", "format"]
    )) return false;
    if (
      !isStoredChoice(block.variant, ["paragraph", "heading", "list", "quote", "code"]) ||
      !Array.isArray(block.atoms) ||
      block.atoms.length > 10_000 ||
      !block.atoms.every(currentAtom) ||
      !text(block.display) ||
      block.display !== block.atoms.map(atomDisplay).join("") ||
      !Array.isArray(block.marks) ||
      block.marks.length > 10_000 ||
      !block.marks.every(currentMark)
    ) return false;
    return (block.level === undefined || (Number.isInteger(block.level) && Number(block.level) >= 1)) &&
      (block.listStyle === undefined || isStoredChoice(block.listStyle, ["bullet", "ordered", "todo"])) &&
      (block.checked === undefined || typeof block.checked === "boolean") &&
      (block.language === undefined || text(block.language, 500)) &&
      (block.style === undefined || identifier(block.style)) &&
      (block.resolvedAt === undefined || (finite(block.resolvedAt) && block.resolvedAt >= 0)) &&
      (block.format === undefined || currentFormat(block.format));
  }
  if (block.type === "formula") {
    return exact(
      block,
      ["id", "type", "expression", "display", "value", "state"],
      ["formulaId", "format"]
    ) &&
      text(block.expression, 10_000) &&
      (block.formulaId === undefined || isStoredRowId(block.formulaId, "formulas")) &&
      text(block.display) &&
      currentFormulaValue(block.value) &&
      block.state === "fresh" &&
      (block.format === undefined || currentFormat(block.format));
  }
  if (block.type === "image") {
    if (!exact(block, ["id", "type", "alt"], ["source", "caption", "crop", "format"]) || !text(block.alt, 10_000)) {
      return false;
    }
    if (block.source !== undefined) {
      const source = recordOf(block.source);
      if (source === undefined) return false;
      if (source.kind === "url") {
        if (!exact(source, ["kind", "url"]) || !text(source.url, 10_000)) return false;
      } else if (source.kind === "file") {
        if (!exact(source, ["kind", "fileId"]) || !isStoredRowId(source.fileId, "externalFiles")) return false;
      } else if (
        source.kind !== "storage" ||
        !exact(source, ["kind", "storageId"]) ||
        !isStoredRowId(source.storageId, "_storage")
      ) return false;
    }
    if (block.caption !== undefined) {
      const caption = recordOf(block.caption);
      if (caption?.type !== "text" || !currentBlock(caption, depth + 1)) return false;
    }
    if (block.crop !== undefined) {
      const crop = recordOf(block.crop);
      if (
        crop === undefined ||
        !exact(crop, ["x", "y", "width", "height"]) ||
        ![crop.x, crop.y, crop.width, crop.height].every((part) => finite(part))
      ) return false;
    }
    return block.format === undefined || currentFormat(block.format);
  }
  if (block.type === "table") {
    if (
      !exact(block, ["id", "type", "rows", "headerRows"], ["columnWidths", "format"]) ||
      !Array.isArray(block.rows) ||
      block.rows.length > 10_000 ||
      !natural(block.headerRows) ||
      block.headerRows > block.rows.length
    ) return false;
    if (
      block.columnWidths !== undefined &&
      (!Array.isArray(block.columnWidths) || !block.columnWidths.every((width) => finite(width)))
    ) return false;
    return block.rows.every((entry) => {
      const row = recordOf(entry);
      return row !== undefined &&
        exact(row, ["id", "cells"]) &&
        identifier(row.id) &&
        Array.isArray(row.cells) &&
        row.cells.length <= 1_000 &&
        row.cells.every((entry) => {
          const cell = recordOf(entry);
          return cell !== undefined &&
            exact(cell, ["id", "blocks"], ["rowSpan", "columnSpan", "format"]) &&
            identifier(cell.id) &&
            Array.isArray(cell.blocks) &&
            cell.blocks.length <= 10_000 &&
            cell.blocks.every((nested) => currentBlock(nested, depth + 1)) &&
            (cell.rowSpan === undefined || (Number.isInteger(cell.rowSpan) && Number(cell.rowSpan) >= 1)) &&
            (cell.columnSpan === undefined || (Number.isInteger(cell.columnSpan) && Number(cell.columnSpan) >= 1)) &&
            (cell.format === undefined || currentFormat(cell.format));
        });
    }) && (block.format === undefined || currentFormat(block.format));
  }
  if (block.type !== "prompt") return false;
  const linked = Object.hasOwn(block, "derivedOutputId");
  const base = ["id", "type", "atoms", "display", "marks", "state"];
  const presentation = ["style", "hole", "format"];
  if (!linked) {
    if (
      block.state !== "idle" ||
      !exact(block, base, [...presentation, "scope", "prompt"])
    ) return false;
  } else {
    if (!isStoredRowId(block.derivedOutputId, "derivedOutputs")) return false;
    const linkedBase = [...base, "derivedOutputId"];
    if (block.state === "idle") {
      if (!exact(block, linkedBase, presentation)) return false;
    } else if (block.state === "stale") {
      if (!exact(block, linkedBase, [...presentation, "refreshedAt"])) return false;
    } else if (block.state === "fresh") {
      if (!exact(block, [...linkedBase, "refreshedAt"], presentation)) return false;
    } else if (block.state === "error") {
      if (!exact(block, [...linkedBase, "error"], [...presentation, "refreshedAt"])) {
        return false;
      }
    } else return false;
  }
  return (block.style === undefined || identifier(block.style)) &&
    (block.prompt === undefined || text(block.prompt)) &&
    (block.scope === undefined || currentScope(block.scope)) &&
    (block.hole === undefined || currentHole(block.hole)) &&
    Array.isArray(block.atoms) &&
    block.atoms.length <= 10_000 &&
    block.atoms.every(currentAtom) &&
    text(block.display) &&
    block.display === block.atoms.map(atomDisplay).join("") &&
    Array.isArray(block.marks) &&
    block.marks.length <= 10_000 &&
    block.marks.every(currentMark) &&
    (block.error === undefined || (text(block.error, 10_000) && block.error.trim().length > 0)) &&
    (block.refreshedAt === undefined || (finite(block.refreshedAt) && block.refreshedAt >= 0)) &&
    (block.format === undefined || currentFormat(block.format));
};

export const admitContentBlocks = (value: unknown): readonly ContentBlock[] | undefined =>
  Array.isArray(value) && value.length <= 10_000 && value.every((block) => currentBlock(block))
    ? value as ContentBlock[]
    : undefined;

const blockText = (block: ContentBlock): string => {
  if (block.type === "text" || block.type === "formula" || block.type === "prompt") {
    return block.display;
  }
  if (block.type === "image") {
    return block.caption === undefined ? block.alt : blockText(block.caption);
  }
  return block.rows
    .map((row) => row.cells.map((cell) => cell.blocks.map(blockText).filter(Boolean).join("\n")).join("\t"))
    .join("\n");
};

export const textInContentBlocks = (blocks: readonly ContentBlock[]): string =>
  blocks.map(blockText).filter(Boolean).join("\n");
