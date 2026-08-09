import type { RichText } from "#rich-text";
import type {
  DocumentBlockKind,
  DocumentBlock,
  DocumentLimits,
  DocumentRow,
  DocumentSnapshot,
  DocumentStyleRegistry,
  ListItem,
  VisualDimensions
} from "./model.js";
import {
  computeAssignedBlockWidth,
  computeUsablePageWidth
} from "./layout.js";

const DOCUMENT_BLOCK_KINDS: DocumentBlockKind[] = [
  "text",
  "code",
  "quote",
  "prompt",
  "divider",
  "callout",
  "list",
  "table",
  "image",
  "chart"
];

export interface DocumentValidationResult {
  ok: boolean;
  diagnostics: string[];
}

const isPositiveInteger = (value: number): boolean =>
  Number.isSafeInteger(value) && value > 0;

const isNonNegativeInteger = (value: number): boolean =>
  Number.isSafeInteger(value) && value >= 0;

const validatePageLayout = (
  snapshot: DocumentSnapshot,
  diagnostics: string[]
): void => {
  const { page, margins, pageNumber } = snapshot.pageLayout;
  if (!isPositiveInteger(page.widthTwips) || !isPositiveInteger(page.heightTwips)) {
    diagnostics.push("page dimensions must be positive integers");
  }
  for (const [name, value] of Object.entries(margins)) {
    if (!isNonNegativeInteger(value)) diagnostics.push(`${name} margin must be non-negative`);
  }
  if (margins.leftTwips + margins.rightTwips >= page.widthTwips) {
    diagnostics.push("horizontal margins must leave positive usable width");
  }
  if (margins.topTwips + margins.bottomTwips >= page.heightTwips) {
    diagnostics.push("vertical margins must leave positive usable height");
  }
  if (page.orientation === "portrait" && page.heightTwips < page.widthTwips) {
    diagnostics.push("portrait page height must be at least its width");
  }
  if (page.orientation === "landscape" && page.widthTwips < page.heightTwips) {
    diagnostics.push("landscape page width must be at least its height");
  }
  if (!isPositiveInteger(pageNumber.start)) diagnostics.push("page-number start must be positive");
};

const validateStyles = (
  registry: DocumentStyleRegistry,
  diagnostics: string[]
): Set<string> => {
  const ids = new Set<string>();
  const roles = new Map<string, number>();
  for (const style of registry.styles) {
    if (!style.id) diagnostics.push("style ID must be non-empty");
    if (ids.has(style.id)) diagnostics.push(`duplicate style ID: ${style.id}`);
    ids.add(style.id);
    if (!style.name.trim()) diagnostics.push(`style ${style.id} must have a name`);
    if (style.systemRole) roles.set(style.systemRole, (roles.get(style.systemRole) ?? 0) + 1);
  }
  for (let level = 1; level <= 6; level += 1) {
    const role = `heading-${level}`;
    if (roles.get(role) !== 1) diagnostics.push(`exactly one ${role} Style is required`);
  }
  for (const style of registry.styles) {
    if (style.basedOnStyleId && !ids.has(style.basedOnStyleId)) {
      diagnostics.push(`style ${style.id} inherits missing style ${style.basedOnStyleId}`);
    }
    const seen = new Set<string>([style.id]);
    let current = style;
    while (current.basedOnStyleId) {
      if (seen.has(current.basedOnStyleId)) {
        diagnostics.push(`style inheritance cycle at ${current.basedOnStyleId}`);
        break;
      }
      seen.add(current.basedOnStyleId);
      const next = registry.styles.find((candidate) => candidate.id === current.basedOnStyleId);
      if (!next) break;
      current = next;
    }
  }
  for (const kind of DOCUMENT_BLOCK_KINDS) {
    const styleId = registry.defaultStyleIdByBlockKind[kind];
    if (!styleId) diagnostics.push(`default ${kind} Style is required`);
    if (!ids.has(styleId)) diagnostics.push(`default ${kind} Style does not resolve: ${styleId}`);
  }
  return ids;
};

const validateDimensions = (
  dimensions: VisualDimensions,
  label: string,
  diagnostics: string[]
): void => {
  if (dimensions.widthTwips !== undefined && !isPositiveInteger(dimensions.widthTwips)) {
    diagnostics.push(`${label} width must be a positive integer`);
  }
  if (!isPositiveInteger(dimensions.heightTwips)) {
    diagnostics.push(`${label} height must be a positive integer`);
  }
};

export const validateSnapshot = (
  snapshot: DocumentSnapshot,
  richText: RichText,
  limits: DocumentLimits
): DocumentValidationResult => {
  const diagnostics: string[] = [];
  if (!Number.isSafeInteger(snapshot.revision) || snapshot.revision < 0) {
    diagnostics.push("revision must be a non-negative integer");
  }
  if (!snapshot.title.trim()) diagnostics.push("title must be non-empty");
  validatePageLayout(snapshot, diagnostics);
  if (snapshot.styles.styles.length > limits.maxStylesPerDocument) {
    diagnostics.push(`style count exceeds ${limits.maxStylesPerDocument}`);
  }
  const styleIds = validateStyles(snapshot.styles, diagnostics);
  const allIds = new Set<string>();
  const promptOutputIds = new Set<string>();
  let rowCount = 0;
  const rootContainerWidth = computeUsablePageWidth(snapshot.pageLayout);

  const claimId = (id: string, label: string): void => {
    if (!id) diagnostics.push(`${label} ID must be non-empty`);
    if (allIds.has(id)) diagnostics.push(`duplicate identity ${id}`);
    allIds.add(id);
  };

  for (const styleId of styleIds) claimId(styleId, "style");

  const variableIds = new Set<string>();
  const variableNames = new Set<string>();
  for (const variable of snapshot.contextVariables) {
    claimId(variable.id, "Context Variable");
    variableIds.add(variable.id);
    const name = variable.name.trim();
    if (!name) diagnostics.push(`Context Variable ${variable.id} must have a name`);
    // Case-insensitively unique, because a template binding addresses these by
    // name and whoever writes that binding cannot know the author's casing.
    const normalized = name.toLocaleLowerCase();
    if (variableNames.has(normalized)) {
      diagnostics.push(`duplicate Context Variable name: ${variable.name}`);
    }
    variableNames.add(normalized);
  }

  function validateListItems(
    items: ListItem[],
    depth: number,
    listKind: string,
    insideCallout: boolean,
    containerWidthTwips?: number
  ): void {
    for (const item of items) {
      claimId(item.id, "list item");
      if (item.rows.length === 0) diagnostics.push(`list item ${item.id} must contain a Row`);
      if (listKind === "checklist" && typeof item.checked !== "boolean") {
        diagnostics.push(`checklist item ${item.id} requires checked`);
      }
      if (listKind !== "checklist" && item.checked !== undefined) {
        diagnostics.push(`only checklist items may carry checked`);
      }
      validateRows(item.rows, depth + 1, insideCallout, containerWidthTwips);
      validateListItems(
        item.children,
        depth + 1,
        listKind,
        insideCallout,
        containerWidthTwips
      );
    }
  }

  function validateBlock(
    block: DocumentBlock,
    depth: number,
    insideCallout: boolean,
    containerWidthTwips?: number
  ): void {
    claimId(block.id, "block");
    if (!styleIds.has(block.styleId)) diagnostics.push(`block ${block.id} has missing Style ${block.styleId}`);

    if (block.kind === "text" || block.kind === "code" || block.kind === "quote") {
      if (block.content.atoms.length > limits.maxAtomsPerBlockContent) {
        diagnostics.push(`block ${block.id} exceeds atom limit`);
      }
      const result = richText.validate(block.content);
      for (const item of result.diagnostics) diagnostics.push(`block ${block.id}: ${item.message}`);
      for (const atom of block.content.atoms) claimId(atom.id, "Rich Text atom");
      for (const mark of block.content.marks) claimId(mark.id, "Rich Text mark");
    } else if (block.kind === "prompt") {
      // Non-negative, not positive: 0 means *declared, never answered*. A
      // Prompt Block acquires its output from `declare`, which returns
      // headRevision 0, and only a later refresh moves it to 1. Requiring a
      // positive revision here made "a prompt that has not run yet"
      // unrepresentable — which is exactly what every block in a freshly
      // duplicated document is.
      if (!block.output.outputId || !isNonNegativeInteger(block.output.appliedRevision)) {
        diagnostics.push(`Prompt Block ${block.id} has an invalid Derived Output reference`);
      }
      if (promptOutputIds.has(block.output.outputId)) {
        diagnostics.push(`Derived Output ${block.output.outputId} is shared by live Prompt Blocks`);
      }
      promptOutputIds.add(block.output.outputId);
    } else if (block.kind === "callout") {
      if (insideCallout) diagnostics.push(`nested Callout Block is not allowed: ${block.id}`);
      validateRows(block.rows, depth + 1, true, containerWidthTwips);
    } else if (block.kind === "list") {
      claimId(block.list.id, "list");
      if (block.list.listKind === "numbered") {
        if (block.list.start !== undefined && !isPositiveInteger(block.list.start)) {
          diagnostics.push(`numbered list ${block.list.id} start must be positive`);
        }
      } else if (block.list.start !== undefined) {
        diagnostics.push(`only numbered list ${block.list.id} may carry start`);
      }
      validateListItems(
        block.list.items,
        depth + 1,
        block.list.listKind,
        insideCallout,
        containerWidthTwips
      );
    } else if (block.kind === "table") {
      const table = block.table;
      claimId(table.id, "table");
      if (table.rows.length > limits.maxTableRows) diagnostics.push(`table ${table.id} exceeds row limit`);
      if (table.columns.length > limits.maxTableColumns) diagnostics.push(`table ${table.id} exceeds column limit`);
      const rowIds = new Set<string>();
      const columnIds = new Set<string>();
      const cellKeys = new Set<string>();
      for (const row of table.rows) {
        claimId(row.id, "table row");
        rowIds.add(row.id);
        if (row.minHeightTwips !== undefined && !isPositiveInteger(row.minHeightTwips)) {
          diagnostics.push(`table row ${row.id} minimum height must be positive`);
        }
      }
      for (const column of table.columns) {
        claimId(column.id, "table column");
        columnIds.add(column.id);
        if (column.width.kind === "fixed" && !isPositiveInteger(column.width.twips)) {
          diagnostics.push(`table column ${column.id} width must be positive`);
        }
      }
      for (const cell of table.cells) {
        claimId(cell.id, "table cell");
        if (!rowIds.has(cell.rowId) || !columnIds.has(cell.columnId)) {
          diagnostics.push(`table cell ${cell.id} references a missing row or column`);
        }
        const key = `${cell.rowId}:${cell.columnId}`;
        if (cellKeys.has(key)) diagnostics.push(`duplicate table cell coordinate ${key}`);
        cellKeys.add(key);
        const column = table.columns.find((candidate) => candidate.id === cell.columnId);
        const fixedCellWidth = column?.width.kind === "fixed"
          ? Math.min(column.width.twips, containerWidthTwips ?? column.width.twips)
          : undefined;
        validateRows(cell.rows, depth + 1, insideCallout, fixedCellWidth);
      }
      for (const rowId of rowIds) {
        for (const columnId of columnIds) {
          if (!cellKeys.has(`${rowId}:${columnId}`)) {
            diagnostics.push(`table ${table.id} is missing cell ${rowId}:${columnId}`);
          }
        }
      }
      const expectedCellOrder = table.rows.flatMap((row) =>
        table.columns.map((column) => `${row.id}:${column.id}`));
      const actualCellOrder = table.cells.map((cell) => `${cell.rowId}:${cell.columnId}`);
      if (expectedCellOrder.some((key, index) => actualCellOrder[index] !== key)) {
        diagnostics.push(`table ${table.id} cells must be stored in row-major order`);
      }
      const mergedCells = new Set<string>();
      const cellIds = new Set(table.cells.map((cell) => cell.id));
      for (const merge of table.merges) {
        claimId(merge.id, "table merge");
        const memberIds = [merge.rootCellId, ...merge.coveredCellIds];
        if (merge.coveredCellIds.length === 0) {
          diagnostics.push(`table merge ${merge.id} must cover at least two cells`);
        }
        if (new Set(memberIds).size !== memberIds.length) {
          diagnostics.push(`table merge ${merge.id} contains duplicate cells`);
        }
        for (const cellId of memberIds) {
          if (!cellIds.has(cellId)) diagnostics.push(`table merge ${merge.id} references missing cell ${cellId}`);
          if (mergedCells.has(cellId)) diagnostics.push(`table cell ${cellId} participates in overlapping merges`);
          mergedCells.add(cellId);
        }
        const members = table.cells.filter((cell) => memberIds.includes(cell.id));
        if (members.length === memberIds.length) {
          const rowIndexes = new Set(members.map((cell) =>
            table.rows.findIndex((row) => row.id === cell.rowId)));
          const columnIndexes = new Set(members.map((cell) =>
            table.columns.findIndex((column) => column.id === cell.columnId)));
          const expectedSize = rowIndexes.size * columnIndexes.size;
          const spansRows = Math.max(...rowIndexes) - Math.min(...rowIndexes) + 1 === rowIndexes.size;
          const spansColumns = Math.max(...columnIndexes) - Math.min(...columnIndexes) + 1 === columnIndexes.size;
          if (expectedSize !== memberIds.length || !spansRows || !spansColumns) {
            diagnostics.push(`table merge ${merge.id} must form one complete rectangle`);
          }
        }
      }
    } else if (block.kind === "image") {
      validateDimensions(block.image.dimensions, `image ${block.id}`, diagnostics);
      if (!block.image.source.fileId || !block.image.source.version || !block.image.source.digest) {
        diagnostics.push(`image ${block.id} has an invalid source reference`);
      }
    } else if (block.kind === "chart") {
      validateDimensions(block.chart.dimensions, `chart ${block.id}`, diagnostics);
    }
  }

  function validateRows(
    rows: DocumentRow[],
    depth: number,
    insideCallout: boolean,
    containerWidthTwips?: number
  ): void {
    if (depth > limits.maxNestingDepth) {
      diagnostics.push(`content nesting exceeds ${limits.maxNestingDepth}`);
      return;
    }
    rowCount += rows.length;
    for (const row of rows) {
      claimId(row.id, "row");
      if (row.blocks.length === 0) diagnostics.push(`row ${row.id} must contain a Block`);
      if (row.blocks.length > limits.maxBlocksPerRow) {
        diagnostics.push(`row ${row.id} exceeds Block limit`);
      }
      if (!isNonNegativeInteger(row.layout.blockGapTwips) ||
          !isNonNegativeInteger(row.layout.marginBeforeTwips) ||
          !isNonNegativeInteger(row.layout.marginAfterTwips)) {
        diagnostics.push(`row ${row.id} spacing must be non-negative integers`);
      }
      const totalGapTwips = row.layout.blockGapTwips * Math.max(0, row.blocks.length - 1);
      const hasUsableContainer = containerWidthTwips !== undefined &&
        Number.isFinite(containerWidthTwips) &&
        containerWidthTwips > 0;
      const gapsFitContainer = !hasUsableContainer || (
        Number.isSafeInteger(totalGapTwips) && totalGapTwips < containerWidthTwips
      );
      if (hasUsableContainer && !gapsFitContainer) {
        diagnostics.push(`row ${row.id} Block gaps must leave positive container width`);
      }
      if (row.layout.tracks.length !== row.blocks.length) {
        diagnostics.push(`row ${row.id} track count must match Block count`);
      }
      for (let index = 0; index < row.blocks.length; index += 1) {
        const block = row.blocks[index];
        const track = row.layout.tracks[index];
        if (!track || track.blockId !== block.id || !isPositiveInteger(track.widthUnits)) {
          diagnostics.push(`row ${row.id} tracks must match Block order with positive widths`);
        }
        let assignedWidth: number | undefined;
        if (hasUsableContainer && gapsFitContainer && track?.blockId === block.id) {
          try {
            assignedWidth = computeAssignedBlockWidth(row, block.id, containerWidthTwips);
          } catch {
            // Structural diagnostics above remain the canonical validation
            // result; an invalid Row has no meaningful child container width.
          }
        }
        validateBlock(block, depth, insideCallout, assignedWidth);
      }
    }
  }

  validateRows(
    snapshot.rows,
    0,
    false,
    rootContainerWidth > 0 ? rootContainerWidth : undefined
  );
  if (rowCount > limits.maxRowsPerDocument) {
    diagnostics.push(`row count exceeds ${limits.maxRowsPerDocument}`);
  }

  return { ok: diagnostics.length === 0, diagnostics };
};
