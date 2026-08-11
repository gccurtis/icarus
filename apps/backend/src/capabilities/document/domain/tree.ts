import type {
  DocumentBlock,
  DocumentList,
  DocumentRow,
  DocumentSnapshot,
  DocumentTable,
  ListItem
} from "./model.js";

export interface RowLocation {
  rows: DocumentRow[];
  row: DocumentRow;
  index: number;
}

export interface BlockLocation extends RowLocation {
  block: DocumentBlock;
  blockIndex: number;
}

const visitBlockRows = (
  block: DocumentBlock,
  visitor: (rows: DocumentRow[]) => boolean
): boolean => {
  if (block.kind === "callout") {
    if (visitRows(block.rows, visitor)) return true;
  } else if (block.kind === "list") {
    const visitItems = (items: ListItem[]): boolean => {
      for (const item of items) {
        if (visitRows(item.rows, visitor) || visitItems(item.children)) return true;
      }
      return false;
    };
    if (visitItems(block.list.items)) return true;
  } else if (block.kind === "table") {
    for (const cell of block.table.cells) {
      if (visitRows(cell.rows, visitor)) return true;
    }
  }
  return false;
};

const blockContainsRows = (
  block: DocumentBlock,
  target: DocumentRow[]
): boolean => {
  const containsInRows = (rows: DocumentRow[]): boolean => {
    if (rows === target) return true;
    return rows.some((row) => row.blocks.some((child) => blockContainsRows(child, target)));
  };

  if (block.kind === "callout") return containsInRows(block.rows);
  if (block.kind === "list") {
    const containsInItems = (items: ListItem[]): boolean => items.some((item) =>
      containsInRows(item.rows) || containsInItems(item.children));
    return containsInItems(block.list.items);
  }
  if (block.kind === "table") {
    return block.table.cells.some((cell) => containsInRows(cell.rows));
  }
  return false;
};

/** The top-level Block whose recursive content owns a nested Row array. */
export const findOutermostBlockForRows = (
  snapshot: DocumentSnapshot,
  target: DocumentRow[]
): DocumentBlock | undefined => {
  if (target === snapshot.rows) return undefined;
  for (const row of snapshot.rows) {
    for (const block of row.blocks) {
      if (blockContainsRows(block, target)) return block;
    }
  }
  return undefined;
};

export const visitRows = (
  rows: DocumentRow[],
  visitor: (rows: DocumentRow[]) => boolean
): boolean => {
  if (visitor(rows)) return true;
  for (const row of rows) {
    for (const block of row.blocks) {
      if (visitBlockRows(block, visitor)) return true;
    }
  }
  return false;
};

export const findRow = (
  snapshot: DocumentSnapshot,
  rowId: string
): RowLocation | undefined => {
  let found: RowLocation | undefined;
  visitRows(snapshot.rows, (rows) => {
    const index = rows.findIndex((row) => row.id === rowId);
    if (index < 0) return false;
    found = { rows, row: rows[index], index };
    return true;
  });
  return found;
};

export const findBlock = (
  snapshot: DocumentSnapshot,
  blockId: string
): BlockLocation | undefined => {
  let found: BlockLocation | undefined;
  visitRows(snapshot.rows, (rows) => {
    for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
      const row = rows[rowIndex];
      const blockIndex = row.blocks.findIndex((block) => block.id === blockId);
      if (blockIndex >= 0) {
        found = {
          rows,
          row,
          index: rowIndex,
          block: row.blocks[blockIndex],
          blockIndex
        };
        return true;
      }
    }
    return false;
  });
  return found;
};

export const forEachBlock = (
  snapshot: DocumentSnapshot,
  visitor: (block: DocumentBlock, row: DocumentRow) => void
): void => {
  visitRows(snapshot.rows, (rows) => {
    for (const row of rows) {
      for (const block of row.blocks) visitor(block, row);
    }
    return false;
  });
};

export const findList = (
  snapshot: DocumentSnapshot,
  listId: string
): DocumentList | undefined => {
  let found: DocumentList | undefined;
  forEachBlock(snapshot, (block) => {
    if (!found && block.kind === "list" && block.list.id === listId) found = block.list;
  });
  return found;
};

export const findTable = (
  snapshot: DocumentSnapshot,
  tableId: string
): DocumentTable | undefined => {
  let found: DocumentTable | undefined;
  forEachBlock(snapshot, (block) => {
    if (!found && block.kind === "table" && block.table.id === tableId) found = block.table;
  });
  return found;
};

export interface ListItemLocation {
  items: ListItem[];
  item: ListItem;
  index: number;
}

export const findListItem = (
  list: DocumentList,
  itemId: string
): ListItemLocation | undefined => {
  const visit = (items: ListItem[]): ListItemLocation | undefined => {
    const index = items.findIndex((item) => item.id === itemId);
    if (index >= 0) return { items, item: items[index], index };
    for (const item of items) {
      const nested = visit(item.children);
      if (nested) return nested;
    }
    return undefined;
  };
  return visit(list.items);
};
