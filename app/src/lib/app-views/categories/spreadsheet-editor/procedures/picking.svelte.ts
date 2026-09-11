import { getContext, setContext } from "svelte";

export type Picker = { readonly insert: (address: string, anchor: string, gesture: number) => void };

export type Draft = { readonly at: string; readonly targets: readonly string[]; readonly text: string };

export type Writer = {
  readonly begin: (seed: string) => void;
  readonly commit: () => void;
};

export type PickingChannel = {
  readonly arm: (picker: Picker) => void;
  readonly disarm: (picker: Picker) => void;
  readonly armed: boolean;
  readonly session: number;
  readonly pick: (address: string, anchor: string, gesture: number) => boolean;
  readonly drafting: (next: Draft | undefined) => void;
  readonly drafted: Draft | undefined;
  readonly beginWriting: (seed: string) => void;
  readonly writeWith: (writer: Writer) => void;
  readonly stopWritingWith: (writer: Writer) => void;
  readonly commitWriting: () => void;
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
  let writer: Writer | undefined;
  let armed = $state(false);
  let session = $state(0);
  let nextSession = 0;
  let draft = $state<Draft | undefined>(undefined);
  let closing = $state<number | undefined>(undefined);

  return {
    arm: (next) => {
      if (picker === next) return;
      picker = next;
      armed = true;
      nextSession += 1;
      session = nextSession;
    },
    disarm: (next) => {
      if (picker !== next) return;
      picker = undefined;
      armed = false;
    },
    get armed(): boolean {
      return armed;
    },
    get session(): number {
      return session;
    },
    pick: (address, anchor, gesture) => {
      if (picker === undefined) return false;
      picker.insert(address, anchor, gesture);
      return true;
    },
    drafting: (next) => {
      draft = next;
    },
    get drafted(): Draft | undefined {
      return draft;
    },
    beginWriting: (seed) => {
      writer?.begin(seed);
    },
    writeWith: (next) => {
      writer = next;
    },
    stopWritingWith: (next) => {
      if (writer === next) writer = undefined;
    },
    commitWriting: () => {
      writer?.commit();
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
