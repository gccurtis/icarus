# Reconcile active documentation with the shipped codebase

## Bring subsystem ledgers and living plans forward to current Alpha/Omega behavior

```text
Architecture        document tabs bind to canonical Omega resource ids
Discrepancies       real project purpose, membership, sharing, and document catalog
Backend requests    shipped project, resource, activity, and prompt capabilities
Living plans        completed resource-id work removed from the forward queue
```

The audit compared active architecture notes, discrepancy records, backend requests,
and living plans with the current data clients and feature tree. It replaces stale
mock-era and pre-migration claims with the actual shipped boundary, while preserving
dated change records and reference/design material as historical snapshots rather than
rewriting the context they were created to capture.

## Remove stale mock language from source-adjacent UI and documentation

```diff
- Mock sign-in — any well-formed email works
+ Sign-in uses the real Omega authentication flow.

- Import will create a placeholder resource.
+ Import is unavailable until a resource-family uploader is connected.

- No editor exists, so exports are metadata placeholders.
+ Generic export is not yet connected to resource-family content.
```

Authentication, project hydration, document routing, workspace persistence, and
transfer surfaces had comments or copy that described older implementation states.
The revised wording distinguishes real Omega-backed behavior, intentional legacy-tab
fallbacks, local persistence, and genuinely unavailable integrations without promising
placeholder behavior the handlers do not perform.

## Restore byte-exact coverage across every Markdown source companion

```text
Companion reconstruction oracle
  source/config files checked: 69
  byte mismatches:               0

Active Markdown link scan
  files checked:                 103
  missing local targets:         0
```

Several companions had lost source separator lines or comment banners, and three shell
companions contained duplicate script terminators. Restoring the exact source stream
makes the companion corpus trustworthy again: concatenating every fenced code block in
each companion now reproduces its source byte-for-byte. The link scan covers active
guidance and source companions while intentionally excluding snapshot collections.

## Rebuild orientation last from the reconciled documentation

```markdown
| Real (backed by Omega / persisted) | Mock / unavailable (explicitly marked) |
| --- | --- |
| Auth/session and persisted display name (`/auth/*`) | Notification preferences |
| Projects: lifecycle, rename/icon/visibility, purpose, members/roles, share links | Projects-list member summary |
| Resource catalog: list/create/rename/delete/open for documents | Unsupported resource-family creation and editors |
| Document editing: `/documents`, change sets, marks, prompt resolve | AI generation and starter-template content |
```

The orientation guide was updated only after the lower-level sources agreed. It now
describes the real document stage and join route, current data modules, managed
development commands, strict project isolation, and an explicit real-versus-unavailable
matrix, giving the next reader a reliable map rather than a stale summary.

## Verify documentation integrity and application behavior

```text
git diff --check  → passed
pnpm check        → 0 errors, 0 warnings
pnpm build        → passed
pnpm test:e2e     → 5 passed
```

Static diagnostics, the production compiler, and the real Alpha/Omega browser suite all
pass after the documentation and UI-copy corrections. This confirms that the refresh
keeps source companions exact and does not regress authentication, project settings,
resources, sharing, or the primary sign-in flow.
