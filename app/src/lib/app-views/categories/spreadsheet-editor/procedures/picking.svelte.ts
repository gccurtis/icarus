export type Picker = { readonly insert: (address: string, anchor: string) => void };

let held: Picker | undefined;

/**
 * What is being typed right now, wherever it is being typed.
 *
 * The grid draws a box around every cell an expression names, and while somebody
 * is writing one the expression it should draw is the draft rather than what the
 * cell holds. One channel, because a sheet has one caret.
 */
let draft = $state<string | undefined>(undefined);

export const arm = (picker: Picker): void => {
  held = picker;
};

export const disarm = (picker: Picker): void => {
  if (held === picker) held = undefined;
};

export const armed = (): boolean => held !== undefined;

export const pick = (address: string, anchor: string): boolean => {
  if (held === undefined) return false;
  held.insert(address, anchor);
  return true;
};

export const drafting = (text: string | undefined): void => {
  draft = text;
};

export const drafted = (): string | undefined => draft;

/**
 * Somebody began writing on the grid. The grid opens no editor of its own, so
 * the keystroke arrives here and the lens field picks it up and takes the caret.
 */
let opening = $state<{ readonly seed: string; readonly at: number } | undefined>(undefined);

export const beginWriting = (seed: string): void => {
  opening = { seed, at: (opening?.at ?? 0) + 1 };
};

export const writingBegun = (): { readonly seed: string; readonly at: number } | undefined => opening;

export const writingTaken = (): void => {
  opening = undefined;
};
