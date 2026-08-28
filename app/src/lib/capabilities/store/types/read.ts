import type { Found } from "$model/server/store/index.server";

export type ReadInput = { readonly path: string };

/** `null` rather than `undefined`: a remote function's answer is JSON. */
export type ReadResult = Found | null;
