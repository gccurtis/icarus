# Taurus Alpha documentation

**Everything outside `archive/` is current.** If a document here describes something that
no longer exists, that is a bug — fix it or move it to the archive, the same way a stale
comment gets deleted rather than tolerated.

New here? Read [`orientation/AGENT-ORIENTATION.md`](orientation/AGENT-ORIENTATION.md)
first. It is the standing picture of what is built, how the runtime is shaped, how to
build and verify, and what is known-broken.

## Where things live

| Directory | Answers | Rule |
| --- | --- | --- |
| [`orientation/`](orientation/README.md) | Where do I start? What is the state of things? | The one document to read first. Kept current. |
| [`roadmap/`](roadmap/README.md) | What do **we** need to build — and what have we decided **not** to? | Our work. Standing list, no dates. |
| [`backend-requests/`](backend-requests/README.md) | What does **Omega** need to build? | Open asks only. Shipped ones move to the archive. |
| [`plans/`](plans/README.md) | What is in flight right now? | Active plans only — usually empty. |
| [`architecture/`](architecture/README.md) | How is it actually built? | Describes reality; updated in the same change as the code. |
| [`style/`](style/README.md) | What should it look and feel like? | The authoritative, implemented design spec. |
| [`support/`](support/README.md) | Background material to consult. | Non-authoritative by definition. |
| [`archive/`](archive/README.md) | What happened, and why does the repo look like this? | Everything dated or superseded. Never treat as current. |

Nine directories became seven on 2026-07-28. `deferred/` folded into the roadmap — a
decision not to build something is a roadmap entry, not its own category — and
`discrepancies/` was archived once the rewritten
[`architecture/document-editor.md`](architecture/document-editor.md) covered the same
translations (byte-offset anchors, single-atom writes, the accepted ceilings) in the place
someone actually reads before touching the code.

## The two "what's next" documents, and why they are separate

They answer different questions for different builders, and merging them is what made the
old lists untrustworthy:

- **[`roadmap/`](roadmap/README.md)** — work **we** do in this repo. If an item is blocked
  on the backend, it says so and links the request. Its `deferred-*.md` files record what
  we decided **not** to build, and why.
- **[`backend-requests/`](backend-requests/README.md)** — work **Omega** does. Each file
  is standalone: someone should be able to open one, build it, and verify it without
  reading Alpha's source.

A capability Alpha genuinely cannot back is a request. A vocabulary or shape difference
Alpha can translate at its data boundary is **not** — write it into the architecture doc
for the subsystem that does the translating, next to the code that performs it.

## Why `archive/` exists

Two kinds of document are inherently dated, and neither belongs in a directory a reader
scans for current truth:

- **[`archive/records/`](archive/records/)** — one change record per commit-and-push
  (repo Practice 2), describing what changed and why. These are written continuously and
  are history the moment they land. This is where to look when you want to know *why* the
  code is shaped the way it is.
- **[`archive/plans/`](archive/plans/)** — plans that shipped. Some are still excellent
  architecture reading; none of them drive work.

Alongside them sit superseded discrepancies, shipped or withdrawn backend requests, and
the old integration effort. **Links from an archived record into other archived paths are
deliberately not rewritten** — a record describes what was true on its date, and editing
it to look current would be a lie.
