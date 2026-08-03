import assert from "node:assert/strict";
import test from "node:test";
import {
  createRichText,
  DEFAULT_CONFIG,
  type RichContent,
} from "../../src/0-platform/rich-text/index.js";
import {
  createBlankSnapshot,
} from "../../src/3-capabilities/document/application/createService.js";
import { canonicalizeSnapshot } from "../../src/3-capabilities/document/domain/canonical.js";
import { digestFormulaExpression } from "../../src/3-capabilities/document/domain/canonical.js";
import {
  DocumentOperationError,
  DocumentUnboundContextVariableError,
  DocumentValidationError,
} from "../../src/3-capabilities/document/domain/errors.js";
import {
  computeAssignedBlockWidth,
  computeUsablePageHeight,
  computeUsablePageWidth,
} from "../../src/3-capabilities/document/domain/layout.js";
import {
  collectDocumentIdentities,
  computeDocumentIdentityTransitions,
  type DocumentIdentity,
} from "../../src/3-capabilities/document/domain/identities.js";
import type {
  DocumentBlock,
  DocumentChangeSet,
  DocumentLimits,
  DocumentOperation,
  DocumentRow,
  DocumentSnapshot,
  PromptContext,
  TextBlock,
} from "../../src/3-capabilities/document/domain/model.js";
import {
  applyOperations,
  computeTouchedIds,
} from "../../src/3-capabilities/document/domain/reducer.js";
import { canRebase } from "../../src/3-capabilities/document/domain/rebase.js";
import { validateSnapshot } from "../../src/3-capabilities/document/domain/validation.js";
import { resolvePromptContext } from "../../src/3-capabilities/document/domain/reducer.js";
import { projectDocumentDependencies } from "../../src/3-capabilities/document/projections/dependencies.js";
import { projectDocumentOutline } from "../../src/3-capabilities/document/projections/outline.js";
import { projectDocumentPlainText } from "../../src/3-capabilities/document/projections/plainText.js";
import {
  projectDocumentBlockStyle,
  projectDocumentTextStyling,
} from "../../src/3-capabilities/document/projections/styling.js";
import { CapturingLogger } from "../helpers/testDoubles.js";

const NORMAL_STYLE = "document-style-normal";
const HEADING_1_STYLE = "document-style-heading-1";
const HEADING_3_STYLE = "document-style-heading-3";

const LIMITS: DocumentLimits = {
  maxRowsPerDocument: 100,
  maxBlocksPerRow: 10,
  maxStylesPerDocument: 100,
  maxNestingDepth: 12,
  maxAtomsPerBlockContent: 1_000,
  maxTableRows: 100,
  maxTableColumns: 50,
};

const richText = () => createRichText(DEFAULT_CONFIG, new CapturingLogger());

const content = (atomId: string, text: string): RichContent => ({
  atoms: [{ id: atomId, kind: "text", text }],
  marks: [],
});

const textBlock = (
  id: string,
  text: string,
  styleId = NORMAL_STYLE,
): TextBlock => ({
  id,
  kind: "text",
  styleId,
  content: content(`${id}-atom`, text),
});

const row = (
  id: string,
  blocks: DocumentBlock[],
  widths: number[] = blocks.map(() => 1),
): DocumentRow => ({
  id,
  blocks,
  layout: {
    blockGapTwips: 0,
    marginBeforeTwips: 0,
    marginAfterTwips: 0,
    tracks: blocks.map((block, index) => ({
      blockId: block.id,
      widthUnits: widths[index] ?? 1,
    })),
  },
});

const snapshotWithRows = (...rows: DocumentRow[]): DocumentSnapshot => ({
  ...createBlankSnapshot({ title: "Domain test" }),
  rows,
});

test("page-layout helpers reserve margins and Row gaps before assigning track widths", () => {
  const snapshot = snapshotWithRows();
  const layoutRow = row(
    "layout-row",
    [textBlock("narrow", "Narrow"), textBlock("wide", "Wide")],
    [1, 2],
  );
  layoutRow.layout.blockGapTwips = 360;

  assert.equal(computeUsablePageWidth(snapshot.pageLayout), 9_360);
  assert.equal(computeUsablePageHeight(snapshot.pageLayout), 12_960);
  assert.equal(computeAssignedBlockWidth(layoutRow, "narrow", 9_360), 3_000);
  assert.equal(computeAssignedBlockWidth(layoutRow, "wide", 9_360), 6_000);
  assert.throws(
    () => computeAssignedBlockWidth(layoutRow, "missing", 9_360),
    /Block is not in Row/,
  );
});

test("Row gaps must leave positive width in the page or known nested container", () => {
  const runtime = richText();
  const pageWidth = computeUsablePageWidth(snapshotWithRows().pageLayout);
  const root = row(
    "invalid-root",
    [textBlock("root-a", "A"), textBlock("root-b", "B")],
  );
  root.layout.blockGapTwips = pageWidth;

  assert.throws(
    () => applyOperations(snapshotWithRows(), [{ type: "row.insert", row: root }], runtime, LIMITS),
    (error) => error instanceof DocumentValidationError &&
      error.diagnostics.some((item) => /Block gaps must leave positive container width/.test(item)),
  );

  const nested = row(
    "invalid-nested",
    [textBlock("nested-a", "A"), textBlock("nested-b", "B")],
  );
  nested.layout.blockGapTwips = 4_680;
  const callout: DocumentBlock = {
    id: "narrow-callout",
    kind: "callout",
    styleId: NORMAL_STYLE,
    tone: "info",
    rows: [nested],
  };
  const sibling = textBlock("callout-sibling", "Sibling");

  assert.throws(
    () => applyOperations(
      snapshotWithRows(),
      [{ type: "row.insert", row: row("outer", [callout, sibling]) }],
      runtime,
      LIMITS,
    ),
    (error) => error instanceof DocumentValidationError &&
      error.diagnostics.some((item) => /invalid-nested Block gaps/.test(item)),
  );
});

test("identity collection recursively covers every retained-history identity kind", () => {
  const markedContent: RichContent = {
    atoms: [{ id: "deep-atom", kind: "text", text: "Deep" }],
    marks: [{
      id: "deep-mark",
      kind: "bold",
      range: {
        start: { atomId: "deep-atom", offset: 0 },
        end: { atomId: "deep-atom", offset: 4 },
      },
    }],
  };
  const deepBlock: TextBlock = {
    id: "deep-block",
    kind: "text",
    styleId: NORMAL_STYLE,
    content: markedContent,
  };
  const table: DocumentBlock = {
    id: "table-block",
    kind: "table",
    styleId: NORMAL_STYLE,
    table: {
      id: "table",
      columns: [
        { id: "table-column", width: { kind: "auto" } },
        { id: "covered-column", width: { kind: "auto" } },
      ],
      rows: [{ id: "table-axis-row", header: false }],
      cells: [
        {
          id: "table-cell",
          rowId: "table-axis-row",
          columnId: "table-column",
          rows: [row("table-content-row", [deepBlock])],
          verticalAlign: "top",
        },
        {
          id: "covered-cell",
          rowId: "table-axis-row",
          columnId: "covered-column",
          rows: [],
          verticalAlign: "top",
        },
      ],
      merges: [{
        id: "table-merge",
        rootCellId: "table-cell",
        coveredCellIds: ["covered-cell"],
      }],
    },
  };
  const list: DocumentBlock = {
    id: "list-block",
    kind: "list",
    styleId: NORMAL_STYLE,
    list: {
      id: "list",
      listKind: "bulleted",
      items: [{
        id: "list-item",
        rows: [row("list-item-row", [table])],
        children: [{
          id: "child-list-item",
          rows: [row("child-item-row", [textBlock("child-block", "Child")])],
          children: [],
        }],
      }],
    },
  };
  const snapshot = snapshotWithRows(row("root-row", [{
    id: "callout-block",
    kind: "callout",
    styleId: NORMAL_STYLE,
    tone: "info",
    rows: [row("callout-row", [list])],
  }]));

  const identities = collectDocumentIdentities(snapshot);
  const expectedSubset: DocumentIdentity[] = [
    { kind: "row", id: "root-row" },
    { kind: "block", id: "callout-block" },
    { kind: "row", id: "callout-row" },
    { kind: "block", id: "list-block" },
    { kind: "list", id: "list" },
    { kind: "list-item", id: "list-item" },
    { kind: "list-item", id: "child-list-item" },
    { kind: "table", id: "table" },
    { kind: "table-row", id: "table-axis-row" },
    { kind: "table-column", id: "table-column" },
    { kind: "table-cell", id: "table-cell" },
    { kind: "table-merge", id: "table-merge" },
    { kind: "rich-text-atom", id: "deep-atom" },
    { kind: "rich-text-mark", id: "deep-mark" },
  ];

  for (const expected of expectedSubset) {
    assert.ok(identities.some((identity) =>
      identity.kind === expected.kind && identity.id === expected.id));
  }
  assert.equal(
    identities.some((identity) => identity.id === "document-style-heading-1" && identity.kind === "style"),
    true,
  );
  assert.deepEqual(
    identities,
    [...identities].sort((left, right) => {
      if (left.id !== right.id) return left.id < right.id ? -1 : 1;
      if (left.kind !== right.kind) return left.kind < right.kind ? -1 : 1;
      return 0;
    }),
  );
});

test("identity transitions expose recursive deletion and later reintroduction", () => {
  const nestedBlock = textBlock("nested-identity-block", "Nested");
  const source = snapshotWithRows(row("identity-row", [{
    id: "identity-list-block",
    kind: "list",
    styleId: NORMAL_STYLE,
    list: {
      id: "identity-list",
      listKind: "bulleted",
      items: [{
        id: "identity-item",
        rows: [row("identity-item-row", [nestedBlock])],
        children: [],
      }],
    },
  }]));
  const deleted = structuredClone(source);
  deleted.rows = [];

  const removal = computeDocumentIdentityTransitions(source, deleted);
  assert.deepEqual(removal.added, []);
  assert.deepEqual(removal.removed, [
    { kind: "list-item", id: "identity-item" },
    { kind: "row", id: "identity-item-row" },
    { kind: "list", id: "identity-list" },
    { kind: "block", id: "identity-list-block" },
    { kind: "row", id: "identity-row" },
    { kind: "block", id: "nested-identity-block" },
    { kind: "rich-text-atom", id: "nested-identity-block-atom" },
  ]);

  const reintroduced = computeDocumentIdentityTransitions(deleted, source);
  assert.deepEqual(reintroduced.added, removal.removed);
  assert.deepEqual(reintroduced.removed, []);
});

test("Block placement is deterministic and deleting a Row's final Block removes the Row", () => {
  const runtime = richText();
  const source = snapshotWithRows(
    row("row-a", [textBlock("a", "A")], [2]),
    row("row-bc", [textBlock("b", "B"), textBlock("c", "C")], [1, 2]),
  );
  const operations: DocumentOperation[] = [
    {
      type: "block.insert",
      block: textBlock("x", "X"),
      placement: {
        kind: "after-block",
        afterBlockId: "a",
        newRowId: "row-x",
        widthUnits: 3,
      },
    },
    {
      type: "block.insert",
      block: textBlock("y", "Y"),
      placement: {
        kind: "after-block",
        afterBlockId: "b",
        widthUnits: 4,
      },
    },
    { type: "block.delete", blockId: "a" },
  ];

  const first = applyOperations(source, operations, runtime, LIMITS);
  const second = applyOperations(source, operations, runtime, LIMITS);

  assert.deepEqual(
    canonicalizeSnapshot(first.snapshot),
    canonicalizeSnapshot(second.snapshot),
  );
  assert.deepEqual(first.snapshot.rows.map((item) => item.id), ["row-x", "row-bc"]);
  assert.deepEqual(first.snapshot.rows[0]?.blocks.map((block) => block.id), ["x"]);
  assert.deepEqual(first.snapshot.rows[0]?.layout.tracks, [
    { blockId: "x", widthUnits: 3 },
  ]);
  assert.deepEqual(first.snapshot.rows[1]?.blocks.map((block) => block.id), ["b", "y", "c"]);
  assert.deepEqual(first.snapshot.rows[1]?.layout.tracks, [
    { blockId: "b", widthUnits: 1 },
    { blockId: "y", widthUnits: 4 },
    { blockId: "c", widthUnits: 2 },
  ]);
  assert.equal(source.rows[0]?.blocks[0]?.id, "a", "the reducer must not mutate its source");

  const restored = applyOperations(first.snapshot, first.inverse, runtime, LIMITS);
  assert.deepEqual(canonicalizeSnapshot(restored.snapshot), canonicalizeSnapshot(source));
});

test("Block move resolves placement before removing its source", () => {
  const runtime = richText();
  const source = snapshotWithRows(
    row("shared-row", [textBlock("a", "A"), textBlock("b", "B")], [3, 2]),
  );
  const applied = applyOperations(source, [{
    type: "block.move",
    blockId: "a",
    placement: { kind: "after-block", afterBlockId: "b" },
  }], runtime, LIMITS);

  assert.deepEqual(applied.snapshot.rows.map((candidate) => candidate.id), ["shared-row"]);
  assert.deepEqual(applied.snapshot.rows[0]?.blocks.map((block) => block.id), ["b", "a"]);
  assert.deepEqual(applied.snapshot.rows[0]?.layout.tracks, [
    { blockId: "b", widthUnits: 2 },
    { blockId: "a", widthUnits: 3 },
  ]);
  const restored = applyOperations(applied.snapshot, applied.inverse, runtime, LIMITS);
  assert.deepEqual(canonicalizeSnapshot(restored.snapshot), canonicalizeSnapshot(source));
});

test("protected heading roles survive visual edits and directly determine the outline", () => {
  const runtime = richText();
  const source = snapshotWithRows(
    row("heading-row", [textBlock("heading", "Architecture", HEADING_1_STYLE)]),
    row("body-row", [textBlock("body", "Body")]),
  );
  const headingStyle = source.styles.styles.find((style) => style.id === HEADING_1_STYLE);
  assert.ok(headingStyle);

  const updated = applyOperations(source, [{
    type: "style.update",
    styleId: HEADING_1_STYLE,
    style: {
      ...structuredClone(headingStyle),
      name: "Project title",
      text: { ...headingStyle.text, color: "#123456", fontWeight: 800 },
    },
  }], runtime, LIMITS);

  assert.deepEqual(projectDocumentOutline(updated.snapshot, runtime), [{
    blockId: "heading",
    level: 1,
    text: "Architecture",
  }]);
  assert.equal(
    updated.snapshot.styles.styles.find((style) => style.id === HEADING_1_STYLE)?.name,
    "Project title",
  );

  assert.throws(
    () => applyOperations(source, [{
      type: "style.delete",
      styleId: HEADING_1_STYLE,
      replacementStyleId: NORMAL_STYLE,
    }], runtime, LIMITS),
    (error) => error instanceof DocumentOperationError && /protected heading Style/.test(error.message),
  );
  assert.throws(
    () => applyOperations(source, [{
      type: "style.update",
      styleId: HEADING_1_STYLE,
      style: { ...structuredClone(headingStyle), systemRole: "heading-2" },
    }], runtime, LIMITS),
    (error) => error instanceof DocumentOperationError && /role cannot be changed/.test(error.message),
  );
});

test("Block styling overlays kind default, selected Style, and presentation", () => {
  const source = snapshotWithRows();
  source.styles.styles.push({
    id: "emphasis",
    name: "Emphasis",
    text: { color: "#123456", italic: true },
    block: { spacingAfterTwips: 200 },
  });
  const block = textBlock("styled", "Styled", "emphasis");
  block.presentation = { alignment: "right", spacingAfterTwips: 400 };

  assert.deepEqual(projectDocumentBlockStyle(source, block), {
    text: {
      fontFamily: "system-ui, sans-serif",
      fontSize: 1,
      color: "#123456",
      italic: true,
    },
    block: {
      spacingAfterTwips: 400,
      alignment: "right",
    },
  });
});

test("text styling projects runtime defaults, Document overlays, presentation, and inline marks", () => {
  const runtime = createRichText({
    defaults: {
      ...DEFAULT_CONFIG.defaults,
      fontFamily: "runtime-default",
      fontWeight: 300,
      underline: false,
    },
    limits: DEFAULT_CONFIG.limits,
  }, new CapturingLogger());
  const source = snapshotWithRows();
  const normal = source.styles.styles.find((style) => style.id === NORMAL_STYLE);
  assert.ok(normal);
  normal.text = {
    fontFamily: "kind-default",
    fontSize: 1.1,
    color: "#111111",
  };
  normal.block = { alignment: "left", spacingAfterTwips: 100 };
  source.styles.styles.push({
    id: "selected-style",
    name: "Selected",
    text: { color: "#222222", italic: true },
    block: { alignment: "center", lineHeight: 1.4 },
  });
  const block = textBlock("styled-ranges", "abcdef", "selected-style");
  block.presentation = { alignment: "right" };
  block.content = {
    atoms: block.content.atoms,
    marks: [
      runtime.bold({
        start: { atomId: "styled-ranges-atom", offset: 0 },
        end: { atomId: "styled-ranges-atom", offset: 3 },
      }, "inline-bold"),
      runtime.style({ color: "#ff0000", backgroundColor: "#ffff00" }, {
        start: { atomId: "styled-ranges-atom", offset: 3 },
        end: { atomId: "styled-ranges-atom", offset: 6 },
      }, "inline-style"),
      runtime.link([{ kind: "url", href: "https://example.com" }], {
        start: { atomId: "styled-ranges-atom", offset: 0 },
        end: { atomId: "styled-ranges-atom", offset: 6 },
      }, "inline-link"),
    ],
  };

  const projected = projectDocumentTextStyling(source, block, runtime);

  assert.deepEqual(projected.block, {
    alignment: "right",
    spacingAfterTwips: 100,
    lineHeight: 1.4,
  });
  assert.equal(projected.text.ranges.length, 2);
  assert.deepEqual(projected.text.ranges[0]?.properties, {
    ...runtime.config.defaults,
    fontFamily: "kind-default",
    fontSize: 1.1,
    color: "#222222",
    italic: true,
    fontWeight: 700,
  });
  assert.deepEqual(projected.text.ranges[1]?.properties, {
    ...runtime.config.defaults,
    fontFamily: "kind-default",
    fontSize: 1.1,
    color: "#222222",
    italic: true,
    backgroundColor: "#ffff00",
  });
  assert.deepEqual(projected.text.ranges.map((range) => range.links), [
    [{ kind: "url", href: "https://example.com" }],
    [{ kind: "url", href: "https://example.com" }],
  ]);
  assert.equal(projected.text.plainText, "abcdef");
});

test("text styling follows atom and explicit layer order instead of opaque IDs", () => {
  const runtime = richText();
  const source = snapshotWithRows();
  const normal = source.styles.styles.find((style) => style.id === NORMAL_STYLE);
  assert.ok(normal);
  normal.text = { color: "#111111" };

  const block = textBlock("ordered-styling", "unused");
  const inlineRange = {
    start: { atomId: "a-middle", offset: 0 },
    end: { atomId: "m-last", offset: 1 },
  };
  block.content = {
    // Deliberately non-lexical IDs: document order is z, a, m.
    atoms: [
      { id: "z-first", kind: "text", text: "ab" },
      { id: "a-middle", kind: "text", text: "3" },
      { id: "m-last", kind: "text", text: "cd" },
    ],
    marks: [
      runtime.style({ backgroundColor: "#ff0000" }, inlineRange, "z-earlier-inline"),
      runtime.style({ backgroundColor: "#0000ff" }, inlineRange, "a-later-inline"),
    ],
  };

  const projected = projectDocumentTextStyling(source, block, runtime);
  const repeated = projectDocumentTextStyling(source, block, runtime);

  assert.deepEqual(projected, repeated);
  assert.deepEqual(projected.text.ranges.map((range) => range.range), [
    {
      start: { atomId: "z-first", offset: 0 },
      end: { atomId: "a-middle", offset: 0 },
    },
    inlineRange,
    {
      start: { atomId: "m-last", offset: 1 },
      end: { atomId: "m-last", offset: 2 },
    },
  ]);
  assert.deepEqual(projected.text.ranges.map((range) => ({
    color: range.properties.color,
    backgroundColor: range.properties.backgroundColor,
  })), [
    { color: "#111111", backgroundColor: "transparent" },
    { color: "#111111", backgroundColor: "#0000ff" },
    { color: "#111111", backgroundColor: "transparent" },
  ]);
  assert.equal(projected.text.plainText, "ab3cd");
});

test("Rich Text authoritative overlay cannot be reintroduced by a supplementary semantic mark", () => {
  const runtime = richText();
  const atoms: RichContent["atoms"] = [
    { id: "weight-atom", kind: "text", text: "weighted" },
  ];
  const range = {
    start: { atomId: "weight-atom", offset: 0 },
    end: { atomId: "weight-atom", offset: 8 },
  };
  const authoritative = runtime.style(
    { fontWeight: 400 },
    range,
    "z-authoritative-style",
  );
  const supplementary = runtime.bold(range, "a-supplementary-bold");

  const overlaid = runtime.overlayMarks(
    [authoritative],
    [supplementary],
    atoms,
  );

  assert.deepEqual(
    overlaid,
    runtime.overlayMarks([authoritative], [supplementary], atoms),
  );
  assert.equal(overlaid.some((mark) => mark.kind === "bold"), false);
  assert.equal(
    runtime.resolveStyling({ atoms, marks: overlaid }).ranges[0]?.properties.fontWeight,
    400,
  );
});

test("root Row membership and ordering operations share a conflict sentinel", () => {
  const source = snapshotWithRows(
    row("row-a", [textBlock("a", "A")]),
    row("row-b", [textBlock("b", "B")]),
  );
  const prepend = computeTouchedIds(source, [{
    type: "row.insert",
    row: row("row-prepend", [textBlock("prepend", "Prepend")]),
  }]);
  const move = computeTouchedIds(source, [{
    type: "row.move",
    rowId: "row-b",
  }]);

  assert.ok(prepend.includes("$document:rows"));
  assert.ok(move.includes("$document:rows"));
  assert.equal(
    canRebase(prepend, [{ touchedIds: move } as DocumentChangeSet]).allowed,
    false,
  );

  const callout: DocumentBlock = {
    id: "callout",
    kind: "callout",
    styleId: NORMAL_STYLE,
    tone: "info",
    rows: [row("nested-row", [textBlock("nested", "Nested")])],
  };
  const nestedSource = snapshotWithRows(row("root-row", [callout]));
  const nestedInsert = computeTouchedIds(nestedSource, [{
    type: "row.insert",
    row: row("nested-row-2", [textBlock("nested-2", "Nested 2")]),
    afterRowId: "nested-row",
  }]);
  assert.equal(nestedInsert.includes("$document:rows"), false);
});

test("nested structural deletion is exactly reversible and Callout ancestry stays protected", () => {
  const runtime = richText();
  const nested = textBlock("nested", "Nested");
  const callout: DocumentBlock = {
    id: "outer-callout",
    kind: "callout",
    styleId: NORMAL_STYLE,
    tone: "info",
    rows: [row("nested-row", [nested])],
  };
  const source = snapshotWithRows(row("root-row", [callout]));
  const deleted = applyOperations(source, [{
    type: "block.delete",
    blockId: nested.id,
  }], runtime, LIMITS);
  const restored = applyOperations(deleted.snapshot, deleted.inverse, runtime, LIMITS);
  assert.deepEqual(canonicalizeSnapshot(restored.snapshot), canonicalizeSnapshot(source));

  const innerCallout: DocumentBlock = {
    id: "inner-callout",
    kind: "callout",
    styleId: NORMAL_STYLE,
    tone: "warning",
    rows: [row("inner-callout-row", [textBlock("inner-text", "No")])],
  };
  const list: DocumentBlock = {
    id: "callout-list-block",
    kind: "list",
    styleId: NORMAL_STYLE,
    list: {
      id: "callout-list",
      listKind: "bulleted",
      items: [{
        id: "callout-list-item",
        rows: [row("callout-list-row", [innerCallout])],
        children: [],
      }],
    },
  };
  const invalid = structuredClone(source);
  const outer = invalid.rows[0]?.blocks[0];
  if (outer?.kind === "callout") outer.rows = [row("list-row", [list])];
  assert.throws(
    () => applyOperations(invalid, [], runtime, LIMITS),
    (error) => error instanceof DocumentValidationError && /nested Callout/.test(error.message),
  );
});

test("Formula discovery and conflict footprints include inserted content and semantic sentinels", () => {
  const runtime = richText();
  const source = snapshotWithRows();
  const formulaBlock: TextBlock = {
    id: "formula-block",
    kind: "text",
    styleId: NORMAL_STYLE,
    content: {
      atoms: [{ id: "formula-atom", kind: "formula", expression: "1 + 2" }],
      marks: [],
    },
  };
  const operation: DocumentOperation = {
    type: "block.insert",
    block: formulaBlock,
    placement: { kind: "new-row", rowId: "formula-row" },
  };
  const applied = applyOperations(source, [operation], runtime, LIMITS);
  assert.deepEqual(applied.formulaChanges, [{
    blockId: "formula-block",
    atomId: "formula-atom",
    expression: "1 + 2",
  }]);
  assert.ok(applied.touchedIds.includes("formula-atom"));
  assert.deepEqual(computeTouchedIds(source, [{ type: "document.rename", title: "Renamed" }]), [
    "$document:title",
  ]);
});

test("Table row and column compensation restores cells and rectangular merges exactly", () => {
  const runtime = richText();
  const table: DocumentBlock = {
    id: "table",
    kind: "table",
    styleId: NORMAL_STYLE,
    table: {
      id: "grid",
      rows: [
        { id: "r1", header: true },
        { id: "r2", header: false },
      ],
      columns: [
        { id: "c1", width: { kind: "auto" } },
        { id: "c2", width: { kind: "fixed", twips: 1_200 } },
      ],
      cells: [
        { id: "r1c1", rowId: "r1", columnId: "c1", rows: [], verticalAlign: "top" },
        { id: "r1c2", rowId: "r1", columnId: "c2", rows: [], verticalAlign: "top" },
        { id: "r2c1", rowId: "r2", columnId: "c1", rows: [], verticalAlign: "bottom" },
        { id: "r2c2", rowId: "r2", columnId: "c2", rows: [], verticalAlign: "bottom" },
      ],
      merges: [{ id: "header-merge", rootCellId: "r1c1", coveredCellIds: ["r1c2"] }],
    },
  };
  const source = snapshotWithRows(row("table-container", [table]));

  const rowDeleted = applyOperations(source, [{
    type: "table.delete-row",
    tableId: "grid",
    rowId: "r1",
  }], runtime, LIMITS);
  const rowRestored = applyOperations(rowDeleted.snapshot, rowDeleted.inverse, runtime, LIMITS);
  assert.deepEqual(canonicalizeSnapshot(rowRestored.snapshot), canonicalizeSnapshot(source));

  const columnDeleted = applyOperations(source, [{
    type: "table.delete-column",
    tableId: "grid",
    columnId: "c2",
  }], runtime, LIMITS);
  const columnRestored = applyOperations(columnDeleted.snapshot, columnDeleted.inverse, runtime, LIMITS);
  assert.deepEqual(canonicalizeSnapshot(columnRestored.snapshot), canonicalizeSnapshot(source));
});

test("projections traverse Rich Text nested through List items and Table cells", () => {
  const runtime = richText();
  const nestedHeading: TextBlock = {
    id: "nested-heading",
    kind: "text",
    styleId: HEADING_3_STYLE,
    content: {
      atoms: [
        { id: "nested-text", kind: "text", text: "Nested result: " },
        {
          id: "nested-formula",
          kind: "formula",
          expression: "1 + 1",
          acceptedValue: { kind: "number", numerator: "2", denominator: "1" },
          displayText: "2",
        },
      ],
      marks: [],
    },
  };
  const nestedPrompt: DocumentBlock = {
    id: "nested-prompt",
    kind: "prompt",
    styleId: NORMAL_STYLE,
    output: { outputId: "dedicated-output", appliedRevision: 4 },
  };
  const innerList: DocumentBlock = {
    id: "inner-list-block",
    kind: "list",
    styleId: NORMAL_STYLE,
    list: {
      id: "inner-list",
      listKind: "bulleted",
      items: [{
        id: "inner-item",
        rows: [row("inner-item-row", [nestedHeading, nestedPrompt], [3, 2])],
        children: [],
      }],
    },
  };
  const table: DocumentBlock = {
    id: "table-block",
    kind: "table",
    styleId: NORMAL_STYLE,
    table: {
      id: "nested-table",
      columns: [{ id: "column-1", width: { kind: "auto" } }],
      rows: [{ id: "table-row-1", header: false }],
      cells: [{
        id: "cell-1",
        rowId: "table-row-1",
        columnId: "column-1",
        rows: [row("cell-content-row", [innerList])],
        verticalAlign: "top",
      }],
      merges: [],
    },
  };
  const outerList: DocumentBlock = {
    id: "outer-list-block",
    kind: "list",
    styleId: NORMAL_STYLE,
    list: {
      id: "outer-list",
      listKind: "numbered",
      start: 1,
      items: [{
        id: "outer-item",
        rows: [row("outer-item-row", [table])],
        children: [],
      }],
    },
  };
  const source = snapshotWithRows(row("root-row", [outerList]));

  assert.doesNotThrow(() => applyOperations(source, [], runtime, LIMITS));
  assert.equal(projectDocumentPlainText(source, runtime), "Nested result: 2");
  assert.deepEqual(projectDocumentOutline(source, runtime), [{
    blockId: "nested-heading",
    level: 3,
    text: "Nested result: 2",
  }]);
  assert.deepEqual(projectDocumentDependencies(source), {
    promptOutputs: [{
      blockId: "nested-prompt",
      outputId: "dedicated-output",
      appliedRevision: 4,
    }],
    formulas: [{
      blockId: "nested-heading",
      atomId: "nested-formula",
      expressionDigest: digestFormulaExpression("1 + 1"),
    }],
  });
});

test("a Rich Text mutation has an exact Document-level inverse", () => {
  const runtime = richText();
  const source = snapshotWithRows(row("text-row", [textBlock("text", "hello")]));
  const applied = applyOperations(source, [{
    type: "rich-text.apply",
    blockId: "text",
    operations: [{
      type: "insert-text",
      at: { atomId: "text-atom", offset: 5 },
      text: " world",
    }],
  }], runtime, LIMITS);

  const changed = applied.snapshot.rows[0]?.blocks[0];
  assert.equal(changed?.kind === "text" ? runtime.plainText(changed.content.atoms) : undefined, "hello world");
  assert.equal(source.rows[0]?.blocks[0]?.kind === "text"
    ? runtime.plainText(source.rows[0].blocks[0].content.atoms)
    : undefined, "hello");
  assert.deepEqual(applied.formulaChanges, []);

  const restored = applyOperations(applied.snapshot, applied.inverse, runtime, LIMITS);
  assert.deepEqual(canonicalizeSnapshot(restored.snapshot), canonicalizeSnapshot(source));
});

test("Image and Chart dimensions are canonical, validated, and reversible", () => {
  const runtime = richText();
  const image: DocumentBlock = {
    id: "image",
    kind: "image",
    styleId: "document-style-visual",
    image: {
      source: {
        fileId: "file-1",
        version: "v1",
        digest: "sha256:image",
        mimeType: "image/png",
      },
      dimensions: {
        widthTwips: 2_400,
        heightTwips: 1_200,
        lockAspectRatio: true,
        horizontalAlign: "center",
      },
      alt: "Diagram",
      decorative: false,
      fit: "contain",
    },
  };
  const chart: DocumentBlock = {
    id: "chart",
    kind: "chart",
    styleId: "document-style-visual",
    chart: {
      source: "literal",
      specification: { series: [1, 2, 3] },
      dimensions: {
        widthTwips: 3_000,
        heightTwips: 1_500,
        lockAspectRatio: false,
        horizontalAlign: "left",
      },
      alt: "Trend",
    },
  };
  const source = snapshotWithRows(row("visual-row", [image, chart], [1, 1]));
  const operations: DocumentOperation[] = [
    {
      type: "visual.set-dimensions",
      blockId: "image",
      dimensions: {
        widthTwips: 4_800,
        heightTwips: 2_400,
        lockAspectRatio: true,
        horizontalAlign: "right",
      },
    },
    {
      type: "visual.set-dimensions",
      blockId: "chart",
      dimensions: {
        heightTwips: 2_000,
        lockAspectRatio: false,
        horizontalAlign: "stretch",
      },
    },
  ];

  const applied = applyOperations(source, operations, runtime, LIMITS);
  const changedImage = applied.snapshot.rows[0]?.blocks[0];
  const changedChart = applied.snapshot.rows[0]?.blocks[1];
  assert.deepEqual(changedImage?.kind === "image" ? changedImage.image.dimensions : undefined, {
    widthTwips: 4_800,
    heightTwips: 2_400,
    lockAspectRatio: true,
    horizontalAlign: "right",
  });
  assert.deepEqual(changedChart?.kind === "chart" ? changedChart.chart.dimensions : undefined, {
    heightTwips: 2_000,
    lockAspectRatio: false,
    horizontalAlign: "stretch",
  });

  const restored = applyOperations(applied.snapshot, applied.inverse, runtime, LIMITS);
  assert.deepEqual(canonicalizeSnapshot(restored.snapshot), canonicalizeSnapshot(source));
  assert.throws(
    () => applyOperations(source, [{
      type: "visual.set-dimensions",
      blockId: "image",
      dimensions: {
        heightTwips: 0,
        lockAspectRatio: true,
        horizontalAlign: "center",
      },
    }], runtime, LIMITS),
    (error) => error instanceof DocumentValidationError && /image image height/.test(error.message),
  );
});

test("a Prompt Block may be declared but never answered", async (t) => {
  const runtime = richText();
  const promptAt = (appliedRevision: number): DocumentSnapshot =>
    snapshotWithRows(row("prompt-row", [{
      id: "prompt-block",
      kind: "prompt",
      styleId: NORMAL_STYLE,
      output: { outputId: "output-1", appliedRevision },
    }]));

  await t.test("appliedRevision 0 is valid and means never answered", () => {
    // `declare` returns headRevision 0, and only a refresh moves it to 1. A
    // positive-only rule made "a prompt that has not run yet" unrepresentable,
    // which is the state every Prompt Block in a freshly duplicated Document is
    // in — so duplication could not produce a valid snapshot at all.
    const result = validateSnapshot(promptAt(0), runtime, LIMITS);
    assert.equal(result.ok, true, result.diagnostics.join("; "));
  });

  await t.test("an answered revision is still valid", () => {
    assert.equal(validateSnapshot(promptAt(3), runtime, LIMITS).ok, true);
  });

  await t.test("a negative or fractional revision is still refused", () => {
    for (const appliedRevision of [-1, 1.5]) {
      const result = validateSnapshot(promptAt(appliedRevision), runtime, LIMITS);
      assert.equal(result.ok, false);
      assert.ok(
        result.diagnostics.some((entry) => /invalid Derived Output reference/.test(entry)),
      );
    }
  });

  await t.test("applying revision 0 to a block is still refused", () => {
    // Relaxing the *snapshot* rule does not relax the *operation* rule.
    // `prompt.apply-derived-output` carries a generated revision, and revision 0
    // would mean un-answering a prompt, which is not a thing that happens.
    assert.throws(
      () => applyOperations(promptAt(1), [{
        type: "prompt.apply-derived-output",
        blockId: "prompt-block",
        output: { outputId: "output-1", appliedRevision: 0 },
      }], runtime, LIMITS),
      (error) => error instanceof DocumentOperationError
        && /revision must be positive/.test(error.message),
    );
  });
});

test("Context Variables are named parameters a Prompt Block can point at", async (t) => {
  const runtime = richText();
  const withVariables = (
    variables: Array<{ id: string; name: string; target?: { id: string; kind: string } }>,
    context: PromptContext = { kind: "direct", target: { id: "ctx-1", kind: "context" } },
  ): DocumentSnapshot => ({
    ...snapshotWithRows(row("prompt-row", [{
      id: "prompt-block",
      kind: "prompt",
      styleId: NORMAL_STYLE,
      context,
      output: { outputId: "output-1", appliedRevision: 0 },
    }])),
    contextVariables: variables,
  });

  await t.test("a variable is created, renamed, and rebound through one update", () => {
    const source = withVariables([]);
    const created = applyOperations(source, [{
      type: "context-variable.create",
      variable: { id: "var-1", name: "Region" },
    }], runtime, LIMITS);
    assert.deepEqual(created.snapshot.contextVariables, [{ id: "var-1", name: "Region" }]);

    // Rename and rebind are the same operation, so the inverse is one prior
    // value rather than a field-by-field diff.
    const updated = applyOperations(created.snapshot, [{
      type: "context-variable.update",
      variable: { id: "var-1", name: "Market", target: { id: "ctx-9", kind: "context" } },
    }], runtime, LIMITS);
    assert.deepEqual(updated.snapshot.contextVariables, [
      { id: "var-1", name: "Market", target: { id: "ctx-9", kind: "context" } },
    ]);

    const restored = applyOperations(updated.snapshot, updated.inverse, runtime, LIMITS);
    assert.deepEqual(
      canonicalizeSnapshot(restored.snapshot),
      canonicalizeSnapshot(created.snapshot),
    );
  });

  await t.test("names are unique case-insensitively, because bindings address them by name", () => {
    // Whoever writes a template binding cannot know the author's casing, so two
    // variables differing only in case would make that binding ambiguous.
    const source = applyOperations(withVariables([]), [{
      type: "context-variable.create",
      variable: { id: "var-1", name: "Region" },
    }], runtime, LIMITS).snapshot;

    assert.throws(
      () => applyOperations(source, [{
        type: "context-variable.create",
        variable: { id: "var-2", name: "  region  " },
      }], runtime, LIMITS),
      (error) => error instanceof DocumentOperationError && /name is taken/.test(error.message),
    );
  });

  await t.test("two edits claiming one name conflict at rebase, not at apply", () => {
    // Without the name in the footprint they would touch disjoint IDs, rebase
    // cleanly, and the loser would fail later as a validation error.
    const source = withVariables([]);
    const left = computeTouchedIds(source, [{
      type: "context-variable.create",
      variable: { id: "var-1", name: "Region" },
    }]);
    const right = computeTouchedIds(source, [{
      type: "context-variable.create",
      variable: { id: "var-2", name: "REGION" },
    }]);
    assert.ok(left.some((id) => right.includes(id)), "the shared name is a shared footprint");
  });

  await t.test("a referenced variable cannot be deleted", () => {
    // Refused rather than cascaded: re-pointing the Blocks is a decision only
    // the caller can make.
    const source = withVariables(
      [{ id: "var-1", name: "Region", target: { id: "ctx-1", kind: "context" } }],
      { kind: "variable", variableId: "var-1" },
    );
    assert.throws(
      () => applyOperations(source, [{
        type: "context-variable.delete",
        variableId: "var-1",
      }], runtime, LIMITS),
      (error) => error instanceof DocumentOperationError
        && /referenced by Prompt Blocks: prompt-block/.test(error.message),
    );

    // Re-point first, then delete.
    const repointed = applyOperations(source, [
      { type: "prompt.set-context", blockId: "prompt-block", context: { kind: "direct", target: { id: "ctx-2", kind: "context" } } },
      { type: "context-variable.delete", variableId: "var-1" },
    ], runtime, LIMITS);
    assert.deepEqual(repointed.snapshot.contextVariables, []);
  });

  await t.test("a Prompt Block cannot point at a variable that does not exist", () => {
    assert.throws(
      () => applyOperations(withVariables([]), [{
        type: "prompt.set-context",
        blockId: "prompt-block",
        context: { kind: "variable", variableId: "nope" },
      }], runtime, LIMITS),
      (error) => error instanceof DocumentOperationError
        && /Context Variable not found/.test(error.message),
    );
  });

  await t.test("resolution is one target in, one target out", () => {
    const direct = withVariables([]);
    assert.deepEqual(
      resolvePromptContext(direct, { kind: "direct", target: { id: "ctx-1", kind: "context" } }),
      [{ id: "ctx-1", kind: "context" }],
    );

    const bound = withVariables([
      { id: "var-1", name: "Region", target: { id: "ctx-7", kind: "context" } },
    ]);
    assert.deepEqual(
      resolvePromptContext(bound, { kind: "variable", variableId: "var-1" }),
      [{ id: "ctx-7", kind: "context" }],
    );
  });

  await t.test("an unbound variable refuses to resolve rather than grounding on everything", () => {
    // Resolving to [] would hand Knowledge the zero-length array it reads as
    // whole-project retrieval — a wrong answer instead of a refused one.
    const unbound = withVariables([{ id: "var-1", name: "Main topic" }]);
    assert.throws(
      () => resolvePromptContext(unbound, { kind: "variable", variableId: "var-1" }),
      (error) => error instanceof DocumentUnboundContextVariableError
        && error.variableName === "Main topic",
    );
  });

  await t.test("variable IDs join the non-reuse ledger", () => {
    // A Prompt Block addresses a variable by ID, so reusing a deleted one would
    // silently re-point a Block in retained history at a different variable.
    const identities = collectDocumentIdentities(
      withVariables([{ id: "var-1", name: "Region" }]),
    );
    assert.ok(identities.some((identity) =>
      identity.kind === "context-variable" && identity.id === "var-1"));
  });
});
