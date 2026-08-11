# 2026-07-29 — Two backend requests, and the docs stop describing placeholders

The four commits before this shipped three library spaces. This one makes the documentation true
again and files what the backend owes.

## Two requests, written *from* Omega's source

`asset-library-owner-scope.md` and `agents-console-scope.md` are both **scope asks, not design
asks**, which is why so much of each says "do not rebuild this". Contexts, document templates, and
personas are complete and good in Omega — every route is just project-scoped, so nothing can be
reused in the next project.

- **#7** splits into four independently shippable pieces, and the first — adding a `description` to
  a context — is a single field we can adopt the day it lands. The one with real work in it is
  copy-based promote/bring-in, stated bluntly because it is the piece most likely to be built as a
  live link: **library assets are copies, with no link back.**
- **#8** is #7's mechanism applied to personas, plus a cross-project task read, plus the one
  genuinely new capability: messaging a running task. That one leads with a capability question
  rather than a shape — *can a running task consume mid-flight input at all?* If not, we drop the
  composer rather than fake it.

## An index row that was missing

`resource-access-enforcement.md` was committed earlier today without a row in the index, which
breaks this directory's own rule that the list length is the amount of outstanding backend work.
Added as row 9 and grouped with #4 in the handover as the security pair. **Nine rows, nine files.**

## Docs that had gone false

- **Roadmap §1** said "placeholders shipped, nothing behind them". It now describes three built
  consoles blocked on two filed requests, with our adoption work in order. Open question 1 — *what
  is a context asset?* — is **struck through as answered**, and worth noting it was answered in
  Omega's source the whole time; nobody had looked.
- Three things this work surfaced are now tracked that were not: extracting a shared table
  primitive (with virtualization — a whole-project context resolves to thousands of rows), retiring
  the Templates rail panel's separate `mock-templates.ts`, and deciding where a template's `Edit`
  leads.
- **Orientation** is redated, its mock/deferred entry rewritten around the three spaces, and its
  "exactly three open requests" line — already wrong at six — replaced with a pointer to the index.
  The e2e count moves 14/14 → 26/26.
- **AGENTS.md** and the evergreen orientation README no longer describe Agents as a permanent tab.

The repo's rule is that everything outside `docs/archive/` is current, so a doc describing something
that no longer exists is a bug rather than history. These were four such bugs.
