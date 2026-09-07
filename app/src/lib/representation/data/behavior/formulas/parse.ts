import { readAddress } from "$representation/data/behavior/formulas/addresses";
import { fail, refusalOf } from "$representation/data/behavior/formulas/refusals";
import { tokenise, type Token } from "$representation/data/behavior/formulas/tokens";
import type { BinaryOperator, Expression, Slice } from "$representation/data/types/formulas/expression";
import type { Refusal } from "$representation/data/types/formulas/refusal";

/**
 * How tightly each operator holds its operands. Loosest first, so a larger
 * number wins. `^` is the one that associates to the right.
 */
const BINDING: Readonly<Record<string, number>> = {
  or: 1,
  and: 2,
  "=": 4,
  "<>": 4,
  "<": 4,
  ">": 4,
  "<=": 4,
  ">=": 4,
  "&": 5,
  "+": 6,
  "-": 6,
  "*": 7,
  "/": 7,
  "^": 8
};

/** `not` sits between `and` and the comparisons, so `not a = b` negates the comparison. */
const NOT = 3;
const COMPARISON = 4;

const WORD_OPERATORS: readonly string[] = ["and", "or"];

export type Parsed = { ok: true; expression: Expression } | { ok: false; refusal: Refusal };

const parsed = (tokens: readonly Token[]): Expression => {
  let at = 0;

  const peek = (): Token | undefined => tokens[at];

  const isSymbol = (value: string): boolean => {
    const token = peek();
    return token?.kind === "symbol" && token.value === value;
  };

  const isWord = (value: string): boolean => {
    const token = peek();
    return token?.kind === "word" && token.value === value;
  };

  const take = (value: string): void => {
    if (!isSymbol(value)) fail("#ERROR!");
    at += 1;
  };

  const operatorAhead = (): BinaryOperator | undefined => {
    const token = peek();
    if (token === undefined) return undefined;
    if (token.kind === "symbol" && token.value in BINDING) return token.value as BinaryOperator;
    if (token.kind === "word" && WORD_OPERATORS.includes(token.value)) return token.value as BinaryOperator;
    return undefined;
  };

  const wholeNumber = (): number => {
    let sign = 1;
    if (isSymbol("-")) {
      sign = -1;
      at += 1;
    } else if (isSymbol("+")) at += 1;
    const token = peek();
    if (token?.kind !== "number" || !Number.isInteger(token.value)) fail("#ERROR!");
    at += 1;
    return sign * (token as { kind: "number"; value: number }).value;
  };

  const slice = (): Slice => {
    if (isSymbol(":")) {
      at += 1;
      if (isSymbol("]")) return { kind: "span" };
      return { kind: "span", to: wholeNumber() };
    }
    const first = wholeNumber();
    if (!isSymbol(":")) return { kind: "pick", at: first };
    at += 1;
    if (isSymbol("]")) return { kind: "span", from: first };
    return { kind: "span", from: first, to: wholeNumber() };
  };

  const query = (of: Expression): Expression => {
    const keep: string[] = [];
    const where: Expression[] = [];
    if (isSymbol("}")) fail("#ERROR!");

    for (;;) {
      if (isSymbol("(")) {
        at += 1;
        where.push(expressionAt(1));
        take(")");
      } else {
        const token = peek();
        if (token?.kind !== "word") fail("#ERROR!");
        at += 1;
        keep.push((token as { kind: "word"; value: string }).value);
      }
      if (!isSymbol(",")) break;
      at += 1;
    }
    take("}");
    return { kind: "query", of, keep, where };
  };

  const call = (name: string): Expression => {
    take("(");
    const args: Expression[] = [];
    if (isSymbol(")")) {
      at += 1;
      return { kind: "call", name, arguments: args };
    }
    for (;;) {
      args.push(expressionAt(1));
      if (!isSymbol(",")) break;
      at += 1;
    }
    take(")");
    return { kind: "call", name, arguments: args };
  };

  const primary = (): Expression => {
    const token = peek();
    if (token === undefined) fail("#ERROR!");

    if (token.kind === "number") {
      at += 1;
      return { kind: "literal", value: { kind: "number", value: token.value } };
    }
    if (token.kind === "text") {
      at += 1;
      return { kind: "literal", value: { kind: "text", value: token.value } };
    }
    if (token.kind === "address") {
      at += 1;
      const address = readAddress(token.source);
      if (address === undefined) fail("#REF!");
      return { kind: "address", address };
    }
    if (token.kind === "word") {
      at += 1;
      if (token.value === "TRUE") return { kind: "literal", value: { kind: "logic", value: true } };
      if (token.value === "FALSE") return { kind: "literal", value: { kind: "logic", value: false } };
      if (isSymbol("(")) return call(token.value);
      return { kind: "name", name: token.value };
    }
    if (token.value === "(") {
      at += 1;
      const inner = expressionAt(1);
      take(")");
      return inner;
    }
    return fail("#ERROR!");
  };

  const postfix = (): Expression => {
    let of = primary();
    for (;;) {
      if (isSymbol("[")) {
        at += 1;
        of = { kind: "index", of, slice: slice() };
        take("]");
      } else if (isSymbol(".")) {
        at += 1;
        if (isSymbol("{")) {
          at += 1;
          of = query(of);
        } else {
          const token = peek();
          if (token?.kind !== "word") fail("#ERROR!");
          at += 1;
          of = { kind: "field", of, field: (token as { kind: "word"; value: string }).value };
        }
      } else if (isSymbol("!")) {
        at += 1;
        of = { kind: "resolve", of };
      } else if (isSymbol("%")) {
        at += 1;
        of = { kind: "percent", of };
      } else break;
    }
    return of;
  };

  const unary = (): Expression => {
    if (isSymbol("-")) {
      at += 1;
      return { kind: "unary", operator: "-", of: unary() };
    }
    if (isSymbol("+")) {
      at += 1;
      return { kind: "unary", operator: "+", of: unary() };
    }
    return postfix();
  };

  const expressionAt = (binding: number): Expression => {
    let left: Expression;
    if (binding <= NOT && isWord("not")) {
      at += 1;
      left = { kind: "unary", operator: "not", of: expressionAt(COMPARISON) };
    } else left = unary();

    for (;;) {
      const operator = operatorAhead();
      if (operator === undefined) break;
      const holds = BINDING[operator];
      if (holds < binding) break;
      at += 1;
      const right = expressionAt(operator === "^" ? holds : holds + 1);
      left = { kind: "binary", operator, left, right };
    }
    return left;
  };

  const whole = expressionAt(1);
  if (at !== tokens.length) fail("#ERROR!");
  return whole;
};

/**
 * One formula, read into a tree. A leading `=` is how a sheet marks a cell as
 * holding one; the language itself does not need it.
 */
export const parseFormula = (text: string): Parsed => {
  const source = text.startsWith("=") ? text.slice(1) : text;
  try {
    return { ok: true, expression: parsed(tokenise(source)) };
  } catch (thrown) {
    const refusal = refusalOf(thrown);
    if (refusal === undefined) throw thrown;
    return { ok: false, refusal };
  }
};
