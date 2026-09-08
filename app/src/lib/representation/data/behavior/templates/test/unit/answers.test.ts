import { describe, expect, it } from "vitest";

import { answerRowsOf, missingIn } from "$representation/data/behavior/templates/answers";
import {
  fillTemplateAtoms,
  templateAtomNamesIn
} from "$representation/data/behavior/templates/scopes";
import type { TemplateBody, TemplateHole } from "$representation/data/types/templates/template";

const body = (): TemplateBody => ({
  resource: "document",
  rows: [
    {
      id: "r1",
      kind: "blocks",
      blocks: [
        {
          id: "b1",
          type: "text",
          variant: "paragraph",
          atoms: [
            { id: "a1", kind: "literal", text: "Dear " },
            { id: "a2", kind: "template", name: "recipient" },
            { id: "a3", kind: "literal", text: ", about " },
            { id: "a4", kind: "template", name: "subject" }
          ],
          display: "Dear {recipient}, about {subject}",
          marks: []
        }
      ]
    }
  ]
});

const blockOf = (held: TemplateBody) => {
  if (held.resource !== "document") throw new Error("a document was expected");
  const row = held.rows[0];
  if (row.kind !== "blocks") throw new Error("blocks were expected");
  return row.blocks[0] as { atoms: { kind: string; text?: string }[]; display: string };
};

describe("a template's text parameters", () => {
  it("are found from the atoms that ask for them", () => {
    expect(templateAtomNamesIn(body())).toEqual(["recipient", "subject"]);
  });

  it("become the words they were answered with, and the display follows", () => {
    const filled = blockOf(fillTemplateAtoms(body(), { recipient: "Ana", subject: "the winter packet" }));
    expect(filled.atoms.map((atom) => atom.kind)).toEqual(["literal", "literal", "literal", "literal"]);
    expect(filled.display).toBe("Dear Ana, about the winter packet");
  });

  it("are left alone when nobody answered, because a template is holes", () => {
    const held = blockOf(fillTemplateAtoms(body(), { recipient: "Ana" }));
    expect(held.atoms[3].kind).toBe("template");
    expect(held.display).toBe("Dear Ana, about {subject}");
  });
});

describe("what placing a template asks for", () => {
  const holes: TemplateHole[] = [
    {
      name: "evidence",
      label: "Evidence",
      description: "What it reads.",
      default: { include: [{ select: "kinds", kinds: ["finding"] }], exclude: [] }
    },
    { name: "subject", label: "Subject", kind: "text" }
  ];

  it("gives every parameter a row, and a scope always has a value", () => {
    const rows = answerRowsOf(holes, {}, {});
    expect(rows.map((row) => row.kind)).toEqual(["scope", "text"]);
    expect(rows[0].value).toBe("Findings");
    expect(rows[0].missing).toBe(false);
    expect(rows[0].answered).toBe(false);
  });

  it("starts a text parameter at its own default words", () => {
    const withWords = [{ name: "subject", label: "Subject", kind: "text" as const, text: "Winter" }];
    const rows = answerRowsOf(withWords, {}, {});
    expect(rows[0].value).toBe("Winter");
    expect(rows[0].missing).toBe(false);
    expect(rows[0].answered).toBe(false);
    expect(answerRowsOf(withWords, {}, { subject: "Spring" })[0].answered).toBe(true);
  });

  it("marks a text parameter missing until it has words", () => {
    expect(missingIn(answerRowsOf(holes, {}, {}))).toEqual(["Subject"]);
    expect(missingIn(answerRowsOf(holes, {}, { subject: "  " }))).toEqual(["Subject"]);
    expect(missingIn(answerRowsOf(holes, {}, { subject: "Winter" }))).toEqual([]);
  });

  it("reads a chosen scope as itself rather than as the default", () => {
    const rows = answerRowsOf(
      holes,
      { evidence: { include: [{ select: "project" }], exclude: [] } },
      { subject: "Winter" }
    );
    expect(rows[0].value).toBe("Everything in the project");
    expect(rows[0].answered).toBe(true);
    expect(rows[1].value).toBe("Winter");
  });
});
