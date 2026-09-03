import type { ContentBlock, TableBlock } from "$representation/data/types/content/content-block";
import type { DocumentRow } from "$representation/data/types/documents/body";

export type BlocksRow = Extract<DocumentRow, { kind: "blocks" }>;

const IMAGE_LINES = 12;
export const DIVIDER_LINES = 1;

export const isBlocks = (row: DocumentRow): row is BlocksRow => row.kind === "blocks";

export const shares = (row: BlocksRow): readonly number[] => {
  if (row.proportions === undefined) return row.blocks.map(() => 1 / row.blocks.length);

  if (row.proportions.length !== row.blocks.length) {
    throw new Error(
      `Row ${row.id} has ${row.blocks.length} blocks and ${row.proportions.length} proportions.`
    );
  }

  const total = row.proportions.reduce((sum, value) => sum + value, 0);
  if (total <= 0) throw new Error(`Row ${row.id} has proportions that do not sum above zero.`);

  return row.proportions.map((value) => value / total);
};

export const budgetOf = (share: number, charactersPerLine: number): number =>
  Math.max(1, Math.floor(charactersPerLine * share));

export const budgets = (row: BlocksRow, charactersPerLine: number): readonly number[] =>
  shares(row).map((share) => budgetOf(share, charactersPerLine));

export const linesOfText = (display: string, budget: number): number => {
  if (budget <= 0) return 1;

  let lines = 1;
  let used = 0;

  for (const word of display.split(" ")) {
    if (used === 0) used = word.length;
    else if (used + 1 + word.length <= budget) used += 1 + word.length;
    else {
      lines += 1;
      used = word.length;
    }

    while (used > budget) {
      lines += 1;
      used -= budget;
    }
  }

  return lines;
};

const linesOfTable = (block: TableBlock, budget: number): number =>
  block.rows.reduce(
    (total, row) =>
      total +
      Math.max(
        1,
        ...row.cells.map((cell) =>
          cell.blocks.reduce((tallest, held) => Math.max(tallest, linesOfBlock(held, budget)), 1)
        )
      ),
    0
  );

export const linesOfBlock = (block: ContentBlock, budget: number): number => {
  switch (block.type) {
    case "text":
    case "formula":
    case "prompt":
      return linesOfText(block.display, budget);
    case "image":
      return IMAGE_LINES;
    case "table":
      return linesOfTable(block, budget);
  }
};

export const linesOfRow = (row: DocumentRow, charactersPerLine: number): number => {
  if (row.kind === "divider") return DIVIDER_LINES;
  if (row.kind === "pageBreak") return 0;

  const budget = budgets(row, charactersPerLine);
  return row.blocks.reduce(
    (tallest, block, index) => Math.max(tallest, linesOfBlock(block, budget[index])),
    1
  );
};

export const pack = <T>(
  items: readonly T[],
  measure: (item: T) => number,
  closes: (item: T) => boolean,
  linesPerPage: number
): readonly (readonly T[])[] => {
  const pages: T[][] = [];
  let page: T[] = [];
  let used = 0;

  for (const item of items) {
    if (closes(item)) {
      page.push(item);
      pages.push(page);
      page = [];
      used = 0;
      continue;
    }

    const lines = measure(item);
    if (used > 0 && used + lines > linesPerPage) {
      pages.push(page);
      page = [];
      used = 0;
    }

    page.push(item);
    used += lines;
  }

  if (page.length > 0 || pages.length === 0) pages.push(page);

  return pages;
};

export const paginate = (
  rows: readonly DocumentRow[],
  charactersPerLine: number,
  linesPerPage: number
): readonly (readonly DocumentRow[])[] =>
  pack(
    rows,
    (row) => linesOfRow(row, charactersPerLine),
    (row) => row.kind === "pageBreak",
    linesPerPage
  );
