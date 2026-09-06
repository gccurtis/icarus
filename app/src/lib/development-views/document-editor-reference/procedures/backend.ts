import type { AreaReference } from "$development-views/document-editor-reference/types";

export const backendReference: AreaReference = {
  slug: "backend",
  index: "05",
  title: "Backend and representation",
  shortTitle: "Backend",
  eyebrow: "Canonical data, capabilities, and revision acceptance",
  summary:
    "The backend owns canonical document snapshots and revision acceptance. A shared structural representation defines document content and operations; capabilities add authorization, validation, conflict detection, persistence, and comment-anchor maintenance.",
  contract:
    "The server accepts only scoped, exact, structurally valid change sets. It applies them with the same pure applier used by the optimistic client, records the accepted revision, shifts comment anchors, and returns only safe non-overlapping catch-up.",
  owns: [
    "Canonical project-owned document leaders, snapshots, revisions, and accepted change sets",
    "Scope checks, exact change-set validation, stale/overlap arbitration, and refusal reasons",
    "The shared DocumentBody, DocumentOp, mark, link, format, furniture, and anchor representations",
    "Server-side comment-anchor transformation and safe store projections"
  ],
  doesNotOwn: [
    "Editor JSON, DOM positions, pagination measurements, or zoom",
    "Client gesture history or panel state",
    "Presentation defaults for Quote and Link",
    "Automatic conflict resolution when touched structural paths overlap"
  ],
  changes: [
    {
      title: "One structural operation language spans client and server",
      before: "Mutation behavior could be implemented separately at different boundaries.",
      now: "Set, insert, remove, move, and text operations target rows/blocks/atoms/marks/document paths and apply through one immutable, invertible representation procedure.",
      why: "Shared semantics eliminate prediction drift and make every accepted mutation testable without an editor."
    },
    {
      title: "Document representation now carries complete editing semantics",
      before: "The model lacked several required style, furniture, link-note, and multi-span annotation fields.",
      now: "Block formats include spacing/line-height/indent; furniture supports normal and first-page roots; links carry optional per-occurrence notes; anchors canonically hold multiple spans while decoding legacy single spans.",
      why: "UI behavior must map to explicit durable data instead of editor-only conventions."
    },
    {
      title: "Revision acceptance is exact and scoped",
      before: "The reference branch’s useful output needed a clearer canonical acceptance boundary before integration.",
      now: "The command validates authorization, project ownership, change-set/touched agreement, base revision, operation application, and safe catch-up before advancing the leader.",
      why: "A server cannot trust optimistic client state, even when it shares the same operation vocabulary."
    },
    {
      title: "Comment anchors move on the canonical path",
      before: "Comments could drift, truncate, or keep false screen positions when text changed.",
      now: "Accepted text operations shift from/to endpoints with explicit affinities against the post-op body, filter deleted blocks/atoms, and preserve detached threads when no span remains.",
      why: "Every client—including future non-editor clients—must receive the same canonical annotation result."
    },
    {
      title: "Scoped store reads expose required comment fields",
      before: "The generic projection omitted structural within/resolution/author/update fields required by the integrated editor.",
      now: "Safe comment-thread projections include only validated fields needed for anchors, status, authorship, and ordering while retaining project ownership filtering.",
      why: "Capabilities should expose explicit safe data rather than forcing panels to bypass the boundary."
    }
  ],
  flows: [
    {
      id: "read",
      title: "Read the canonical document",
      trigger: "A scoped client query requests a document body and revision.",
      steps: [
        { actor: "Remote capability", action: "Validates the request shape and required project/resource scope.", artifact: "readDocumentBody" },
        { actor: "Store", action: "Resolves the unambiguous project-owned document leader and latest snapshot.", artifact: "document metadata + snapshot" },
        { actor: "Representation decoder", action: "Validates and strips any shared/store references from returned domain data.", artifact: "DocumentBody" },
        { actor: "Remote query", action: "Returns body and revision as the canonical runtime synchronization input.", artifact: "leader result" }
      ],
      outcome: "The client receives one validated body/revision pair for a resource it is authorized to read.",
      failure: "Missing scope, ambiguity, ownership mismatch, or invalid stored representation yields an explicit capability error."
    },
    {
      id: "submit",
      title: "Validate a document change set",
      trigger: "Document runtime submits baseRevision, operations, and touched paths.",
      steps: [
        { actor: "Remote capability", action: "Checks authorization, scope, exact input shape, and touched-path agreement.", artifact: "submitDocumentChanges" },
        { actor: "Revision gate", action: "Loads the canonical leader and compares the submitted base revision.", artifact: "leader revision" },
        { actor: "Conflict procedure", action: "Collects consecutive intervening change sets and rejects missing or overlapping history.", artifact: "catchUp + touched paths" },
        { actor: "Shared applier", action: "Applies catch-up/local operations immutably and refuses invalid structural paths or values.", artifact: "applyOps" }
      ],
      outcome: "Only an authorized, structurally valid, non-conflicting change set proceeds to canonical persistence.",
      failure: "Stale-with-overlap, missing history, invalid operations, or inconsistent touched paths return a typed refusal without advancing revision."
    },
    {
      id: "persist",
      title: "Persist an accepted revision",
      trigger: "Validation and shared operation application succeed.",
      steps: [
        { actor: "Anchor transformer", action: "Shifts every affected comment span against accepted text operations and the post-op body.", artifact: "transform-comment-anchor" },
        { actor: "Store capability", action: "Writes updated comment-thread anchors that remain within project scope.", artifact: "commentThreads" },
        { actor: "Document capability", action: "Writes the revisioned change set and creates/updates the canonical snapshot.", artifact: "documentChangeSets + snapshots" },
        { actor: "Document capability", action: "Advances document leader metadata and returns revision plus safe catch-up.", artifact: "acceptance result" }
      ],
      outcome: "Document data, revision history, metadata, and comment anchors represent the accepted operation sequence.",
      failure: "A store write failure is surfaced; current storage APIs do not yet provide a transaction across all related records."
    },
    {
      id: "apply-op",
      title: "Apply and invert native operations",
      trigger: "Client optimism, server acceptance, undo, redo, rebase, or a unit test evaluates DocumentOp arrays.",
      steps: [
        { actor: "Path resolver", action: "Locates document, body, header/footer, first-page, row, block, atom, or mark target by structural identity.", artifact: "DocumentPath" },
        { actor: "Operation applier", action: "Performs immutable set/insert/remove/move/text transformation with precondition checks.", artifact: "applyOp" },
        { actor: "Mark maintenance", action: "Shifts, trims, or prunes structural mark endpoints as text changes.", artifact: "mark ranges" },
        { actor: "Inverse builder", action: "Uses retained prior values/positions/content to produce reverse operations in reverse order.", artifact: "invertAll" }
      ],
      outcome: "Every legal operation sequence has deterministic data semantics independent of UI or transport.",
      failure: "A failed precondition or missing path returns failure and does not partially mutate the input body."
    },
    {
      id: "anchor",
      title: "Transform comment anchors",
      trigger: "An accepted text operation inserts, deletes, or replaces content.",
      steps: [
        { actor: "Anchor decoder", action: "Canonicalizes current multi-span and legacy single-span representations.", artifact: "StoredAnchorWithin" },
        { actor: "Endpoint transform", action: "Shifts start/end offsets with distinct affinity rules for boundary insertions.", artifact: "from/to affinity" },
        { actor: "Live-body filter", action: "Drops spans whose structural block or atom no longer exists after application.", artifact: "post-op DocumentBody" },
        { actor: "Thread update", action: "Persists remaining canonical spans or an empty/detached anchor state.", artifact: "commentThread.within" }
      ],
      outcome: "Comments continue to identify intended text wherever structural identity remains resolvable.",
      failure: "No guessed replacement target is created when all original structures are deleted."
    }
  ],
  domains: [
    {
      name: "Document body",
      owner: "Representation data model",
      shape: "rows of typed content blocks plus optional page setup, named styles, header/footer, and first-page furniture roots",
      states: ["validated canonical snapshot", "optimistic client projection", "post-operation candidate"],
      transitions: ["decode", "apply DocumentOp[]", "snapshot at accepted revision"],
      invariants: ["Stable IDs identify rows/blocks/atoms/marks", "Pages are not stored", "All rich furniture uses the same row/block vocabulary"],
      sources: ["src/lib/representation/data/types/documents/body.ts", "src/lib/representation/data/types/content/content-block.ts"]
    },
    {
      name: "Document operation",
      owner: "Representation operation model",
      shape: "set/insert/remove/move/text + structural target/path + inverse precondition data",
      states: ["constructed", "validated", "applied", "inverted", "refused"],
      transitions: ["intent → operation", "apply → new body", "invert → reverse operation", "capability accept → change set"],
      invariants: ["Paths use stable identity", "Removals and replacements verify prior content", "Touched paths exactly summarize submitted operations"],
      sources: ["src/lib/representation/data/types/document/operation.ts", "src/lib/representation/data/types/document/apply-ops.ts"]
    },
    {
      name: "Document leader and change set",
      owner: "Document capability/store",
      shape: "project-owned resource metadata + canonical snapshot revision + ordered accepted operation/touched-path records",
      states: ["current", "stale client base", "safe catch-up", "overlapping refusal", "accepted next revision"],
      transitions: ["read leader", "compare base", "collect catch-up", "apply/persist/advance"],
      invariants: ["Revision advances only after valid application", "Catch-up history must be consecutive", "Overlapping touched paths are not auto-merged"],
      sources: ["src/lib/capabilities/document/api/submit-document-changes/submit-document-changes.ts", "src/lib/capabilities/document/index.remote.ts"]
    },
    {
      name: "Structural mark and link",
      owner: "Document representation",
      shape: "mark ID + kind/value + structural from/to endpoints; link value adds safe URL and optional note",
      states: ["valid span", "trimmed by deletion", "shifted by insertion", "removed"],
      transitions: ["insert/remove/replace mark", "text op → endpoint maintenance"],
      invariants: ["Endpoints resolve within live structural atoms", "Link note is per occurrence", "Link appearance is represented by independent marks"],
      sources: ["src/lib/representation/data/types/content/content-block.ts", "src/lib/representation/data/behavior/documents/apply-ops.ts"]
    },
    {
      name: "Stored comment anchor",
      owner: "Store representation + document capability",
      shape: "canonical list of structural spans with from/to endpoints; legacy single-block input remains decodable",
      states: ["multi-span attached", "partially attached", "detached/empty", "legacy decoded"],
      transitions: ["create from selection", "accepted text op → shift/filter", "resolve for display"],
      invariants: ["Server transform uses post-op body", "Deleted identities are never guessed", "An empty anchor does not delete the discussion"],
      sources: ["src/lib/representation/data/types/collaboration/anchor.ts", "src/lib/capabilities/document/api/submit-document-changes/transform-comment-anchor.ts"]
    },
    {
      name: "Safe store projection",
      owner: "Generic store capability",
      shape: "scope-filtered records with a per-table allowlist of validated fields",
      states: ["authorized result", "empty result", "invalid/ambiguous refusal"],
      transitions: ["query → scope filter → field projection → decode"],
      invariants: ["Project ownership is enforced", "Secrets/internal references remain omitted", "Comment anchor and resolution fields are explicitly allowlisted"],
      sources: ["src/lib/capabilities/store/api/read/scoped-read.ts", "src/lib/capabilities/store/index.remote.ts"]
    }
  ],
  procedures: [
    {
      name: "applyOp / applyOps",
      role: "Immutably execute the native document language across body and furniture roots.",
      reads: "Validated body, structural paths, operations, and inverse preconditions.",
      writes: "A new DocumentBody value only.",
      failure: "Returns typed failure on missing identity, mismatch, invalid location, or unsupported mutation.",
      sources: ["src/lib/representation/data/behavior/documents/apply-ops.ts"]
    },
    {
      name: "invert / invertAll",
      role: "Derive reverse operations using retained prior values, content, and structural placement.",
      reads: "Forward operations carrying inverse data.",
      writes: "A reversed inverse operation array.",
      failure: "Construction-time validation prevents non-invertible mutation shapes.",
      sources: ["src/lib/representation/data/behavior/documents/apply-ops.ts"]
    },
    {
      name: "readDocumentBody",
      role: "Return the unambiguous canonical body/revision within caller scope.",
      reads: "Authorization context, project/resource IDs, document metadata and snapshot.",
      writes: "No domain data; returns validated query result.",
      failure: "Rejects absent scope, ownership mismatch, ambiguity, missing leader, or invalid stored body.",
      sources: ["src/lib/capabilities/document/api/read-document-body/read-document-body.ts"]
    },
    {
      name: "submitDocumentChanges",
      role: "Validate, arbitrate, apply, persist, and acknowledge one revisioned change set.",
      reads: "Caller scope, base revision, ops/touched, leader snapshot, intervening history.",
      writes: "Shifted anchors, change set, snapshot, and document leader metadata.",
      failure: "Returns stale/overlap/unresolved/invalid/store refusals without counterfeit acceptance.",
      sources: ["src/lib/capabilities/document/api/submit-document-changes/submit-document-changes.ts"]
    },
    {
      name: "collect catch-up / overlap check",
      role: "Build a consecutive remote operation sequence and determine whether its touched paths conflict with local intent.",
      reads: "Accepted change sets after client base revision and local touched paths.",
      writes: "Safe catch-up result or refusal.",
      failure: "Missing revisions or intersecting structural paths cannot auto-rebase.",
      sources: ["src/lib/capabilities/document/api/submit-document-changes/submit-document-changes.ts"]
    },
    {
      name: "transformCommentAnchor",
      role: "Shift and filter persisted comment spans on the canonical accepted text-operation path.",
      reads: "Stored anchor, accepted operations, pre/post-operation structural body.",
      writes: "Canonical updated within value for each affected thread.",
      failure: "Unresolvable spans are removed from within; the thread remains as detached discussion.",
      sources: ["src/lib/capabilities/document/api/submit-document-changes/transform-comment-anchor.ts"]
    },
    {
      name: "scoped store read",
      role: "Project and return only safe table fields within the caller’s project boundary.",
      reads: "Scope, requested table, stored records, field allowlist.",
      writes: "No domain data; produces a validated projection.",
      failure: "Unknown tables/shapes, ambiguous ownership, or out-of-scope records are rejected/omitted.",
      sources: ["src/lib/capabilities/store/api/read/scoped-read.ts"]
    }
  ],
  structure: [
    { path: "src/lib/representation/data/types/documents/* + content/*", role: "Document model", note: "Rows, blocks, atoms, formats, styles, marks, links, page setup, furniture, and operations." },
    { path: "src/lib/representation/data/behavior/documents/apply-ops.ts", role: "Operation representation", note: "Structural resolution, validation, immutable application, mark maintenance, and inversion." },
    { path: "src/lib/representation/data/types/collaboration/anchor.ts + representation/store/tables.ts", role: "Store model", note: "Comment thread/comment/user records and canonical/legacy anchor shapes." },
    { path: "src/lib/capabilities/document/api/*", role: "Document capability boundary", note: "Authorization, query, submit validation, catch-up, conflict refusal, persistence, and acknowledgement." },
    { path: "src/lib/capabilities/document/api/submit-document-changes/transform-comment-anchor.ts", role: "Annotation maintenance", note: "Canonical endpoint affinity, shift/filter, and detached behavior." },
    { path: "src/lib/capabilities/store/api/read/scoped-read.ts", role: "Generic store capability", note: "Scoped safe-field projection used by workspace queries." }
  ],
  review: [
    { tone: "settled", title: "Representation is editor-independent", detail: "The operation model, applier, inverse behavior, furniture, links, and anchors can be tested without Svelte or ProseMirror." },
    { tone: "settled", title: "Server acceptance distrusts the client", detail: "Scope, exact shapes, touched paths, revision continuity, structural application, and ownership are all revalidated." },
    { tone: "watch", title: "Multi-record acceptance lacks a storage transaction", detail: "Anchor, change-set, snapshot, and metadata writes are ordered but not atomic under the current generic store API. A transactional capability is the principal durability follow-up." },
    { tone: "watch", title: "The shared applier is a complexity hotspot", detail: "Its size reflects all structural roots and operation kinds. Future splits should preserve one public apply/invert contract and avoid separate client/server implementations." }
  ],
  related: ["runtime", "content", "context", "inspector"]
};
