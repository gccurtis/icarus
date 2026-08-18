/**
 * A configuration mapping, as it arrives from the server load. Values stay
 * `unknown` because every consumer owns the validation rules for the keys it
 * reads — this object provides no defaults, coerces nothing, and asserts no
 * shapes.
 */
export type ConfigurationSnapshot = Record<string, unknown>;

/**
 * The client's view of configuration: the keys the server chose to publish, read
 * by dotted path.
 *
 * Deliberately one method, for the reason its
 * [server twin](../../server/configuration/types.ts) gives — the place that
 * knows whether a key may be absent is the thing that reads it, not this.
 *
 * **This is not the server's `Configuration`, and must not become it.** That one
 * holds every section of every YAML file, including the development project
 * token and the observability settings. This holds only what
 * `/app/[project]/+layout.server.ts` publishes, and the browser can read
 * everything in it.
 */
export interface ConfigurationModel {
  get(key: string): unknown;
}

/**
 * Decides what counts as a mapping, so key traversal knows where to stop.
 *
 * Arrays and non-plain objects are values, never containers — a dotted path
 * cannot descend through one, which is what stops `a.b.0` from meaning something
 * different depending on how the YAML was written.
 *
 * A near-copy of the same predicate in
 * [`$model/server/configuration/types.ts`](../../server/configuration/types.ts).
 * The duplication is deliberate: the `environment` rule forbids the client tree
 * from importing the server tree, and there is no third place for a model helper
 * to live. Fifteen lines twice is the price of that boundary, and it is the
 * cheaper half of the trade.
 */
export const isConfigurationObject = (value: unknown): value is ConfigurationSnapshot => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value) as unknown;
  return prototype === Object.prototype || prototype === null;
};

/**
 * Reads a key that must be a finite number, throwing when it is not.
 *
 * Offered beside the interface rather than written into each consumer for the
 * same reason the server offers `requiredString`: "required number" is the shape
 * every published key has so far, and the throw has to name the key and the file
 * to be actionable at four in the morning.
 *
 * Throwing rather than defaulting is the point. A key missing from the
 * allowlist in `+layout.server.ts` is a deployment defect, and a silent default
 * would turn it into a client that batches differently from the one that was
 * configured — with nothing anywhere saying so.
 */
export const requiredNumber = (configuration: ConfigurationModel, key: string): number => {
  const value = configuration.get(key);
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(
      `Configuration key '${key}' must be a finite number — check the published key list in ` +
        "src/routes/app/[project]/+layout.server.ts and the value in configuration/"
    );
  }
  return value;
};
