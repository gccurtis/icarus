# Greenfield implementation sequence

These are construction authorities, not migration packets. Each stage creates
one coherent, independently reviewable outcome and proves it before later
features depend on it. A stage may be split into smaller commits, but its exit
criteria remain one product boundary.

Use [BUILD-A-STAGE.md](BUILD-A-STAGE.md) as the reusable fresh-task prompt after
selecting one stage.

## Sequence

| Stage | Outcome | Depends on |
| --- | --- | --- |
| [00](00-foundation-host-cell.md) | Go module, Host, bound Cell kernel, typed dispatch, bounded interactive execution, health/lab | None |
| [01](01-persistence-authority-jobs.md) | Control/Project database substrate, UoW, idempotency, Audit, one-use permits/fences, jobs, object store | 00 |
| [02](02-control-identity-project.md) | OIDC, durable sessions/step-up, one-Organization Users, one-owner Projects, search/pins/share links/grants/duplicate, provisioning and placement | 01 |
| [03](03-workspace-resource-entry.md) | Project entry, Resource identity/catalog, per-User workspace and Resource/Data favorites, Product API shell contracts | 02 |
| [04](04-documents.md) | Complete headless Document system, styles/typed blocks, ChangeSet reconciliation, prompt-output history, templates, collaboration-anchor semantics and render | 03 |
| [05](05-files-sources-connectors.md) | Secure multi-file/folder Upload Batches, immutable files, source registration/extraction and connector boundary | 03 |
| [05A](05a-provider-connectors.md) | Concrete provider connector adapter(s), consent, incremental/full intake and revocation evidence | 05, 02, Q006 selection |
| [06](06-knowledge-intelligence-resolution.md) | Knowledge/KLR, provider-neutral Intelligence, sealed Resolution and prompt execution | 04, 05 |
| [07](07-formula-data.md) | Typed Formula, names/tables/bindings, structured data and lineage foundation | 03 |
| [07A](07a-analytic-compute.md) | One hardened analytic compute engine, exact inputs, typed results and explicit materialization | 07, 01 |
| [08](08-workbooks.md) | Workbook/Worksheet/cell/table behavior integrated with Formula/Data | 07 |
| [09](09-decks.md) | Deck/Slide/layout/elements/notes/themes and deterministic rendering | 03 |
| [10](10-boards-chats.md) | Board canvas/dashboard and Project Chat/SavedOutput resources | 03 |
| [11](11-translation-import-export.md) | Native packages, Office import/export, fidelity, Project archive | 04, 05, 08–10 |
| [12](12-agents-context-collaboration.md) | Quarterback, Agent Instructions/Personas/triggers/Routines/tasks, proposals/review/undo, notifications, activity/context/memory/search | 06–10 |
| [13](13-web-client.md) | Accessible Svelte product shell and Resource-family clients over Product contracts | Backend slices as needed |
| [14](14-administration-production.md) | Settings/admin, enterprise federation, authenticators/recovery, billing/usage reconciliation, Project Audit, isolation, recovery, performance and release | All promoted slices |

Stages 04–10 are capability-oriented and can be reordered when dependencies
permit. Documents remains the first editable Resource because prompt blocks,
ChangeSets, anchor semantics, headless rendering, and sources exercise the most
important cross-cutting contracts. Stage 05A is selected only after Q006 names
a provider workflow; it need not block local upload, Knowledge or other family
work. Stage 07A completes the accepted analytic-compute surface and may follow
Stage 07 whenever a hardened runtime can be proved; it need not block Workbook
Formula behavior that does not invoke analytic code.

## Required document structure

Every stage defines:

1. intended outcome and explicit non-goals;
2. target directories and files by responsibility;
3. public types, interfaces, operations, and schemas;
4. construction and request flows;
5. persistence, concurrency, authority, failure, and recovery behavior;
6. deterministic and live proof matrix;
7. production versus local/test composition;
8. completion evidence and remaining boundary; and
9. consequential decisions with alternatives/revisit triggers.

## Definition of done

A stage is done only when:

- its public behavior and non-goals match the relevant capability pages;
- production wiring fails closed where a real dependency is absent;
- architecture laws are non-vacuous and include illegal fixtures;
- deterministic, race, integration, security, crash/retry, and headless tests
  appropriate to the stage pass;
- secrets and content are absent from logs/errors/telemetry;
- generated contracts and schema checksums have no drift;
- docs map concrete files/symbols and record decisions;
- the worktree is clean and changes are in coherent commits; and
- the report distinguishes source correctness from live production evidence.

## Reporting contract

Each implementation report should include:

- outcome and unchanged non-goals;
- base/head/branch/commit ledger;
- before/after directory tree;
- key types/interfaces/functions and call graph;
- schemas and migration ownership introduced in the new system;
- test commands, results, durations, and environment boundaries;
- security/concurrency/failure/recovery evidence;
- review findings and repairs;
- consequential decisions and alternatives;
- residual production gaps; and
- recommended next stage.

Do not report Nova parity, migration completion, or rollback to Nova. If Nova
behavior supplies a fixture, name it as evidence only.
