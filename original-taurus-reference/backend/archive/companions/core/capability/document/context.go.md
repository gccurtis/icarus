# context.go

Per-block context selection for the live-document program. A prompt block may
carry a `BlockContext` — the `include`/`exclude` sets over the document's declared
context variables — and its resolved retrieval scope is the union of the included
variables' sources minus the excluded variables' sources (`includes − excludes`).
This file holds the type, its deep clone, and (added in a later task) the
name→origin scope resolver. See repo conventions (AGENTS.md).

## Code breakdown

```go
package document

import "strings"

// BlockContext is a prompt block's per-block scope selection over the document's
// declared context variables: the resolved retrieval scope is the union of the
// included variables' sources minus the excluded variables' sources.
type BlockContext struct {
	Include []string `json:"include,omitempty"`
	Exclude []string `json:"exclude,omitempty"`
}

func cloneBlockContext(c *BlockContext) *BlockContext {
	if c == nil {
		return nil
	}
	out := &BlockContext{}
	if len(c.Include) > 0 {
		out.Include = append([]string(nil), c.Include...)
	}
	if len(c.Exclude) > 0 {
		out.Exclude = append([]string(nil), c.Exclude...)
	}
	return out
}

// validateBlockContext checks a block context selection is well-formed: no blank
// variable names. A nil context is valid (the block clears its selection).
// Variable existence is not required — an unknown name simply contributes nothing
// at resolve time. A name may appear in BOTH include and exclude: that is the
// primary exclude use case ("include a broad set, exclude one of them"), and the
// scope is includes − excludes, so exclude wins (see resolveBlockScope).
func validateBlockContext(c *BlockContext) error {
	if c == nil {
		return nil
	}
	for _, name := range c.Include {
		if strings.TrimSpace(name) == "" {
			return ErrInvalidChangeSet
		}
	}
	for _, name := range c.Exclude {
		if strings.TrimSpace(name) == "" {
			return ErrInvalidChangeSet
		}
	}
	return nil
}

// ScopeOrigin is a resolved source address for scoped retrieval.
type ScopeOrigin struct {
	Kind string
	ID   string
}

// resolveBlockScopeSelection maps a block's include/exclude variable names to
// their bound-resource origins WITHOUT subtracting — the anonymous context
// definition handed to a ScopeResolver, which expands (nested contexts,
// whole-project) and subtracts at the leaf level. Each side is deduped and kept
// in declared order. Unbound/undeclared variables contribute nothing.
func resolveBlockScopeSelection(tmpl *TemplateInfo, ctx *BlockContext) (include, exclude []ScopeOrigin) {
	if tmpl == nil || ctx == nil {
		return nil, nil
	}
	bind := func(name string) (ScopeOrigin, bool) {
		v := tmpl.contextVariable(name)
		if v == nil || v.BoundResource == nil || v.BoundResource.ID == "" {
			return ScopeOrigin{}, false
		}
		return ScopeOrigin{Kind: v.BoundResource.Kind, ID: v.BoundResource.ID}, true
	}
	collect := func(names []string) []ScopeOrigin {
		seen := make(map[ScopeOrigin]bool)
		var out []ScopeOrigin
		for _, name := range names {
			o, ok := bind(name)
			if !ok || seen[o] {
				continue
			}
			seen[o] = true
			out = append(out, o)
		}
		return out
	}
	return collect(ctx.Include), collect(ctx.Exclude)
}

// subtractOrigins returns include − exclude, deduped, in include order (exclude
// wins). This is the origin-level scope used when no ScopeResolver is wired.
func subtractOrigins(include, exclude []ScopeOrigin) []ScopeOrigin {
	excluded := make(map[ScopeOrigin]bool, len(exclude))
	for _, o := range exclude {
		excluded[o] = true
	}
	seen := make(map[ScopeOrigin]bool, len(include))
	var out []ScopeOrigin
	for _, o := range include {
		if excluded[o] || seen[o] {
			continue
		}
		seen[o] = true
		out = append(out, o)
	}
	return out
}

// resolveBlockScope computes includes − excludes over the template's variable
// bindings at the origin level (the reference-graph and no-resolver retrieval
// path). See resolveBlockScopeSelection for the leaf-level expansion path.
func resolveBlockScope(tmpl *TemplateInfo, ctx *BlockContext) []ScopeOrigin {
	include, exclude := resolveBlockScopeSelection(tmpl, ctx)
	return subtractOrigins(include, exclude)
}
```

`cloneBlockContext` copies both slices so a cloned block never shares the
selection with the original — the block deep-copy path (`cloneBlock`) calls it,
keeping `Context` isolated like `Atoms`/`Marks`/`Data`.

`resolveBlockScopeSelection` turns a block's variable-name selection into
concrete source origins on each side (include, exclude) WITHOUT subtracting: it
looks each name up in the template's variables, keeps only those bound to a
resource, and dedups each side in declared order. An unknown or
free-text-only variable simply contributes nothing, so an in-progress selection
never errors — it just narrows or widens the scope. This is the split point for
a later ScopeResolver, which expands each side (nested contexts, whole-project)
and subtracts at the leaf level instead of at the origin level.

`subtractOrigins` computes `include − exclude` (dedup, include order, exclude
wins) — the origin-level subtraction used when no ScopeResolver is wired.

`resolveBlockScope` composes the two: `subtractOrigins(resolveBlockScopeSelection(tmpl, ctx))`.
Its signature and output are unchanged for existing callers (`dependencies.go`,
`prompt.go`). The `ScopeOrigin.Kind → knowledge sourceType` mapping stays in the
wiring adapter, so this file (and the whole capability) imports no knowledge
types.
