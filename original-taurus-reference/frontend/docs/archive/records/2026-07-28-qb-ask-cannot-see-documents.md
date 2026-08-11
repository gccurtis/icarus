# 2026-07-28 — Live review: Quarterback Ask cannot see documents (new backend request)

Second finding from the user's live review: they typed a fact into a document, asked the
Quarterback bar about it, and the agent said the document *"didn't have enough data to
determine the answer"* — with the answer sitting right there in the document.

## What was done

No Alpha code changed. This was an investigation, an end-to-end reproduction, and a new
**High-priority backend request**:
[`docs/backend-requests/document-knowledge-ingestion.md`](../../backend-requests/document-knowledge-ingestion.md)
(README table now lists four open asks).

## The diagnosis

Ask turns are grounded **only** through the project's knowledge lattice — the pinned
document is never read directly (Omega's `chat_engine.go` uses the chat's `resourceId` only
to scope Plan/Action tasks; Ask context carries attachments only). And **nothing ever
ingests documents into the lattice**: the sole ingestion route is dev-only
(`POST /dev/knowledge/documents/:id`), whose own comment says ingestion "is normally driven
by resource changes" — a link that does not exist. Only connector sources auto-sync.

So the model behaved correctly under its grounded-citation contract: the lattice was empty,
retrieval returned nothing, and it honestly reported insufficient evidence.

## The reproduction (scripted against the dev stack)

| Step | Result |
| --- | --- |
| Document created holding "The launch code … is INDIGO-7." | 201 |
| Ask chat pinned to the document; question posted | *"There is no available evidence…"* |
| `POST /dev/knowledge/retrieve "launch code"` | `{"regions":[]}` |
| Dev-only ingest of the document | 201, 1 window embedded |
| Same retrieve | the span, with row/block refs |
| Fresh chat, same question | *"The launch code for the Taurus demo rocket is INDIGO-7."* |

The lattice, retrieval, and Ask all work — they are starved, not broken. One operational
footnote captured in the request: the running dev lattice stamped its vectors with
`qwen/qwen3-embedding-4b` while the committed manifest now names `text-embedding-3-small`,
so a re-sync path should re-embed on identity mismatch rather than leaving retrieval in the
409 conflict state.

## Product note

The user's instinct — *"the whole project should probably be the default context"* — is
exactly what the request yields: the lattice is project-scoped, so once ingestion is
automatic, every Ask grounds against the whole project by default, and the document pin
stays what it already is (task scoping). Alpha's dock is already honest about the rest: the
unwired context toggles are badged as not yet applied (B2b).
