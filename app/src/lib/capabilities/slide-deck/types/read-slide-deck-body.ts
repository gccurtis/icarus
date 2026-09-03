import type { SlideDeckBody } from "$representation/data/types/slide-decks/body";

export type ReadSlideDeckBodyInput = {
  readonly resourceId: string;
};

/** `null` rather than `undefined`: a remote function's answer is JSON. */
export type ReadSlideDeckBodyResult = {
  readonly revision: number;
  readonly body: SlideDeckBody;
} | null;
