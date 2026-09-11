# Editor Audit

Lives at `src/lib/development-views/editor-audit/` and is reached at
`/demo/editor-audit`.

This is the durable review surface for the 2026-09-06 document and presentation
editor audit. It records each reported symptom, its source-level cause, the
recommended repair, acceptance criteria, cross-editor presentation guidance,
and the evidence boundary. All confirmed implementation findings in this pass
are repaired, and each decision brief preserves the recorded direction beside
the original recommendation and alternatives.

The decision section contains the small set of questions that change represented
meaning or the implementation working agreement. Each brief records grounding,
the recommendation, the chosen direction, alternatives, evaluation criteria,
and a tradeoff matrix. Follow-up notes auto-save to browser-local storage and can
be copied with the source-controlled record; the page never silently changes a
decision or writes the notes to product data.

It is a development reference, not an editor implementation. The compact panel
drawings demonstrate information hierarchy only and deliberately do not import
production inspector components.
