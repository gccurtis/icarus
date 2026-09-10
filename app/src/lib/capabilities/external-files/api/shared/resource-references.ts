import { kindMatches } from "$representation/data/behavior/core/resource";
import type {
  Atom,
  ContentBlock,
  Mark
} from "$representation/data/types/content/content-block";
import type { FormulaValue } from "$representation/data/types/content/formula-value";
import type { ResourceRef } from "$representation/data/types/core/resource";
import type {
  ResourceSet,
  TemplatedResourceSet
} from "$representation/data/types/core/resource-set";
import type { DocumentBody, DocumentRow } from "$representation/data/types/documents/body";
import type {
  SlideBackground,
  SlideDeckBody,
  SlideElement
} from "$representation/data/types/slide-decks/body";
import type { SheetCell } from "$representation/data/types/spreadsheets/cell";

export const refNamesExternalFile = (ref: ResourceRef, externalFileId: string): boolean =>
  ref.id === externalFileId && kindMatches("externalFile", ref.kind);

export const resourceSetNamesExternalFile = (
  set: ResourceSet | TemplatedResourceSet,
  externalFileId: string
): boolean => [...set.include, ...set.exclude].some(
  (term) => term.select === "resources" && term.refs.some(
    (ref) => refNamesExternalFile(ref, externalFileId)
  )
);

export const formulaValueNamesExternalFile = (
  value: FormulaValue,
  externalFileId: string
): boolean => {
  switch (value.kind) {
    case "reference":
      return value.target.to === "resource" && refNamesExternalFile(value.target.ref, externalFileId);
    case "list":
      return value.values.some((entry) => formulaValueNamesExternalFile(entry, externalFileId));
    case "record":
      return Object.values(value.fields).some(
        (entry) => formulaValueNamesExternalFile(entry, externalFileId)
      );
    case "table":
      return value.rows.some((row) => row.some(
        (entry) => formulaValueNamesExternalFile(entry, externalFileId)
      ));
    case "empty":
    case "number":
    case "text":
    case "logic":
    case "date":
    case "range":
    case "function":
      return false;
  }
};

const marksNameExternalFile = (marks: readonly Mark[], externalFileId: string): boolean =>
  marks.some((mark) =>
    mark.link?.kind === "resource" && refNamesExternalFile(mark.link.ref, externalFileId)
  );

const atomsNameExternalFile = (atoms: readonly Atom[], externalFileId: string): boolean =>
  atoms.some((atom) =>
    atom.kind === "formula" && formulaValueNamesExternalFile(atom.lastResolvedValue, externalFileId)
  );

export const contentBlockNamesExternalFile = (
  block: ContentBlock,
  externalFileId: string
): boolean => {
  switch (block.type) {
    case "text":
      return atomsNameExternalFile(block.atoms, externalFileId) ||
        marksNameExternalFile(block.marks, externalFileId);
    case "formula":
      return formulaValueNamesExternalFile(block.value, externalFileId);
    case "image":
      return (
        block.source?.kind === "file" && block.source.fileId === externalFileId
      ) || (
        block.caption !== undefined && contentBlockNamesExternalFile(block.caption, externalFileId)
      );
    case "table":
      return block.rows.some((row) => row.cells.some((cell) =>
        cell.blocks.some((nested) => contentBlockNamesExternalFile(nested, externalFileId))
      ));
    case "prompt":
      return atomsNameExternalFile(block.atoms, externalFileId) ||
        marksNameExternalFile(block.marks, externalFileId) ||
        (block.scope !== undefined && resourceSetNamesExternalFile(block.scope, externalFileId));
  }
};

export const contentBlocksNameExternalFile = (
  blocks: readonly ContentBlock[],
  externalFileId: string
): boolean => blocks.some((block) => contentBlockNamesExternalFile(block, externalFileId));

const documentRowsNameExternalFile = (
  rows: readonly DocumentRow[],
  externalFileId: string
): boolean => rows.some((row) =>
  row.kind === "blocks" && contentBlocksNameExternalFile(row.blocks, externalFileId)
);

export const documentBodyNamesExternalFile = (
  body: DocumentBody,
  externalFileId: string
): boolean => documentRowsNameExternalFile(body.rows, externalFileId) ||
  (body.header !== undefined && (
    documentRowsNameExternalFile(body.header.rows, externalFileId) ||
    documentRowsNameExternalFile(body.header.firstPageRows ?? [], externalFileId)
  )) ||
  (body.footer !== undefined && (
    documentRowsNameExternalFile(body.footer.rows, externalFileId) ||
    documentRowsNameExternalFile(body.footer.firstPageRows ?? [], externalFileId)
  ));

const backgroundNamesExternalFile = (
  background: SlideBackground | undefined,
  externalFileId: string
): boolean => background?.kind === "image" && background.fileId === externalFileId;

const slideElementNamesExternalFile = (
  element: SlideElement,
  externalFileId: string
): boolean => {
  const content = element.content;
  switch (content.type) {
    case "text":
    case "formula":
    case "prompt":
    case "image":
    case "table":
      return contentBlockNamesExternalFile(content.block, externalFileId);
    case "shape":
      return content.block !== undefined && contentBlockNamesExternalFile(content.block, externalFileId);
    case "group":
      return content.children.some((child) => slideElementNamesExternalFile(child, externalFileId));
    case "line":
    case "chart":
      return false;
  }
};

export const slideDeckBodyNamesExternalFile = (
  body: SlideDeckBody,
  externalFileId: string
): boolean => backgroundNamesExternalFile(body.theme.background, externalFileId) ||
  body.layouts.some((layout) =>
    backgroundNamesExternalFile(layout.background, externalFileId) ||
    layout.locked.some((element) => slideElementNamesExternalFile(element, externalFileId))
  ) ||
  body.slides.some((slide) =>
    backgroundNamesExternalFile(slide.background, externalFileId) ||
    slide.elements.some((element) => slideElementNamesExternalFile(element, externalFileId)) ||
    contentBlocksNameExternalFile(slide.notes, externalFileId)
  );

export const sheetCellNamesExternalFile = (
  cell: SheetCell,
  externalFileId: string
): boolean => formulaValueNamesExternalFile(cell.value, externalFileId) ||
  marksNameExternalFile(cell.marks ?? [], externalFileId);
