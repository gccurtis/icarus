import type { PresentationBody } from "$representation/data/types/presentations/body";

export type ReadPresentationBodyInput = {
  readonly resourceId: string;
};

/** `null` rather than `undefined`: a remote function's answer is JSON. */
export type ReadPresentationBodyResult = {
  readonly revision: number;
  readonly body: PresentationBody;
} | null;
