# Document templates (Alpha gap G1)

> Implemented per this design. Ops `set_template` / `set_context_variable`,
> `Base.Template`, `CreateFromTemplate`, `GET /documents/templates`, and the
> bound-context resolution hook. Unit + dev-tests green.

A template is not a separate resource type. The document `Base` gains an
**optional `Template` object, exactly like `layout`**: a document either doesn't
have it, or has it. When present it declares named **context variables** bound to
real context. Building a template = define + bind the variables. Using one =
duplicate (bindings cleared) → the client prompts the user and re-binds each
variable → refresh. **Templates change context only** — they do not touch
personas or any other resolution setting; a prompt block keeps whatever persona it
already resolves with, only its context changes.

## Model (`core/capability/document`)

```go
// On Base, alongside PageLayout / LayoutRules:
Template *TemplateInfo `json:"template,omitempty"`

type TemplateInfo struct {
    IsTemplate bool              `json:"isTemplate"`          // a reusable template (vs an instance)
    Variables  []ContextVariable `json:"variables,omitempty"`
}

type ContextVariable struct {
    Name         string `json:"name"`                    // unique in the doc; referenced by prompt content
    Description  string `json:"description,omitempty"`   // shown to the user when binding
    BoundContext string `json:"boundContext,omitempty"`  // free text for now; cleared on duplicate
}
```

Bounds: variable name ≤ 64, description ≤ 512, boundContext ≤ a few KB, max
variables per document ≤ 64. Names are unique within a document.

## Bound context is free text now — with a seam for a future context capability

`boundContext` is a free string today, so any value is accepted and there is
nothing to validate against. The seam: a later **context capability** resolves a
binding to real context (a file, a connector, …). When it exists,
`set_context_variable` will **validate the binding and return an error when the
context is not real** — while still storing the value, so the user can fix or sync
it later. Not built now; the op signature and error path are shaped so adding it
is additive.

## Change ops (versioned, undoable — like `set_page_layout`)

- **`set_template`** — replace the whole `TemplateInfo` (define/rename variables +
  descriptions, set `IsTemplate`). Used while **building** a template.
- **`set_context_variable`** `{name, boundContext}` — bind (or clear) one
  variable's context document-wide, without resending the rest. Used while
  **instantiating** (one call per user answer). Rejects an undeclared name.

Both follow the full changeset lifecycle (apply / inverse / validate / normalize /
rebase / clone / summarize), same as `set_block_custom_typography` (record 0069).

## Instantiate

`POST /documents { fromTemplateId }` (and `GET /documents/templates` to list
`IsTemplate` docs). `CreateFromTemplate` reuses the existing `Duplicate` structure
copy, then: **clears every variable's `BoundContext`**, keeps names / descriptions,
and sets `IsTemplate=false`. The instance is a normal working document that
remembers what it still needs bound.

## Prompt-resolution path

`ResolveBlock` gains one thing: the document's `Template.Variables` (their
`BoundContext`) are passed to the prompt model as additional context for that
resolution (alongside retrieval), so a prompt that references a variable by name
resolves with its bound context. **No `{{var}}` substitution** — the bound contexts
are supplied as context; the instruction/model uses them. **Persona is unchanged**
— resolution uses whatever persona it uses today.

The `PromptModel` port's resolve call gains one optional input — the bound
variables — and the wiring adapter includes them in the prompt it builds.
Everything stays behind the existing port; the document capability imports neither
persona nor intelligence.

## Settled

- Context variables: `{name, description, boundContext}` — **no persona, no other
  resolution setting**. ✓
- Bound context = free text now; future context capability validates (unreal ⇒
  error, may still store) + connectors. ✓
- No `{{var}}` substitution engine. ✓
- On duplicate: clear bindings, keep names/descriptions, `IsTemplate=false`. ✓
- Two ops (`set_template`, `set_context_variable`), full changeset lifecycle. ✓
