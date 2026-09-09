import { getContext, setContext } from "svelte";

export type Picker = { readonly insert: (address: string, anchor: string) => void };

export type Draft = { readonly at: string; readonly text: string };

export type Writing = { readonly seed: string; readonly at: number };

export type PickingChannel = {
  readonly arm: (picker: Picker) => void;
  readonly disarm: (picker: Picker) => void;
  readonly armed: boolean;
  readonly pick: (address: string, anchor: string) => boolean;
  readonly drafting: (next: Draft | undefined) => void;
  readonly drafted: Draft | undefined;
  readonly beginWriting: (seed: string) => void;
  readonly begun: Writing | undefined;
  readonly writingTaken: () => void;
  readonly endWriting: () => void;
  readonly ended: number | undefined;
  readonly endingTaken: () => void;
};

/**
 * The one caret a sheet has, and the three things that happen around it.
 *
 * The grid draws a box around every cell an expression names, and while somebody
 * is writing one the expression it should draw is the draft rather than what the
 * cell holds. The grid opens no editor of its own, so a keystroke on it arrives
 * here and the lens field takes it. And writing that ends at the keyboard hands
 * the caret back, which a click into another field must not do.
 *
 * One instance per project, constructed where the project is, because the field
 * doing the writing and the grid answering the clicks are in different panels
 * and neither owns the other.
 */
export const createPickingChannel = (): PickingChannel => {
  let picker: Picker | undefined = undefined;
  let draft = $state<Draft | undefined>(undefined);
  let opening = $state<Writing | undefined>(undefined);
  let closing = $state<number | undefined>(undefined);

  return {
    arm: (next) => {
      picker = next;
    },
    disarm: (next) => {
      if (picker === next) picker = undefined;
    },
    get armed(): boolean {
      return picker !== undefined;
    },
    pick: (address, anchor) => {
      if (picker === undefined) return false;
      picker.insert(address, anchor);
      return true;
    },
    drafting: (next) => {
      draft = next;
    },
    get drafted(): Draft | undefined {
      return draft;
    },
    beginWriting: (seed) => {
      opening = { seed, at: (opening?.at ?? 0) + 1 };
    },
    get begun(): Writing | undefined {
      return opening;
    },
    writingTaken: () => {
      opening = undefined;
    },
    endWriting: () => {
      closing = (closing ?? 0) + 1;
    },
    get ended(): number | undefined {
      return closing;
    },
    endingTaken: () => {
      closing = undefined;
    }
  };
};

const CHANNEL = Symbol("spreadsheet-editor.picking");

export const providePickingChannel = (channel: PickingChannel): PickingChannel =>
  setContext(CHANNEL, channel);

export const pickingChannel = (): PickingChannel => {
  const held = getContext<PickingChannel | undefined>(CHANNEL);
  if (held === undefined) {
    throw new Error(
      "No picking channel was provided for this project. " +
        "See src/routes/app/[project]/+layout.svelte."
    );
  }
  return held;
};
