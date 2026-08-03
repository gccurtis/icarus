// The definition is sugar. This is where the semantics come from.
//
// One deterministic function lowers the pills into a Formula expression:
//
//   join → filter → group → sort → limit → display
//
// There is no second evaluator and no parallel semantics to keep in sync. A
// pull compiles, evaluates through the engine, and shapes the result.
//
// Compilation is one-way. Formula text does not decompile back into pills, and
// no attempt is made — which is exactly why a pull returns the definition too.
//
// See scratch/structured-analytic-design/compilation.md.

import { isBuiltinName } from "#formula";
import type { FormulaEngine, FormulaExpression } from "#formula";
import type { Logger } from "#platform/observability/logger.js";
import { AnalyticCompilationError } from "./errors.js";
import {
  inputKey,
  placementName,
  type AnalyticDefinition,
  type AnalyticFieldPlacement,
  type AnalyticFieldRef,
  type AnalyticFilter,
  type AnalyticScalar
} from "./model.js";

// ─── Emitting source ──────────────────────────────────────────────────────────

const INDENT = "  ";
const indent = (depth: number): string => INDENT.repeat(depth);

/**
 * Shifts an already-rendered block to a deeper nesting level.
 *
 * Every fragment is built relative to column zero and re-indented when it is
 * embedded, so no emitter needs to know how deeply it will end up nested. The
 * first line is left alone because the caller has already placed it.
 */
const reindent = (block: string, depth: number): string =>
  block.split("\n").join(`\n${indent(depth)}`);

/**
 * The language the compiler emits. Pinned rather than taken from the caller:
 * this file writes one dialect, and a definition must not silently compile
 * against a version whose semantics it was never written for.
 */
export const COMPILED_LANGUAGE_VERSION = "formula/v1" as const;

/** Identifier-safe by Formula's rule, which is also Structured Data's rule. */
const FORMULA_IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;

/**
 * Names Formula's parser reads as syntax rather than as a reference. Structured
 * Data refuses to create an entry named any of these, so this is belt-and-braces
 * — but the compiler should not be the thing that assumes it.
 */
const FORMULA_LITERALS = new Set(["true", "false", "null", "if", "lambda", "function"]);

/**
 * A reference to a Structured Data entry.
 *
 * Backticks only when the bare name would not lex as one identifier, because
 * readable output is the whole reason compiled analytics are worth saving —
 * `Orders` beats `` `Orders` `` on every line it appears.
 *
 * Quoting does not rescue a name that collides with a builtin: the lexer emits
 * an ordinary identifier token either way, so the binder still resolves `sum`
 * to the builtin. Structured Data rejects those names at creation, which is the
 * only place the problem can actually be prevented.
 */
const nameRef = (name: string): string =>
  FORMULA_IDENTIFIER.test(name) && !FORMULA_LITERALS.has(name.toLowerCase())
    ? name
    : `\`${name.replace(/[\\`]/g, match => `\\${match}`)}\``;

/**
 * A text literal.
 *
 * The lexer passes an unrecognised escape through as the bare character, so
 * `\` and `"` are the only two that *must* be escaped. The control characters
 * are escaped anyway: a raw newline inside a literal lexes fine but turns one
 * line of compiled source into several, which makes saved output unreadable
 * and every golden test in this capability position-dependent.
 */
const textLiteral = (value: string): string => {
  const escaped = value.replace(/[\\"\n\r\t]/g, match => {
    switch (match) {
      case "\\": return "\\\\";
      case "\"": return "\\\"";
      case "\n": return "\\n";
      case "\r": return "\\r";
      default: return "\\t";
    }
  });
  return `"${escaped}"`;
};

/**
 * A scalar literal, in the exact-rational form Formula evaluates natively.
 *
 * A number is a numerator/denominator pair rather than a float precisely so it
 * survives this step without rounding: it becomes a division expression, and
 * the engine's rational arithmetic keeps it exact. Parenthesised so it cannot
 * re-associate with anything around it in a record or list.
 */
const scalarLiteral = (scalar: AnalyticScalar): string => {
  switch (scalar.kind) {
    case "null": return "null";
    case "text": return textLiteral(scalar.value);
    case "logic": return scalar.value ? "true" : "false";
    case "number":
      // Parenthesised only where it is a division, so it cannot re-associate
      // with anything around it. A bare integer, negative or not, needs none.
      return scalar.denominator === "1"
        ? scalar.numerator
        : `(${scalar.numerator} / ${scalar.denominator})`;
  }
};

type Entry = readonly [string, string];

/** A record literal, rendered on one line. Keys are emitted in the order given. */
const record = (entries: readonly Entry[]): string =>
  `{ ${entries.map(([key, value]) => `${key}: ${value}`).join(", ")} }`;

const list = (items: readonly string[]): string => `[${items.join(", ")}]`;

// ─── The pipeline ─────────────────────────────────────────────────────────────

/** One transformation applied to the table flowing through the pipeline. */
interface Stage {
  readonly fn: string;
  /** Rendered arguments after the table, which is always the first argument. */
  readonly args: readonly string[];
}

/**
 * Renders the stage chain outside-in, so the source reads in pipeline order
 * from the outermost call inward — the same shape the design documents.
 */
const renderStages = (base: string, stages: readonly Stage[]): string => {
  if (stages.length === 0) return base;
  const outer = stages[stages.length - 1];
  const inner = renderStages(base, stages.slice(0, -1));
  const args = [inner, ...outer.args]
    .map(arg => `${INDENT}${reindent(arg, 1)}`)
    .join(",\n");
  return `${outer.fn}(\n${args}\n)`;
};

// ─── Field naming ─────────────────────────────────────────────────────────────

/**
 * How a definition's field references appear in the compiled table.
 *
 * `JOIN` qualifies its output as `<inputKey>.<field>`, and the compiler always
 * supplies the prefixes — they cannot be inferred, because `ASTABLE` takes a
 * name but the table value carries none afterwards. With a single input there
 * is no join to qualify anything, so the fields stay bare.
 */
const fieldReference = (ref: AnalyticFieldRef, qualified: boolean): string =>
  qualified ? `${ref.input}.${ref.field}` : ref.field;

// ─── Filters ──────────────────────────────────────────────────────────────────

const predicate = (filter: AnalyticFilter, qualified: boolean): string => {
  const field = textLiteral(fieldReference(filter.field, qualified));
  switch (filter.operator) {
    case "isNull":
    case "isNotNull":
      return record([["field", field], ["op", textLiteral(filter.operator)]]);
    case "in":
      return record([
        ["field", field],
        ["op", textLiteral("in")],
        ["values", list(filter.values.map(scalarLiteral))]
      ]);
    case "contains":
      return record([
        ["field", field],
        ["op", textLiteral("contains")],
        ["value", textLiteral(filter.value)],
        ["caseSensitive", filter.caseSensitive ? "true" : "false"]
      ]);
    default:
      return record([
        ["field", field],
        ["op", textLiteral(filter.operator)],
        ["value", scalarLiteral(filter.value)]
      ]);
  }
};

// ─── The compiler ─────────────────────────────────────────────────────────────

/**
 * Lowers a definition to Formula source.
 *
 * Structurally valid input only — `validateAnalyticDefinition` runs first, and
 * this trusts its guarantees (nonempty inputs, a left-deep join chain, every
 * reference naming a declared input). What it does *not* trust is that the
 * result can be evaluated: two placements can validate independently and still
 * collide on an output column name, which only becomes visible here.
 */
export const compileToSource = (definition: AnalyticDefinition): string => {
  const qualified = definition.joins.length > 0;

  // ── The joined base ───────────────────────────────────────────────────────
  const asTable = (index: number): string => {
    const key = inputKey(definition.inputs[index]);
    return `ASTABLE(${nameRef(definition.inputs[index].name)}, ${textLiteral(key)})`;
  };

  let base = asTable(0);
  definition.joins.forEach((join, index) => {
    // `on` names are resolved against each side *before* qualification, so the
    // right side is always bare. The left side is bare only for the first join;
    // after that the accumulated table is already qualified.
    const first = index === 0;
    const on = list(join.on.map(key => record([
      ["left", textLiteral(first ? key.leftField : `${join.left}.${key.leftField}`)],
      ["right", textLiteral(key.rightField)]
    ])));

    const options: Entry[] = [["kind", textLiteral(join.kind)], ["on", on]];
    // Only the first join prefixes its left operand; afterwards the accumulated
    // side already carries prefixes and re-prefixing would double them.
    if (first) options.push(["leftAs", textLiteral(join.left)]);
    options.push(["rightAs", textLiteral(join.right)]);

    base = `JOIN(\n${INDENT}${reindent(base, 1)},\n${INDENT}${asTable(index + 1)},\n`
      + `${INDENT}${record(options)}\n)`;
  });

  const stages: Stage[] = [];

  // ── Filter ────────────────────────────────────────────────────────────────
  if (definition.filters.length > 0) {
    stages.push({
      fn: "WHERE",
      args: [record([["all", list(definition.filters.map(f => predicate(f, qualified)))]])]
    });
  }

  // ── Group ─────────────────────────────────────────────────────────────────
  // Rows before Columns, matching the order a pull reports its fields in. The
  // compiled table still emits keys before aggregates, which is why the service
  // permutes cells rather than passing the compiled table straight through.
  const placements = [...definition.rows, ...definition.columns];
  const outputName = (placement: AnalyticFieldPlacement): string => placementName(placement);

  const seen = new Map<string, string>();
  for (const placement of placements) {
    const name = outputName(placement);
    const previous = seen.get(name);
    if (previous !== undefined) {
      // Caught here rather than at pull time. Each placement is individually
      // valid — they only conflict once compiled — and a definition that can
      // never evaluate should be refused when it is saved, not on every pull
      // forever after.
      throw new AnalyticCompilationError(
        `two placements would both produce the column '${name}' (${previous} and ${placement.id});`
        + " give one of them a distinct label"
      );
    }
    seen.set(name, placement.id);
  }

  const keys = placements
    .filter(placement => placement.aggregation === "none")
    .map(placement => record([
      ["field", textLiteral(fieldReference(placement.field, qualified))],
      ["as", textLiteral(outputName(placement))]
    ]));
  const aggregates = placements
    .filter(placement => placement.aggregation !== "none")
    .map(placement => record([
      ["as", textLiteral(outputName(placement))],
      ["field", textLiteral(fieldReference(placement.field, qualified))],
      ["fn", textLiteral(placement.aggregation)]
    ]));

  if (keys.length === 0) {
    // A whole-table rollup. Distinct from GROUP with no keys: over an empty
    // input it still returns one row, because a rollup of nothing is a row of
    // empty answers rather than no rows at all.
    stages.push({ fn: "AGGREGATE", args: [record([["aggregates", list(aggregates)]])] });
  } else {
    // With no aggregates this is a distinct over the key columns, which is what
    // dimensions-only shelves mean.
    stages.push({
      fn: "GROUP",
      args: [record([["keys", list(keys)], ["aggregates", list(aggregates)]])]
    });
  }

  // ── Sort ──────────────────────────────────────────────────────────────────
  // Sorts name a placement, and after grouping a placement's column is named by
  // its `as` — so a sort compiles to the output name, never the source field.
  if (definition.sorts.length > 0) {
    const byId = new Map(placements.map(placement => [placement.id, placement]));
    stages.push({
      fn: "SORT",
      args: [list(definition.sorts.map(sort => {
        const placement = byId.get(sort.placementId);
        if (placement === undefined) {
          throw new AnalyticCompilationError(
            `sort names no placement: ${sort.placementId}`
          );
        }
        return record([
          ["field", textLiteral(outputName(placement))],
          ["direction", textLiteral(sort.direction)]
        ]);
      }))]
    });
  }

  // ── Limit and display ─────────────────────────────────────────────────────
  if (definition.limit !== undefined) {
    stages.push({ fn: "LIMIT", args: [String(definition.limit)] });
  }
  // Always emitted, `table` included: the rendering intent is part of the
  // recipe, and a table that says it is a table is not the same as one that
  // never said anything.
  stages.push({ fn: "DISPLAY", args: [textLiteral(definition.display.kind)] });

  return renderStages(base, stages);
};

/**
 * Lowers a definition and parses it, which is the check that matters: a
 * definition that cannot be lowered into something the engine will accept is
 * refused before it is stored, rather than failing on every pull afterwards.
 *
 * The expression is deliberately not persisted. It is cheap to re-derive, and
 * storing it would create a second artifact to keep consistent with the
 * definition that is its only source of truth.
 */
export const compileDefinition = (
  definition: AnalyticDefinition,
  engine: FormulaEngine,
  logger?: Logger
): FormulaExpression => {
  const startedAt = performance.now();
  let source: string;
  try {
    source = compileToSource(definition);
  } catch (error) {
    logger?.warn(
      "structured-analytic.definition.compile-failed",
      {
        reason: error instanceof Error ? error.message : String(error),
        definition,
        durationMs: Math.round(performance.now() - startedAt)
      },
      { detail: "content" }
    );
    throw error;
  }

  const parsed = engine.parse({ source, languageVersion: COMPILED_LANGUAGE_VERSION });
  if (!parsed.ok || parsed.value === undefined) {
    const reason = parsed.diagnostics?.map(d => d.message).join("; ") ?? "unknown parse failure";
    // A compiler bug, not a caller's mistake: validation already passed, so
    // nothing the client sent should be able to produce unparseable source.
    // Logged with both the definition and the source so it is reproducible.
    logger?.error(
      "structured-analytic.definition.compile-unparseable",
      { reason, source, definition },
      { detail: "content" }
    );
    throw new AnalyticCompilationError(`compiled source did not parse: ${reason}`);
  }

  logger?.debug(
    "structured-analytic.definition.compiled",
    {
      source,
      definition,
      sourceBytes: Buffer.byteLength(source, "utf8"),
      durationMs: Math.round(performance.now() - startedAt)
    },
    { detail: "content" }
  );
  return parsed.value;
};

/** Exported for the vocabulary-parity test, and for anything that formats names. */
export const isBareNameSafe = (name: string): boolean =>
  FORMULA_IDENTIFIER.test(name) && !FORMULA_LITERALS.has(name.toLowerCase()) && !isBuiltinName(name);
