import type { FormulaValue } from "$representation/data/types/content/formula-value";
import type { Answer, ErrorToken, Origin, Refusal } from "$representation/data/types/formulas/refusal";

/**
 * The declared vocabulary. A token nothing raises still belongs here, because a
 * reader who meets one needs somewhere to look it up.
 */
export const ERROR_TOKENS: readonly ErrorToken[] = [
  "#DIV/0!",
  "#VALUE!",
  "#NAME?",
  "#REF!",
  "#NUM!",
  "#N/A",
  "#NULL!",
  "#ERROR!",
  "#CYCLE!",
  "#FIELD?",
  "#INDEX!",
  "#SHAPE!"
];

export const ERROR_MEANINGS: Readonly<Record<ErrorToken, string>> = {
  "#DIV/0!": "This formula divides by zero.",
  "#VALUE!": "This formula was given a value of the wrong kind.",
  "#NAME?": "This formula names something nothing defines.",
  "#REF!": "This formula refers to something that is no longer there.",
  "#NUM!": "This formula produced a number that cannot be represented.",
  "#N/A": "No value is available here.",
  "#NULL!": "This formula intersects two ranges that do not meet.",
  "#ERROR!": "This formula could not be read.",
  "#CYCLE!": "This formula depends on itself.",
  "#FIELD?": "This value has no field by that name.",
  "#INDEX!": "That position is past the end.",
  "#SHAPE!": "That gesture does not apply to a value of this shape."
};

export const ERROR_NAMES: Readonly<Record<ErrorToken, string>> = {
  "#DIV/0!": "Division by zero",
  "#VALUE!": "Wrong kind of value",
  "#NAME?": "Unknown name",
  "#REF!": "Broken reference",
  "#NUM!": "Impossible number",
  "#N/A": "Not available",
  "#NULL!": "Empty intersection",
  "#ERROR!": "Unreadable formula",
  "#CYCLE!": "Circular reference",
  "#FIELD?": "Unknown field",
  "#INDEX!": "Position past the end",
  "#SHAPE!": "Wrong shape"
};

export const isErrorToken = (text: string): text is ErrorToken =>
  (ERROR_TOKENS as readonly string[]).includes(text);

/**
 * How a refusal travels out of a walk that is many frames deep.
 *
 * Thrown as a plain tagged object rather than an Error subclass, so nothing in
 * this domain exports a class and a caller cannot mistake it for a fault.
 */
type Thrown = { readonly refused: Refusal };

const isThrown = (value: unknown): value is Thrown =>
  typeof value === "object" && value !== null && "refused" in value;

/**
 * Both are annotated rather than inferred so a call narrows what follows it: a
 * `never` returned by an arrow function only ends control flow for the compiler
 * when the binding itself carries the type.
 */
export const fail: (token: ErrorToken, word?: string, at?: Origin) => never = (token, word, at) => {
  throw {
    refused: { token, ...(word === undefined ? {} : { word }), ...(at === undefined ? {} : { at }) }
  } satisfies Thrown;
};

export const raise: (refusal: Refusal) => never = (refusal) => {
  throw { refused: refusal } satisfies Thrown;
};

/** The refusal a throw carries, or nothing when the throw was a real fault. */
export const refusalOf = (thrown: unknown): Refusal | undefined =>
  isThrown(thrown) ? thrown.refused : undefined;

export const answering = (value: FormulaValue): Answer => ({ ok: true, value });

export const refusing = (refusal: Refusal): Answer => ({ ok: false, refusal });

/** Runs a walk, turning any refusal it throws into an answer. A fault still throws. */
export const attempted = (walk: () => FormulaValue): Answer => {
  try {
    return answering(walk());
  } catch (thrown) {
    const refusal = refusalOf(thrown);
    if (refusal === undefined) throw thrown;
    return refusing(refusal);
  }
};
