// Token types and source spans for formula/v1.

/** Half-open byte span in the UTF-8 source. */
export interface SourceSpan {
  readonly startByte: number;
  readonly endByte: number;
}

export type TokenKind =
  // Literals
  | "number"
  | "text"
  | "true"
  | "false"
  | "null"
  // Identifiers and keywords
  | "identifier"
  | "if"
  | "lambda"
  | "function"
  // Punctuation
  | "lparen"
  | "rparen"
  | "lbracket"
  | "rbracket"
  | "lbrace"
  | "rbrace"
  | "comma"
  | "colon"
  | "dot"
  | "dotlbrace"   // ".{" — lexed as a single token to avoid ambiguity
  | "bang"        // prefix logical NOT  OR  postfix exact-one
  | "question"    // postfix zero-or-one
  | "pipe"        // "|" inside .{} projection pipe
  // Arithmetic
  | "plus"
  | "minus"
  | "star"
  | "slash"
  | "percent"
  | "caret"       // "^" — power in expressions, XOR in condition nodes
  // Comparison / equality
  | "eq"          // "="
  | "neq"         // "!="
  | "lt"
  | "lte"
  | "gt"
  | "gte"
  // Logical
  | "and"         // "&&"
  | "or"          // "||"
  // Special
  | "eof"
  | "error";

export interface Token {
  readonly kind: TokenKind;
  readonly span: SourceSpan;
  /** Raw source text for this token. */
  readonly text: string;
}
