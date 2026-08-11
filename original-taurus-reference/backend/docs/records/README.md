# records

A running log of the code changes we make, with rationale.

Each increment gets one numbered file, `NNNN-<slug>.md`. Within it: a section
(`##`) per file changed, and under each, a subsection (`###`) per change — with
the relevant code block and a note on **what it does**, **the goal it serves**,
and **why the change was made**.

These records capture *changes and their reasons over time* — the "why" behind
the diffs, alongside git history. They were once paired with `*.go.md` companion
docs describing the *current* state of each source file; that practice is retired
and those docs are archived under
[`archive/companions/`](../../archive/companions/README.md), so records are now
the only prose that travels with the code.
