import assert from "node:assert/strict";
import { test } from "vitest";
import { renderDisplayContent } from "$rich-content/api/shared/render-display";
import type { RawContent } from "$rich-content/types/raw-content";

/**
 * Tier one: no database, no mock, no scope.
 *
 * The projection is a pure function of Raw Content, and this is the file where
 * that pays off — a case that would take four mutations to reach through the API
 * is three lines of literal content here.
 */
const content = (over: Partial<RawContent> = {}): RawContent => ({
  id: "content_1",
  version: 7,
  atoms: [{ id: "atom_1", kind: "text", text: "abcdef" }],
  marks: [],
  ...over
});

const range = (start: number, end: number) => ({
  start: { atomId: "atom_1", offset: start },
  end: { atomId: "atom_1", offset: end }
});

test("unformatted content is one segment carrying the default style", () => {
  const [segment] = renderDisplayContent(content()).lines[0]!.segments;

  assert.equal(segment?.text, "abcdef");
  assert.equal(segment?.style.bold, false);
  assert.equal(segment?.style.fontWeight, 400);
});

test("segments are cut at every offset where formatting changes", () => {
  const projection = renderDisplayContent(
    content({
      marks: [{ id: "mark_1", kind: "style", range: range(2, 4), properties: { bold: true } }]
    })
  );

  assert.deepEqual(
    projection.lines[0]!.segments.map(({ text, style }) => [text, style.bold]),
    [
      ["ab", false],
      ["cd", true],
      ["ef", false]
    ]
  );
});

test("a later mark wins where two overlap", () => {
  const projection = renderDisplayContent(
    content({
      marks: [
        { id: "mark_1", kind: "style", range: range(0, 6), properties: { fontSize: 1 } },
        { id: "mark_2", kind: "style", range: range(0, 6), properties: { fontSize: 3 } }
      ]
    })
  );

  assert.equal(projection.lines[0]!.segments[0]!.style.fontSize, 3);
});

test("ids embed the version, which is what makes a handle stale", () => {
  const first = renderDisplayContent(content({ version: 1 }));
  const second = renderDisplayContent(content({ version: 2 }));

  assert.ok(first.lines[0]!.id.includes(":1:"));
  assert.ok(second.lines[0]!.id.includes(":2:"));
  assert.notEqual(first.lines[0]!.segments[0]!.id, second.lines[0]!.segments[0]!.id);
});

test("a line break is a line boundary, and a trailing one leaves an empty line", () => {
  const projection = renderDisplayContent(
    content({
      atoms: [
        { id: "atom_1", kind: "text", text: "one" },
        { id: "atom_2", kind: "line-break" },
        { id: "atom_3", kind: "text", text: "two" },
        { id: "atom_4", kind: "line-break" },
        { id: "atom_5", kind: "text", text: "" }
      ]
    })
  );

  assert.deepEqual(
    projection.lines.map((line) => line.segments.map(({ text }) => text).join("")),
    ["one", "two", ""]
  );
});

test("duplicate link targets are reported once", () => {
  const projection = renderDisplayContent(
    content({
      marks: [
        {
          id: "mark_1",
          kind: "link",
          range: range(0, 6),
          targets: [{ kind: "url", href: "https://example.test" }]
        },
        {
          id: "mark_2",
          kind: "link",
          range: range(0, 6),
          targets: [{ kind: "url", href: "https://example.test" }]
        }
      ]
    })
  );

  assert.deepEqual(projection.lines[0]!.segments[0]!.links, [
    { kind: "url", href: "https://example.test" }
  ]);
});

test("an ordered list restarts only when the list id changes", () => {
  const lineAtoms = (index: number) => [
    { id: `atom_${index}`, kind: "text" as const, text: `line ${index}` },
    { id: `break_${index}`, kind: "line-break" as const }
  ];
  const item = (index: number, listId: string) => ({
    id: `mark_${index}`,
    kind: "list-item" as const,
    range: {
      start: { atomId: `atom_${index}`, offset: 0 },
      end: { atomId: `atom_${index}`, offset: 6 }
    },
    listId,
    presentation: { kind: "ordered" as const, start: 1, separator: ". " }
  });

  const projection = renderDisplayContent(
    content({
      atoms: [
        ...lineAtoms(1),
        ...lineAtoms(2),
        ...lineAtoms(3),
        { id: "atom_4", kind: "text", text: "" }
      ],
      marks: [item(1, "list_a"), item(2, "list_a"), item(3, "list_b")]
    })
  );

  assert.deepEqual(
    projection.lines.slice(0, 3).map((line) => line.list?.marker),
    ["1", "2", "1"]
  );
});
