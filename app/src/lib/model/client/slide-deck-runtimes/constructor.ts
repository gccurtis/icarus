import type { ConfigurationModel } from "$model/client/configuration";
import { requiredNumber } from "$model/client/configuration";
import { SlideDeckRuntimes } from "$model/client/slide-deck-runtimes/definition.svelte";
import type { SlideDeckRuntimesModel } from "$model/client/slide-deck-runtimes/types";

/**
 * Where the two thresholds are written for the server side. The client reads
 * them from the published slice rather than carrying its own copy, so a
 * deployment that tunes one tunes both.
 */
const FLUSH_AFTER_OPS = "revisions.changeSets.flushAfterOps";
const FLUSH_AFTER_MS = "revisions.changeSets.flushAfterMs";

/**
 * Returns a fresh register.
 *
 * The thresholds are read **here rather than at flush time**, so a key missing
 * from the published list fails while the graph is being built — with a message
 * naming the key and the file — instead of the first time somebody types.
 *
 * Configuration is BORROWED: the root constructed it and the root owns it. This
 * reads two values out of it at construction and never holds it afterwards.
 *
 * It takes no other dependency. It does not know about tabs, and it does not
 * need storage — nothing it holds survives a reload, by design, because an
 * unflushed buffer that outlived the browser would be an edit the user can
 * neither see nor cancel.
 */
export const createSlideDeckRuntimes = (
  configuration: ConfigurationModel
): SlideDeckRuntimesModel =>
  new SlideDeckRuntimes({
    afterOps: requiredNumber(configuration, FLUSH_AFTER_OPS),
    afterMs: requiredNumber(configuration, FLUSH_AFTER_MS)
  });
