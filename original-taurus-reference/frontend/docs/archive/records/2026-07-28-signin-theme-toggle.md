# 2026-07-28 — Library pass 3/3: the sign-in theme toggle (plan complete)

Last commit of the Context & Templates plan
(`docs/plans/2026-07-28-context-templates-mock-pass.md` — status now SHIPPED).

## The toggle

A quiet text button below the sign-in card — the one screen with no other route to the theme
control, since the top-bar toggles all live behind auth. Per the user's spec, **the label names
the mode you are currently seeing** ("Dark mode" while dark); clicking switches both mode and
label. It goes through the shared `$lib/theme` store, so the choice persists (localStorage)
and the pre-paint bootstrap keeps honoring it on the next load.

## e2e

`library-and-theme.spec.ts` gained the third test (suite **17**): reads the initial
`data-theme`, clicks the label naming it, asserts the flipped label and the flipped
`data-theme`, and reloads to prove persistence. One honest wrinkle: the first click can land on
the server-rendered DOM **before Svelte hydration attaches the handler**, so the click-then-
assert is wrapped in `expect(...).toPass()` — retried until the first *effective* click flips
the label, rather than a blind sleep.

## Close-out

- Plan status → **SHIPPED** with the three commit hashes and records.
- Orientation §7 records the pass (and the Toaster fix) alongside the completed reorg; still
  no active plan afterward.

## Verification

`pnpm check` 0/0 · vitest 346/346 · build clean · companions OK · e2e **17/17** (spec alone and
the full suite).
