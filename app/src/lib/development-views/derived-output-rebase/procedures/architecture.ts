export const TRANSACTION_ENTRIES = [
  {
    entry: "Document save",
    authored: "revision · snapshot · metadata · comments",
    semantic: "exact-text outbox",
    proof: "document Store fault + restart recovery"
  },
  {
    entry: "Slide-deck save",
    authored: "revision · snapshot · metadata",
    semantic: "exact-text + material outbox",
    proof: "slide-deck Store fault + restart recovery"
  },
  {
    entry: "Spreadsheet save",
    authored: "revision · snapshot · current representation",
    semantic: "material outbox when projection changes",
    proof: "spreadsheet atomicity + ownership suites"
  },
  {
    entry: "Project resource create",
    authored: "resource · leader · first snapshot · metadata",
    semantic: "kind-appropriate outbox",
    proof: "creation rollback + restart recovery"
  },
  {
    entry: "Template instantiate",
    authored: "copy · snapshot · metadata · template linkage",
    semantic: "kind-appropriate outbox",
    proof: "three-kind instantiation fault matrix"
  }
] as const;

export const QUEUE_RULES = [
  ["Claim", "One Store transaction changes queued → running and writes a random owner token plus a five-minute lease."],
  ["Join", "Only the token owner may settle a claim; concurrent processors cannot both publish the same job."],
  ["Recover", "A running job is reclaimable only after its lease expires, so an interrupted process cannot strand it forever."],
  ["Retry", "Provider failure is bounded at three attempts; exhaustion becomes a terminal failed row rather than an infinite spinner."],
  ["Supersede", "A newer authored revision resets obsolete work to the new revision and prevents an older result from becoming current."],
  ["Fail closed", "Derived Output and Research Chat refuse stale knowledge when any required newer job is queued, running or terminally failed."]
] as const;

export const OPERATION_OWNERS = [
  {
    owner: "ServerModel.operationFlights",
    holds: "shared promises · AbortControllers · stop flags · deadline handles",
    lifetime: "one server process",
    shutdown: "abort all, clear timers, release references"
  },
  {
    owner: "semanticSyncJobs / semanticMaterialJobs",
    holds: "revision · state · attempt · owner token · lease · failure",
    lifetime: "durable Store row",
    shutdown: "nothing; expired work is reclaimable"
  },
  {
    owner: "derivedOutputRefreshJobs",
    holds: "request key · definition revision · queued/running/failed state",
    lifetime: "durable Store row",
    shutdown: "same request can resume or report failure"
  }
] as const;

export const CURRENT_SCHEMA_CUTS = [
  "No stored Derived Output state named generating",
  "No persisted PromptBlock generating flag",
  "No semantic locator resourceTitle fallback",
  "No defaulted definitionRevision or missing material scopeRefs",
  "No empty legacy PromptBlock interpretation",
  "No deleted document typography or slide normalization reader, and no legacy collaboration-anchor union",
  "No production /app reference route"
] as const;

export const ARCHITECTURE_FILES = [
  ["Transaction seam", "capabilities/semantic-overlay/api/shared/outbox.ts"],
  ["Lease protocol", "capabilities/semantic-overlay/api/shared/durable-queue.ts"],
  ["Exact worker", "capabilities/semantic-overlay/api/shared/queue-processor.ts"],
  ["Material worker", "capabilities/semantic-overlay/api/shared/material-queue-processor.ts"],
  ["Process owner", "model/server/operation-flights/"],
  ["Composition root", "runtime/server/start.server.ts"],
  ["Ownership checker", "scripts/lint/shared/module-load.mjs"]
] as const;
