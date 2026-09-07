/**
 * What a name may be: letters, digits and underscore, never starting with a
 * digit.
 *
 * No spaces, and no quoting to get around that. A hyphen is subtraction
 * everywhere else in the language, so a hyphenated name would be legal in a
 * bare projection and ambiguous inside a predicate.
 */
const WORD = /^[A-Za-z_][A-Za-z0-9_]*$/;

/** Words the grammar spends, which no name may take. */
export const RESERVED: readonly string[] = ["TRUE", "FALSE", "and", "or", "not"];

export const isLegalWord = (text: string): boolean => WORD.test(text);

const looksLikeAnAddress = (text: string): boolean => /^\$?[A-Za-z]{1,3}\$?\d+$/.test(text);

/**
 * Whether a variable or field may be called this. An address-shaped word is
 * refused at creation rather than at use, because a variable called B4 could
 * never be said out loud in a formula.
 */
export const isLegalName = (text: string): boolean =>
  isLegalWord(text) &&
  !looksLikeAnAddress(text) &&
  !RESERVED.some((word) => word.toLowerCase() === text.toLowerCase());

/** Why a name was refused, for a surface that has to say so. */
export const nameRefusal = (text: string): string | undefined => {
  if (text.trim().length === 0) return "A name cannot be empty.";
  if (!WORD.test(text)) return "A name is letters, digits and underscore, and cannot start with a digit.";
  if (looksLikeAnAddress(text)) return "A name cannot look like a cell address.";
  if (RESERVED.some((word) => word.toLowerCase() === text.toLowerCase())) return `${text} is a word the language spends.`;
  return undefined;
};
