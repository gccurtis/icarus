/**
 * A parsed expression. Private to this capability — nothing stores one, because
 * what is stored is the text an author wrote and the value it last produced.
 *
 * A reference and a name are different nodes rather than one resolved later:
 * `B7` is decided by its *shape* at parse time, which is what lets a formula
 * mean the same thing wherever it is pasted.
 */
export type Expression =
  | { kind: "number"; value: number }
  | { kind: "text"; value: string }
  | { kind: "boolean"; value: boolean }
  | { kind: "cell"; reference: string }
  | { kind: "range"; from: string; to: string }
  | { kind: "name"; name: string }
  | { kind: "call"; name: string; arguments: Expression[] }
  | { kind: "unary"; operator: "-"; operand: Expression }
  | { kind: "binary"; operator: Operator; left: Expression; right: Expression };

export type Operator = "+" | "-" | "*" | "/" | "^";
