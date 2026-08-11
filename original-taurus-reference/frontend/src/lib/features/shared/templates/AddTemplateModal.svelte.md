# AddTemplateModal.svelte

The **Add template** modal: a search box over the mock catalog
([`mock-templates.ts`](mock-templates.ts.md)) and a result list — name, one-line description,
and a kind badge (Document / Slides, with matching icons). Choosing one closes the modal and
toasts *"… would drop in here — templates are mocked for now."* — the insertion mechanics
arrive with the real template backend, and until then the copy says exactly what didn't happen.
The framing line carries a `MockBadge`; an empty search shows a no-matches notice rather than
the full catalog pretending to be results.

`open` is `$bindable`; closing (either path) clears the query so the modal reopens fresh.
