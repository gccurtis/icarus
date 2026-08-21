/**
 * A read, shaped like the real one.
 *
 * `$json-store/client` hands a view a live handle — `current`, `error`, and a
 * `refresh()` that re-runs it — rather than a value. Every mock door in this
 * tree returns the same shape, so a panel reading a table that does not exist yet
 * is written exactly like a panel reading one that does:
 *
 * ```ts
 * const mentions = mentionsFor(projectId);   // mock
 * const projects = list("projects");         // real
 * ```
 *
 * Both are then `x.current`. Replacing a mock with the real door is an import
 * change, not a rewrite, which is the whole reason the shape is copied rather
 * than simplified to a bare value.
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

/** Wraps a value in the handle shape. */
export const read = <T>(current: T): Read<T> => ({
  current,
  error: undefined,
  loading: false,
  refresh: async () => {}
});
