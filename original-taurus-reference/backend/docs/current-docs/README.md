# Current Taurus Yesod documentation

This directory is the repo-native execution corpus for completing Taurus Omega.

## Snapshot

- Source: active, non-archived Resources related to the Taurus Yesod project in Notion
- Mirrored: 2026-07-30
- Planning baseline: `50efd18413cc47935033889e51d58e9c828733e2`
- Pages: 176 total — 47 Primary and 129 Supporting
- Work packets: 44 source mirrors plus 44 agent-facing execution handoffs

The planning SHA fixes the state against which the work was designed. It is not a checkout instruction. Every implementation packet begins from the latest approved `main` containing its hard predecessors and records that actual SHA.

## Layout

- `work-packets/` — the files to give a coding agent. Each is a self-contained execution prompt with dependency gates, required reading, decision boundaries, validation, deliverables, and the full source specification embedded.
- `notion/primary/` — exact mirrors of active Primary Notion pages.
- `notion/supporting/` — exact mirrors of active Supporting Notion pages.
- `notion/work-packets/` — exact mirrors of the 44 Notion work-packet pages.
- `MANIFEST.md` — human-readable inventory and local path map.
- `manifest.json` — machine-readable inventory for sync/audit tooling.

## How to execute a packet

1. Choose the next packet whose hard predecessors are present on `main`.
2. Give the coding agent only the corresponding file under `docs/current-docs/work-packets/` and say: “Execute this packet completely. Follow its dependency gate, required reading, validation, record, and direct-to-main commit contract.”
3. The agent reads the required local sources named by that file, verifies current code, implements the packet, runs the gates, creates the numbered change record, commits the scoped change, and pushes it to `origin/main`.
4. Begin dependent packets from the newly pushed `main`.

The execution packet embeds its entire source specification. Its links improve navigation, but the handoff does not depend on a live Notion session.

## Authority

When material conflicts, apply the order printed in every execution packet:

1. latest explicit user decision;
2. current Primary docs in this snapshot;
3. the execution directive and embedded packet specification;
4. current code, tests, migrations, and as-built records;
5. Supporting docs and historical frozen links.

`AGENTS.md` is authoritative for repository workflow. In particular, companion `.go.md` files are retired; each material increment creates a numbered file under `docs/records/`.

## Mirror policy

These files preserve the active Notion corpus as evidence. Do not silently turn a mirror into a new policy source. Make a resolved planning change in Notion, then regenerate the mirror and manifest in one reviewed change. Archived/obsolete Notion pages are intentionally absent.

Notion-specific tags such as `<callout>`, `<table>`, and `<page>` are preserved so no source meaning is lost.
