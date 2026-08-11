# CLAUDE.md

All conventions, workflows, and project context for this repository live in
**[AGENTS.md](AGENTS.md)**. Read it and follow it.

**Start every session by reading
[`docs/orientation/AGENT-ORIENTATION.md`](docs/orientation/AGENT-ORIENTATION.md)** — the current
picture of what is built, how the runtime is shaped, how to build/test/verify, which e2e failures
are known-pre-existing, and what the active plan and next task are. It is kept current; trust it
over your assumptions about the codebase.

Two practices are easy to forget and must not be skipped:

1. **Markdown companions** — every hand-authored source/config file has a
   `<filename>.md` companion beside it that explains it (prose, not a byte-exact
   mirror), updated in the same change as the code and never left older than the
   source. See AGENTS.md → *Practice 1*.
2. **Change records** — on commit-and-push, write `docs/archive/records/YYYY-MM-DD-<slug>.md`
   describing every change and why. See AGENTS.md → *Practice 2*.
