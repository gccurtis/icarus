import assert from "node:assert/strict";
import { test } from "vitest";
import { EditorState } from "prosemirror-state";

import type { TextBlock } from "$representation/data/types/content/content-block";
import type { DocumentBody, PageFurniture } from "$representation/data/types/documents/body";
import {
  PAGE_NUMBERS,
  pageNumberDecorations,
  pageNumberText,
  pageNumbersOf,
  pageNumbersPlugin
} from "$app-views/categories/document-editor/procedures/page-numbers";
import { docOf } from "$app-views/categories/document-editor/procedures/projection";

const text = (id: string, display: string): TextBlock => ({
  id,
  type: "text",
  variant: "paragraph",
  atoms: [{ id: `${id}-atom`, kind: "literal", text: display }],
  display,
  marks: []
});

const host = (edge: "header" | "footer", display = "Reserved furniture content"): PageFurniture => ({
  rows: [
    {
      id: `#${edge}-row`,
      kind: "blocks",
      blocks: [text(`#${edge}-block`, display)]
    }
  ],
  distanceFromEdge: 0.4,
  pageNumber: { position: "end" }
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

test("represented page furniture determines only the page-number edge", () => {
  assert.equal(pageNumbersOf({ rows: [], footer: host("footer") }).placement?.edge, "bottom");
  assert.equal(pageNumbersOf({ rows: [], header: host("header") }).placement?.edge, "top");
  assert.deepEqual(pageNumbersOf({ rows: [] }), {});
});

test("the plugin projects page numbers without projecting host content", () => {
  const body: DocumentBody = {
    rows: [
      { id: "#r1", kind: "blocks", blocks: [text("#b1", words(80))] },
      { id: "#r2", kind: "blocks", blocks: [text("#b2", words(80))] }
    ],
    footer: host("footer")
  };
  const doc = docOf(body, { charactersPerLine: 40, linesPerPage: 8 });
  const state = EditorState.create({
    doc,
    plugins: [pageNumbersPlugin(() => pageNumbersOf(body))]
  });

  assert.equal(doc.childCount, 2);
  assert.equal(doc.textContent.includes("Reserved furniture content"), false);
  assert.equal(pageNumberDecorations(state).find().length, 2);
  assert.equal(PAGE_NUMBERS.getState(state)?.placement?.numbering.position, "end");
});
