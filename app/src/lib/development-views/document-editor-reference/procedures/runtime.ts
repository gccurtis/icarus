import type { AreaReference } from "$development-views/document-editor-reference/types";

export const runtimeReference: AreaReference = {
  slug: "runtime",
  index: "04",
  title: "Document runtime",
  shortTitle: "Runtime",
  eyebrow: "Optimistic state, history, and synchronization",
  summary:
    "The runtime is the client-side authority for an open document. It keeps one optimistic body, turns gestures into history, coalesces transport work, reconciles server catch-up, and exposes failure without discarding user edits.",
  contract:
    "All editor surfaces attach to the same per-resource runtime. apply is synchronous and optimistic; flush is asynchronous and revisioned. Wire batching may combine operations, but user-gesture undo boundaries are never rewritten.",
  owns: [
    "Live DocumentBody, server revision, sync state, buffered operations, and failure details",
    "Gesture-level undo/redo stacks and ephemeral pending marks/scroll intent",
    "Flush scheduling, wire coalescing, catch-up, retry, discard, and remote synchronization",
    "Per-workspace registries that share one runtime/query instance across surfaces"
  ],
  doesNotOwn: [
    "Editor DOM or ProseMirror state",
    "Server validation, authorization, or canonical snapshots",
    "Workspace panel selection and layout",
    "Semantic operation definitions independent from the shared representation"
  ],
  changes: [
    {
      title: "The runtime becomes the sole client body",
      before: "Different editor and panel paths could behave like separate state owners.",
      now: "Content, Context, and Inspector attach through the workspace to one per-resource runtime and all derive from runtime.body.",
      why: "Optimistic editing can only converge if every client surface observes the same state machine."
    },
    {
      title: "Optimism and persistence use one applier",
      before: "Duplicated mutation semantics could drift between client and server.",
      now: "runtime.apply and the server capability both invoke the shared representation applier over the same validated DocumentOp language.",
      why: "The user-visible prediction must match canonical server application exactly."
    },
    {
      title: "Wire batching no longer rewrites undo",
      before: "Transport efficiency risked determining the shape of local history.",
      now: "Every runtime.apply records a gesture entry; flush coalesces only the outgoing wire operations.",
      why: "Undo should reverse what the person did, not how the network grouped it."
    },
    {
      title: "Conflict and failure become explicit states",
      before: "A refused or failed save could disappear behind an apparently clean editor.",
      now: "Runtime exposes saving, rebasing, needs-review, offline, and error states; rejected operations remain available for retry or explicit discard.",
      why: "Recoverability requires preserving both user intent and the reason it could not be accepted."
    },
    {
      title: "Store queries move to workspace lifetime",
      before: "Short-lived inspector lenses could create/destroy derived remote state and produce inert-derived console warnings.",
      now: "Workspace constructs persistent table queries and username once, then exposes readStore/readUsername to all surfaces.",
      why: "Resource lifetime should follow the workspace that consumes it, not whichever lens happens to be mounted."
    }
  ],
  flows: [
    {
      id: "attach",
      title: "Attach a document",
      trigger: "Content, Context, or Inspector requests a runtime by resource ID.",
      steps: [
        { actor: "Workspace", action: "Delegates resource lookup to the document runtime registry.", artifact: "documentRuntime(resourceId)" },
        { actor: "Runtime registry", action: "Reuses an open instance, revives a settling instance, or constructs one.", artifact: "attach" },
        { actor: "Runtime", action: "Reads the latest server leader body/revision when newly constructed or safely settled.", artifact: "sync" },
        { actor: "Surface", action: "Reads reactive body, sync, history, failure, pending marks, and scroll intent.", artifact: "Runtime state" }
      ],
      outcome: "Every surface for the resource receives the same live body and synchronization state.",
      failure: "Transport failure retains the runtime and exposes error/offline state for recovery."
    },
    {
      id: "apply",
      title: "Apply a local gesture",
      trigger: "A content or panel procedure submits native operations.",
      steps: [
        { actor: "Runtime.apply", action: "Applies operations immediately with the shared immutable applier.", artifact: "applyOps" },
        { actor: "Runtime.apply", action: "Computes/stores inverse operations as one undo gesture and clears redo.", artifact: "history entry" },
        { actor: "Runtime.apply", action: "Appends operations and touched paths to the outgoing buffer.", artifact: "buffer" },
        { actor: "Scheduler", action: "Flushes when time or operation-count thresholds are reached.", artifact: "timer / threshold" }
      ],
      outcome: "The UI updates synchronously while durable submission is safely deferred and batchable.",
      failure: "A locally invalid operation is refused before body/history/buffer mutation."
    },
    {
      id: "accept",
      title: "Flush and accept",
      trigger: "The buffer reaches a threshold, its timer fires, release begins, or retry is requested.",
      steps: [
        { actor: "Runtime.flush", action: "Moves buffered work into one in-flight change set and coalesces wire operations.", artifact: "baseRevision + ops + touched" },
        { actor: "Server capability", action: "Validates scope/change-set shape and applies against the canonical leader.", artifact: "submitDocumentChanges" },
        { actor: "Runtime", action: "Applies any non-overlapping catch-up returned with acceptance.", artifact: "catchUp" },
        { actor: "Runtime", action: "Advances revision, clears in-flight state, and returns to saved or flushes newer buffer work.", artifact: "sync=saved" }
      ],
      outcome: "Optimistic and canonical bodies converge without altering local gesture history.",
      failure: "A transport error restores in-flight operations ahead of newer buffered work and retains an actionable failure."
    },
    {
      id: "stale",
      title: "Rebase a stale submission",
      trigger: "The server refuses because the client base revision is behind and supplies safe catch-up operations.",
      steps: [
        { actor: "Runtime", action: "Enters rebasing and applies catch-up before local in-flight/buffered intent.", artifact: "prepend/rebase" },
        { actor: "Runtime", action: "Rebuilds local optimistic body with shared operation semantics.", artifact: "applyOps" },
        { actor: "Runtime", action: "Retries the submission once against the advanced revision.", artifact: "flush retry" },
        { actor: "Runtime", action: "Returns to saved on acceptance or needs-review on unresolved overlap.", artifact: "sync state" }
      ],
      outcome: "Non-overlapping remote and local changes converge automatically.",
      failure: "Overlapping or unresolvable work remains visible with failure context; it is never silently discarded."
    },
    {
      id: "recover",
      title: "Recover from a refused save",
      trigger: "Runtime is in needs-review, offline, or error with retained operations.",
      steps: [
        { actor: "Editor chrome", action: "Displays sync state and the preserved failure reason.", artifact: "runtime.failure" },
        { actor: "Retry", action: "Requeues retained operations and attempts a fresh flush/sync path.", artifact: "runtime.retry" },
        { actor: "Discard", action: "Requires an explicit user action to abandon retained local operations.", artifact: "runtime.discard" },
        { actor: "Runtime.sync", action: "Reads and installs the canonical server leader only after local work is settled/discarded.", artifact: "remote query refresh" }
      ],
      outcome: "The user chooses whether to retry intent or return to canonical state.",
      failure: "Repeated transport failure preserves the same recoverable state."
    },
    {
      id: "release",
      title: "Release workspace resources",
      trigger: "The client workspace closes.",
      steps: [
        { actor: "Client runtime", action: "Flushes pending workspace/store work.", artifact: "workspace.flush" },
        { actor: "Runtime registries", action: "Release all document, deck, and sheet runtimes.", artifact: "releaseAll" },
        { actor: "Document runtime", action: "Enters settling and flushes remaining document operations.", artifact: "release" },
        { actor: "Query registry", action: "Releases persistent remote table/resource queries.", artifact: "query release" }
      ],
      outcome: "Closing the client does not intentionally drop buffered work or leave workspace queries rooted.",
      failure: "Flush failure remains represented by runtime failure until the client lifetime ends."
    }
  ],
  domains: [
    {
      name: "Runtime synchronization",
      owner: "Document Runtime",
      shape: "body + revision + sync + buffer + inFlight + timer + pendingFlush + failure",
      states: ["loading", "saved", "saving", "rebasing", "needs-review", "offline", "error"],
      transitions: ["construct → loading → saved", "apply → saving", "stale → rebasing", "unresolved → needs-review", "retry/discard → saving/saved"],
      invariants: ["body includes all optimistic intent", "At most one flush promise is in flight", "Failed operations are retained until explicit recovery"],
      sources: ["src/lib/model/client/document-runtimes/definition.svelte.ts", "src/lib/model/client/document-runtimes/types.ts"]
    },
    {
      name: "Gesture history",
      owner: "Document Runtime",
      shape: "undo and redo stacks of forward/inverse DocumentOp arrays",
      states: ["empty", "undoable", "redoable"],
      transitions: ["apply → push undo/clear redo", "undo → apply inverse/push redo", "redo → apply forward/push undo"],
      invariants: ["One user gesture is one history entry", "Wire coalescing never rewrites history", "Undo itself persists through the normal buffer"],
      sources: ["src/lib/model/client/document-runtimes/definition.svelte.ts"]
    },
    {
      name: "Runtime registry entry",
      owner: "Document runtime constructor/registry",
      shape: "resource ID → Runtime + attachment/lifetime state",
      states: ["absent", "open", "settling", "released"],
      transitions: ["attach → open", "release → settling", "reattach → open", "settled → released"],
      invariants: ["One runtime instance per open resource", "Reattachment reuses safely settling state", "Release flushes before disposal"],
      sources: ["src/lib/model/client/document-runtimes/constructor.svelte.ts", "src/lib/model/client/document-runtimes/definition.svelte.ts"]
    },
    {
      name: "Workspace store queries",
      owner: "Workspace client model",
      shape: "persistent query per table name + username query + readStore/readUsername accessors",
      states: ["lazy/unread", "loading", "available", "error", "released"],
      transitions: ["workspace construct → register", "first read → fetch", "remote change → refresh", "workspace close → release"],
      invariants: ["Lens mount lifetime does not own a query", "All consumers share the same scoped table projection", "Query errors remain observable"],
      sources: ["src/lib/model/client/workspace-state/definition.svelte.ts", "src/lib/runtime/client/start.ts"]
    }
  ],
  procedures: [
    {
      name: "attach / release / releaseAll",
      role: "Manage one per-resource runtime across open, settling, reuse, and disposal.",
      reads: "Registry entries and resource IDs.",
      writes: "Registry lifetime and pending flush work.",
      failure: "Release does not intentionally discard buffered work.",
      sources: ["src/lib/model/client/document-runtimes/constructor.svelte.ts", "src/lib/model/client/document-runtimes/definition.svelte.ts"]
    },
    {
      name: "apply",
      role: "Optimistically apply one user gesture and record its reversible history/buffer data.",
      reads: "Current live body, revision, operation array, touched paths.",
      writes: "body, undo/redo, buffer, sync state, flush schedule.",
      failure: "Shared applier rejection leaves runtime state unchanged.",
      sources: ["src/lib/model/client/document-runtimes/definition.svelte.ts", "src/lib/representation/data/types/document/apply-ops.ts"]
    },
    {
      name: "flush",
      role: "Serialize buffered work into one revisioned command while preserving concurrent local additions.",
      reads: "base revision, buffered/in-flight operations and touched paths.",
      writes: "in-flight/buffer state, revision, body catch-up, sync/failure.",
      failure: "Transport work is restored in order; semantic refusal moves to review state.",
      sources: ["src/lib/model/client/document-runtimes/definition.svelte.ts", "src/lib/capabilities/document/index.remote.ts"]
    },
    {
      name: "sync",
      role: "Install a freshly read canonical leader only when the runtime has no local/in-flight work.",
      reads: "Remote body/revision query and a rechecked settled condition.",
      writes: "body, revision, and sync state.",
      failure: "A changed local state during the round trip prevents unsafe overwrite.",
      sources: ["src/lib/model/client/document-runtimes/definition.svelte.ts"]
    },
    {
      name: "retry / discard",
      role: "Make recovery from retained failure explicit and user-directed.",
      reads: "Failure detail and retained operations.",
      writes: "Requeued buffer or canonical resynchronization state.",
      failure: "Further refusal remains visible; neither path pretends a save succeeded.",
      sources: ["src/lib/model/client/document-runtimes/definition.svelte.ts"]
    },
    {
      name: "workspace readStore / readUsername",
      role: "Provide stable, shared access to scoped remote store data for panels and annotations.",
      reads: "Persistent query registry constructed at workspace startup.",
      writes: "No domain data; accessors expose query values/errors.",
      failure: "Errors remain query state and do not create per-lens replacement queries.",
      sources: ["src/lib/model/client/workspace-state/definition.svelte.ts", "src/lib/runtime/client/start.ts"]
    }
  ],
  structure: [
    { path: "src/lib/model/client/document-runtimes/definition.svelte.ts", role: "Runtime state machine", note: "Live body, apply/history, buffer, flush/rebase, failure, retry/discard, and release behavior." },
    { path: "src/lib/model/client/document-runtimes/types.ts", role: "Runtime contracts", note: "Sync/failure/change-set and public runtime shapes." },
    { path: "src/lib/model/client/document-runtimes/constructor.svelte.ts", role: "Registry", note: "Per-resource attachment, reuse, settling, and release lifecycle." },
    { path: "src/lib/model/client/workspace-state/definition.svelte.ts", role: "Workspace composition", note: "Shares document runtimes and persistent scoped store queries with all surfaces." },
    { path: "src/lib/runtime/client/start.ts", role: "Client bootstrap", note: "Constructs configuration, store, runtimes, tabs/views/workspace and owns whole-client shutdown." }
  ],
  review: [
    { tone: "settled", title: "Optimistic/canonical semantics are shared", detail: "The runtime and server wrapper invoke the same immutable operation applier; tests cover apply/invert and rebase behavior." },
    { tone: "settled", title: "Failure is recoverable", detail: "Buffers and failure context survive refusal or transport error; retry and discard are distinct explicit actions." },
    { tone: "watch", title: "Individual tab-close release is not wired", detail: "Production startup calls releaseAll on whole-client close, but no current tab-close path calls documentRuntimes.release(resourceId). Per-document runtimes therefore live for the workspace lifetime today." },
    { tone: "watch", title: "Cross-record server commit is not transactional", detail: "The backend writes change-set, snapshot, metadata, and shifted comment anchors through separate store operations; stronger storage transactions remain a future durability seam." }
  ],
  related: ["content", "context", "inspector", "backend"]
};
