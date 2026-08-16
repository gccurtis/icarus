import { FormulaError } from "$formula/errors";
import type { Expression, Operator } from "$formula/types/expression";

type Token =
  | { kind: "number"; value: number }
  | { kind: "text"; value: string }
  | { kind: "word"; value: string }
  | { kind: "symbol"; value: string };

/** `B7` is a cell and `TargetMargin` is a name, decided by shape and nothing else. */
const CELL = /^[A-Za-z]{1,3}[0-9]+$/;

const syntax = (message: string): never => {
  throw new FormulaError("syntax", message);
};

const tokenize = (source: string): Token[] => {
  const tokens: Token[] = [];
  let at = 0;

  while (at < source.length) {
    const character = source[at];

    if (/\s/.test(character)) {
      at += 1;
    } else if (/[0-9]/.test(character)) {
      const digits = /^[0-9]*\.?[0-9]+/.exec(source.slice(at));
      if (!digits) syntax(`Not a number at ${at}`);
      tokens.push({ kind: "number", value: Number(digits![0]) });
      at += digits![0].length;
    } else if (character === '"') {
      const end = source.indexOf('"', at + 1);
      if (end === -1) syntax("Unterminated text");
      tokens.push({ kind: "text", value: source.slice(at + 1, end) });
      at = end + 1;
    } else if (/[A-Za-z_]/.test(character)) {
      const word = /^[A-Za-z_][A-Za-z0-9_]*/.exec(source.slice(at))!;
      tokens.push({ kind: "word", value: word[0] });
      at += word[0].length;
    } else if ("+-*/^(),:".includes(character)) {
      tokens.push({ kind: "symbol", value: character });
      at += 1;
    } else {
      syntax(`Unexpected '${character}'`);
    }
  }

  return tokens;
};

/**
 * Text to an expression tree, or a refusal that it is not one.
 *
 * A leading `=` is dropped here: it is how an author says "this is a formula",
 * and by the time anything is parsed that has already been established.
 *
 * **A bare name has no spaces**, which is what makes `=TargetMargin * 2`
 * unambiguous — and why the name manager's lookup key drops whitespace rather
 * than tidying it, so the variable an author called `Target Margin` is the one
 * this finds.
 */
export const parse = (expression: string): Expression => {
  const tokens = tokenize(expression.trim().replace(/^=/, ""));
  let at = 0;

  const peek = (): Token | undefined => tokens[at];
  const symbolIs = (value: string) => {
    const token = peek();
    return token?.kind === "symbol" && token.value === value;
  };
  const take = (value: string) => {
    if (!symbolIs(value)) syntax(`Expected '${value}'`);
    at += 1;
  };

  const binary = (
    operators: Operator[],
    next: () => Expression,
    rightAssociative = false
  ): Expression => {
    let left = next();
    for (;;) {
      const token = peek();
      if (token?.kind !== "symbol") break;
      const operator = token.value as Operator;
      if (!operators.includes(operator)) break;
      at += 1;
      const right = rightAssociative ? binary(operators, next, true) : next();
      left = { kind: "binary", operator, left, right };
    }
    return left;
  };

  const additive = (): Expression => binary(["+", "-"], multiplicative);
  const multiplicative = (): Expression => binary(["*", "/"], power);
  const power = (): Expression => binary(["^"], unary, true);

  const unary = (): Expression => {
    if (symbolIs("-")) {
      at += 1;
      return { kind: "unary", operator: "-", operand: unary() };
    }
    if (symbolIs("+")) {
      at += 1;
      return unary();
    }
    return primary();
  };

  const call = (name: string): Expression => {
    take("(");
    const args: Expression[] = [];
    if (!symbolIs(")")) {
      args.push(additive());
      while (symbolIs(",")) {
        at += 1;
        args.push(additive());
      }
    }
    take(")");
    return { kind: "call", name, arguments: args };
  };

  const word = (value: string): Expression => {
    if (symbolIs("(")) return call(value);
    if (/^true$/i.test(value)) return { kind: "boolean", value: true };
    if (/^false$/i.test(value)) return { kind: "boolean", value: false };
    if (!CELL.test(value)) return { kind: "name", name: value };

    // A range is two references and a colon, and only a reference can start one:
    // `Total:B3` is not a range, it is a name and a stray colon.
    if (symbolIs(":")) {
      const next = tokens[at + 1];
      if (next?.kind === "word" && CELL.test(next.value)) {
        at += 2;
        return { kind: "range", from: value.toUpperCase(), to: next.value.toUpperCase() };
      }
    }
    return { kind: "cell", reference: value.toUpperCase() };
  };

  const primary = (): Expression => {
    const token = peek();
    if (!token) return syntax("Nothing to evaluate");
    at += 1;

    if (token.kind === "number") return { kind: "number", value: token.value };
    if (token.kind === "text") return { kind: "text", value: token.value };
    if (token.kind === "word") return word(token.value);
    if (token.value === "(") {
      const inner = additive();
      take(")");
      return inner;
    }
    return syntax(`Unexpected '${token.value}'`);
  };

  const parsed = additive();
  // Anything left over means the expression was two expressions, and guessing
  // which one was meant is how a formula silently computes something else.
  if (at < tokens.length) syntax("Unexpected trailing input");
  return parsed;
};
