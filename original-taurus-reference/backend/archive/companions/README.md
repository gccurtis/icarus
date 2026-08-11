# Archived companion docs

191 prose descriptions of the files under `core/`, one per non-test `.go`,
mirroring their original paths — `core/capability/knowledge/build.go.md` is at
`archive/companions/core/capability/knowledge/build.go.md`.

They were written under a rule that every code change update its file's
companion in the same commit. That rule is retired (see
[`AGENTS.md`](../../AGENTS.md)), so nothing keeps these current from July 2026
onward.

## How to read them

**As history, not as documentation.** Each one describes its file as it stood
when last touched. The prose about *why* a shape was chosen tends to stay true
long after the code moves; the prose about *what the code does* is the part that
rots. Where a companion and the code disagree, the code is right.

They are worth reaching for when a design decision looks arbitrary and you want
the argument behind it — that reasoning is often nowhere else, since
[`docs/records/`](../../docs/records/) covers changes rather than steady state.

Restoring one is a plain `git mv` back to its mirrored path.
