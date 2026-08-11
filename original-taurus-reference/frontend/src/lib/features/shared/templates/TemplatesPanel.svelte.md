# TemplatesPanel.svelte

The **Templates** rail panel — the in-editor face of the template library
(`docs/archive/plans/2026-07-28-context-templates-mock-pass.md`). Rendered in both the document and
slides context rails through per-stage wrappers, because rail sections mount with no props and
the two stages differ only in scope.

**Everything here is mocked and badged.** There is no template backend; both actions toast
honest copy saying so. When the template model is designed, a standalone backend request
precedes replacing the mocks (the standing playbook).

## The two sections

**Add a template** — one button opening [`AddTemplateModal`](AddTemplateModal.svelte.md):
search the catalog, pick one, it "drops in" (a toast today).

**Make a template** — name (gates the button), description, and **Make template**. On the
slides scope a `RadioGroup` offers **This slide / Whole deck** — a deck and a single slide are
both saveable as templates, per the user; a document is its own scope, so the document variant
shows no choice. Submitting toasts what *would* have been saved and clears the fields.

## Deferred: Convert text → prompt

Considered for a second button under Make template and **deliberately left out** (user,
2026-07-28): a template author today wouldn't know when to convert text to a prompt block, so
for now you design templates by hand. The future shape is AI-driven — classify which content is
prompt vs text from the text itself, which also unlocks **auto-generated context variables**
(hard to author manually). Revisit when templates get a backend.

## Also considered

A "drop template" button in the editor's own top bar, instead of (or beside) this rail panel.
Kept in the rail for now; the button remains a candidate once templates are real and usage
shows where the reach-for-it moment is.
