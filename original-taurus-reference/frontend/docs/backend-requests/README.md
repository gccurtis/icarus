# Backend requests (for Taurus Omega)

**Every file in this directory is one piece of work we need Omega to complete. Nothing else
lives here.** One file = one ask. When it ships, the file moves to
[`docs/archive/backend-requests/`](../archive/backend-requests/) and its row below is deleted —
so the length of this list is always the amount of outstanding backend work.

Most are missing capabilities; one is a defect. Both are work to be done, so both belong here.

This is the mirror of Omega's own `docs/frontend-requests/`, where Omega tells *us* what to change.

---

## The current ask — ten items

**Rows 1–6 were re-verified against Omega's source on 2026-07-28.** That audit found one
request substantially already built and another half-built, both now corrected — see
[Audited, and what it changed](#audited-and-what-it-changed). Rows 7–9 were filed 2026-07-29 and
were written *from* Omega's source, which is why so much of them says "do not rebuild this".

| # | Request | Priority | One line |
| --- | --- | --- | --- |
| 1 | [Ask turns 500, and the cause is not recorded](ask-turn-500s.md) | **High — a bug, user-visible** | ~9% of Ask turns under a terse custom persona return `500 "chat operation failed"` and no answer (0/24 under the default persona, same prompt). Three distinct rejections collapse into one opaque error and the cause is dropped from the log despite Omega intending to record it. `decodeAnswer` also demands prose even when `insufficientEvidence` is set. |
| 2 | [Chat turn context items](chat-turn-context-items.md) | **High — smallest fix to the QB loop** | `POST /agent/chats/:id/turns` accepts no context, so the front end cannot send the document the user is looking at. `agent.AskRequest.Context` already exists, validated and bounded — it just is not exposed at the HTTP edge. |
| 3 | [Automatic document → knowledge ingestion](document-knowledge-ingestion.md) | **High — the "whole project" default** | Nothing ever ingests documents into the knowledge lattice (only a dev-only route exists), so every Quarterback Ask about project content answers "no available evidence". Reproduced end-to-end 2026-07-28. |
| 4 | [Validate document mark payloads](document-mark-payload-validation.md) | **High — security** | `POST /documents/:id/changes` accepts `javascript:` link hrefs and arbitrary font-name text, stores them, and serves them to every client. Colours are validated on *marks* — but not on custom typography, a second hole found in the re-audit. |
| 5 | [Per-turn persona override](persona-override-per-turn.md) | Medium | Let one *turn* run as a chosen persona without rewriting the chat's persona, and record which persona answered. **The per-task half is already shipped — do not build it.** |
| 6 | [A push channel for document presence](live-collaboration-presence.md) | Low | Only a push channel and a `joinedAt` field remain: Omega already ships per-document presence and a 30s server-side TTL. **Adopting them is Alpha's job, not Omega's.** |
| 7 | [Owner-scoped contexts and templates](asset-library-owner-scope.md) | **High — two shipped screens have no data** | Contexts and document templates are complete and good, but every route is project-scoped, so a context or template cannot be reused in the next project. Needs a `description` field (tiny), owner-scoped library records, copy-based promote/bring-in, and per-asset sharing — **four independently shippable pieces**. |
| 8 | [Agents console scope](agents-console-scope.md) | **High — a third shipped screen has no data** | Personas (versioned, with per-persona task history) and agent tasks are complete — and project-scoped. The Agents console needs owner-scoped personalities (the sibling of #7), a cross-project task list with project attribution, and — the one genuinely new capability — messaging a running task. **Three independent pieces.** |
| 9 | [Access must not be opt-in](resource-access-enforcement.md) | **High — a disclosure bug class** | `documentAccessGuard` enforces access for routes naming a `:documentID`, but cannot see resources named in a *response body* — so everything else is enforced by a handler choosing to filter. Put the caller in the read signature so forgetting is a compile error, and define what a denied resource looks like on the wire. |
| 10 | [Presence keyed by project](project-level-presence.md) | Medium — one shipped surface runs on a mock | Presence is keyed by *document* (`byDoc`), so a user on the project overview is present to nobody, including themselves. The context rail's Members lens shows real membership but **mocked** `On now`. Needs one project-scoped presence read and a heartbeat that doesn't require an open document. **The TTL tracker and sessions already exist — do not rebuild them.** Not the same as row 6, which is a push channel for *document* presence. |

## Handover — read this before the individual files

They are separate files because each has a different fix in a different place, not because they
are unrelated. Three of them are the same user-visible symptom seen from three angles, so here is
the map and a suggested order.

**The Quarterback cannot answer from your project content.** That one symptom produces
requests 1, 2 and 3:

- **2** is the small one: expose a field your Ask engine *already has* on the chat-turn
  endpoint, so the client can send the document the user is looking at. **Start here** — it is
  the cheapest change on the list and it makes the feature demonstrable.
- **3** is the real fix: nothing ever indexes documents, so project-wide grounding cannot work
  at all. This is the product goal ("the whole project is the default context") and the
  largest piece of work here.
- **1 is related to 3 but is not simply caused by it.** Ask turns fail outright ~9% of the time
  under a terse persona (0/24 under the default, same prompt). We first assumed the empty index
  was the whole story; measuring narrowed it, and the leading candidate is now narrower and
  more fixable — `decodeAnswer` demands prose even when the model has correctly set
  `insufficientEvidence`. **Do request 1's logging fix first**: three different rejections
  currently collapse into one opaque 500, so nobody — including us — can say which is which.
  Then re-measure after 3 ships.

The other six are independent of those and (except 7 and 8, which share a mechanism) of each
other:

- **4 and 9 are the security pair, and neither should queue behind a feature.** 4 is small and
  contained — `javascript:` link hrefs are stored and served unvalidated. 9 is structural: access
  is enforced by handlers remembering to filter, which is a bug class rather than a bug. **Please
  do not let either sit behind features.**
- **5** is a contained feature (per-turn persona), with its already-shipped half marked
  do-not-build.
- **6** is lowest: most of it turned out to be built already, and the remaining adoption work
  is ours, not yours.
- **7 is the largest new capability here, and the most already-built.** Contexts and templates
  are finished work we are not asking you to touch; what is missing is only that they cannot
  live above a project. It splits into four pieces that ship independently, and **the first —
  adding a `description` to a context — is a single field we can adopt the day it lands.** Start
  there if you want a quick win; the copy-based promote/bring-in in piece 3 is where the real
  work is.
- **8 is 7's sibling plus one genuinely new capability.** Owner-scoped personalities are the
  same library mechanism as 7 applied to personas — build the two together and share it. The
  cross-project task list is a read with project attribution. **Steering a running task is the
  piece to scope first**: if the engine's loop cannot consume mid-flight input, say so and we
  drop the composer rather than fake it.

**Each file repeats context on purpose.** The standalone rule below means you can open any one
of them and build it without reading the others — so you will see the empty-index situation
explained more than once. That is duplication by design, not contradiction.

## Audited, and what it changed

Re-checking each open request against Omega's actual source — rather than against what the
request claimed Omega did — found that two of them were asking for work already done:

- **Document presence was shipped 2026-07-26, one day *before* we filed the request** asking
  for it. `GET /documents/:documentID/collaboration` and a 30-second TTL both exist; the
  request also wrongly claimed Alpha was calling the presence write routes, which it never
  has. Rewritten down to the push channel and an arrival timestamp, dropped to Low, and the
  adoption work moved to [our roadmap](../roadmap/README.md) where it belongs.
- **Per-task persona override is shipped and Alpha already uses it** — `POST /agent/plans`
  and `POST /agent/actions` take `persona: {personaId, personaVersion}` and store an immutable
  snapshot on the task. That section is now marked do-not-build; only the per-turn half
  remains.

**This audit is now the standing rule for this directory: verify against Omega's source before
filing, and re-audit periodically.** An open ask for something the backend already built is
worse than no ask — it wastes their time and makes the whole list untrustworthy.

Each is **standalone**: what already works, the exact gap, request/response shapes, the rules, and
how it will be verified. You should not need to read Alpha's source or any other file here.

## Deliberately not requested

Do not build these — Alpha has decided against them, so they are not gaps:

- **Notifications feed** — Omega already ships `GET /notifications`; Alpha is not building the
  surface. [Why](../roadmap/deferred-notifications-feed.md).
- **pdf / docx import & export** — long-term deferred; Markdown round-trips today.
  [Why](../roadmap/deferred-pdf-docx-import-export.md).
- **Document row windows** — withdrawn. Alpha deleted pagination and windowing; the whole document
  is loaded and diffed.

---

## Conventions

**One file per request, and it must stand alone.** Omega should be able to open a single file,
build it, and verify it. Every request states:

1. What already works — so nothing gets rebuilt.
2. The gap — what Alpha cannot do, and what a user sees today.
3. What we need — concrete shapes, with the optional/required split explicit.
4. The rules that matter — defaults, errors, authorization, what must *not* change.
5. How we will verify — a numbered list someone can run.
6. The current front-end fallback — so partial delivery still helps.

**Omega owns the final contract.** If your rules differ from what a request proposes, say so and we
will mirror them exactly — the way Alpha's `safeCssColor` mirrors Omega's `validCSSColor`.

**When something lands, move the file to `../archive/backend-requests/`** and delete its row above.
Keeping shipped work here is what made the previous index untrustworthy.

**Backend request vs discrepancy.** A terminology or shape difference Alpha can translate at its
data boundary is only a translation recorded in the [architecture doc](../architecture/README.md) for the subsystem that performs it — no backend work. A capability
Alpha genuinely cannot back is a request and belongs here.
