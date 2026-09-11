import assert from "node:assert/strict";
import { describe, test } from "vitest";
import {
  answersOf,
  bodyOf,
  changed,
  documentBody,
  entries,
  fields,
  fieldsOf,
  slotsOf,
  row,
  spreadsheetBody,
  tagsOf,
  template,
  validateCreateTemplate
} from "$capabilities/templates/test/unit/template-fixture";

describe("stored template validation — exact fields and slots", () => {
  test("admits only exact data records and arrays at template input boundaries", () => {
    const hidden = { target: "document", name: "Current" };
    Object.defineProperty(hidden, "retired", { value: true, enumerable: false });
    const accessor = { target: "document" } as { target: string; name: string };
    Object.defineProperty(accessor, "name", {
      enumerable: true,
      get: () => {
        throw new Error("accessor was invoked");
      }
    });
    const inherited = Object.assign(Object.create({ retired: true }), {
      target: "document",
      name: "Current"
    });

    for (const input of [
      hidden,
      accessor,
      inherited,
      { target: "document", name: "Current", description: undefined },
      { target: "document", name: "Current", [Symbol("retired")]: true }
    ]) {
      assert.throws(() => validateCreateTemplate(input), /an object is required/);
    }

    const tags = ["current"];
    Object.defineProperty(tags, "retired", { value: true, enumerable: false });
    assert.throws(() => tagsOf(tags, "tags"), /exact current JSON data/);

    const answer = { include: [{ select: "project" }], exclude: [] };
    Object.defineProperty(answer.include[0], "retired", { value: true, enumerable: false });
    assert.throws(
      () => answersOf({ region: answer }, "answers"),
      /exact current JSON data/
    );

    assert.throws(
      () => fieldsOf({ current: true, retired: undefined }, "fields"),
      /an object is required/
    );
  });

  test("rejects hidden and symbol fields at the template body boundary", () => {
    const hidden = { ...documentBody };
    Object.defineProperty(hidden, "oldBody", { value: true, enumerable: false });
    const symbol = { ...documentBody, [Symbol("oldBody")]: true };

    assert.throws(() => bodyOf(hidden, "hidden-field"), /exact current JSON data/);
    assert.throws(() => bodyOf(symbol, "symbol-field"), /exact current JSON data/);
  });

  test("allows ordinary record-value keys that merely resemble representation ids", () => {
    const body = {
      ...spreadsheetBody,
      cells: {
        A1: {
          value: {
            kind: "record",
            fields: {
              resourceId: { kind: "text", value: "customer-123" },
              userId: { kind: "text", value: "account-owner" }
            }
          }
        }
      }
    };

    assert.doesNotThrow(() => bodyOf(body, "record-keys"));
  });

  test("rejects a slot whose answer kind is absent", () => {
    assert.throws(
      () => slotsOf([{ name: "untyped", label: "Untyped" }], "test"),
      /a slot is answered with a scope or with text/
    );
  });

  test("accepts only canonical represented slots and bounded templated defaults", () => {
    const valid = [
      {
        name: "region",
        label: "Region",
        kind: "scope",
        description: "The operating region.",
        default: {
          include: [{ select: "kinds", kinds: ["finding", "document"] }],
          exclude: [{ select: "project" }]
        }
      },
      {
        name: "evidence",
        label: "Evidence",
        kind: "scope",
        default: { include: [{ select: "set", setId: "resourceSets:1" }], exclude: [] }
      }
    ];
    assert.equal(slotsOf(valid, "test").length, 2);

    const invalid = [
      [{ ...valid[0], invented: true }],
      [{ ...valid[0], name: " region" }],
      [{ ...valid[0], label: "x".repeat(501) }],
      [{ ...valid[0], description: "x".repeat(4_001) }],
      [
        {
          ...valid[0],
          default: {
            include: Array.from({ length: 101 }, () => ({ select: "project" })),
            exclude: []
          }
        }
      ],
      [
        {
          ...valid[0],
          default: {
            include: [{ select: "kinds", kinds: ["finding", "Finding"] }],
            exclude: []
          }
        }
      ],
      [
        {
          ...valid[0],
          default: {
            include: [{ select: "project", invented: true }],
            exclude: []
          }
        }
      ],
      [
        {
          ...valid[0],
          default: {
            include: [{ select: "slot", name: "Region" }],
            exclude: []
          }
        }
      ],
      [
        {
          ...valid[0],
          default: {
            include: [{ select: "set", setId: "sets:1" }],
            exclude: []
          }
        }
      ],
      [
        { name: "region", label: "Region", kind: "scope" },
        { name: "Region", label: "Duplicate by case", kind: "scope" }
      ]
    ];
    for (const slots of invalid) {
      assert.throws(() => slotsOf(slots, "test"), /templates\/test:/);
    }
  });

  test("requires exact case for one slot default referencing another", () => {
    assert.throws(
      () =>
        slotsOf(
          [
            { name: "region", label: "Region", kind: "scope" },
            {
              name: "evidence",
              label: "Evidence",
              kind: "scope",
              default: {
                include: [{ select: "slot", name: "Region" }],
                exclude: []
              }
            }
          ],
          "test"
        ),
      /default names a declared slot/
    );
  });

  test("accepts only portable current formula and prompt lifecycle arms", () => {
    const body = {
      resource: "document",
      rows: [{
        id: "row",
        kind: "blocks",
        blocks: [
          {
            id: "text",
            type: "text",
            variant: "paragraph",
            atoms: [{
              id: "formula-atom",
              kind: "formula",
              expression: "=1",
              lastResolvedValue: { kind: "number", value: 1 },
              lastResolvedDisplay: "1",
              state: "fresh"
            }],
            display: "1",
            marks: []
          },
          {
            id: "formula-block",
            type: "formula",
            expression: "=1",
            display: "1",
            value: { kind: "number", value: 1 },
            state: "fresh"
          },
          {
            id: "prompt",
            type: "prompt",
            atoms: [{ id: "prompt-atom", kind: "literal", text: "Summarize" }],
            display: "Summarize",
            marks: [],
            prompt: "Summarize",
            state: "idle"
          }
        ]
      }]
    };
    assert.equal(bodyOf(body, "current-content").resource, "document");

    const formulaAtom = (candidate: Record<string, unknown>): unknown =>
      changed(body, (draft) => {
        const text = fields(entries(fields(entries(draft.rows)[0]).blocks)[0]);
        text.atoms = [{ ...fields(entries(text.atoms)[0]), ...candidate }];
        text.display = String(fields(entries(text.atoms)[0]).lastResolvedDisplay ?? "");
      });
    const formulaBlock = (candidate: Record<string, unknown>): unknown =>
      changed(body, (draft) => {
        const block = fields(entries(fields(entries(draft.rows)[0]).blocks)[1]);
        Object.assign(block, candidate);
      });
    const prompt = (candidate: Record<string, unknown>): unknown =>
      changed(body, (draft) => {
        const block = fields(entries(fields(entries(draft.rows)[0]).blocks)[2]);
        Object.assign(block, candidate);
      });

    for (const candidate of [
      formulaAtom({ state: "stale" }),
      formulaAtom({ state: "computing" }),
      formulaAtom({ state: "error", error: "failed" }),
      formulaAtom({ formulaId: undefined }),
      formulaBlock({ state: "stale" }),
      formulaBlock({ state: "computing" }),
      formulaBlock({ state: "error", error: "failed" }),
      formulaBlock({ resolvedAt: 10 }),
      formulaBlock({ formulaId: undefined }),
      prompt({ state: "fresh", refreshedAt: 10 }),
      prompt({ state: "stale" }),
      prompt({ state: "error", error: "failed" }),
      prompt({ derivedOutputId: "derivedOutputs:1" }),
      prompt({ refreshedAt: undefined })
    ]) {
      assert.throws(
        () => bodyOf(candidate, "retired-content"),
        /body is not a valid document|exact current JSON data|project-bound field/
      );
    }
  });

});
