// Lexer — UTF-8 source → token stream.
// All byte offsets are code-unit positions in the JS string (UTF-16),
// which matches byte offsets for ASCII; non-ASCII identifiers are not
// supported in formula/v1.

import type { Token, TokenKind } from "./tokens.js";

const KEYWORDS: Record<string, TokenKind> = {
  TRUE: "true",
  FALSE: "false",
  NULL: "null",
  IF: "if",
  LAMBDA: "lambda",
  FUNCTION: "function"
};

function isDigit(ch: string): boolean {
  return ch >= "0" && ch <= "9";
}

function isIdentStart(ch: string): boolean {
  return (ch >= "a" && ch <= "z") || (ch >= "A" && ch <= "Z") || ch === "_";
}

function isIdentCont(ch: string): boolean {
  return isIdentStart(ch) || isDigit(ch);
}

export function lex(source: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  const len = source.length;

  const emit = (kind: TokenKind, start: number, end: number): void => {
    tokens.push({ kind, span: { startByte: start, endByte: end }, text: source.slice(start, end) });
  };

  while (i < len) {
    const start = i;
    const ch = source[i];

    // Whitespace
    if (ch === " " || ch === "\t" || ch === "\r" || ch === "\n") {
      i++;
      continue;
    }

    // Single-line comment
    if (ch === "/" && source[i + 1] === "/") {
      while (i < len && source[i] !== "\n") i++;
      continue;
    }

    // String literal — double-quoted, with backslash escape
    if (ch === '"') {
      i++;
      let value = "";
      while (i < len && source[i] !== '"') {
        if (source[i] === "\\") {
          i++;
          const esc = source[i];
          if (esc === "n") value += "\n";
          else if (esc === "t") value += "\t";
          else if (esc === "r") value += "\r";
          else if (esc === '"') value += '"';
          else if (esc === "\\") value += "\\";
          else value += esc;
          i++;
        } else {
          value += source[i++];
        }
      }
      if (i >= len) {
        tokens.push({ kind: "error", span: { startByte: start, endByte: i }, text: source.slice(start, i) });
        continue;
      }
      i++; // closing "
      tokens.push({ kind: "text", span: { startByte: start, endByte: i }, text: value });
      continue;
    }

    // Quoted name — backtick-delimited, with backslash escape.
    //
    // Emitted as an ordinary identifier carrying the unquoted text, so a project
    // name that is not identifier-safe stays referenceable everywhere a bare name
    // is: `Q3 Orders`.region. Nothing downstream needs to know it was quoted.
    if (ch === "`") {
      i++;
      let value = "";
      while (i < len && source[i] !== "`") {
        if (source[i] === "\\") {
          i++;
          // A trailing backslash must not read past the end; falling through
          // leaves the unterminated check below to report it.
          if (i >= len) break;
          const esc = source[i];
          if (esc === "n") value += "\n";
          else if (esc === "t") value += "\t";
          else if (esc === "r") value += "\r";
          else if (esc === "`") value += "`";
          else if (esc === "\\") value += "\\";
          else value += esc;
          i++;
        } else {
          value += source[i++];
        }
      }
      if (i >= len) {
        // Unterminated, matching how an unterminated string literal is reported.
        tokens.push({ kind: "error", span: { startByte: start, endByte: i }, text: source.slice(start, i) });
        continue;
      }
      i++; // closing `
      if (value.length === 0) {
        tokens.push({ kind: "error", span: { startByte: start, endByte: i }, text: source.slice(start, i) });
        continue;
      }
      tokens.push({ kind: "identifier", span: { startByte: start, endByte: i }, text: value });
      continue;
    }

    // Number literal
    if (isDigit(ch) || (ch === "." && i + 1 < len && isDigit(source[i + 1]))) {
      while (i < len && isDigit(source[i])) i++;
      if (i < len && source[i] === "." && i + 1 < len && isDigit(source[i + 1])) {
        i++; // consume "."
        while (i < len && isDigit(source[i])) i++;
      }
      emit("number", start, i);
      continue;
    }

    // .{ or . or number starting with .
    if (ch === ".") {
      if (source[i + 1] === "{") {
        i += 2;
        emit("dotlbrace", start, i);
      } else {
        i++;
        emit("dot", start, i);
      }
      continue;
    }

    // Identifiers and keywords
    if (isIdentStart(ch)) {
      while (i < len && isIdentCont(source[i])) i++;
      const text = source.slice(start, i);
      const kw = KEYWORDS[text.toUpperCase()];
      if (kw) {
        tokens.push({ kind: kw, span: { startByte: start, endByte: i }, text });
      } else {
        tokens.push({ kind: "identifier", span: { startByte: start, endByte: i }, text });
      }
      continue;
    }

    // Two-char operators
    if (ch === "!" && source[i + 1] === "=") { i += 2; emit("neq", start, i); continue; }
    if (ch === "<" && source[i + 1] === "=") { i += 2; emit("lte", start, i); continue; }
    if (ch === ">" && source[i + 1] === "=") { i += 2; emit("gte", start, i); continue; }
    if (ch === "&" && source[i + 1] === "&") { i += 2; emit("and", start, i); continue; }
    if (ch === "|" && source[i + 1] === "|") { i += 2; emit("or", start, i); continue; }

    // Single-char operators and punctuation
    switch (ch) {
      case "(": i++; emit("lparen", start, i); break;
      case ")": i++; emit("rparen", start, i); break;
      case "[": i++; emit("lbracket", start, i); break;
      case "]": i++; emit("rbracket", start, i); break;
      case "{": i++; emit("lbrace", start, i); break;
      case "}": i++; emit("rbrace", start, i); break;
      case ",": i++; emit("comma", start, i); break;
      case ":": i++; emit("colon", start, i); break;
      case "+": i++; emit("plus", start, i); break;
      case "-": i++; emit("minus", start, i); break;
      case "*": i++; emit("star", start, i); break;
      case "/": i++; emit("slash", start, i); break;
      case "%": i++; emit("percent", start, i); break;
      case "^": i++; emit("caret", start, i); break;
      case "=": i++; emit("eq", start, i); break;
      case "<": i++; emit("lt", start, i); break;
      case ">": i++; emit("gt", start, i); break;
      case "!": i++; emit("bang", start, i); break;
      case "?": i++; emit("question", start, i); break;
      case "|": i++; emit("pipe", start, i); break;
      default:
        i++;
        emit("error", start, i);
    }
  }

  emit("eof", len, len);
  return tokens;
}
