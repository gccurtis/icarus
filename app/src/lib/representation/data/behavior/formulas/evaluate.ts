import { writeAddress } from "$representation/data/behavior/formulas/addresses";
import { CALLS, LAZY_CALLS } from "$representation/data/behavior/formulas/builtins";
import { attempted, fail, raise } from "$representation/data/behavior/formulas/refusals";
import { fielded, indexed, queried } from "$representation/data/behavior/formulas/slicing";
import {
  EMPTY,
  compare,
  logic,
  logicOf,
  number,
  numberOf,
  sameValue,
  text,
  textOf
} from "$representation/data/behavior/formulas/values";
import type { FormulaValue } from "$representation/data/types/content/formula-value";
import type { Expression } from "$representation/data/types/formulas/expression";
import type { Answer } from "$representation/data/types/formulas/refusal";
import type { Resolver } from "$representation/data/types/formulas/resolver";

/** Records a predicate is being evaluated inside, innermost last. */
type Scope = readonly FormulaValue[];

const WALKS = ["=", "<>"];

const scalar = (value: FormulaValue): boolean =>
  value.kind === "number" || value.kind === "text" || value.kind === "logic" || value.kind === "empty" || value.kind === "date";

const answerOf = (answer: Answer): FormulaValue => {
  if (answer.ok) return answer.value;
  return raise(answer.refusal);
};

const fieldInScope = (name: string, scope: Scope): FormulaValue | undefined => {
  for (let depth = scope.length - 1; depth >= 0; depth -= 1) {
    const row = scope[depth];
    if (row.kind === "record" && name in row.fields) return row.fields[name];
  }
  return undefined;
};

/**
 * One formula, answered.
 *
 * Nothing here knows what a spreadsheet is. A name is looked up in one fixed
 * order — the built-ins, then the project, then whatever an id names — and the
 * last two are questions the caller's resolver answers.
 */
export const evaluate = (expression: Expression, resolver: Resolver): Answer => {
  /** References already walked, so a ring answers rather than loops. */
  const walked = new Set<string>();

  /** A range is an address: reading one as data resolves it there and then. */
  const settled = (value: FormulaValue): FormulaValue => {
    if (value.kind !== "range") return value;
    const answer = resolver.address({
      at: "range",
      resourceId: value.resourceId,
      range: { from: value.from, to: value.to }
    });
    return answer === null ? fail("#REF!") : answerOf(answer);
  };

  const resolved = (value: FormulaValue): FormulaValue => {
    let held = settled(value);
    while (held.kind === "reference") {
      const key = JSON.stringify(held.target);
      if (walked.has(key)) fail("#CYCLE!");
      walked.add(key);

      const answer =
        held.target.to === "variable"
          ? resolver.variable(held.target.name)
          : resolver.address({ at: "resource", ref: held.target.ref });
      if (answer === null) {
        return held.target.to === "variable" ? fail("#NAME?", held.target.name) : fail("#REF!");
      }
      held = settled(answerOf(answer));
    }
    return held;
  };

  const named = (name: string, scope: Scope): FormulaValue => {
    const field = fieldInScope(name, scope);
    if (field !== undefined) return field;
    const answer = resolver.variable(name);
    if (answer === null) fail("#NAME?", name);
    return settled(answerOf(answer));
  };

  const called = (name: string, args: readonly Expression[], scope: Scope): FormulaValue => {
    const lazily = LAZY_CALLS[name];
    if (lazily !== undefined) return lazily(args, (of) => run(of, scope));

    const eagerly = CALLS[name];
    if (eagerly !== undefined) return eagerly(args.map((of) => run(of, scope)));

    return fail("#NAME?", name);
  };

  const binary = (operator: string, left: FormulaValue, right: FormulaValue): FormulaValue => {
    if (operator === "or") return logic(logicOf(left) || logicOf(right));
    if (operator === "and") return logic(logicOf(left) && logicOf(right));
    if (operator === "&") return text(textOf(left) + textOf(right));

    if (WALKS.includes(operator) && (!scalar(left) || !scalar(right))) {
      const same = sameValue(left, right);
      return logic(operator === "=" ? same : !same);
    }
    if (operator === "=") return logic(compare(left, right) === 0);
    if (operator === "<>") return logic(compare(left, right) !== 0);
    if (operator === "<") return logic(compare(left, right) < 0);
    if (operator === ">") return logic(compare(left, right) > 0);
    if (operator === "<=") return logic(compare(left, right) <= 0);
    if (operator === ">=") return logic(compare(left, right) >= 0);

    const one = numberOf(left);
    const other = numberOf(right);
    if (operator === "+") return number(one + other);
    if (operator === "-") return number(one - other);
    if (operator === "*") return number(one * other);
    if (operator === "/") return other === 0 ? fail("#DIV/0!") : number(one / other);
    if (operator === "^") return number(one ** other);
    return fail("#ERROR!");
  };

  const run = (of: Expression, scope: Scope): FormulaValue => {
    switch (of.kind) {
      case "literal":
        return of.value;
      case "name":
        return named(of.name, scope);
      case "address": {
        const answer = resolver.address(of.address);
        if (answer === null) fail("#REF!", writeAddress(of.address));
        return settled(answerOf(answer));
      }
      case "call":
        return called(of.name, of.arguments, scope);
      case "unary": {
        if (of.operator === "not") return logic(!logicOf(run(of.of, scope)));
        const held = numberOf(run(of.of, scope));
        return number(of.operator === "-" ? -held : held);
      }
      case "percent":
        return number(numberOf(run(of.of, scope)) / 100);
      case "binary":
        return binary(of.operator, run(of.left, scope), run(of.right, scope));
      case "field":
        return fielded(run(of.of, scope), of.field);
      case "index":
        return indexed(run(of.of, scope), of.slice);
      case "query":
        return queried(run(of.of, scope), of.keep, (row) =>
          of.where.every((test) => logicOf(run(test, [...scope, row])))
        );
      case "resolve":
        return resolved(run(of.of, scope));
      default:
        return EMPTY;
    }
  };

  return attempted(() => run(expression, []));
};
