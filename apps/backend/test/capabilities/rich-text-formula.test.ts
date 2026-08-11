import assert from "node:assert/strict";
import test from "node:test";
import {
  formatFormulaValue,
  formatFormulaWireValue,
  makeList,
  makeLogic,
  makeNumber,
  makeRational,
  makeRecord,
  makeTable,
  makeText,
  NULL_VALUE,
  toWire,
  type FormulaValue,
} from "../../src/capabilities/formula/index.js";
import {
  createRichText,
  DEFAULT_CONFIG,
  type FormulaAtom,
  type RichContent,
  type RichTextIdFactory,
} from "../../src/capabilities/rich-text/index.js";
import { CapturingLogger } from "../helpers/testDoubles.js";

const createIds = (): RichTextIdFactory => {
  let atom = 0;
  let mark = 0;
  return {
    atomId: () => `generated-atom-${++atom}`,
    markId: () => `generated-mark-${++mark}`,
  };
};

const formulaAtom = (content: RichContent): FormulaAtom => {
  const atom = content.atoms.find((candidate) => candidate.kind === "formula");
  assert.ok(atom && atom.kind === "formula");
  return atom;
};

test("completed delimiters become one Formula atom through an atomic Rich Text operation", () => {
  const richText = createRichText(DEFAULT_CONFIG, new CapturingLogger());
  const text = "hello {{ 1 + 1 }} world";
  const start = text.indexOf("{{");
  const end = text.indexOf("}}") + 2;
  const content: RichContent = {
    atoms: [{ id: "source", kind: "text", text }],
    marks: [
      {
        id: "bold-all",
        kind: "bold",
        range: {
          start: { atomId: "source", offset: 0 },
          end: { atomId: "source", offset: text.length },
        },
      },
      {
        id: "italic-formula",
        kind: "italic",
        range: {
          start: { atomId: "source", offset: start },
          end: { atomId: "source", offset: end },
        },
      },
    ],
  };
  const range = {
    start: { atomId: "source", offset: start },
    end: { atomId: "source", offset: end },
  };

  const authored = richText.formulaFromDelimitedRange(content, range, createIds());
  const repeated = richText.formulaFromDelimitedRange(content, range, createIds());
  assert.deepEqual(repeated, authored, "deterministic IDs produce deterministic operations");
  assert.equal(authored.expression, " 1 + 1 ");
  assert.equal(authored.operations.length, 1);
  assert.equal(authored.operations[0]?.type, "replace-range-with-atom");

  const applied = richText.apply(content, authored.operations);
  assert.deepEqual(applied.content.atoms, [
    { id: "source", kind: "text", text: "hello " },
    {
      id: "generated-atom-1",
      kind: "formula",
      expression: " 1 + 1 ",
      displayText: "{{ 1 + 1 }}",
    },
    { id: "generated-atom-2", kind: "text", text: " world" },
  ]);
  assert.equal(new Set(applied.content.atoms.map((atom) => atom.id)).size, 3);
  assert.deepEqual(applied.content.marks[0]?.range, {
    start: { atomId: "source", offset: 0 },
    end: { atomId: "generated-atom-2", offset: 6 },
  });
  assert.deepEqual(applied.content.marks[1]?.range, {
    start: { atomId: "generated-atom-1", offset: 0 },
    end: { atomId: "generated-atom-1", offset: 11 },
  });
  assert.equal(richText.validate(applied.content).ok, true);

  const restored = richText.apply(applied.content, applied.inverse).content;
  assert.deepEqual(richText.encode(restored), richText.encode(content));
});

test("Formula delimiter authoring rejects malformed, blank, cross-atom, and stale ranges", () => {
  const richText = createRichText(DEFAULT_CONFIG, new CapturingLogger());
  const plain: RichContent = {
    atoms: [{ id: "source", kind: "text", text: "before 1 + 1 after" }],
    marks: [],
  };
  assert.throws(
    () => richText.formulaFromDelimitedRange(plain, {
      start: { atomId: "source", offset: 7 },
      end: { atomId: "source", offset: 12 },
    }, createIds()),
    /must start with '\{\{'/,
  );

  const blank: RichContent = {
    atoms: [{ id: "source", kind: "text", text: "{{   }}" }],
    marks: [],
  };
  assert.throws(
    () => richText.formulaFromDelimitedRange(blank, {
      start: { atomId: "source", offset: 0 },
      end: { atomId: "source", offset: 7 },
    }, createIds()),
    /non-blank/,
  );

  const split: RichContent = {
    atoms: [
      { id: "left", kind: "text", text: "{{1" },
      { id: "right", kind: "text", text: "+1}}" },
    ],
    marks: [],
  };
  assert.throws(
    () => richText.formulaFromDelimitedRange(split, {
      start: { atomId: "left", offset: 0 },
      end: { atomId: "right", offset: 4 },
    }, createIds()),
    /within one text atom/,
  );

  const source: RichContent = {
    atoms: [{ id: "source", kind: "text", text: "{{1+1}}" }],
    marks: [],
  };
  const authored = richText.formulaFromDelimitedRange(source, {
    start: { atomId: "source", offset: 0 },
    end: { atomId: "source", offset: 7 },
  }, createIds());
  assert.throws(
    () => richText.apply({
      atoms: [{ id: "source", kind: "text", text: "{{2+2}}" }],
      marks: [],
    }, authored.operations),
    /expected text does not match/,
  );
});

test("Formula settlement applies and clears exact accepted values and diagnostics", () => {
  const richText = createRichText(DEFAULT_CONFIG, new CapturingLogger());
  const initial: RichContent = {
    atoms: [{
      id: "formula",
      kind: "formula",
      expression: "1 + 1",
      displayText: "{{1 + 1}}",
    }],
    marks: [],
  };
  const acceptedValue = toWire(makeNumber(makeRational(2n, 1n)));
  const accepted = richText.apply(initial, [{
    type: "apply-formula-settlement",
    atomId: "formula",
    settlement: { acceptedValue, displayText: "2" },
  }]);
  assert.deepEqual(formulaAtom(accepted.content).acceptedValue, acceptedValue);
  assert.equal(formulaAtom(accepted.content).displayText, "2");
  assert.equal(formulaAtom(accepted.content).diagnostic, undefined);
  assert.deepEqual(
    richText.encode(richText.apply(accepted.content, accepted.inverse).content),
    richText.encode(initial),
  );

  const failed = richText.apply(accepted.content, [{
    type: "apply-formula-settlement",
    atomId: "formula",
    settlement: {
      displayText: "{{1 + 1}}",
      diagnostic: {
        code: "divide_by_zero",
        message: "Division by zero",
        sourceRange: { start: 0, end: 5 },
      },
    },
  }]);
  assert.equal(formulaAtom(failed.content).acceptedValue, undefined);
  assert.deepEqual(formulaAtom(failed.content).diagnostic, {
    code: "divide_by_zero",
    message: "Division by zero",
    sourceRange: { start: 0, end: 5 },
  });
  assert.deepEqual(
    richText.encode(richText.apply(failed.content, failed.inverse).content),
    richText.encode(accepted.content),
  );

  const compatible = richText.apply(initial, [{
    type: "apply-formula-result",
    atomId: "formula",
    value: { kind: "null" },
    displayText: "null",
  }]);
  assert.deepEqual(formulaAtom(compatible.content).acceptedValue, { kind: "null" });
  assert.deepEqual(
    richText.encode(richText.apply(compatible.content, compatible.inverse).content),
    richText.encode(initial),
  );
});

test("Formula display formatting is deterministic for scalar and structured values", () => {
  assert.equal(formatFormulaValue(NULL_VALUE), "null");
  assert.equal(formatFormulaValue(makeNumber(makeRational(1n, 8n))), "0.125");
  assert.equal(formatFormulaValue(makeNumber(makeRational(-5n, 2n))), "-2.5");
  assert.equal(formatFormulaValue(makeNumber(makeRational(1n, 3n))), "1/3");
  assert.equal(formatFormulaValue(makeText("hello")), "hello");
  assert.equal(formatFormulaValue(makeLogic(true)), "true");
  assert.equal(
    formatFormulaValue(makeList([makeNumber(makeRational(1n, 1n)), makeText("two")])),
    '[1, "two"]',
  );

  const record = makeRecord(
    ["name", "active"],
    [makeText("Ada"), makeLogic(true)],
  );
  assert.equal(formatFormulaValue(record), '{"name": "Ada", "active": true}');
  assert.equal(formatFormulaWireValue(toWire(record)), formatFormulaValue(record));

  const table = makeTable(
    ["name"],
    [[makeText("Ada")], [makeText("Grace")]],
  );
  assert.equal(
    formatFormulaValue(table),
    '[{"name": "Ada"}, {"name": "Grace"}]',
  );

  const fn: FormulaValue = {
    kind: "function",
    fn: { kind: "builtin", name: "SUM", implementationVersion: "1" },
  };
  assert.equal(formatFormulaValue(fn), "[function SUM]");
});
