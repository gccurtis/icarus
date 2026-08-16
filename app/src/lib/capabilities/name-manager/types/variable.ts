import { v, type Infer } from "convex/values";
import { formulaValueValidator, type FormulaValue } from "$content/types/value";
import type { Id } from "$convex/_generated/dataModel";
import type { Actor } from "$shared/types/actor";

/** What kind of thing a name holds, in the author's vocabulary. */
export const valueTypeValidator = v.union(
  v.literal("text"),
  v.literal("number"),
  v.literal("logic"),
  v.literal("date"),
  v.literal("null"),
  v.literal("list"),
  v.literal("record"),
  v.literal("table"),
  v.literal("function")
);

export type ValueType = Infer<typeof valueTypeValidator>;

/**
 * What a name holds: a formula value, plus the three shapes a formula cannot
 * return.
 *
 * Built from [`formulaValueValidator`](../../content/types/value.ts) rather than
 * beside it, so a stored `42` and a computed `42` are the same value — the
 * caller evaluates and sends the result, and nothing converts on the way in.
 *
 * `v.any()` at the leaves for the reason content states: the recursion is real
 * and a validator is a value, not a type. The types below are what stay
 * truthful.
 */
export const variableValueValidator = v.union(
  ...formulaValueValidator.members,
  v.object({ kind: v.literal("list"), values: v.array(v.any()) }),
  v.object({ kind: v.literal("record"), fields: v.record(v.string(), v.any()) }),
  v.object({
    kind: v.literal("function"),
    parameters: v.array(v.string()),
    expression: v.string()
  })
);

export type VariableValue =
  | FormulaValue
  | { kind: "list"; values: VariableValue[] }
  | { kind: "record"; fields: Record<string, VariableValue> }
  /** Stored, never run. Calling a named function is not something pass 2 does. */
  | { kind: "function"; parameters: string[]; expression: string };

/**
 * The declared type each value kind answers to.
 *
 * Two names differ because two vocabularies meet here: an author declares
 * `logic` and `null`, and a value carries content's `boolean` and `empty`. One
 * mapping, stated once, rather than a second value union whose `number` is not
 * the same type as a formula's.
 */
export const KIND_OF: Readonly<Record<ValueType, VariableValue["kind"]>> = {
  text: "text",
  number: "number",
  logic: "boolean",
  date: "date",
  null: "empty",
  list: "list",
  record: "record",
  table: "table",
  function: "function"
};

/** What an author sends to name a value. The value arrives already computed. */
export type VariableDefinition = {
  readonly name: string;
  readonly declaredType: ValueType;
  readonly value: VariableValue;
};

/** A named value as anything outside this capability sees it. */
export type NameVariable = {
  readonly id: Id<"nameVariables">;
  /** The authored casing — what gets displayed. */
  readonly name: string;
  /** The lookup form: lowercased and whitespace-normalized. */
  readonly nameKey: string;
  readonly declaredType: ValueType;
  readonly value: VariableValue;
  readonly definitionOrder: number;
  readonly createdBy: Actor;
  readonly updatedAt: number;
};
