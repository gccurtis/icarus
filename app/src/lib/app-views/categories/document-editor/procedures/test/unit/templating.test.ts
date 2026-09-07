import assert from "node:assert/strict";
import { test } from "vitest";
import type { DocumentBody } from "$representation/data/types/documents/body";
import { applyOps, invertAll } from "$representation/data/behavior/documents/apply-ops";
import type { TemplateDetail } from "$capabilities/templates/index.remote";
import {
  answerFrom,
  answerOptions,
  answersFrom,
  currentRowId,
  defaultChoices,
  insertionOf,
  isWholeProject,
  kindsOf,
  mergedVariables,
  ruleFrom,
  ruleOf,
  setIdsOf,
  withVariableField
} from "$app-views/categories/document-editor/procedures/templating";

const text = (id: string, display: string, style?: string) => ({
  id,
  type: "text" as const,
  variant: "paragraph" as const,
  ...(style === undefined ? {} : { style }),
  atoms: [{ id: `${id}-a`, kind: "literal" as const, text: display }],
  display,
  marks: []
});

const held: DocumentBody = {
  rows: [
    { id: "r1", kind: "blocks", blocks: [text("b1", "One")] },
    { id: "r2", kind: "blocks", blocks: [text("b2", "Two")] }
  ]
};

const template: TemplateDetail = {
  id: "templates:1",
  name: "Brief",
  target: "document",
  availability: "personal",
  tags: [],
  createdByName: "Uma",
  revision: 1,
  updatedAt: 1,
  lastUsedAt: null,
  canEdit: true,
  canDelete: true,
  body: {
    resource: "document",
    styles: { defaultKey: "body", styles: { body: { name: "Body" }, title: { name: "Title", fontSize: 28 } } },
    rows: [
      { id: "t1", kind: "blocks", blocks: [text("tb1", "Heading", "title")] },
      {
        id: "t2",
        kind: "blocks",
        blocks: [
          {
            id: "tp1",
            type: "prompt",
            atoms: [{ id: "tp1-a", kind: "literal", text: "Sum up" }],
            display: "Sum up",
            marks: [],
            scope: { include: [{ select: "variable", name: "evidence" }], exclude: [] },
            state: "idle"
          }
        ]
      }
    ]
  },
  variables: [{ name: "evidence", label: "Evidence", default: { include: [{ select: "kinds", kinds: ["finding"] }], exclude: [] } }]
};

test("an insertion lands after the row holding the caret, or at the end", () => {
  assert.equal(currentRowId(held, { kind: "next-letter", id: "b1/atoms/b1-a@0" }), "r1");
  assert.equal(currentRowId(held, undefined), "r2");
  assert.equal(currentRowId({ rows: [] }, undefined), null);
});

test("inserting into a document resolves prompts, mints ids, and brings missing styles", () => {
  const body: DocumentBody = { ...held, styles: { defaultKey: "body", styles: { body: { name: "Body" } } } };
  const insertion = insertionOf(body, template, "r1", "resolve");
  const after = applyOps(body, insertion.ops);
  assert.deepEqual(after.rows.map((row) => row.id)[0], "r1");
  assert.equal(after.rows.length, 4);
  assert.notEqual(after.rows[1].id, "t1");
  assert.ok(after.rows[1].id.startsWith("#r"));
  const inserted = after.rows[2];
  if (inserted.kind !== "blocks" || inserted.blocks[0].type !== "prompt") throw new Error("prompt expected");
  assert.deepEqual(inserted.blocks[0].scope, { include: [{ select: "kinds", kinds: ["finding"] }], exclude: [] });
  assert.equal(insertion.firstBlockId, (after.rows[1] as { blocks: { id: string }[] }).blocks[0].id);
  assert.deepEqual(Object.keys(after.styles?.styles ?? {}), ["body", "title"]);
  assert.deepEqual(applyOps(after, invertAll(insertion.ops)), body);
});

test("inserting into a stage keeps variable terms", () => {
  const kept = insertionOf(held, template, null, "keep");
  const after = applyOps(held, kept.ops);
  const first = after.rows[1];
  if (first.kind !== "blocks" || first.blocks[0].type !== "prompt") throw new Error("prompt expected");
  assert.deepEqual(first.blocks[0].scope, { include: [{ select: "variable", name: "evidence" }], exclude: [] });
});

test("a variable without a default resolves to the whole project on insert", () => {
  const insertion = insertionOf(held, { ...template, variables: [{ name: "evidence", label: "Evidence" }] }, "r2", "resolve");
  const after = applyOps(held, insertion.ops);
  const row = after.rows[3];
  if (row.kind !== "blocks" || row.blocks[0].type !== "prompt") throw new Error("prompt expected");
  assert.deepEqual(row.blocks[0].scope, { include: [{ select: "project" }], exclude: [] });
});

test("variables are edited by name and merged without repeats", () => {
  const declared = [{ name: "incident_evidence", label: "Incident evidence" }];

  const described = withVariableField(declared, "incident_evidence", { description: "  What happened  " });
  assert.equal(described[0].description, "What happened");
  const cleared = withVariableField(described, "incident_evidence", { description: "" });
  assert.equal("description" in cleared[0], false);
  const ruled = withVariableField(declared, "incident_evidence", { default: { include: [{ select: "project" }], exclude: [] } });
  assert.deepEqual(ruled[0].default, { include: [{ select: "project" }], exclude: [] });

  const merged = mergedVariables(declared, [{ name: "incident_evidence", label: "Other" }, { name: "models", label: "Models" }]);
  assert.deepEqual(merged.map((variable) => variable.name), ["incident_evidence", "models"]);
  assert.deepEqual(merged[0], declared[0]);
});

test("a default is read as prose and built from the modal's two choices", () => {
  assert.equal(ruleOf(undefined), "Everything in the project");
  assert.equal(isWholeProject(undefined), true);
  assert.deepEqual(kindsOf(undefined), []);
  assert.equal(ruleOf({ include: [{ select: "kinds", kinds: ["finding", "document"] }], exclude: [] }), "Findings, Documents");
  assert.equal(
    ruleOf({ include: [{ select: "project" }], exclude: [{ select: "kinds", kinds: ["slides"] }] }),
    "Everything in the project, minus Slide decks"
  );
  assert.equal(ruleOf({ include: [], exclude: [] }), "Nothing");
  assert.deepEqual(ruleFrom(true, ["finding"]), { include: [{ select: "project" }], exclude: [] });
  assert.deepEqual(ruleFrom(false, ["finding", "document"]), {
    include: [{ select: "kinds", kinds: ["finding", "document"] }],
    exclude: []
  });
  assert.deepEqual(kindsOf(ruleFrom(false, ["research"])), ["research"]);

  const names = new Map([["resourceSets:1", "Winter filings"]]);
  const named = ruleFrom(false, [], ["resourceSets:1"]);
  assert.deepEqual(named, { include: [{ select: "set", setId: "resourceSets:1" }], exclude: [] });
  assert.deepEqual(setIdsOf(named), ["resourceSets:1"]);
  assert.equal(ruleOf(named, names), "Winter filings");
  assert.equal(ruleOf(named), "A set that no longer exists");
  assert.equal(ruleOf(ruleFrom(false, ["finding"], ["resourceSets:1"]), names), "Findings and Winter filings");
});

test("inserting asks for each variable, offers the default first, and resolves the answers", () => {
  const sets = [
    { id: "resourceSets:1", name: "Winter filings", set: { include: [], exclude: [] }, createdByName: "Uma", revision: 1, updatedAt: 1, resolves: 3 }
  ];
  const options = answerOptions(template.variables[0], sets);
  assert.equal(options[0].value, "default");
  assert.equal(options[0].label, "Default · Findings");
  assert.deepEqual(options.slice(1, 3).map((option) => option.label), ["Everything in the project", "Only documents"]);
  assert.deepEqual(options.at(-1), { value: "set:resourceSets:1", label: "Winter filings" });

  assert.deepEqual(defaultChoices(template.variables), { evidence: "default" });
  assert.equal(answerFrom("default"), undefined);
  assert.deepEqual(answerFrom("kind:finding"), { include: [{ select: "kinds", kinds: ["finding"] }], exclude: [] });
  assert.deepEqual(answersFrom({ evidence: "default" }), {});

  const answers = answersFrom({ evidence: "set:resourceSets:1" });
  const insertion = insertionOf(held, template, "r2", "resolve", answers);
  const after = applyOps(held, insertion.ops);
  const row = after.rows[3];
  if (row.kind !== "blocks" || row.blocks[0].type !== "prompt") throw new Error("prompt expected");
  assert.deepEqual(row.blocks[0].scope, { include: [{ select: "set", setId: "resourceSets:1" }], exclude: [] });
});
