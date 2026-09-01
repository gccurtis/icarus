import type { ConfigurationModel } from "$model/client/configuration";
import { requiredNumber } from "$model/client/configuration";
import { DocumentRuntimes } from "$model/client/document-runtimes/definition.svelte";
import type { DocumentRuntimesModel } from "$model/client/document-runtimes/types";

const FLUSH_AFTER_OPS = "revisions.changeSets.flushAfterOps";
const FLUSH_AFTER_MS = "revisions.changeSets.flushAfterMs";

export const createDocumentRuntimes = (configuration: ConfigurationModel): DocumentRuntimesModel =>
  new DocumentRuntimes({
    afterOps: requiredNumber(configuration, FLUSH_AFTER_OPS),
    afterMs: requiredNumber(configuration, FLUSH_AFTER_MS)
  });
