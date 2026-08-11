# Integration re-audit, doc recut, and full-integration plan

Re-audited the Alpha↔Omega integration against Omega `HEAD` `f8774ab` after the backend
shipped a large batch from our gap list, reorganized the integration docs into two clean
files, reconciled stale statuses, and wrote the master implementation plan. Docs only.

## Re-audit finding: Omega shipped most of the "hide" gaps

A source sweep (routes in `core/transport/transport.go`, capabilities in `core/capability/*`)
showed Omega now backs **templates** (`/documents/templates`), **notifications**
(`/notifications`), **resource access/attributes/pinning** (`/resources/:kind/:id/access`,
`/attributes`), **windowed row reads** (`/rows`, `/row-manifest`, `/rows/locate`),
**live-web chat context**, and **organizations** — most of what the prior plan intended to
*hide*. New guiding principle recorded: **nothing hidden — integrate or visibly track.**
Still genuinely gapped: G3 pdf/docx, G5 native `list` kind + indent, G6 typography defaults.

## Integration docs recut into two clean files

```
docs/integration/current/2026-07-25-integratable-now.md      # what Omega backs + what we build + plan
docs/integration/current/2026-07-25-backend-outstanding.md   # what Omega still must implement/change
docs/integration/old/                                        # the prior audit/plan/contract, archived + frozen
```

Everything else in `current/` moved to `old/` (the stale namesakes there were superseded by the
newer versions and retired; git history retains them). `old/README.md` is now an archive index.
Two files replace five so the live view is unambiguous.

## Status reconciliation

```
alpha-remaining-gaps-2026-07-25.md   # G1/G2/G4 marked SHIPPED (integrate); G3/G5/G6 remain; fixed a pipe-in-table render bug
README.md                            # document-row-windows + ai-generation → Shipped
```

Kept the per-request docs accurate so File B's summary and the detailed requests agree.

## Master implementation plan

```
docs/superpowers/plans/2026-07-26-full-integration.md
```

Eight phases (A2 → B2 AI dock → Templates → Notifications → Resource access → Windowed rows →
pdf/docx options → Name Manager verify), each a self-contained commit with checkbox tasks, an
end-to-end check against the live `:8443` stack, and companions + a change record. Notes the
verified notifications semantics (ephemeral drain-toast channel, not preferences — a checkpoint
in Phase 4) and the one deliberate badged mock (pdf/docx options, Phase 7).
