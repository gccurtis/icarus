# Knowledge retrieval

Knowledge retrieval returns verbatim, grounded Text-lattice regions. It does not
synthesize answers or perform canonical Resource reads. Resource owns current
origin reading; Knowledge returns indexed evidence with immutable generation
provenance.

## One stable read

Every public retrieval (`Retrieve`, `RetrieveExact`, `RetrieveMany`, and
`RetrieveScopedMany`) runs the same protocol:

```text
capture active ReadToken + EmbeddingSpace
  → obtain generation-pinned ArtifactStore
  → embed query through exact provider/model identity
  → rank by descent or exact scan
  → hydrate source metadata + literal window content in that view
  → validate and merge evidence
  → recheck ReadToken
```

`ReadToken` contains Project, lattice kind, generation ID, state revision, and
source cursor. A promotion, rollback, add, replacement, or removal makes it
stale. Knowledge retries the entire operation once; a second race returns
`knowledge.evidence_changed`.

Configuration drift cannot strand the active generation: the Intelligence
adapter exposes `EmbedExact(provider, model, inputs)`, using only an already
configured provider and never accepting credentials from the caller.

## Ranking paths

`RetrieveExact` ranks every window and is the certification oracle.
`Retrieve` enters through directed lattice descent. Descent walks the derived
frontier best-first, bounded by threshold, beam, and expansion ceiling. If it
finds no candidates, retrieval uses the exact scan and reports
`mode:"exact-fallback"`.

All ranking is deterministic for equal scores through artifact-ID tie breaks.
Stored vectors and the query must have the active space's exact dimension and
finite components.

Descent also fails closed on structural corruption. Every frontier node must
exist; node counts and member IDs must be valid; each member must resolve to
exactly one window or lower-level node; child levels must decrease; and every
final candidate must materialize. Missing graph data is
`knowledge.evidence_corrupt`, not a smaller plausible-looking answer.

## Evidence hydration

Ranking rows intentionally omit literal text. Hydration loads:

- source metadata by `LocalRefID`;
- exact content for every ranked `WindowID`; and
- all records from the same generation-pinned store view.

Before emitting a region, Knowledge verifies:

- source presence, Project identity, revision/hash, and active vector identity;
- window presence, ID/ref consistency, finite exact-width vector;
- `0 <= start <= end <= source.sizeBytes`;
- `len(window.text) == end-start`;
- ordered, in-range source block spans;
- exact window block references; and
- byte-for-byte equality wherever windows overlap or contain one another.

Any stable violation returns `knowledge.evidence_corrupt`. If the active token
changed while the violation was observed, the whole retrieval retries once,
because a racing replacement may be the cause. Partial/shortened citations are
never returned.

## Regions and provenance

Overlapping or touching windows from the same source merge into a contiguous
region. Relevance is the best contributing score; density is the number of
contributing ranked windows. Regions are admitted under the configured character
budget, with the existing bounded dense-region overage.

Every region carries:

```json
{
  "sourceType": "document",
  "sourceId": "doc-id",
  "indexedRevision": 7,
  "generationId": "generation-id",
  "sourceHash": "sha256",
  "windowIds": ["window-a", "window-b"],
  "start": 120,
  "end": 480,
  "relevance": 0.81,
  "density": 2,
  "text": "verbatim indexed evidence",
  "blocks": [{"rowId":"row-id","blockId":"block-id"}]
}
```

Agent evidence and durable Document prompt evidence preserve generation ID,
source hash, contributing window IDs, and indexed revision. Those fields state
what snapshot was cited. A later exact Resource read has separate direct-origin
version/hash provenance and must not be represented as this indexed snapshot.

`RetrieveResult` also reports the generation ID, source cursor, embedding-space
identity, mode, and complete query-embedding usage (tokens, requests, and
provider-reported cost).

## Scope

`RetrieveScopedMany` restricts candidates to an explicit origin allow-list while
retaining the generation protocol. General project retrieval is still
Project-scoped rather than requester-aware; Ω-009 owns propagation of caller
identity and per-Resource access filtering. Ω-005 does not disguise that later
authorization contract as generation work.
