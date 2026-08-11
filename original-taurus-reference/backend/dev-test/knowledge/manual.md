# Manual test: knowledge lattice

This is the by-hand version of [`run.sh`](run.sh). The **knowledge** capability
maintains a per-project **retrieval lattice** over source text. Adding a source
(a document today) flattens it to text, splits it into overlapping **windows**,
**embeds** each window, and **clusters** the windows into cluster artifacts —
by the KLR rule: a cluster is a maximal group whose members are *all pairwise*
similar above a level-relative threshold; clusters may overlap, and windows that
cluster nowhere stay orphans and carry upward unchanged —
within a source, then across the project's sources (the corpus tier clusters
every source's **frontier**: its roots plus its unclustered orphans). A source
ends as a forest, never a forced single summary. **Retrieval** embeds a query
and returns grounded, cited spans. The production path is the **exact scan**
(rank every window); with `knowledge.descent.enabled` the lattice is walked
best-first from its frontier instead, and with `descent.audit` on, every
result reports how descent compared to the exact scan
(`"audit":{"recall":…,"candidates":…,"windows":…}`). Each response names its
path in `"mode"` (`exact`, `descent`, or `exact-fallback` when pruning left
nothing).

These endpoints live under **`/dev`**: ingestion is normally driven by resource
changes, not called directly, so they are not part of the production client
surface. They are **project-scoped and gated** — sign in and select a project
first (see the [projects manual](../projects/manual.md)).

The core serves **HTTPS** (self-signed in dev), so `curl` uses `-k`, with the
session cookie in `-b cookies.txt`.

## Why this suite needs a real key

Windowing, storage, and retrieval *plumbing* are covered by unit tests with a
fake embedder. But whether the lattice **clusters and retrieves well** — whether a
query about one topic actually lands on the right source — only means anything
against **real embeddings**. So this suite makes live embedding calls and asserts
on retrieval *quality*. Without a key there is nothing to prove, and the automated
[`run.sh`](run.sh) **skips**.

## Prerequisites

- Go toolchain; run from the **project root** (`taurus-omega/`).
- A real OpenRouter key in a gitignored `etc/config.local.yaml` (overlaid on the
  committed [`etc/config.yaml`](../../etc/config.yaml) at startup):

  ```yaml
  # etc/config.local.yaml  (never committed)
  mode: dev
  intelligence:
    providers:
      openrouter:
        api_key: "sk-or-..."
  ```

- An embedding cast configured at the coordinates the knowledge embedder is bound
  to — **`general / medium / medium / medium`** — for example:

  ```yaml
  intelligence:
    casts:
      embedding:
        - { purpose: general, strength: medium, speed: medium, cost: medium,
            provider: openrouter, model: "openai/text-embedding-3-small" }
  ```

- Start the core (`go run ./core`), sign in, and **select a project**.

## 1. Add two topically distinct documents

First create two documents whose text is far apart in meaning (see the
[documents manual](../documents/manual.md)). Call their ids `<GARDEN_ID>` (plant
biology) and `<FINANCE_ID>` (personal finance).

Add each to the lattice:

```sh
curl -k -b cookies.txt -X POST https://127.0.0.1:8080/dev/knowledge/documents/<GARDEN_ID>
```

Response is `201 Created` with the registered source, the window/node counts, and
the embedding **usage** the call cost:

```json
{"source":{"localRefId":"...","sourceType":"document","sourceId":"<GARDEN_ID>",
           "projectId":"...","text":"...","addedAt":"...","syncedAt":"..."},
 "windows":2,"nodes":1,"usage":{"promptTokens":111,"totalTokens":111}}
```

`sourceId` is the origin's own id — here the document id — not an internal one;
the lattice's internal handle is `localRefId`. `addedAt` is when the source first
entered the lattice; `syncedAt` is when it last updated it.

Adding the **second** document rebuilds the **corpus tier** of the lattice, so
retrieval can now discriminate between sources.

## 2. Retrieve — the query lands on the right source

```sh
curl -k -b cookies.txt -X POST https://127.0.0.1:8080/dev/knowledge/retrieve \
  -H 'Content-Type: application/json' \
  -d '{"query":"how do leaves turn sunlight into energy for the plant","topK":3}'
```

Response is `200 OK` with ranked **regions** — retrieved windows of one source
that overlap or touch are **merged** into one verbatim span, so near-duplicate
overlapping hits never appear. Each region carries **provenance** (`sourceType`,
`sourceID`, the `blocks` it touches), a **byte range** (`start`, `end`) into the
source text, its best window `relevance`, a `density` count of how many
retrieved windows converged on it, and the exact `text`. Total region text is
bounded by a **character budget** (`knowledge.retrieval.char_budget`, default
4000; dense regions may overrun by a controlled quarter, and the top region is
always returned). The result also names its retrieval path in `"mode"`:

```json
{"regions":[{"sourceType":"document","sourceId":"<GARDEN_ID>","start":0,"end":481,
             "relevance":0.54,"density":1,
             "text":"Photosynthesis is how green plants convert sunlight...",
             "blocks":[{"rowId":"...","blockId":"..."}]}],
 "mode":"descent","audit":{"recall":1,"candidates":1,"windows":2},
 "usage":{"promptTokens":10,"totalTokens":10}}
```

The top region's `sourceId` is `<GARDEN_ID>` — the plant document — even though
the finance document is also in the lattice. A finance query
(`"what makes stock prices go up..."`) symmetrically returns `<FINANCE_ID>` on
top. That is the quality this suite exists to verify.

## 3. Update — re-adding re-syncs, reusing unchanged embeddings

```sh
curl -k -b cookies.txt -X POST https://127.0.0.1:8080/dev/knowledge/documents/<GARDEN_ID>
```

`POST` on an origin that already exists **updates** it: it replaces the windows
and nodes and advances `syncedAt`, keeping the same `localRefId` and original
`addedAt`. The update is cost-smart — it **reuses the stored embedding of every
window whose text is unchanged** and embeds only what changed:

```json
{ ..., "windows":3, "nodes":2, "reused":3, "embedded":0,
  "usage":{"promptTokens":0,"totalTokens":0} }
```

Re-posting an unchanged document embeds nothing (`"embedded":0`, zero usage).
Appending a paragraph re-embeds only the new tail; the untouched body is reused.

## 4. Remove

```sh
curl -k -b cookies.txt -X DELETE https://127.0.0.1:8080/dev/knowledge/documents/<GARDEN_ID>
```

Response is `200 {"removed":true}`. Remove deletes the source's snapshot, windows
and nodes, rebuilds the corpus tier from what's left, and the document is no
longer retrievable. Removing something that was never indexed is a `404`. Remove
does **not** require the document to still exist — a deleted document is a reason
to remove it from the lattice, not a blocker.

## Notes

- The endpoints are **gated**: without a session they return `401`; updating the
  lattice needs an **owner/editor** role (a reader gets `403`).
- An unknown document id is a `404`.
- With **no key** configured, an add fails with `503` ("intelligence provider not
  configured") — the same unconfigured-provider signal the intelligence endpoints
  give.
- Every response carries a `usage` block, so the token cost of a run is visible;
  the automated suite sums it and prints an estimated dollar cost at the end.
