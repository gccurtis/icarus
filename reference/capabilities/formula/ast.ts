// FormulaNode discriminated union — the AST produced by the parser.
// Nodes are immutable and carry source spans for diagnostics.
// NOTE: value.ts imports FormulaNode (for LambdaFunction.body).
//       ast.ts must NOT import value.ts to avoid circular deps.

import type { SourceSpan } from "./tokens.js";

// ─── Node base ───────────────────────────────────────────────────────────────

export interface NodeBase {
  readonly id: string;         // stable short UUID assigned at parse time
  readonly span: SourceSpan;
}

// ─── Literal nodes ────────────────────────────────────────────────────────────

export interface NullLiteralNode extends NodeBase {
  readonly type: "null-literal";
}

export interface NumberLiteralNode extends NodeBase {
  readonly type: "number-literal";
  readonly raw: string;   // original source text, parsed into CanonicalRational later
}

export interface TextLiteralNode extends NodeBase {
  readonly type: "text-literal";
  readonly value: string; // unescaped string value
}

export interface LogicLiteralNode extends NodeBase {
  readonly type: "logic-literal";
  readonly value: boolean;
}

// ─── Name ─────────────────────────────────────────────────────────────────────

export interface BoundFormulaReference {
  readonly kind: "binding";
  readonly bindingId: string;
  readonly ownerRevision: number | string;
  readonly valueDigest: string;
}

export interface NameNode extends NodeBase {
  readonly type: "name";
  readonly name: string;
  readonly binding?: BoundFormulaReference;
}

// ─── Structured constructors ─────────────────────────────────────────────────

export interface ListLiteralNode extends NodeBase {
  readonly type: "list-literal";
  readonly elements: readonly FormulaNode[];
}

export interface RecordFieldNode {
  readonly key: string;
  readonly value: FormulaNode;
  readonly span: SourceSpan;
}

export interface RecordLiteralNode extends NodeBase {
  readonly type: "record-literal";
  readonly fields: readonly RecordFieldNode[];
}

// ─── Unary / Binary / Call ───────────────────────────────────────────────────

export type UnaryOperator = "-" | "+" | "!";
export interface UnaryNode extends NodeBase {
  readonly type: "unary";
  readonly operator: UnaryOperator;
  readonly operand: FormulaNode;
}

export type BinaryOperator =
  | "+" | "-" | "*" | "/" | "%" | "^"
  | "=" | "!=" | "<" | "<=" | ">" | ">="
  | "&&" | "||";

export interface BinaryNode extends NodeBase {
  readonly type: "binary";
  readonly operator: BinaryOperator;
  readonly left: FormulaNode;
  readonly right: FormulaNode;
}

export interface CallNode extends NodeBase {
  readonly type: "call";
  readonly callee: FormulaNode;
  readonly args: readonly FormulaNode[];
}

export interface LambdaNode extends NodeBase {
  readonly type: "lambda";
  readonly parameters: readonly string[];
  readonly body: FormulaNode;
  readonly normalizedSource: string;
}

// ─── Structured access ────────────────────────────────────────────────────────

export interface FieldAccessNode extends NodeBase {
  readonly type: "field-access";
  readonly target: FormulaNode;
  readonly fieldName: string;
}

export interface IndexNode extends NodeBase {
  readonly type: "index";
  readonly target: FormulaNode;
  readonly index: FormulaNode;
}

export interface SliceNode extends NodeBase {
  readonly type: "slice";
  readonly target: FormulaNode;
  readonly start?: number;  // undefined = omitted
  readonly end?: number;    // undefined = omitted
}

// ─── Set operations ───────────────────────────────────────────────────────────

export type ConditionOperator = "=" | "!=" | "<" | "<=" | ">" | ">=";

export interface FieldConditionNode {
  readonly type: "field-condition";
  readonly field: string;
  readonly operator: ConditionOperator;
  readonly value: FormulaNode;
  readonly span: SourceSpan;
}

export interface ConditionNotNode {
  readonly type: "condition-not";
  readonly condition: FormulaConditionNode;
  readonly span: SourceSpan;
}

export interface ConditionCompositionNode {
  readonly type: "condition-composition";
  readonly operator: "and" | "or" | "xor";
  readonly conditions: readonly FormulaConditionNode[];
  readonly span: SourceSpan;
}

export type FormulaConditionNode =
  | FieldConditionNode
  | ConditionNotNode
  | ConditionCompositionNode;

export type SetOperationBody =
  | { readonly kind: "field-projection"; readonly fields: readonly string[] }
  | { readonly kind: "condition-query"; readonly condition: FormulaConditionNode };

export interface SetOperationNode extends NodeBase {
  readonly type: "set-operation";
  readonly target: FormulaNode;
  readonly body: SetOperationBody;
}

// ─── Cardinality promotion ────────────────────────────────────────────────────

export interface CardinalityPromotionNode extends NodeBase {
  readonly type: "cardinality-promotion";
  readonly target: FormulaNode;
  readonly mode: "exactly-one" | "zero-or-one";
}

// ─── Union ────────────────────────────────────────────────────────────────────

export type FormulaNode =
  | NullLiteralNode
  | NumberLiteralNode
  | TextLiteralNode
  | LogicLiteralNode
  | NameNode
  | ListLiteralNode
  | RecordLiteralNode
  | UnaryNode
  | BinaryNode
  | CallNode
  | LambdaNode
  | FieldAccessNode
  | IndexNode
  | SliceNode
  | SetOperationNode
  | CardinalityPromotionNode;
