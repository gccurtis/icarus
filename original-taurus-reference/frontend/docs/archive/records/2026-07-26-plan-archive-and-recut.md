# 2026-07-26 — Archive superseded roadmaps; recut the master plan

A course-correction checkpoint after B2b/G4/B6: the plan surfaces had accumulated
superseded roadmaps, and the next stretch of work needed a single, structured driver. Old
execution plans/checklists were archived and a fresh master plan written.

## Superseded roadmaps → `docs/archive/`

```
docs/superpowers/plans/2026-07-25-a2-block-kinds.md        → docs/archive/
docs/superpowers/specs/2026-07-25-a2-block-kinds-design.md → docs/archive/
docs/superpowers/plans/2026-07-26-full-integration.md      → docs/archive/
docs/superpowers/plans/2026-07-21-playwright-harness.md    → docs/archive/
docs/superpowers/specs/2026-07-21-playwright-harness-design.md → docs/archive/
docs/plans/2026-07-21-next-steps.md                        → docs/archive/
docs/plans/2026-07-24-slide-editor-checklist.md            → docs/archive/
```

Moved via `git mv` (history preserved) with a `docs/archive/README.md` explaining each and
warning that nothing there is current. Scope was **superseded roadmaps only** — architecture/
design references (runtime model, panel system, pagination engine, data-layer migration,
identity manager, slide-editor-fabric, cockpit-flake) stay live under `docs/plans/` and
`docs/superpowers/specs/`, because they describe reality rather than plan future work.
`docs/plans/README.md` dropped its two archived entries and gained an "Archived" pointer.

## New master plan

`docs/superpowers/plans/2026-07-26-integration-completion.md` becomes the current driver. It
captures the approved course-correction: **Phase 1** restores the companion documents to
multi-section, byte-exact form (a previous batch wrote them as a single whole-file fence,
which defeats their purpose) and backfills the companion-less `projects`/`session` systems;
**Phase 2** writes the backend request to unify chats with agentic work (every chat carries a
persona; tasks spawn from and speak back through chats); **Phase 3** fixes stale contracts in
the live docs (`/missing` routes that don't exist, `variables` vs `contextVariables`,
access being PATCH-only/owner-only); **Phase 4** wires the remaining features (project member
summary, workspace state, windowed rows); **Phase 5** holds the deferred items. An **admin
dashboard** (manage projects/orgs/users during contracting) is logged as backlog.

`ORIENTATION.md`'s doc-map now points at the new plan instead of the archived one.

## Why this way

The prior single-fence companion format and the accumulated roadmaps both worked against the
project's own conventions (companions must explain code in pieces; plans must not sit stale
and misleading). Archiving rather than deleting keeps provenance; a single dated master plan
keeps the review surface honest about what's actually next.
