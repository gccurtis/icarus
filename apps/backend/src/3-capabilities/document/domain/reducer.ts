import type { ContextEntry } from "#context";
import type { RichText, RichTextOperation, TextStyleProperties } from "#rich-text";
import { canonicalDigest } from "./canonical.js";
import {
  DocumentOperationError,
  DocumentPlacementError,
  DocumentStyleReferenceError,
  DocumentUnboundContextVariableError,
  DocumentValidationError
} from "./errors.js";
import type {
  BlockPlacement,
  DocumentBlock,
  DocumentLimits,
  DocumentOperation,
  DocumentRow,
  DocumentSnapshot,
  DocumentStyle,
  ListItem,
  PromptBlock,
  PromptContext,
  RowLayout,
  TableCell,
  DocumentTable
} from "./model.js";
import {
  findBlock,
  findOutermostBlockForRows,
  findList,
  findListItem,
  findRow,
  findTable,
  forEachBlock
} from "./tree.js";
import { validateSnapshot } from "./validation.js";

export interface FormulaAtomChange {
  blockId: string;
  atomId: string;
  expression: string;
}

export interface DocumentApplyResult {
  snapshot: DocumentSnapshot;
  forward: DocumentOperation[];
  inverse: DocumentOperation[];
  touchedIds: string[];
  formulaChanges: FormulaAtomChange[];
}

const clone = <T>(value: T): T => structuredClone(value);

const requireBlock = (snapshot: DocumentSnapshot, blockId: string) => {
  const location = findBlock(snapshot, blockId);
  if (!location) throw new DocumentOperationError(`Block not found: ${blockId}`);
  return location;
};

const requireRow = (snapshot: DocumentSnapshot, rowId: string) => {
  const location = findRow(snapshot, rowId);
  if (!location) throw new DocumentPlacementError(`Row not found: ${rowId}`);
  return location;
};

const requireStyle = (snapshot: DocumentSnapshot, styleId: string): DocumentStyle => {
  const style = snapshot.styles.styles.find((candidate) => candidate.id === styleId);
  if (!style) throw new DocumentStyleReferenceError(styleId);
  return style;
};

/**
 * Case-insensitively, because a template binding addresses variables **by name**
 * and the person typing that binding has no way to know which casing the author
 * used. Two variables differing only in case would make a binding ambiguous.
 */
export const normalizeVariableName = (name: string): string =>
  name.trim().toLocaleLowerCase();

/**
 * The whole of context resolution. There is no algorithm here on purpose —
 * one target in, one target out — which is what replacing the entry *list* with
 * a single `PromptContext` bought.
 *
 * An unbound variable **throws** rather than resolving to nothing. Resolving to
 * `[]` would hand `Knowledge.resolveScope` the zero-length array it reads as
 * whole-project retrieval, so a prompt nobody finished configuring would
 * silently ground itself on everything — a wrong answer instead of a refused
 * one. Unbound variables only exist on template-mode Documents, because
 * instantiation must bind every declared parameter, so on an ordinary Document
 * this cannot fire.
 */
export const resolvePromptContext = (
  snapshot: DocumentSnapshot,
  context: PromptContext
): ContextEntry[] => {
  if (context.kind === "direct") return [clone(context.target)];
  const variable = snapshot.contextVariables
    .find((candidate) => candidate.id === context.variableId);
  if (!variable) {
    throw new DocumentOperationError(`Context Variable not found: ${context.variableId}`);
  }
  if (!variable.target) {
    throw new DocumentUnboundContextVariableError(variable.id, variable.name);
  }
  return [clone(variable.target)];
};

/**
 * The lenient form, used **only** while copying.
 *
 * A template legitimately holds unbound parameters, and a copy has to declare a
 * Derived Output for every Prompt Block regardless — one live Block owns one
 * dedicated output, so there is no "skip this one" option. Declaring with no
 * entries is safe here precisely because nothing refreshes it in that state:
 * registration seals the copy, and instantiation calls `applyBindings` before
 * the instance is usable. The strict resolver guards the moment work would
 * actually be grounded.
 */
export const resolvePromptContextIfBound = (
  snapshot: DocumentSnapshot,
  context: PromptContext
): ContextEntry[] => {
  if (context.kind === "direct") return [clone(context.target)];
  const variable = snapshot.contextVariables
    .find((candidate) => candidate.id === context.variableId);
  return variable?.target ? [clone(variable.target)] : [];
};

/** Live Prompt Blocks pointing at one variable, as the Blocks themselves. */
const referencingPromptBlocks = (
  snapshot: DocumentSnapshot,
  variableId: string
): PromptBlock[] => {
  const blocks: PromptBlock[] = [];
  forEachBlock(snapshot, (block) => {
    if (block.kind === "prompt" &&
        block.context.kind === "variable" &&
        block.context.variableId === variableId) {
      blocks.push(block);
    }
  });
  return blocks;
};

const requireAvailableVariableName = (
  snapshot: DocumentSnapshot,
  name: string,
  exceptId?: string
): void => {
  const normalized = normalizeVariableName(name);
  if (normalized.length === 0) {
    throw new DocumentOperationError("Context Variable name must not be empty");
  }
  const taken = snapshot.contextVariables.some(
    (variable) =>
      variable.id !== exceptId && normalizeVariableName(variable.name) === normalized
  );
  if (taken) throw new DocumentOperationError(`Context Variable name is taken: ${name}`);
};

export const resolveDocumentStyle = (
  snapshot: DocumentSnapshot,
  styleId: string
): { text: TextStyleProperties; block: DocumentStyle["block"] } => {
  const chain: DocumentStyle[] = [];
  const seen = new Set<string>();
  let current = requireStyle(snapshot, styleId);
  while (true) {
    if (seen.has(current.id)) throw new DocumentStyleReferenceError(styleId, "Style inheritance cycle");
    seen.add(current.id);
    chain.unshift(current);
    if (!current.basedOnStyleId) break;
    current = requireStyle(snapshot, current.basedOnStyleId);
  }
  const text: Record<string, unknown> = {};
  const block: Record<string, unknown> = {};
  for (const style of chain) {
    Object.assign(text, style.text);
    Object.assign(block, style.block);
  }
  return {
    text: text as TextStyleProperties,
    block: block as DocumentStyle["block"]
  };
};

const defaultRowLayout = (blockId: string, widthUnits = 1): RowLayout => ({
  blockGapTwips: 0,
  marginBeforeTwips: 0,
  marginAfterTwips: 0,
  tracks: [{ blockId, widthUnits }]
});

const insertBlockAt = (
  row: DocumentRow,
  block: DocumentBlock,
  index: number,
  widthUnits: number
): void => {
  if (!Number.isSafeInteger(widthUnits) || widthUnits <= 0) {
    throw new DocumentPlacementError("Block width units must be a positive integer");
  }
  row.blocks.splice(index, 0, block);
  row.layout.tracks.splice(index, 0, { blockId: block.id, widthUnits });
};

const placeBlock = (
  snapshot: DocumentSnapshot,
  block: DocumentBlock,
  placement: BlockPlacement
): void => {
  const widthUnits = placement.widthUnits ?? 1;
  if (placement.kind === "in-row") {
    const target = requireRow(snapshot, placement.rowId);
    const index = placement.afterBlockId === undefined
      ? 0
      : target.row.blocks.findIndex((candidate) => candidate.id === placement.afterBlockId) + 1;
    if (placement.afterBlockId !== undefined && index === 0) {
      throw new DocumentPlacementError(`Anchor Block is not in Row ${placement.rowId}`);
    }
    insertBlockAt(target.row, block, index, widthUnits);
    return;
  }

  if (placement.kind === "new-row") {
    if (findRow(snapshot, placement.rowId)) {
      throw new DocumentPlacementError(`Row already exists: ${placement.rowId}`);
    }
    const rows = placement.afterRowId ? requireRow(snapshot, placement.afterRowId).rows : snapshot.rows;
    const index = placement.afterRowId
      ? rows.findIndex((row) => row.id === placement.afterRowId) + 1
      : 0;
    rows.splice(index, 0, {
      id: placement.rowId,
      blocks: [block],
      layout: {
        blockGapTwips: placement.layout?.blockGapTwips ?? 0,
        marginBeforeTwips: placement.layout?.marginBeforeTwips ?? 0,
        marginAfterTwips: placement.layout?.marginAfterTwips ?? 0,
        tracks: [{ blockId: block.id, widthUnits }]
      }
    });
    return;
  }

  if (placement.kind === "after-block") {
    const anchor = requireBlock(snapshot, placement.afterBlockId);
    if (anchor.row.blocks.length === 1) {
      if (!placement.newRowId) {
        throw new DocumentPlacementError("after-block requires newRowId for a sole-Block Row");
      }
      anchor.rows.splice(anchor.index + 1, 0, {
        id: placement.newRowId,
        blocks: [block],
        layout: defaultRowLayout(block.id, widthUnits)
      });
      return;
    }
    insertBlockAt(anchor.row, block, anchor.blockIndex + 1, widthUnits);
    return;
  }

  const before = requireBlock(snapshot, placement.beforeBlockId);
  const after = requireBlock(snapshot, placement.afterBlockId);
  if (before.rows === after.rows && before.row === after.row) {
    if (after.blockIndex !== before.blockIndex + 1) {
      throw new DocumentPlacementError("between-blocks anchors must be adjacent");
    }
    insertBlockAt(before.row, block, after.blockIndex, widthUnits);
    return;
  }
  if (before.rows !== after.rows || after.index !== before.index + 1) {
    throw new DocumentPlacementError("between-blocks Rows must be adjacent siblings");
  }
  if (!placement.newRowId) {
    throw new DocumentPlacementError("between-blocks requires newRowId across Rows");
  }
  before.rows.splice(after.index, 0, {
    id: placement.newRowId,
    blocks: [block],
    layout: defaultRowLayout(block.id, widthUnits)
  });
};

const resolveMovePlacement = (
  snapshot: DocumentSnapshot,
  blockId: string,
  placement: BlockPlacement
): BlockPlacement | undefined => {
  const source = requireBlock(snapshot, blockId);

  if (placement.kind === "in-row") {
    const target = requireRow(snapshot, placement.rowId);
    if (placement.afterBlockId === blockId) {
      throw new DocumentPlacementError("A Block cannot move after itself");
    }
    if (placement.afterBlockId !== undefined &&
        !target.row.blocks.some((block) => block.id === placement.afterBlockId)) {
      throw new DocumentPlacementError(`Anchor Block is not in Row ${placement.rowId}`);
    }
    if (target.row === source.row && source.row.blocks.length === 1) {
      if (placement.afterBlockId !== undefined) {
        throw new DocumentPlacementError("A sole Block has no distinct in-Row anchor");
      }
      return undefined;
    }
    return clone(placement);
  }

  if (placement.kind === "new-row") {
    if (placement.afterRowId === source.row.id && source.row.blocks.length === 1) {
      const prior = source.index > 0 ? source.rows[source.index - 1]?.id : undefined;
      if (!prior && source.rows !== snapshot.rows) {
        throw new DocumentPlacementError(
          "Moving a sole first nested Row requires an explicit surviving Row anchor"
        );
      }
      return { ...clone(placement), afterRowId: prior };
    }
    if (placement.afterRowId !== undefined) requireRow(snapshot, placement.afterRowId);
    return clone(placement);
  }

  if (placement.kind === "after-block") {
    if (placement.afterBlockId === blockId) {
      throw new DocumentPlacementError("A Block cannot move after itself");
    }
    const anchor = requireBlock(snapshot, placement.afterBlockId);
    if (anchor.row.blocks.length === 1) {
      if (!placement.newRowId) {
        throw new DocumentPlacementError("after-block requires newRowId for a sole-Block Row");
      }
      return {
        kind: "new-row",
        afterRowId: anchor.row.id,
        rowId: placement.newRowId,
        widthUnits: placement.widthUnits
      };
    }
    return {
      kind: "in-row",
      rowId: anchor.row.id,
      afterBlockId: anchor.block.id,
      widthUnits: placement.widthUnits
    };
  }

  if (placement.beforeBlockId === blockId || placement.afterBlockId === blockId) {
    throw new DocumentPlacementError("A moved Block cannot be one of its placement anchors");
  }
  const before = requireBlock(snapshot, placement.beforeBlockId);
  const after = requireBlock(snapshot, placement.afterBlockId);
  if (before.rows === after.rows && before.row === after.row) {
    if (after.blockIndex !== before.blockIndex + 1) {
      throw new DocumentPlacementError("between-blocks anchors must be adjacent");
    }
    return {
      kind: "in-row",
      rowId: before.row.id,
      afterBlockId: before.block.id,
      widthUnits: placement.widthUnits
    };
  }
  if (before.rows !== after.rows || after.index !== before.index + 1) {
    throw new DocumentPlacementError("between-blocks Rows must be adjacent siblings");
  }
  if (!placement.newRowId) {
    throw new DocumentPlacementError("between-blocks requires newRowId across Rows");
  }
  return {
    kind: "new-row",
    afterRowId: before.row.id,
    rowId: placement.newRowId,
    widthUnits: placement.widthUnits
  };
};

const removeBlock = (snapshot: DocumentSnapshot, blockId: string): void => {
  const location = requireBlock(snapshot, blockId);
  location.row.blocks.splice(location.blockIndex, 1);
  location.row.layout.tracks.splice(location.blockIndex, 1);
  if (location.row.blocks.length === 0) location.rows.splice(location.index, 1);
};

const contentOf = (block: DocumentBlock) => {
  if (block.kind !== "text" && block.kind !== "code" && block.kind !== "quote") {
    throw new DocumentOperationError(`Block ${block.id} does not contain Rich Text`);
  }
  return block.content;
};

const setContent = (block: DocumentBlock, content: ReturnType<typeof contentOf>): void => {
  if (block.kind !== "text" && block.kind !== "code" && block.kind !== "quote") {
    throw new DocumentOperationError(`Block ${block.id} does not contain Rich Text`);
  }
  block.content = content;
};

const formulaMap = (block: DocumentBlock): Map<string, string> => {
  const result = new Map<string, string>();
  if (block.kind === "text" || block.kind === "code" || block.kind === "quote") {
    for (const atom of block.content.atoms) {
      if (atom.kind === "formula") result.set(atom.id, atom.expression);
    }
  }
  return result;
};

const snapshotFormulaMap = (
  snapshot: DocumentSnapshot
): Map<string, { blockId: string; expression: string }> => {
  const result = new Map<string, { blockId: string; expression: string }>();
  forEachBlock(snapshot, (block) => {
    for (const [atomId, expression] of formulaMap(block)) {
      result.set(atomId, { blockId: block.id, expression });
    }
  });
  return result;
};

const parentItemId = (items: ListItem[], target: ListItem[]): string | undefined => {
  for (const item of items) {
    if (item.children === target) return item.id;
    const nested = parentItemId(item.children, target);
    if (nested) return nested;
  }
  return undefined;
};

const destinationItems = (
  listItems: ListItem[],
  parentId?: string
): ListItem[] => {
  if (!parentId) return listItems;
  const visit = (items: ListItem[]): ListItem | undefined => {
    for (const item of items) {
      if (item.id === parentId) return item;
      const nested = visit(item.children);
      if (nested) return nested;
    }
    return undefined;
  };
  const parent = visit(listItems);
  if (!parent) throw new DocumentOperationError(`List item not found: ${parentId}`);
  return parent.children;
};

const insertAfter = <T>(items: T[], item: T, afterId: string | undefined, getId: (value: T) => string): void => {
  if (afterId === undefined) {
    items.unshift(item);
    return;
  }
  const index = items.findIndex((candidate) => getId(candidate) === afterId);
  if (index < 0) throw new DocumentOperationError(`Insertion anchor not found: ${afterId}`);
  items.splice(index + 1, 0, item);
};

const sortTableCells = (table: DocumentTable): void => {
  const rowOrder = new Map(table.rows.map((row, index) => [row.id, index]));
  const columnOrder = new Map(table.columns.map((column, index) => [column.id, index]));
  table.cells.sort((left, right) => {
    const rowDifference = (rowOrder.get(left.rowId) ?? Number.MAX_SAFE_INTEGER) -
      (rowOrder.get(right.rowId) ?? Number.MAX_SAFE_INTEGER);
    return rowDifference !== 0
      ? rowDifference
      : (columnOrder.get(left.columnId) ?? Number.MAX_SAFE_INTEGER) -
          (columnOrder.get(right.columnId) ?? Number.MAX_SAFE_INTEGER);
  });
};

const applyOne = (
  snapshot: DocumentSnapshot,
  operation: DocumentOperation,
  richText: RichText,
  formulaChanges: FormulaAtomChange[]
): void => {
  switch (operation.type) {
    case "document.rename":
      snapshot.title = operation.title;
      return;
    case "document.set-lifecycle":
      snapshot.lifecycle = operation.lifecycle;
      return;
    case "layout.set-page":
      snapshot.pageLayout = clone(operation.layout);
      return;
    case "prompt.set-context": {
      const block = requireBlock(snapshot, operation.blockId).block;
      if (block.kind !== "prompt") {
        throw new DocumentOperationError(`Block ${block.id} is not a Prompt Block`);
      }
      const context = operation.context;
      if (context.kind === "variable" &&
          !snapshot.contextVariables.some((v) => v.id === context.variableId)) {
        throw new DocumentOperationError(`Context Variable not found: ${context.variableId}`);
      }
      block.context = clone(context);
      return;
    }
    case "context-variable.create":
      if (snapshot.contextVariables.some((variable) => variable.id === operation.variable.id)) {
        throw new DocumentOperationError(`Context Variable already exists: ${operation.variable.id}`);
      }
      requireAvailableVariableName(snapshot, operation.variable.name);
      snapshot.contextVariables.push(clone(operation.variable));
      return;
    case "context-variable.update": {
      const index = snapshot.contextVariables
        .findIndex((variable) => variable.id === operation.variable.id);
      if (index < 0) {
        throw new DocumentOperationError(`Context Variable not found: ${operation.variable.id}`);
      }
      requireAvailableVariableName(snapshot, operation.variable.name, operation.variable.id);
      snapshot.contextVariables[index] = clone(operation.variable);
      return;
    }
    case "context-variable.delete": {
      const index = snapshot.contextVariables
        .findIndex((variable) => variable.id === operation.variableId);
      if (index < 0) {
        throw new DocumentOperationError(`Context Variable not found: ${operation.variableId}`);
      }
      const removed = snapshot.contextVariables[index];
      const referencing = referencingPromptBlocks(snapshot, operation.variableId);

      // **Cascade, and it changes nothing.** A referencing Block is re-pointed
      // at the variable's *current target* — the same thing it already resolved
      // to — so deleting a variable removes a level of indirection rather than
      // the grounding underneath it. Refusing instead would push the caller into
      // doing exactly this by hand, one `prompt.set-context` at a time.
      if (referencing.length > 0) {
        if (!removed.target) {
          // The one case with nothing to substitute. Only reachable on a
          // template, where an unbound variable is a declared parameter, and
          // there deletion really would strand the Blocks with no grounding.
          throw new DocumentOperationError(
            `Context Variable ${removed.id} is unbound and referenced by Prompt Blocks: ` +
            `${referencing.map((block) => block.id).join(", ")}`
          );
        }
        for (const block of referencing) {
          block.context = { kind: "direct", target: clone(removed.target) };
        }
      }
      snapshot.contextVariables.splice(index, 1);
      return;
    }
    case "style.create":
      if (snapshot.styles.styles.some((style) => style.id === operation.style.id)) {
        throw new DocumentOperationError(`Style already exists: ${operation.style.id}`);
      }
      snapshot.styles.styles.push(clone(operation.style));
      return;
    case "style.update": {
      const index = snapshot.styles.styles.findIndex((style) => style.id === operation.styleId);
      if (index < 0) throw new DocumentStyleReferenceError(operation.styleId);
      if (operation.style.id !== operation.styleId) {
        throw new DocumentOperationError("style.update cannot change Style identity");
      }
      const old = snapshot.styles.styles[index];
      if (old.systemRole !== operation.style.systemRole) {
        throw new DocumentOperationError("A protected heading role cannot be changed or reassigned");
      }
      snapshot.styles.styles[index] = clone(operation.style);
      return;
    }
    case "style.delete": {
      const style = requireStyle(snapshot, operation.styleId);
      requireStyle(snapshot, operation.replacementStyleId);
      if (style.systemRole) throw new DocumentOperationError("A protected heading Style cannot be deleted");
      if (operation.styleId === operation.replacementStyleId) {
        throw new DocumentOperationError("A Style cannot replace itself during deletion");
      }
      snapshot.styles.styles = snapshot.styles.styles
        .filter((candidate) => candidate.id !== operation.styleId)
        .map((candidate) => candidate.basedOnStyleId === operation.styleId
          ? { ...candidate, basedOnStyleId: operation.replacementStyleId }
          : candidate);
      for (const kind of Object.keys(snapshot.styles.defaultStyleIdByBlockKind) as Array<keyof typeof snapshot.styles.defaultStyleIdByBlockKind>) {
        if (snapshot.styles.defaultStyleIdByBlockKind[kind] === operation.styleId) {
          snapshot.styles.defaultStyleIdByBlockKind[kind] = operation.replacementStyleId;
        }
      }
      forEachBlock(snapshot, (block) => {
        if (block.styleId === operation.styleId) block.styleId = operation.replacementStyleId;
      });
      return;
    }
    case "style.set-default":
      requireStyle(snapshot, operation.styleId);
      snapshot.styles.defaultStyleIdByBlockKind[operation.blockKind] = operation.styleId;
      return;
    case "style.apply-inline": {
      const block = requireBlock(snapshot, operation.blockId).block;
      const resolved = resolveDocumentStyle(snapshot, operation.styleId).text;
      if (canonicalDigest(resolved) !== canonicalDigest(operation.resolvedProperties)) {
        throw new DocumentOperationError("Resolved inline Style properties do not match the saved Style");
      }
      const result = richText.apply(contentOf(block), [{
        type: "add-mark",
        mark: {
          id: operation.markId,
          kind: "style",
          range: operation.range,
          properties: clone(operation.resolvedProperties)
        }
      }]);
      setContent(block, result.content);
      return;
    }
    case "row.insert": {
      if (findRow(snapshot, operation.row.id)) throw new DocumentOperationError(`Row already exists: ${operation.row.id}`);
      const rows = operation.afterRowId ? requireRow(snapshot, operation.afterRowId).rows : snapshot.rows;
      const index = operation.afterRowId
        ? rows.findIndex((row) => row.id === operation.afterRowId) + 1
        : 0;
      rows.splice(index, 0, clone(operation.row));
      return;
    }
    case "row.move": {
      const source = requireRow(snapshot, operation.rowId);
      if (operation.afterRowId === operation.rowId) throw new DocumentPlacementError("A Row cannot move after itself");
      const row = source.row;
      source.rows.splice(source.index, 1);
      const rows = operation.afterRowId ? requireRow(snapshot, operation.afterRowId).rows : snapshot.rows;
      const index = operation.afterRowId
        ? rows.findIndex((candidate) => candidate.id === operation.afterRowId) + 1
        : 0;
      rows.splice(index, 0, row);
      return;
    }
    case "row.delete": {
      const location = requireRow(snapshot, operation.rowId);
      location.rows.splice(location.index, 1);
      return;
    }
    case "row.set-layout": {
      requireRow(snapshot, operation.rowId).row.layout = clone(operation.layout);
      return;
    }
    case "block.insert":
      if (findBlock(snapshot, operation.block.id)) throw new DocumentOperationError(`Block already exists: ${operation.block.id}`);
      placeBlock(snapshot, clone(operation.block), operation.placement);
      return;
    case "block.move": {
      const location = requireBlock(snapshot, operation.blockId);
      const block = location.block;
      const width = location.row.layout.tracks[location.blockIndex]?.widthUnits ?? 1;
      const placement = resolveMovePlacement(snapshot, operation.blockId, operation.placement);
      if (!placement) {
        if (operation.placement.widthUnits !== undefined) {
          location.row.layout.tracks[location.blockIndex].widthUnits = operation.placement.widthUnits;
        }
        return;
      }
      removeBlock(snapshot, operation.blockId);
      placeBlock(snapshot, block, {
        ...placement,
        widthUnits: placement.widthUnits ?? width
      });
      return;
    }
    case "block.replace": {
      const location = requireBlock(snapshot, operation.blockId);
      if (operation.block.id !== operation.blockId) throw new DocumentOperationError("block.replace cannot change identity");
      location.row.blocks[location.blockIndex] = clone(operation.block);
      return;
    }
    case "block.delete":
      removeBlock(snapshot, operation.blockId);
      return;
    case "block.set-style":
      requireStyle(snapshot, operation.styleId);
      requireBlock(snapshot, operation.blockId).block.styleId = operation.styleId;
      return;
    case "block.set-presentation": {
      const block = requireBlock(snapshot, operation.blockId).block;
      if (operation.presentation === undefined) delete block.presentation;
      else block.presentation = clone(operation.presentation);
      return;
    }
    case "rich-text.apply": {
      const block = requireBlock(snapshot, operation.blockId).block;
      const before = formulaMap(block);
      const result = richText.apply(contentOf(block), operation.operations);
      setContent(block, result.content);
      const after = formulaMap(block);
      for (const [atomId, expression] of after) {
        if (before.get(atomId) !== expression) {
          formulaChanges.push({ blockId: block.id, atomId, expression });
        }
      }
      return;
    }
    case "prompt.apply-derived-output": {
      const block = requireBlock(snapshot, operation.blockId).block;
      if (block.kind !== "prompt") throw new DocumentOperationError(`Block ${block.id} is not a Prompt Block`);
      if (block.output.outputId !== operation.output.outputId) {
        throw new DocumentOperationError("A Prompt Block cannot adopt a different Derived Output identity");
      }
      if (operation.output.appliedRevision <= 0) throw new DocumentOperationError("Derived Output revision must be positive");
      block.output = clone(operation.output);
      return;
    }
    case "list.insert-item": {
      const list = findList(snapshot, operation.listId);
      if (!list) throw new DocumentOperationError(`List not found: ${operation.listId}`);
      if (findListItem(list, operation.item.id)) throw new DocumentOperationError(`List item already exists: ${operation.item.id}`);
      insertAfter(destinationItems(list.items, operation.parentItemId), clone(operation.item), operation.afterItemId, (item) => item.id);
      return;
    }
    case "list.move-item": {
      const list = findList(snapshot, operation.listId);
      if (!list) throw new DocumentOperationError(`List not found: ${operation.listId}`);
      const source = findListItem(list, operation.itemId);
      if (!source) throw new DocumentOperationError(`List item not found: ${operation.itemId}`);
      if (operation.parentItemId === operation.itemId) throw new DocumentOperationError("A List item cannot contain itself");
      source.items.splice(source.index, 1);
      insertAfter(destinationItems(list.items, operation.parentItemId), source.item, operation.afterItemId, (item) => item.id);
      return;
    }
    case "list.delete-item": {
      const list = findList(snapshot, operation.listId);
      const location = list ? findListItem(list, operation.itemId) : undefined;
      if (!location) throw new DocumentOperationError(`List item not found: ${operation.itemId}`);
      location.items.splice(location.index, 1);
      return;
    }
    case "list.set-checked": {
      const list = findList(snapshot, operation.listId);
      const location = list ? findListItem(list, operation.itemId) : undefined;
      if (!list || !location) throw new DocumentOperationError(`List item not found: ${operation.itemId}`);
      if (list.listKind !== "checklist") throw new DocumentOperationError("checked is valid only for checklist items");
      location.item.checked = operation.checked;
      return;
    }
    case "table.insert-row": {
      const table = findTable(snapshot, operation.tableId);
      if (!table) throw new DocumentOperationError(`Table not found: ${operation.tableId}`);
      insertAfter(table.rows, clone(operation.row), operation.afterRowId, (row) => row.id);
      table.cells.push(...clone(operation.cells));
      sortTableCells(table);
      return;
    }
    case "table.move-row": {
      const table = findTable(snapshot, operation.tableId);
      if (!table) throw new DocumentOperationError(`Table not found: ${operation.tableId}`);
      const index = table.rows.findIndex((row) => row.id === operation.rowId);
      if (index < 0) throw new DocumentOperationError(`Table Row not found: ${operation.rowId}`);
      const [row] = table.rows.splice(index, 1);
      insertAfter(table.rows, row, operation.afterRowId, (candidate) => candidate.id);
      sortTableCells(table);
      return;
    }
    case "table.delete-row": {
      const table = findTable(snapshot, operation.tableId);
      if (!table) throw new DocumentOperationError(`Table not found: ${operation.tableId}`);
      const index = table.rows.findIndex((row) => row.id === operation.rowId);
      if (index < 0) throw new DocumentOperationError(`Table Row not found: ${operation.rowId}`);
      const removedCellIds = new Set(table.cells.filter((cell) => cell.rowId === operation.rowId).map((cell) => cell.id));
      table.rows.splice(index, 1);
      table.cells = table.cells.filter((cell) => cell.rowId !== operation.rowId);
      table.merges = table.merges.filter((merge) =>
        !removedCellIds.has(merge.rootCellId) && !merge.coveredCellIds.some((id) => removedCellIds.has(id)));
      return;
    }
    case "table.insert-column": {
      const table = findTable(snapshot, operation.tableId);
      if (!table) throw new DocumentOperationError(`Table not found: ${operation.tableId}`);
      insertAfter(table.columns, clone(operation.column), operation.afterColumnId, (column) => column.id);
      table.cells.push(...clone(operation.cells));
      sortTableCells(table);
      return;
    }
    case "table.move-column": {
      const table = findTable(snapshot, operation.tableId);
      if (!table) throw new DocumentOperationError(`Table not found: ${operation.tableId}`);
      const index = table.columns.findIndex((column) => column.id === operation.columnId);
      if (index < 0) throw new DocumentOperationError(`Table Column not found: ${operation.columnId}`);
      const [column] = table.columns.splice(index, 1);
      insertAfter(table.columns, column, operation.afterColumnId, (candidate) => candidate.id);
      sortTableCells(table);
      return;
    }
    case "table.delete-column": {
      const table = findTable(snapshot, operation.tableId);
      if (!table) throw new DocumentOperationError(`Table not found: ${operation.tableId}`);
      const index = table.columns.findIndex((column) => column.id === operation.columnId);
      if (index < 0) throw new DocumentOperationError(`Table Column not found: ${operation.columnId}`);
      const removedCellIds = new Set(table.cells.filter((cell) => cell.columnId === operation.columnId).map((cell) => cell.id));
      table.columns.splice(index, 1);
      table.cells = table.cells.filter((cell) => cell.columnId !== operation.columnId);
      table.merges = table.merges.filter((merge) =>
        !removedCellIds.has(merge.rootCellId) && !merge.coveredCellIds.some((id) => removedCellIds.has(id)));
      return;
    }
    case "table.merge": {
      const table = findTable(snapshot, operation.tableId);
      if (!table) throw new DocumentOperationError(`Table not found: ${operation.tableId}`);
      table.merges.push(clone(operation.merge));
      return;
    }
    case "table.unmerge": {
      const table = findTable(snapshot, operation.tableId);
      if (!table) throw new DocumentOperationError(`Table not found: ${operation.tableId}`);
      const index = table.merges.findIndex((merge) => merge.id === operation.mergeId);
      if (index < 0) throw new DocumentOperationError(`Table merge not found: ${operation.mergeId}`);
      table.merges.splice(index, 1);
      return;
    }
    case "image.set-source": {
      const block = requireBlock(snapshot, operation.blockId).block;
      if (block.kind !== "image") throw new DocumentOperationError(`Block ${block.id} is not an Image`);
      block.image.source = clone(operation.source);
      return;
    }
    case "image.set-accessibility": {
      const block = requireBlock(snapshot, operation.blockId).block;
      if (block.kind !== "image") throw new DocumentOperationError(`Block ${block.id} is not an Image`);
      block.image.alt = operation.alt;
      block.image.decorative = operation.decorative;
      return;
    }
    case "visual.set-dimensions": {
      const block = requireBlock(snapshot, operation.blockId).block;
      if (block.kind === "image") block.image.dimensions = clone(operation.dimensions);
      else if (block.kind === "chart") block.chart.dimensions = clone(operation.dimensions);
      else throw new DocumentOperationError(`Block ${block.id} has no visual dimensions`);
      return;
    }
  }
};

const previousId = <T>(items: T[], index: number, getId: (value: T) => string): string | undefined =>
  index > 0 ? getId(items[index - 1]) : undefined;

const changedOutermostBlocks = (
  before: DocumentSnapshot,
  after: DocumentSnapshot
): DocumentBlock[] => {
  const changed: DocumentBlock[] = [];
  for (const row of before.rows) {
    for (const block of row.blocks) {
      const current = findBlock(after, block.id)?.block;
      if (current && canonicalDigest(current) !== canonicalDigest(block)) changed.push(block);
    }
  }
  return changed;
};

const restoreBlocks = (blocks: DocumentBlock[]): DocumentOperation[] =>
  blocks.map((block) => ({
    type: "block.replace",
    blockId: block.id,
    block: clone(block)
  }));

const inverseFor = (
  before: DocumentSnapshot,
  operation: DocumentOperation,
  after: DocumentSnapshot
): DocumentOperation[] => {
  switch (operation.type) {
    case "document.rename":
      return [{ type: "document.rename", title: before.title }];
    case "document.set-lifecycle":
      return [{ type: "document.set-lifecycle", lifecycle: before.lifecycle }];
    case "layout.set-page":
      return [{ type: "layout.set-page", layout: clone(before.pageLayout) }];
    case "prompt.set-context": {
      const block = findBlock(before, operation.blockId)?.block;
      if (!block || block.kind !== "prompt") {
        throw new DocumentOperationError(`Prompt Block not found: ${operation.blockId}`);
      }
      return [{
        type: "prompt.set-context",
        blockId: operation.blockId,
        context: clone(block.context)
      }];
    }
    case "context-variable.create":
      return [{ type: "context-variable.delete", variableId: operation.variable.id }];
    case "context-variable.update": {
      // The whole prior variable, because the operation replaces the whole
      // thing. A field-level inverse would have to know which fields changed,
      // and "rename" and "rebind" are the same operation here.
      const previous = before.contextVariables
        .find((variable) => variable.id === operation.variable.id);
      if (!previous) {
        throw new DocumentOperationError(`Context Variable not found: ${operation.variable.id}`);
      }
      return [{ type: "context-variable.update", variable: clone(previous) }];
    }
    case "context-variable.delete": {
      const removed = before.contextVariables
        .find((variable) => variable.id === operation.variableId);
      if (!removed) {
        throw new DocumentOperationError(`Context Variable not found: ${operation.variableId}`);
      }
      // The variable comes back first, then every Block the cascade re-pointed
      // goes back to referencing it. Without the second half the inverse would
      // restore the variable and leave the Blocks pointing at a literal target —
      // the same grounding, but no longer a parameter, which is a different
      // Document.
      return [
        { type: "context-variable.create", variable: clone(removed) },
        ...referencingPromptBlocks(before, operation.variableId).map((block) => ({
          type: "prompt.set-context" as const,
          blockId: block.id,
          context: { kind: "variable" as const, variableId: operation.variableId }
        }))
      ];
    }
    case "style.create":
      return [{
        type: "style.delete",
        styleId: operation.style.id,
        replacementStyleId: before.styles.defaultStyleIdByBlockKind.text
      }];
    case "style.update":
      return [{ type: "style.update", styleId: operation.styleId, style: clone(requireStyle(before, operation.styleId)) }];
    case "style.delete": {
      const deleted = requireStyle(before, operation.styleId);
      const result: DocumentOperation[] = [{ type: "style.create", style: clone(deleted) }];
      for (const style of before.styles.styles) {
        const current = after.styles.styles.find((candidate) => candidate.id === style.id);
        if (current && canonicalDigest(current) !== canonicalDigest(style)) {
          result.push({ type: "style.update", styleId: style.id, style: clone(style) });
        }
      }
      for (const [kind, styleId] of Object.entries(before.styles.defaultStyleIdByBlockKind)) {
        if (after.styles.defaultStyleIdByBlockKind[kind as keyof typeof after.styles.defaultStyleIdByBlockKind] !== styleId) {
          result.push({ type: "style.set-default", blockKind: kind as keyof typeof before.styles.defaultStyleIdByBlockKind, styleId });
        }
      }
      forEachBlock(before, (block) => {
        if (block.styleId === operation.styleId) {
          result.push({ type: "block.set-style", blockId: block.id, styleId: operation.styleId });
        }
      });
      return result;
    }
    case "style.set-default":
      return [{
        type: "style.set-default",
        blockKind: operation.blockKind,
        styleId: before.styles.defaultStyleIdByBlockKind[operation.blockKind]
      }];
    case "style.apply-inline":
    case "rich-text.apply": {
      const block = requireBlock(before, operation.blockId).block;
      return [{ type: "block.replace", blockId: block.id, block: clone(block) }];
    }
    case "row.insert":
      return [{ type: "row.delete", rowId: operation.row.id }];
    case "row.delete": {
      const location = requireRow(before, operation.rowId);
      const owner = findOutermostBlockForRows(before, location.rows);
      if (owner) return restoreBlocks([owner]);
      return [{ type: "row.insert", row: clone(location.row), afterRowId: previousId(location.rows, location.index, (row) => row.id) }];
    }
    case "row.move": {
      const source = requireRow(before, operation.rowId);
      const destination = requireRow(after, operation.rowId);
      const sourceOwner = findOutermostBlockForRows(before, source.rows);
      const destinationOwner = findOutermostBlockForRows(after, destination.rows);
      if (sourceOwner && destinationOwner) {
        return restoreBlocks(changedOutermostBlocks(before, after));
      }
      if (sourceOwner) {
        return [
          { type: "row.delete", rowId: operation.rowId },
          ...restoreBlocks([sourceOwner])
        ];
      }
      if (destinationOwner) {
        const originalDestination = findBlock(before, destinationOwner.id)?.block;
        if (!originalDestination) throw new DocumentOperationError("Row move inverse destination is unavailable");
        return [
          ...restoreBlocks([originalDestination]),
          {
            type: "row.insert",
            row: clone(source.row),
            afterRowId: previousId(source.rows, source.index, (row) => row.id)
          }
        ];
      }
      return [{
        type: "row.move",
        rowId: operation.rowId,
        afterRowId: previousId(source.rows, source.index, (row) => row.id)
      }];
    }
    case "row.set-layout":
      return [{ type: "row.set-layout", rowId: operation.rowId, layout: clone(requireRow(before, operation.rowId).row.layout) }];
    case "block.insert":
      return [{ type: "block.delete", blockId: operation.block.id }];
    case "block.delete": {
      const location = requireBlock(before, operation.blockId);
      if (location.row.blocks.length === 1) {
        const owner = findOutermostBlockForRows(before, location.rows);
        if (owner) return restoreBlocks([owner]);
        return [{
          type: "row.insert",
          row: clone(location.row),
          afterRowId: previousId(location.rows, location.index, (row) => row.id)
        }];
      }
      return [{
        type: "block.insert",
        block: clone(location.block),
        placement: {
          kind: "in-row",
          rowId: location.row.id,
          afterBlockId: previousId(location.row.blocks, location.blockIndex, (block) => block.id),
          widthUnits: location.row.layout.tracks[location.blockIndex].widthUnits
        }
      }];
    }
    case "block.move": {
      const location = requireBlock(before, operation.blockId);
      const destination = requireBlock(after, operation.blockId);
      const sourceOwner = findOutermostBlockForRows(before, location.rows);
      const destinationOwner = findOutermostBlockForRows(after, destination.rows);
      const sourceRowStillExists = Boolean(findRow(after, location.row.id));
      const placement: BlockPlacement = sourceRowStillExists
        ? {
            kind: "in-row",
            rowId: location.row.id,
            afterBlockId: previousId(location.row.blocks, location.blockIndex, (block) => block.id),
            widthUnits: location.row.layout.tracks[location.blockIndex].widthUnits
          }
        : {
            kind: "new-row",
            rowId: location.row.id,
            afterRowId: previousId(location.rows, location.index, (row) => row.id),
            layout: {
              blockGapTwips: location.row.layout.blockGapTwips,
              marginBeforeTwips: location.row.layout.marginBeforeTwips,
              marginAfterTwips: location.row.layout.marginAfterTwips
            },
            widthUnits: location.row.layout.tracks[location.blockIndex].widthUnits
          };
      const restoreSource: DocumentOperation = {
        type: "block.move",
        blockId: operation.blockId,
        placement
      };
      if (sourceOwner && destinationOwner) {
        return restoreBlocks(changedOutermostBlocks(before, after));
      }
      if (sourceOwner) {
        return [
          { type: "block.delete", blockId: operation.blockId },
          ...restoreBlocks([sourceOwner])
        ];
      }
      if (destinationOwner) {
        const originalDestination = findBlock(before, destinationOwner.id)?.block;
        if (!originalDestination) throw new DocumentOperationError("Block move inverse destination is unavailable");
        return [...restoreBlocks([originalDestination]), restoreSource];
      }
      return [restoreSource];
    }
    case "block.replace":
      return [{ type: "block.replace", blockId: operation.blockId, block: clone(requireBlock(before, operation.blockId).block) }];
    case "block.set-style":
      return [{ type: "block.set-style", blockId: operation.blockId, styleId: requireBlock(before, operation.blockId).block.styleId }];
    case "block.set-presentation":
      return [{
        type: "block.set-presentation",
        blockId: operation.blockId,
        presentation: clone(requireBlock(before, operation.blockId).block.presentation)
      }];
    case "prompt.apply-derived-output": {
      const block = requireBlock(before, operation.blockId).block;
      if (block.kind !== "prompt") throw new DocumentOperationError("Prompt inverse target changed kind");
      return [{ type: "prompt.apply-derived-output", blockId: block.id, output: clone(block.output) }];
    }
    case "list.insert-item":
      return [{ type: "list.delete-item", listId: operation.listId, itemId: operation.item.id }];
    case "list.delete-item": {
      const list = findList(before, operation.listId);
      const location = list ? findListItem(list, operation.itemId) : undefined;
      if (!list || !location) throw new DocumentOperationError("List inverse target not found");
      return [{
        type: "list.insert-item",
        listId: operation.listId,
        parentItemId: parentItemId(list.items, location.items),
        item: clone(location.item),
        afterItemId: previousId(location.items, location.index, (item) => item.id)
      }];
    }
    case "list.move-item": {
      const list = findList(before, operation.listId);
      const location = list ? findListItem(list, operation.itemId) : undefined;
      if (!list || !location) throw new DocumentOperationError("List inverse target not found");
      return [{
        type: "list.move-item",
        listId: operation.listId,
        itemId: operation.itemId,
        parentItemId: parentItemId(list.items, location.items),
        afterItemId: previousId(location.items, location.index, (item) => item.id)
      }];
    }
    case "list.set-checked": {
      const list = findList(before, operation.listId);
      const location = list ? findListItem(list, operation.itemId) : undefined;
      if (!location) throw new DocumentOperationError("List inverse target not found");
      return [{ type: "list.set-checked", listId: operation.listId, itemId: operation.itemId, checked: Boolean(location.item.checked) }];
    }
    case "table.insert-row":
      return [{ type: "table.delete-row", tableId: operation.tableId, rowId: operation.row.id }];
    case "table.delete-row": {
      const table = findTable(before, operation.tableId);
      const index = table?.rows.findIndex((row) => row.id === operation.rowId) ?? -1;
      if (!table || index < 0) throw new DocumentOperationError("Table inverse row not found");
      const removedCellIds = new Set(
        table.cells.filter((cell) => cell.rowId === operation.rowId).map((cell) => cell.id)
      );
      const removedMerges = table.merges.filter((merge) =>
        removedCellIds.has(merge.rootCellId) ||
        merge.coveredCellIds.some((cellId) => removedCellIds.has(cellId)));
      return [{
        type: "table.insert-row",
        tableId: operation.tableId,
        row: clone(table.rows[index]),
        cells: clone(table.cells.filter((cell) => cell.rowId === operation.rowId)),
        afterRowId: previousId(table.rows, index, (row) => row.id)
      }, ...removedMerges.map((merge): DocumentOperation => ({
        type: "table.merge",
        tableId: operation.tableId,
        merge: clone(merge)
      }))];
    }
    case "table.move-row": {
      const table = findTable(before, operation.tableId);
      const index = table?.rows.findIndex((row) => row.id === operation.rowId) ?? -1;
      if (!table || index < 0) throw new DocumentOperationError("Table inverse row not found");
      return [{ type: "table.move-row", tableId: operation.tableId, rowId: operation.rowId, afterRowId: previousId(table.rows, index, (row) => row.id) }];
    }
    case "table.insert-column":
      return [{ type: "table.delete-column", tableId: operation.tableId, columnId: operation.column.id }];
    case "table.delete-column": {
      const table = findTable(before, operation.tableId);
      const index = table?.columns.findIndex((column) => column.id === operation.columnId) ?? -1;
      if (!table || index < 0) throw new DocumentOperationError("Table inverse column not found");
      const removedCellIds = new Set(
        table.cells.filter((cell) => cell.columnId === operation.columnId).map((cell) => cell.id)
      );
      const removedMerges = table.merges.filter((merge) =>
        removedCellIds.has(merge.rootCellId) ||
        merge.coveredCellIds.some((cellId) => removedCellIds.has(cellId)));
      return [{
        type: "table.insert-column",
        tableId: operation.tableId,
        column: clone(table.columns[index]),
        cells: clone(table.cells.filter((cell) => cell.columnId === operation.columnId)),
        afterColumnId: previousId(table.columns, index, (column) => column.id)
      }, ...removedMerges.map((merge): DocumentOperation => ({
        type: "table.merge",
        tableId: operation.tableId,
        merge: clone(merge)
      }))];
    }
    case "table.move-column": {
      const table = findTable(before, operation.tableId);
      const index = table?.columns.findIndex((column) => column.id === operation.columnId) ?? -1;
      if (!table || index < 0) throw new DocumentOperationError("Table inverse column not found");
      return [{ type: "table.move-column", tableId: operation.tableId, columnId: operation.columnId, afterColumnId: previousId(table.columns, index, (column) => column.id) }];
    }
    case "table.merge":
      return [{ type: "table.unmerge", tableId: operation.tableId, mergeId: operation.merge.id }];
    case "table.unmerge": {
      const table = findTable(before, operation.tableId);
      const merge = table?.merges.find((candidate) => candidate.id === operation.mergeId);
      if (!merge) throw new DocumentOperationError("Table inverse merge not found");
      return [{ type: "table.merge", tableId: operation.tableId, merge: clone(merge) }];
    }
    case "image.set-source": {
      const block = requireBlock(before, operation.blockId).block;
      if (block.kind !== "image") throw new DocumentOperationError("Image inverse target changed kind");
      return [{ type: "image.set-source", blockId: block.id, source: clone(block.image.source) }];
    }
    case "image.set-accessibility": {
      const block = requireBlock(before, operation.blockId).block;
      if (block.kind !== "image") throw new DocumentOperationError("Image inverse target changed kind");
      return [{ type: "image.set-accessibility", blockId: block.id, alt: block.image.alt, decorative: block.image.decorative }];
    }
    case "visual.set-dimensions": {
      const block = requireBlock(before, operation.blockId).block;
      if (block.kind === "image") return [{ type: "visual.set-dimensions", blockId: block.id, dimensions: clone(block.image.dimensions) }];
      if (block.kind === "chart") return [{ type: "visual.set-dimensions", blockId: block.id, dimensions: clone(block.chart.dimensions) }];
      throw new DocumentOperationError("Visual inverse target changed kind");
    }
  }
};

const valueIds = (value: unknown): string[] => {
  const ids = new Set<string>();
  const visit = (value: unknown, key?: string): void => {
    if (typeof value === "string" && (key === "id" || key?.endsWith("Id"))) {
      ids.add(value);
      return;
    }
    if (Array.isArray(value)) {
      for (const item of value) visit(item);
      return;
    }
    if (value && typeof value === "object") {
      for (const [childKey, child] of Object.entries(value as Record<string, unknown>)) {
        visit(child, childKey);
      }
    }
  };
  visit(value);
  return [...ids];
};

const ROOT_ROWS_SENTINEL = "$document:rows";

const placementCreatesRootRow = (
  snapshot: DocumentSnapshot,
  placement: BlockPlacement
): boolean => {
  switch (placement.kind) {
    case "in-row":
      return false;
    case "new-row":
      return placement.afterRowId === undefined ||
        findRow(snapshot, placement.afterRowId)?.rows === snapshot.rows;
    case "after-block": {
      const anchor = findBlock(snapshot, placement.afterBlockId);
      return Boolean(
        anchor &&
        anchor.rows === snapshot.rows &&
        anchor.row.blocks.length === 1
      );
    }
    case "between-blocks": {
      const before = findBlock(snapshot, placement.beforeBlockId);
      const after = findBlock(snapshot, placement.afterBlockId);
      return Boolean(
        before &&
        after &&
        before.rows === snapshot.rows &&
        after.rows === snapshot.rows &&
        before.row !== after.row
      );
    }
  }
};

const operationIds = (
  snapshot: DocumentSnapshot,
  operation: DocumentOperation
): string[] => {
  const ids = new Set(valueIds(operation));
  const add = (value: unknown): void => {
    for (const id of valueIds(value)) ids.add(id);
  };

  switch (operation.type) {
    case "document.rename":
      ids.add("$document:title");
      break;
    case "document.set-lifecycle":
      ids.add("$document:lifecycle");
      break;
    case "layout.set-page":
      ids.add("$document:page-layout");
      break;
    case "style.set-default":
      ids.add(`$document:default-style:${operation.blockKind}`);
      break;
    case "context-variable.create":
    case "context-variable.update":
      // The *name* is a conflict footprint, not just the ID. Two concurrent
      // edits claiming one name touch disjoint IDs, so without this they would
      // both rebase cleanly and the loser would fail at apply time — a conflict
      // reported as a validation error, one layer too late.
      ids.add(`$document:context-variable-name:${normalizeVariableName(operation.variable.name)}`);
      break;
    case "style.delete": {
      for (const style of snapshot.styles.styles) {
        if (style.id === operation.styleId || style.basedOnStyleId === operation.styleId) {
          add(style);
        }
      }
      forEachBlock(snapshot, (block) => {
        if (block.styleId === operation.styleId) add(block);
      });
      break;
    }
    case "row.insert": {
      const destination = operation.afterRowId
        ? findRow(snapshot, operation.afterRowId)?.rows
        : snapshot.rows;
      if (destination === snapshot.rows) ids.add(ROOT_ROWS_SENTINEL);
      break;
    }
    case "row.delete":
    case "row.move": {
      const location = findRow(snapshot, operation.rowId);
      if (location) {
        add(location.row);
        if (location.rows === snapshot.rows) ids.add(ROOT_ROWS_SENTINEL);
      }
      if (operation.type === "row.move") {
        const destination = operation.afterRowId
          ? findRow(snapshot, operation.afterRowId)?.rows
          : snapshot.rows;
        if (destination === snapshot.rows) ids.add(ROOT_ROWS_SENTINEL);
      }
      break;
    }
    case "row.set-layout": {
      const location = findRow(snapshot, operation.rowId);
      if (location) add(location.row.blocks);
      break;
    }
    case "block.insert":
      if (placementCreatesRootRow(snapshot, operation.placement)) {
        ids.add(ROOT_ROWS_SENTINEL);
      }
      break;
    case "block.delete":
    case "block.move":
    case "block.replace": {
      const location = findBlock(snapshot, operation.blockId);
      if (location) {
        ids.add(location.row.id);
        add(location.block);
        if (
          operation.type !== "block.replace" &&
          location.rows === snapshot.rows &&
          location.row.blocks.length === 1
        ) {
          ids.add(ROOT_ROWS_SENTINEL);
        }
      }
      if (
        operation.type === "block.move" &&
        placementCreatesRootRow(snapshot, operation.placement)
      ) {
        ids.add(ROOT_ROWS_SENTINEL);
      }
      break;
    }
    case "list.delete-item":
    case "list.move-item": {
      const list = findList(snapshot, operation.listId);
      const location = list ? findListItem(list, operation.itemId) : undefined;
      if (location) add(location.item);
      break;
    }
    case "table.delete-row":
    case "table.move-row": {
      const table = findTable(snapshot, operation.tableId);
      if (table) {
        const cells = table.cells.filter((cell) => cell.rowId === operation.rowId);
        add(cells);
        const cellIds = new Set(cells.map((cell) => cell.id));
        add(table.merges.filter((merge) =>
          cellIds.has(merge.rootCellId) || merge.coveredCellIds.some((id) => cellIds.has(id))));
      }
      break;
    }
    case "table.delete-column":
    case "table.move-column": {
      const table = findTable(snapshot, operation.tableId);
      if (table) {
        const cells = table.cells.filter((cell) => cell.columnId === operation.columnId);
        add(cells);
        const cellIds = new Set(cells.map((cell) => cell.id));
        add(table.merges.filter((merge) =>
          cellIds.has(merge.rootCellId) || merge.coveredCellIds.some((id) => cellIds.has(id))));
      }
      break;
    }
    default:
      break;
  }
  return [...ids];
};

export const computeTouchedIds = (
  snapshot: DocumentSnapshot,
  operations: DocumentOperation[]
): string[] => [...new Set(operations.flatMap((operation) => operationIds(snapshot, operation)))].sort();

export const applyOperations = (
  source: DocumentSnapshot,
  operations: DocumentOperation[],
  richText: RichText,
  limits: DocumentLimits
): DocumentApplyResult => {
  let snapshot = clone(source);
  let inverse: DocumentOperation[] = [];
  const formulaChanges: FormulaAtomChange[] = [];
  for (const operation of operations) {
    const before = clone(snapshot);
    applyOne(snapshot, clone(operation), richText, formulaChanges);
    inverse = [...inverseFor(before, operation, snapshot), ...inverse];
  }
  const result = validateSnapshot(snapshot, richText, limits);
  if (!result.ok) throw new DocumentValidationError(result.diagnostics);
  const beforeFormulas = snapshotFormulaMap(source);
  const afterFormulas = snapshotFormulaMap(snapshot);
  const settledFormulaChanges: FormulaAtomChange[] = [];
  for (const [atomId, candidate] of afterFormulas) {
    const previous = beforeFormulas.get(atomId);
    if (!previous || previous.expression !== candidate.expression) {
      settledFormulaChanges.push({ atomId, ...candidate });
    }
  }
  return {
    snapshot,
    forward: clone(operations),
    inverse,
    touchedIds: computeTouchedIds(source, operations),
    formulaChanges: settledFormulaChanges
  };
};

export const applyWithoutValidation = (
  source: DocumentSnapshot,
  operations: DocumentOperation[],
  richText: RichText
): DocumentSnapshot => {
  const snapshot = clone(source);
  const formulaChanges: FormulaAtomChange[] = [];
  for (const operation of operations) applyOne(snapshot, clone(operation), richText, formulaChanges);
  return snapshot;
};
