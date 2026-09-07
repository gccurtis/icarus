import type { Address } from "$representation/data/types/formulas/expression";
import type { Answer } from "$representation/data/types/formulas/refusal";

/**
 * How a formula reaches everything it did not bring with it.
 *
 * Two questions, asked in that order after the built-ins have been tried: is
 * this a project name, and is this an id. Either may answer `null`, meaning
 * nothing here knows the word, which is what makes `#NAME?` possible.
 *
 * Neither implementation belongs to the formula system. A spreadsheet supplies
 * one, a document supplies one, and neither is named anywhere in this domain.
 */
export type Resolver = {
  readonly variable: (name: string) => Answer | null;
  readonly address: (address: Address) => Answer | null;
};
