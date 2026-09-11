import type { TemplateAnswers, TemplateDetail } from "$capabilities/templates/index.remote";
import { withFreshIds, type IdHint } from "$representation/data/behavior/templates/fresh-ids";
import {
  fillTemplateAtoms,
  resolveTemplateScopes
} from "$representation/data/behavior/templates/scopes";
import type { DocumentBody, DocumentRow } from "$representation/data/types/documents/body";
import type { DocumentOp } from "$representation/data/types/documents/op";
import { rowHolding } from "$app-views/categories/document-editor/procedures/blocks";
import { mint, type IdKind } from "$app-views/categories/document-editor/procedures/ids";
import { addressOf } from "$app-views/categories/document-editor/procedures/inspecting";
import type { Selection } from "$model/client/workspace-state";

export const currentRowId = (
  body: DocumentBody,
  selection: Selection | undefined
): string | null => {
  const blockId = selection === undefined ? undefined : addressOf(selection.id)?.blockId;
  const row = blockId === undefined ? undefined : rowHolding(body, blockId);
  return row?.id ?? body.rows.at(-1)?.id ?? null;
};

const HINT_KIND: Record<IdHint, IdKind> = {
  row: "row",
  block: "block",
  cell: "block",
  atom: "atom",
  mark: "mark",
  slide: "block",
  element: "block",
  layout: "block",
  section: "block"
};

const mintFor = (hint: IdHint): string => mint(HINT_KIND[hint]);

export type Insertion = {
  readonly ops: readonly DocumentOp[];
  readonly firstBlockId: string | undefined;
};

const firstBlockIn = (rows: readonly DocumentRow[]): string | undefined => {
  for (const row of rows) {
    if (row.kind === "blocks" && row.blocks.length > 0) return row.blocks[0].id;
  }
  return undefined;
};

export const insertionOf = (
  body: DocumentBody,
  template: TemplateDetail,
  afterRowId: string | null,
  mode: "resolve" | "keep",
  answers: TemplateAnswers = {},
  texts: Readonly<Record<string, string>> = {}
): Insertion => {
  if (template.body.resource !== "document") return { ops: [], firstBlockId: undefined };

  let source = template.body;
  if (mode === "resolve") {
    const resolved = resolveTemplateScopes(template.body, template.slots, answers);
    if (!resolved.accepted || resolved.body.resource !== "document") {
      return { ops: [], firstBlockId: undefined };
    }
    const filled = fillTemplateAtoms(resolved.body, texts);
    if (filled.resource !== "document") return { ops: [], firstBlockId: undefined };
    source = filled;
  }

  const rows = withFreshIds(source.rows, mintFor, "row");
  if (rows.length === 0) return { ops: [], firstBlockId: undefined };

  const ops: DocumentOp[] = [];
  const held = body.styles?.styles ?? {};
  for (const [key, style] of Object.entries(source.styles?.styles ?? {})) {
    if (key in held) continue;
    ops.push({ op: "insert", target: "document", path: "styles", ids: [key], after: null, values: [style] });
  }
  ops.push({
    op: "insert",
    target: "row",
    path: "rows",
    ids: rows.map((row) => row.id),
    after: afterRowId,
    values: rows
  });
  return { ops, firstBlockId: firstBlockIn(rows) };
};
