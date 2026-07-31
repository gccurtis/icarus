// FormulaDiagnostic — stable codes and constructors.

import type { SourceSpan } from "./tokens.js";

export type FormulaDiagnosticCode =
  | "parse_error"
  | "unknown_identifier"
  | "unknown_function"
  | "wrong_arity"
  | "type_error"
  | "divide_by_zero"
  | "numeric_error"
  | "invalid_index"
  | "index_out_of_range"
  | "unknown_field"
  | "invalid_table"
  | "cardinality_error"
  | "cycle_error"
  | "limit_exceeded"
  | "unsupported_version"
  | "stale_binding"
  | "invalid_resolver_snapshot";

export interface FormulaDiagnostic {
  readonly code: FormulaDiagnosticCode;
  readonly message: string;
  readonly span?: SourceSpan;
  readonly path?: readonly string[];
  readonly details?: Readonly<Record<string, string | number | boolean>>;
}

export function makeDiagnostic(
  code: FormulaDiagnosticCode,
  message: string,
  span?: SourceSpan,
  details?: Record<string, string | number | boolean>
): FormulaDiagnostic {
  const d: {
    code: FormulaDiagnosticCode;
    message: string;
    span?: SourceSpan;
    details?: Record<string, string | number | boolean>;
  } = { code, message };
  if (span) d.span = span;
  if (details) d.details = details;
  return d;
}

export function parseError(message: string, span?: SourceSpan): FormulaDiagnostic {
  return makeDiagnostic("parse_error", message, span);
}

export function typeError(message: string, span?: SourceSpan): FormulaDiagnostic {
  return makeDiagnostic("type_error", message, span);
}

export function divideByZero(span?: SourceSpan): FormulaDiagnostic {
  return makeDiagnostic("divide_by_zero", "Division by zero", span);
}

export function unknownIdentifier(name: string, span?: SourceSpan): FormulaDiagnostic {
  return makeDiagnostic("unknown_identifier", `Unknown identifier: ${name}`, span);
}

export function unknownFunction(name: string, span?: SourceSpan): FormulaDiagnostic {
  return makeDiagnostic("unknown_function", `Unknown function: ${name}`, span);
}

export function wrongArity(name: string, expected: string, got: number, span?: SourceSpan): FormulaDiagnostic {
  return makeDiagnostic("wrong_arity", `${name} expects ${expected} argument(s), got ${got}`, span, { expected, got });
}

export function limitExceeded(limitName: string, value: number, limit: number, span?: SourceSpan): FormulaDiagnostic {
  return makeDiagnostic("limit_exceeded", `Limit '${limitName}' exceeded: ${value} > ${limit}`, span, { limitName, value, limit });
}

export function invalidIndex(span?: SourceSpan): FormulaDiagnostic {
  return makeDiagnostic("invalid_index", "Index 0 is invalid; indexes are 1-based", span);
}

export function indexOutOfRange(index: number, length: number, span?: SourceSpan): FormulaDiagnostic {
  return makeDiagnostic("index_out_of_range", `Index ${index} is out of range for length ${length}`, span, { index, length });
}

export function unknownField(field: string, span?: SourceSpan): FormulaDiagnostic {
  return makeDiagnostic("unknown_field", `Unknown field: ${field}`, span, { field });
}

export function invalidTable(message: string, span?: SourceSpan): FormulaDiagnostic {
  return makeDiagnostic("invalid_table", message, span);
}

export function cardinalityError(message: string, span?: SourceSpan): FormulaDiagnostic {
  return makeDiagnostic("cardinality_error", message, span);
}

export function numericError(message: string, span?: SourceSpan): FormulaDiagnostic {
  return makeDiagnostic("numeric_error", message, span);
}

export function staleBinding(bindingId: string, span?: SourceSpan): FormulaDiagnostic {
  return makeDiagnostic("stale_binding", `Binding ${bindingId} is stale or deleted`, span, { bindingId });
}
