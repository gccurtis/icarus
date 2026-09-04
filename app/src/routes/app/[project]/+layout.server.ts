import type { Configuration } from "$runtime/server/start.server";
import type { LayoutServerLoad } from "./$types";

/**
 * Every configuration key the browser may see.
 *
 * **An allowlist, and the reason it is one is worth stating.** The merged YAML
 * holds the development project token and the observability settings alongside
 * these, and a load function's return value is serialized into the document
 * where anyone can read it. Publishing by omission is how a secret ships, so the
 * list is what crosses rather than the tree minus what we remembered to remove.
 *
 * Adding a key here is a deliberate act with a reviewer. Nothing reads
 * configuration on the client that is not named in this array.
 */
const PUBLISHED_KEYS = [
  "revisions.changeSets.flushAfterOps",
  "revisions.changeSets.flushAfterMs",
  "revisions.sync.everyMs",
  "workspace.changeSets.flushAfterOps",
  "workspace.changeSets.flushAfterMs",
  "slideDeck.stage.unitsHigh",
  "slideDeck.stage.widthRem",
  "slideDeck.stage.averageGlyphWidthEm",
  "slideDeck.zoom.minimum",
  "slideDeck.zoom.maximum",
  "slideDeck.zoom.step",
  "slideDeck.gutter.minimumRem",
  "slideDeck.gutter.maximumRem"
] as const;

/**
 * Rebuilds the named keys into the nested shape they had, so a client reading
 * `revisions.changeSets.flushAfterOps` asks for the same path the YAML wrote.
 *
 * Flattening to single-segment keys was the alternative and would have made the
 * two sides name the same value differently — which is the drift the client's
 * `get` being a copy of the server's exists to avoid.
 *
 * A key with no value is omitted rather than published as `undefined`: the
 * client's `requiredNumber` then reports it as missing and names this file,
 * which is a better failure than a key that exists and holds nothing.
 */
const publish = (configuration: Configuration): Record<string, unknown> => {
  const snapshot: Record<string, unknown> = {};

  for (const key of PUBLISHED_KEYS) {
    const value = configuration.get(key);
    if (value === undefined) continue;

    const segments = key.split(".");
    const leaf = segments.pop()!;

    let node = snapshot;
    for (const segment of segments) {
      node[segment] ??= {};
      node = node[segment] as Record<string, unknown>;
    }
    node[leaf] = value;
  }

  return snapshot;
};

/**
 * Hands the client instance its settings.
 *
 * A server load rather than a remote function, because these values must be in
 * hand *before* `buildClientModel` runs: the objects below read their thresholds
 * during their own construction, and a value that arrived after mount would make
 * every one of them cope with not having one yet.
 *
 * `+layout.ts` sets `ssr = false`, which turns off server *rendering* and not
 * server *loads* — the client router fetches this, so the data is present when
 * the layout script runs.
 */
export const load: LayoutServerLoad = ({ locals }) => ({
  configuration: publish(locals.model.configuration)
});
