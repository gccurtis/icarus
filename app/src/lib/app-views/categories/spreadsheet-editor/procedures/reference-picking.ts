export type ReferenceSpan = {
  readonly from: number;
  readonly to: number;
  readonly anchor: string;
  readonly gesture: number;
};

export type ReferenceGesture = {
  readonly serial: number;
  readonly active?: number;
};

export type ReferenceInsertion = {
  readonly text: string;
  readonly span: ReferenceSpan;
  readonly caret: number;
};

export const initialReferenceGesture = (): ReferenceGesture => ({ serial: 0 });

/** A new pointer-down always starts a distinct reference-selection gesture. */
export const startedReferenceGesture = (held: ReferenceGesture): ReferenceGesture => {
  const next = held.serial + 1;
  return { serial: next, active: next };
};

/** Pointer-up ends growth without forgetting the monotonic gesture identity. */
export const endedReferenceGesture = (held: ReferenceGesture): ReferenceGesture =>
  held.active === undefined ? held : { serial: held.serial };

/** Insert a new picked reference, or grow the span that began at the same cell. */
export const insertedReference = (
  text: string,
  address: string,
  anchor: string,
  gesture: number,
  selection: { readonly from: number; readonly to: number },
  previous?: ReferenceSpan
): ReferenceInsertion => {
  const growing =
    previous !== undefined &&
    previous.anchor === anchor &&
    previous.gesture === gesture;
  const from = growing ? previous.from : selection.from;
  const to = growing ? previous.to : selection.to;
  const next = `${text.slice(0, from)}${address}${text.slice(to)}`;
  const caret = from + address.length;
  return { text: next, span: { from, to: caret, anchor, gesture }, caret };
};
