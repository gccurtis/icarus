# 0161 — Add the current Yesod corpus and executable Omega packets

## Baseline

- Repository planning baseline: `50efd18413cc47935033889e51d58e9c828733e2`.
- Notion source: Taurus Yesod Resources relation, active and non-archived at 2026-07-30.
- Source inventory: 176 pages — 47 Primary, 129 Supporting, including Ω-001 through Ω-044.

## Decision

Keep the Notion source pages as a complete evidence mirror and add a separate agent-facing execution layer. The execution files are the only packet files handed directly to coding agents. Each carries the complete source body plus:

- hard dependency and later-integration gates;
- source authority and required-reading order;
- current-state preflight;
- ports-and-adapters, authorization, transaction, and cell-runtime invariants;
- bounded decisional authority and stop conditions;
- repository and packet-specific validation;
- required numbered record and pull-request evidence.

The frozen SHA remains planning evidence. Implementations start from the latest approved `main` containing their predecessors.

Ω-035–Ω-037 no longer treat Ω-042 as a hard start dependency. They implement against the File/Object port; Ω-042 provides and re-certifies production adapters. This resolves the apparent cycle without changing either packet's product outcome.

## Files

- `docs/current-docs/README.md`
- `docs/current-docs/MANIFEST.md`
- `docs/current-docs/manifest.json`
- `docs/current-docs/notion/`
- `docs/current-docs/work-packets/`
- `docs/orientation/README.md`

## Validation

- Verified 176 expected source mirrors and no empty source bodies.
- Verified exactly 44 unique packet IDs, Ω-001 through Ω-044.
- Verified every execution packet embeds its corresponding Notion body.
- Verified every local Notion link emitted by the generator resolves inside the mirrored corpus.
- Verified hard dependencies point only backward; explicit later integrations are labeled separately.
- Verified deterministic, collision-free paths and unique Notion page IDs.
- Updated repository orientation to point to the execution corpus and removed its
  stale requirement to maintain retired `.go.md` companions.
- Markdown/link and corpus-integrity checks are recorded in the completion
  evidence.
- Go formatting/build/test gates are not applicable to generated documentation content locally; repository CI remains required before merge.

## Operational effect

A coding agent can now receive one repo file and execute a packet without a live
Notion connection or a separately assembled prompt. Mainline delivery,
predecessor gates, scoped commits, and evidence-based completion remain
explicit.

## Notion handoff

The Primary completion-program page names the repo-native packet directory,
distinguishes the frozen planning baseline from an implementation starting SHA,
reports the full 176-page corpus, and follows the retired-companion validation
rule. Its local source mirror was refreshed after that update.
