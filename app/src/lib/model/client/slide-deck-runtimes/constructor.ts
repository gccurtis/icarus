import type { ConfigurationModel } from "$model/client/configuration";
import { requiredNumber } from "$model/client/configuration";
import { SlideDeckRuntimes } from "$model/client/slide-deck-runtimes/definition.svelte";
import type { SlideDeckRuntimesModel } from "$model/client/slide-deck-runtimes/types";

const FLUSH_AFTER_OPS = "revisions.changeSets.flushAfterOps";
const FLUSH_AFTER_MS = "revisions.changeSets.flushAfterMs";

export const createSlideDeckRuntimes = (
  configuration: ConfigurationModel
): SlideDeckRuntimesModel =>
  new SlideDeckRuntimes({
    afterOps: requiredNumber(configuration, FLUSH_AFTER_OPS),
    afterMs: requiredNumber(configuration, FLUSH_AFTER_MS)
  });
