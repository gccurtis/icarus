import { describe, expect, it } from "vitest";

import { asId } from "$representation/data/behavior/core/id";
import {
  holeNamesIn,
  promptHolesOf,
  promptWordsIn,
  textHolesOf,
  withMarkedHoles,
  withPromptHoles,
  withPrompts
} from "$representation/data/behavior/templates/prompt-holes";
import {
  fillTemplateAtoms,
  resolveTemplateScopes,
  scopeHoleNamesIn,
  templateAtomNamesIn
} from "$representation/data/behavior/templates/scopes";
import type { Atom, Mark } from "$representation/data/types/content/content-block";
import type { TemplateBody, TemplateHole } from "$representation/data/types/templates/template";

/**
 * What a template has to survive once it is worth having.
 *
 * A real template is long, asks a lot of questions, and sits over prose that
 * somebody has already formatted. These cases hold the whole pipeline —
 * marking, templating, resolving, filling — to that size and to the awkward
 * shapes text actually takes.
 */

const literal = (id: string, text: string): Atom => ({ id, kind: "literal", text });

const holeMark = (id: string, atom: string, from: number, to: number, name: string): Mark => ({
  id,
  from: { atom, offset: from },
  to: { atom, offset: to },
  hole: { name }
});

const styleMark = (id: string, atom: string, from: number, to: number): Mark => ({
  id,
  from: { atom, offset: from },
  to: { atom, offset: to },
  style: ["bold"]
});

const paragraph = (id: string, atoms: readonly Atom[], marks: readonly Mark[]) => ({
  id,
  type: "text",
  variant: "paragraph",
  atoms: [...atoms],
  display: atoms.map((atom) => (atom.kind === "literal" ? atom.text : "")).join(""),
  marks: [...marks]
});

const prompt = (id: string, extra: Record<string, unknown>) => ({
  id,
  type: "prompt",
  atoms: [literal(`${id}-a`, "Sum up")],
  display: "Sum up",
  marks: [],
  state: "idle",
  ...extra
});

const bodyOf = (blocks: readonly unknown[]) => ({
  resource: "document",
  rows: [{ id: "r1", kind: "blocks", blocks: [...blocks] }]
});

const minter = () => {
  let at = 0;
  return () => {
    at += 1;
    return `n${at}`;
  };
};

const templated = <T>(body: T): T => withMarkedHoles(withPromptHoles(body, promptHolesOf(body)), minter());

const blocksOf = (body: unknown): Record<string, unknown>[] =>
  ((body as { rows: { blocks: Record<string, unknown>[] }[] }).rows[0].blocks);

const setScope = (id: string) => ({
  include: [{ select: "set" as const, setId: asId<"resourceSets">(id) }],
  exclude: []
});

describe("a template of real size", () => {
  const PROSE = 240;
  const PROMPTS = 60;

  const large = () =>
    bodyOf([
      ...Array.from({ length: PROSE }, (_, index) => {
        const words = `Paragraph ${index} names Northwind and closes.`;
        const at = words.indexOf("Northwind");
        return paragraph(
          `p${index}`,
          [literal(`p${index}a`, words)],
          index % 3 === 0
            ? [holeMark(`p${index}m`, `p${index}a`, at, at + "Northwind".length, `Text ${index}`)]
            : [styleMark(`p${index}m`, `p${index}a`, 0, 9)]
        );
      }),
      ...Array.from({ length: PROMPTS }, (_, index) =>
        prompt(`q${index}`, {
          scope: setScope(`resourceSets:${index}`),
          ...(index % 2 === 0 ? { hole: { name: `Scope ${index}` } } : {})
        })
      )
    ]);

  it("keeps every hole somebody made and nothing else", () => {
    const held = templated(large());
    const scopes = scopeHoleNamesIn(held as unknown as TemplateBody);
    const texts = templateAtomNamesIn(held as unknown as TemplateBody);
    expect(scopes).toHaveLength(PROMPTS / 2);
    expect(texts).toHaveLength(Math.ceil(PROSE / 3));
    expect(new Set(holeNamesIn(held)).size).toBe(scopes.length + texts.length);
  });

  it("leaves every untemplateified prompt reading exactly what it read", () => {
    const held = templated(large());
    const untouched = blocksOf(held).filter(
      (block) => block.type === "prompt" && block.hole === undefined
    );
    expect(untouched).toHaveLength(PROMPTS / 2);
    for (const block of untouched) {
      expect((block.scope as { include: { select: string }[] }).include[0].select).toBe("set");
    }
  });

  it("keeps the words each text hole stands for, and the prose around them", () => {
    const held = templated(large());
    const holes = textHolesOf(held);
    expect(holes).toHaveLength(Math.ceil(PROSE / 3));
    expect(holes.every((hole) => hole.text === "Northwind")).toBe(true);
    const marked = blocksOf(held)[0];
    expect(marked.display).toBe("Paragraph 0 names {Text 0} and closes.");
    expect(blocksOf(held)[1].display).toBe("Paragraph 1 names Northwind and closes.");
  });

  it("keeps the formatting on every paragraph nobody templateified", () => {
    const held = templated(large());
    const styled = blocksOf(held).filter(
      (block) => block.type === "text" && (block.marks as Mark[]).length > 0
    );
    expect(styled).toHaveLength(PROSE - Math.ceil(PROSE / 3));
    expect(styled.every((block) => (block.marks as Mark[])[0].style?.[0] === "bold")).toBe(true);
  });

  it("resolves every scope hole in one pass, with nothing undeclared", () => {
    const held = templated(large()) as unknown as TemplateBody;
    const holes: TemplateHole[] = promptHolesOf(large()).map((draft) => draft.hole);
    const resolved = resolveTemplateScopes(held, holes);
    expect(resolved.accepted).toBe(true);
    if (!resolved.accepted) return;
    expect(resolved.undeclared).toEqual([]);
    const prompts = blocksOf(resolved.body).filter((block) => block.type === "prompt");
    for (const block of prompts) {
      const include = (block.scope as { include: { select: string }[] }).include;
      expect(include.every((term) => term.select !== "hole")).toBe(true);
    }
  });

  it("fills every text hole it is answered for and leaves the rest standing", () => {
    const held = templated(large()) as unknown as TemplateBody;
    const names = templateAtomNamesIn(held);
    const answers = Object.fromEntries(names.slice(1).map((name) => [name, "Southwind"]));
    const filled = fillTemplateAtoms(held, answers);
    expect(templateAtomNamesIn(filled)).toEqual([names[0]]);
    expect(blocksOf(filled)[3].display).toBe("Paragraph 3 names Southwind and closes.");
    expect(blocksOf(filled)[0].display).toBe("Paragraph 0 names {Text 0} and closes.");
  });
});

describe("text that is not simple", () => {
  const held = (atoms: readonly Atom[], marks: readonly Mark[]) =>
    withMarkedHoles(bodyOf([paragraph("b1", atoms, marks)]), minter());

  it("takes a run of astral characters whole", () => {
    const body = held(
      [literal("a1", "Ana 🚀 Ortiz signs.")],
      [holeMark("m1", "a1", 4, 6, "launch")]
    );
    expect(textHolesOf(body)[0].text).toBe("🚀");
    expect(blocksOf(body)[0].display).toBe("Ana {launch} Ortiz signs.");
  });

  it("takes two holes that touch, without either eating the other", () => {
    const body = held(
      [literal("a1", "AnaOrtiz signs.")],
      [holeMark("m1", "a1", 0, 3, "first"), holeMark("m2", "a1", 3, 8, "last")]
    );
    expect(blocksOf(body)[0].display).toBe("{first}{last} signs.");
    expect(textHolesOf(body).map((hole) => hole.text)).toEqual(["Ana", "Ortiz"]);
  });

  it("takes the whole block, and a run at each end", () => {
    const whole = held([literal("a1", "Everything.")], [holeMark("m1", "a1", 0, 11, "all")]);
    expect(blocksOf(whole)[0].display).toBe("{all}");

    const ends = held(
      [literal("a1", "Ana writes Ortiz")],
      [holeMark("m1", "a1", 0, 3, "first"), holeMark("m2", "a1", 11, 16, "last")]
    );
    expect(blocksOf(ends)[0].display).toBe("{first} writes {last}");
  });

  it("holds fifty holes and fifty formatted runs in one paragraph, all of them", () => {
    const words = Array.from({ length: 50 }, (_, index) => `hole${index} keep${index} `).join("");
    const marks: Mark[] = [];
    let at = 0;
    for (let index = 0; index < 50; index += 1) {
      const holeText = `hole${index}`;
      const keepText = `keep${index}`;
      marks.push(holeMark(`h${index}`, "a1", at, at + holeText.length, `Hole ${index}`));
      at += holeText.length + 1;
      marks.push(styleMark(`s${index}`, "a1", at, at + keepText.length));
      at += keepText.length + 1;
    }
    const body = held([literal("a1", words)], marks);
    const block = blocksOf(body)[0];
    expect(textHolesOf(body)).toHaveLength(50);
    expect(block.marks).toHaveLength(50);
    const atoms = block.atoms as Atom[];
    const spans = atoms.map((atom) => (atom.kind === "literal" ? atom.text : ""));
    for (const mark of block.marks as Mark[]) {
      const index = atoms.findIndex((atom) => atom.id === mark.from.atom);
      const before = spans.slice(0, index).join("").length;
      const flat = spans.join("");
      expect(flat.slice(before + mark.from.offset, before + mark.to.offset)).toMatch(/^keep\d+$/);
    }
  });

  it("refuses a run of nothing but a caret, however many are asked for", () => {
    const body = held(
      [literal("a1", "Untouched.")],
      [holeMark("m1", "a1", 4, 4, "nothing"), holeMark("m2", "a1", 9, 9, "also nothing")]
    );
    expect(blocksOf(body)[0].display).toBe("Untouched.");
    expect(textHolesOf(body)).toEqual([]);
  });
});

describe("prompts that ask a lot", () => {
  const long = `Read every filing and ${"weigh the counterparties, ".repeat(400)}then answer.`;

  it("carries a prompt of ten thousand characters onto the block and back off it", () => {
    const held = bodyOf([prompt("q1", { hole: { name: "sources" }, scope: setScope("resourceSets:1") })]);
    const asked = withPrompts(held, { q1: long });
    const body = withPromptHoles(asked, promptHolesOf(asked)) as unknown as TemplateBody;
    expect(long.length).toBeGreaterThan(10_000);
    expect(promptWordsIn(body).sources).toBe(long);
  });

  it("gives two prompts sharing one name one answer between them", () => {
    const held = bodyOf([
      prompt("q1", { hole: { name: "winter" }, scope: setScope("resourceSets:1") }),
      prompt("q2", { hole: { name: "winter" }, scope: setScope("resourceSets:1") })
    ]);
    const body = templated(held) as unknown as TemplateBody;
    expect(scopeHoleNamesIn(body)).toEqual(["winter"]);

    const holes: TemplateHole[] = [{ name: "winter", label: "winter", default: setScope("resourceSets:1") }];
    const answer = { include: [{ select: "kinds" as const, kinds: ["research"] }], exclude: [] };
    const resolved = resolveTemplateScopes(body, holes, { winter: answer });
    expect(resolved.accepted).toBe(true);
    if (!resolved.accepted) return;
    const scopes = blocksOf(resolved.body).map((block) => block.scope);
    expect(scopes[0]).toEqual(scopes[1]);
    expect(scopes[0]).toEqual({ include: [{ select: "kinds", kinds: ["research"] }], exclude: [] });
  });

  it("falls back to the whole project for a hole the template never declared", () => {
    const body = templated(
      bodyOf([prompt("q1", { hole: { name: "missing" }, scope: setScope("resourceSets:1") })])
    ) as unknown as TemplateBody;
    const resolved = resolveTemplateScopes(body, []);
    expect(resolved.accepted).toBe(true);
    if (!resolved.accepted) return;
    expect(resolved.undeclared).toEqual(["missing"]);
  });

  it("refuses an answer that excludes, because a difference cannot be flattened", () => {
    const body = templated(
      bodyOf([prompt("q1", { hole: { name: "winter" }, scope: setScope("resourceSets:1") })])
    ) as unknown as TemplateBody;
    const holes: TemplateHole[] = [{ name: "winter", label: "winter", default: setScope("resourceSets:1") }];
    const resolved = resolveTemplateScopes(body, holes, {
      winter: {
        include: [{ select: "project" }],
        exclude: [{ select: "kinds", kinds: ["finding"] }]
      }
    });
    expect(resolved.accepted).toBe(false);
  });
});
