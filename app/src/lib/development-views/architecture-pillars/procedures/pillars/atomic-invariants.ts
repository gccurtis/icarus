import type { ArchitecturePillar } from "$development-views/architecture-pillars/types";

export const ATOMIC_INVARIANTS: ArchitecturePillar = {
  code: "PIL-05",
  slug: "atomic-invariants",
  name: "One domain intent commits as one unit",
  short: "The persistence owner must uphold all-or-nothing invariants across every row an intent changes.",
  thesis:
    "A capability can describe one valid business action while issuing several individually atomic writes. If the model cannot commit that set together, the domain invariant is still weaker than the capability contract.",
  supports:
    "This protects revision history, creation flows, comment threads, and any represented relationship from partially persisted state—even when disk, process, or adapter failures occur midway.",
  contract: [
    "The capability names and validates one domain intent; it does not attempt best-effort recovery itself.",
    "The persistence-owning model exposes a transaction/unit-of-work for every multi-record invariant.",
    "Commit is atomic across the complete write set or recoverable from a durable journal after restart.",
    "Revision snapshot, leader metadata, and change-set acknowledgement advance together.",
    "Tests inject failure at every durable step and compare the complete store before and after."
  ],
  example: {
    title: "Starting one comment thread performs two independent commits",
    source: "capabilities/comments/api/start-thread/start-thread.ts",
    shape: `threadId = store.create("commentThreads", thread)
commentId = store.create("comments", openingComment)
return { threadId, commentId }`,
    observed:
      "Each Store create atomically rewrites its own table file. A failure after the thread write but before the comment write leaves a thread with no opening comment. Resource creation and document/presentation revision submission contain analogous multi-table sequences.",
    antagonism:
      "The capability's single intent is stronger than the model operation it can call. The server behavior looks coherent in one procedure while the durable state can expose an impossible intermediate outcome.",
    repair:
      "Use StoreModel.transaction, stage every affected table through its scoped unit, and let the existing journal and restart recovery publish the complete intent. Capabilities call that model boundary once.",
    nuance:
      "Catching the second error and deleting the first row is not equivalent: rollback can also fail, exposes intermediate state, and duplicates persistence behavior in capabilities."
  },
  equivalence: {
    rule: "One externally visible intent requires more than one durable mutation and those mutations can commit independently.",
    generalRepair:
      "Move the atomic unit into the persistence model, call it once from the capability, and prove all-or-none behavior with injected failures and restart recovery.",
    members: [
      "Resource row plus leader snapshot creation",
      "Comment thread plus opening comment",
      "Change set plus snapshot plus leader/revision metadata",
      "Removal of a parent and its owned children",
      "Any denormalized index updated separately from its authoritative record"
    ]
  },
  desiredFlow: [
    "Capability validates one intent and establishes authorized current state",
    "Capability builds or requests a complete unit of work",
    "Store model validates every affected table's proposed next state",
    "Persistence adapter records commit intent and atomically publishes it",
    "Recovery either completes or discards the unit before serving reads"
  ],
  checkers: [
    {
      id: "TXN-01",
      name: "storage-is-reached-through-a-model",
      status: "Enforced",
      wave: 1,
      mechanism: "Import/call graph",
      guarantee: "Capabilities do not open files or database clients directly; persistence is model-owned.",
      detects: "Direct storage adapters, node filesystem modules, or persistence libraries in capability code.",
      implementation: "Retain capabilities/storage-through-a-model and representation/store-opens-nothing.",
      current: "Enforced and clean for production server code.",
      limit: "Routing each individual write through StoreModel says nothing about atomicity across writes."
    },
    {
      id: "TXN-02",
      name: "multi-write-capability-uses-a-unit-of-work",
      status: "Enforced",
      wave: 1,
      mechanism: "TypeScript call graph",
      guarantee: "A capability entry cannot issue multiple durable mutations outside one transaction boundary.",
      detects: "Two or more reachable Store create/update/remove/replace calls without a containing transaction callback or typed atomic model method.",
      implementation:
        "Count durable mutation effects across the local procedure call graph, not merely one file. Fail with the complete call path and affected subjects.",
      current: "Enforced across the local capability call graph with transaction-context propagation; eleven existing multi-write procedures are baselined.",
      limit: "One write can still violate a cross-record invariant, and two writes may be intentionally independent jobs. An explicit intent classification resolves rare exceptions."
    },
    {
      id: "TXN-03",
      name: "multi-table-intent-is-atomic",
      status: "Enforced",
      wave: 1,
      mechanism: "Persistence fault-injection contract test",
      guarantee: "Every multi-table capability leaves either the old complete state or the new complete state.",
      detects: "Partial writes at each staged operation, rename, flush, manifest publication, and returned acknowledgement.",
      implementation:
        "Require each multi-write capability entry to be imported by its own non-functional atomicity test (or an explicit shared Store contract), inject failures at durable boundaries, restart StoreModel, and assert a complete outcome.",
      current: "Enforced through executable per-intent failpoint contracts; eleven uncovered intents remain baselined, while template removal is covered and clean.",
      limit: "The failpoint inventory must evolve with the adapter; otherwise a new durable step can escape coverage."
    },
    {
      id: "TXN-04",
      name: "journal-recovers-before-readiness",
      status: "Enforced",
      wave: 2,
      mechanism: "Server initialization contract test",
      guarantee: "A process restart never serves a half-published transaction.",
      detects: "Unreplayed journals, partially swapped files, stale manifests, and initialization announcing ready before recovery.",
      implementation:
        "Seed every interrupted journal phase, construct ServerModel, and assert recovery completes before a capability can observe Store.",
      current: "Enforced and clean: Store recovery runs before table loading, and executable failpoint tests cover rollback, replay, repeated restart, and readiness refusal.",
      limit: "This check is adapter-specific beneath a common model contract; a database implementation will use transaction rollback tests instead."
    },
    {
      id: "TXN-05",
      name: "revision-state-advances-together",
      status: "Enforced",
      wave: 2,
      mechanism: "Subject invariant test",
      guarantee: "Snapshot, change set, resource leader, and revision number always describe the same accepted edit history.",
      detects: "Orphan snapshots/change sets, leader pointers to absent bodies, duplicate revision acceptance, and acknowledged but invisible edits.",
      implementation:
        "Identify resource-revision submissions by their submit-*-changes entry, then define a reusable revision invariant assertion and run it before/after success, conflict, injected persistence failure, and restart for every editor subject.",
      current: "Enforced; document and presentation revision atomicity contracts are baselined as missing.",
      limit: "This domain check complements rather than replaces generic transaction fault testing; incidental maintenance of snapshots or change sets outside a submit-*-changes entry does not make a capability a revision subject."
    }
  ],
  rollout: [
    "Use the implemented Store unit-of-work and durable JSON journal as the boundary for each multi-write capability.",
    "Convert comment thread creation as the smallest atomic capability slice and register its fault contract.",
    "Move each of the eleven baselined multi-write intents inside one transaction callback and contract case.",
    "Complete revision atomicity for documents and presentations, removing baseline records as each invariant passes."
  ],
  relatedFindings: ["ARCH-02"]
};
