# 2026-07-26 — Windowed row reads: deferred (keep full-document load)

Decision (with the user): **keep loading the whole document** and defer windowed row reads. This
records why and updates the live docs. No code change — the full-doc load is already the
behavior; this makes the deferral explicit and captures the approach for whoever picks it up.

## Why it's not a bolt-on like the other integrations

The other integrations were data-layer translations. Windowed reads reach into the **editor
core**:

- The editor is ProseMirror, whose model **is** the whole document (every row is a node).
- Every edit is computed by diffing the entire server-truth `snapshot` against the entire current
  doc (`diffDoc(this.snapshot, this.state.doc)`), and ~15 other spots read the full `snapshot`
  (styleRef, block alignment, block lookup).
- To load only a viewport window of row **bodies**, off-screen rows must live in the editor as
  lightweight **placeholders** (bodies swapped in on scroll), and the diff must **skip rows whose
  body isn't loaded** — otherwise a placeholder reads as a delete/change and corrupts the doc on
  save.

Pagination is *not* the blocker: it needs only row **heights**, which the `row-manifest` provides
without bodies, and the `DocumentRowRepository` / `pagePlan` / `ensurePageRange` scaffolding was
built for exactly this. The hard part is the editor's whole-doc assumption.

## Shape when picked up (for the future implementer)

The Omega routes exist (`descriptor` / `row-manifest` / `rows?from=&count=` / `rows/locate` /
`revision-hints`; **no `/missing`**). The path: load `descriptor` + `row-manifest` → build the
page plan and placeholder rows from the manifest → load viewport bodies via `/rows` → fetch
`rowRepository.missing()` on `ensurePageRange` → make the diff window-safe (only diff loaded
rows). A perf win for very large documents; not blocking anything today.

## Docs updated

```
docs/superpowers/plans/2026-07-26-integration-completion.md  — Task 4.3 → DEFERRED + the shape
docs/integration/current/ORIENTATION.md                       — What's next: all buildable shipped;
                                                                windowed rows deferred
docs/integration/current/2026-07-25-integratable-now.md       — row → DEFERRED; order recut
```

With this, **every buildable integration is shipped**; the remaining items (windowed rows,
notifications, pdf/docx, the 4 giant companions) are all deliberately deferred and tracked.
