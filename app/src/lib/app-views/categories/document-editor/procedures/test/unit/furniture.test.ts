import assert from "node:assert/strict";
import { test } from "vitest";
import { EditorState } from "prosemirror-state";
import type { TextBlock } from "$representation/data/types/content/content-block";
import type { DocumentBody, PageFurniture } from "$representation/data/types/documents/body";
import { applyOps, invertAll } from "$representation/data/behavior/documents/apply-ops";
import {
  FURNITURE,
  focusOfFurniture,
  furnitureDecorations,
  furnitureOf,
  furniturePlugin,
  pageNumberText,
  textOfFurniture
} from "$app-views/categories/document-editor/procedures/furniture";
import { bodyOf, docOf } from "$app-views/categories/document-editor/procedures/projection";
import { translate } from "$app-views/categories/document-editor/procedures/translate";

const text = (id: string, display: string): TextBlock => ({
  id,
  type: "text",
  variant: "paragraph",
  atoms: [{ id: `${id}-atom`, kind: "literal", text: display }],
  display,
  marks: []
});

const furniture = (display: string, over: Partial<PageFurniture> = {}): PageFurniture => ({
  rows: [{ id: "#fr1", kind: "blocks", blocks: [text("#fblock1", display)] }],
  distanceFromEdge: 0.4,
  ...over
});

const words = (count: number): string => Array.from({ length: count }, () => "word").join(" ");

test("page numbers count from where they start and can skip the first page", () => {
  assert.equal(pageNumberText(undefined, 0), undefined);
  assert.equal(pageNumberText({ position: "center" }, 0), "1");
  assert.equal(pageNumberText({ position: "center", startAt: 4 }, 2), "6");
  assert.equal(pageNumberText({ position: "center", hideOnFirstPage: true }, 0), undefined);
  assert.equal(pageNumberText({ position: "center", hideOnFirstPage: true }, 1), "1");
  assert.equal(pageNumberText({ position: "center", startAt: 4, hideOnFirstPage: true }, 2), "5");
});

test("furniture text is its rows, with the first page's own rows when it has them", () => {
  const held = furniture("Every page", {
    firstPageRows: [{ id: "#firstrow", kind: "blocks", blocks: [text("#fblockfirst", "Title page")] }]
  });

  assert.equal(textOfFurniture(held, 0), "Title page");
  assert.equal(textOfFurniture(held, 1), "Every page");
});

test("the first page owns canonical furniture and later pages get read-only projections", () => {
  const body: DocumentBody = {
    rows: [
      { id: "#r1", kind: "blocks", blocks: [text("#b1", words(80))] },
      { id: "#r2", kind: "blocks", blocks: [text("#b2", words(80))] }
    ],
    header: furniture("Brief"),
    footer: furniture("", { pageNumber: { position: "end" } })
  };
  const doc = docOf(body, { charactersPerLine: 40, linesPerPage: 8 });
  const state = EditorState.create({ doc, plugins: [furniturePlugin(() => furnitureOf(body))] });

  assert.equal(doc.childCount, 2, "two pages");
  assert.equal(doc.firstChild?.children.filter((node) => node.type.name === "furniture_header").length, 1);
  assert.equal(doc.firstChild?.children.filter((node) => node.type.name === "furniture_footer").length, 1);
  assert.equal(doc.lastChild?.children.filter((node) => node.type.name.startsWith("furniture_")).length, 0);
  const found = furnitureDecorations(state).find();
  assert.equal(found.length, 3, "first-page number plus both projections on page two");
  assert.deepEqual(FURNITURE.getState(state)?.header?.rows[0].id, "#fr1");
});

test("furniture exposes a structural address for the shared inspector", () => {
  assert.deepEqual(focusOfFurniture(furniture("Brief")), {
    blockId: "#fblock1",
    address: "#fblock1/atoms/#fblock1-atom@0"
  });
});

test("canonical furniture round-trips through the same document projection", () => {
  const body: DocumentBody = {
    rows: [{ id: "#r1", kind: "blocks", blocks: [text("#b1", "Body")] }],
    header: furniture("Shared header"),
    footer: furniture("Shared footer")
  };

  const projected = docOf(body, { charactersPerLine: 72, linesPerPage: 40 });
  assert.deepEqual(bodyOf(projected, body), body);
});

test("a header edit translates to ops rooted at header/rows and round-trips", () => {
  const before: DocumentBody = { rows: [], header: furniture("Brief") };
  const next: DocumentBody = {
    ...before,
    header: {
      ...before.header!,
      rows: [
        ...before.header!.rows,
        { id: "#fr2", kind: "blocks", blocks: [text("#fblock2", "Second line")] }
      ]
    }
  };

  const ops = translate(before, next);
  assert.deepEqual(ops.map((op) => [op.op, op.path]), [["insert", "header/rows"]]);

  const after = applyOps(before, ops);
  assert.equal(after.header?.rows.length, 2);
  assert.deepEqual(applyOps(after, invertAll(ops)), before);
});

test("typing in the header is an atom op the applier finds inside the header", () => {
  const before: DocumentBody = { rows: [], header: furniture("Brief") };
  const next: DocumentBody = {
    ...before,
    header: {
      ...before.header!,
      rows: [
        { ...before.header!.rows[0], kind: "blocks", blocks: [text("#fblock1", "Briefing")] }
      ]
    }
  };

  const ops = translate(before, next);
  assert.equal(ops[0].op, "text");

  const after = applyOps(before, ops);
  const block = after.header?.rows[0].kind === "blocks" ? after.header.rows[0].blocks[0] : undefined;
  assert.equal(block?.type === "text" && block.display, "Briefing");
});
