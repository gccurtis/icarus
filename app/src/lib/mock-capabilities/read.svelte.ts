/**
 * A read, shaped like the real one — and, on a review page, one you can change.
 *
 * `$json-store/client` hands a view a live handle rather than a value, so every
 * mock door returns the same `current` / `error` / `refresh` shape and a panel is
 * written the same way whether the table exists yet or not.
 *
 * ```ts
 * const mentions = mentionsFor(projectId);   // mock
 * const projects = list("projects");         // real
 * ```
 *
 * **Every door names itself.** The id is what makes a panel answerable: a review
 * page can say which doors this panel actually called, show what each returned,
 * and let the reader put a different answer in and watch the panel move. Without
 * it a panel is a picture; with it a panel is a function you can evaluate.
 *
 * **An override is not a mutation.** The sample data stays as written and the
 * override sits in front of it, so a reader who has been experimenting can put
 * everything back without reloading, and two panels reading the same door still
 * agree.
 */

export type Read<T> = {
  /**
   * What the door answered. Never `undefined` here — a mock has nothing to wait
   * for — which is why a caller may read it directly where a real query needs
   * `?? []`. That difference is deliberate and is the one thing to fix when a
   * mock is swapped out.
   */
  readonly current: T;
  /** Always absent. A mock cannot fail, and pretending otherwise is a lie. */
  readonly error: undefined;
  /** Always false, for the same reason. */
  readonly loading: false;
  /** A no-op, so a caller that refreshes after a write still compiles. */
  refresh: () => Promise<void>;
};

/** What a door was asked and what it answered, for one render. */
export type DoorCall = {
  readonly id: string;
  readonly value: unknown;
  /** Whether what came back was the reader's answer rather than the sample. */
  readonly overridden: boolean;
};

/**
 * A plain Map rather than `$state`, and that is load-bearing: doors are called
 * from inside `$derived`, and writing to reactive state during a derivation is
 * an unsafe mutation. The page reads this after a render instead.
 */
const calls = new Map<string, DoorCall>();

const overrides = $state<Record<string, unknown>>({});

/** Off everywhere but a review page, so an application records nothing. */
let watching = false;

const handle = <T>(current: T): Read<T> => ({
  current,
  error: undefined,
  loading: false,
  refresh: async () => {}
});

/**
 * Wrap a value in the handle shape.
 *
 * `id` is optional so that a door written before this existed still compiles,
 * but a door without one is invisible to a review page — name every door.
 */
export const read = <T>(current: T, id?: string): Read<T> => {
  if (id === undefined) return handle(current);

  const override = overrides[id];
  const overridden = override !== undefined;
  if (watching) calls.set(id, { id, value: overridden ? override : current, overridden });

  return handle(overridden ? (override as T) : current);
};

/** Start recording which doors get called. A review page turns this on. */
export const watchDoors = (on: boolean): void => {
  watching = on;
  if (!on) calls.clear();
};

/** Forget the last render's calls, before mounting a different panel. */
export const forgetDoors = (): void => {
  calls.clear();
};

/** What this render asked for, in the order it asked. */
export const doorCalls = (): DoorCall[] => [...calls.values()];

/** Put a different answer in front of a door. */
export const overrideDoor = (id: string, value: unknown): void => {
  overrides[id] = value;
};

/** Put the sample answer back. */
export const clearOverride = (id: string): void => {
  delete overrides[id];
};

/** Put every sample answer back. */
export const clearOverrides = (): void => {
  for (const id of Object.keys(overrides)) delete overrides[id];
};

/** Which doors are currently answering something other than the sample. */
export const overriddenDoors = (): string[] => Object.keys(overrides);
