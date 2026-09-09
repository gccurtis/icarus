# State and behavior architecture audit

The reference page at `/demo/state-behavior-audit` records the as-built audit of
state ownership, procedure placement, capability boundaries, runtime lifetime,
and architectural reviewability at revision `306e308` on `main`.

The page is deliberately static. Evidence and recommendations live in
`procedures/report.ts`; the Svelte files only present that report. Update the
snapshot metadata and re-run the repository checks before treating a later page
as current.

This audit excludes vendored components from component-complexity metrics and
separates development-only route I/O from the production architecture verdict.
