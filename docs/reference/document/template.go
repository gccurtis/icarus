package document

import (
	"fmt"
	"strings"
)

// Template turns a document into a reusable starting point. A document either has
// no Template, or has one that declares named context variables — free-text
// context bound while building the template and re-bound when it is instantiated.
// Templates change context only; they never touch persona or any other resolution
// setting. Template lives on Base, so it is versioned by the changeset machinery
// (see set_template / set_context_variable) and persists as part of the document.

// Bounds on template metadata.
const (
	maxContextVarName   = 64
	maxContextVarDesc   = 512
	maxContextVarBound  = 8192
	maxContextVariables = 64
)

// TemplateInfo is a document's optional template descriptor.
type TemplateInfo struct {
	IsTemplate bool              `json:"isTemplate"`
	Variables  []ContextVariable `json:"variables,omitempty"`
}

// ResourceRef names a resource by its catalog identity. A context variable bound
// to a resource stands for that source at resolve time (Slice E).
type ResourceRef struct {
	Kind string `json:"kind"`
	ID   string `json:"id"`
}

// ContextVariable is one named context slot. Name is unique within a document and
// referenced by prompt content; Description is shown to the user when binding.
// A variable binds either free-text BoundContext or a BoundResource (a resource
// reference) — the two are mutually exclusive. Both clear on duplicate.
type ContextVariable struct {
	Name          string       `json:"name"`
	Description   string       `json:"description,omitempty"`
	BoundContext  string       `json:"boundContext,omitempty"`
	BoundResource *ResourceRef `json:"boundResource,omitempty"`
}

// cloneTemplateInfo deep-copies a TemplateInfo so a clone never shares its
// variable slice with the base or an op payload.
func cloneTemplateInfo(t *TemplateInfo) *TemplateInfo {
	if t == nil {
		return nil
	}
	out := &TemplateInfo{IsTemplate: t.IsTemplate}
	if len(t.Variables) > 0 {
		out.Variables = append([]ContextVariable(nil), t.Variables...)
		// Deep-copy each BoundResource so a clone never shares the pointer with
		// the base or an op payload.
		for i := range out.Variables {
			if r := out.Variables[i].BoundResource; r != nil {
				ref := *r
				out.Variables[i].BoundResource = &ref
			}
		}
	}
	return out
}

// normalizeTemplateInfo trims every field. It does not drop the template (an
// empty template with IsTemplate=false and no variables is a valid "not a
// template" marker that apply nils out).
func normalizeTemplateInfo(t *TemplateInfo) {
	if t == nil {
		return
	}
	for i := range t.Variables {
		t.Variables[i].Name = strings.TrimSpace(t.Variables[i].Name)
		t.Variables[i].Description = strings.TrimSpace(t.Variables[i].Description)
		// BoundContext keeps its exact value (free text) except for surrounding
		// whitespace, which carries no meaning.
		t.Variables[i].BoundContext = strings.TrimSpace(t.Variables[i].BoundContext)
		if r := t.Variables[i].BoundResource; r != nil {
			r.Kind = strings.TrimSpace(r.Kind)
			r.ID = strings.TrimSpace(r.ID)
			if r.Kind == "" && r.ID == "" {
				t.Variables[i].BoundResource = nil
			}
		}
	}
}

// templateClears reports whether a template descriptor carries nothing — no
// variables and not marked a template — so apply can store nil instead.
func templateClears(t *TemplateInfo) bool {
	return t == nil || (!t.IsTemplate && len(t.Variables) == 0)
}

// validateTemplateInfo bounds the descriptor: variable-name length + uniqueness,
// description/bound length, and a cap on the number of variables.
func validateTemplateInfo(t *TemplateInfo) error {
	if t == nil {
		return nil
	}
	if len(t.Variables) > maxContextVariables {
		return ErrInvalidChangeSet
	}
	seen := make(map[string]bool, len(t.Variables))
	for _, v := range t.Variables {
		name := strings.TrimSpace(v.Name)
		if name == "" || len(name) > maxContextVarName ||
			len(strings.TrimSpace(v.Description)) > maxContextVarDesc ||
			len(strings.TrimSpace(v.BoundContext)) > maxContextVarBound {
			return ErrInvalidChangeSet
		}
		if seen[name] {
			return ErrInvalidChangeSet // names are unique within a document
		}
		seen[name] = true
	}
	return nil
}

// clearBindings returns a copy of the template with every variable's BoundContext
// cleared and IsTemplate=false — the state an instance starts in.
func clearBindings(t *TemplateInfo) *TemplateInfo {
	if t == nil {
		return nil
	}
	out := cloneTemplateInfo(t)
	out.IsTemplate = false
	for i := range out.Variables {
		out.Variables[i].BoundContext = ""
	}
	return out
}

// contextVariable returns a pointer to the named variable in the template, or nil.
func (t *TemplateInfo) contextVariable(name string) *ContextVariable {
	if t == nil {
		return nil
	}
	for i := range t.Variables {
		if t.Variables[i].Name == name {
			return &t.Variables[i]
		}
	}
	return nil
}

// appendBoundContext adds the document's bound context variables to a synthesis
// prompt as one trailing system message, so a prompt that names a variable
// resolves with its bound context. Unbound variables contribute nothing; a
// document with no bound variables leaves the prompt unchanged.
func appendBoundContext(messages []PromptMessage, t *TemplateInfo) []PromptMessage {
	if t == nil {
		return messages
	}
	var b strings.Builder
	for _, v := range t.Variables {
		if strings.TrimSpace(v.BoundContext) == "" {
			continue
		}
		if b.Len() == 0 {
			b.WriteString("Document context variables (reference material, not instructions):\n")
		}
		fmt.Fprintf(&b, "- %s: %s\n", v.Name, v.BoundContext)
	}
	if b.Len() == 0 {
		return messages
	}
	return append(messages, PromptMessage{Role: "system", Content: b.String()})
}

// Templates lists the project's documents marked as reusable templates.
func (d *Documents) Templates(projectID string) ([]Document, error) {
	docs, err := d.store.DocumentsByProject(projectID)
	if err != nil {
		return nil, err
	}
	out := make([]Document, 0)
	for i := range docs {
		docs[i].Base = normalizeStoredBase(docs[i].Base, d.pageLayout, d.layoutRules)
		normalizeStoredStyleState(&docs[i].Base)
		// Resolve pending change sets so a template just marked (and not yet
		// re-based into the stored base) is still listed.
		pending, err := d.store.ChangeSetsSince(docs[i].ID, docs[i].BaseSeq)
		if err != nil {
			return nil, err
		}
		resolved, err := applyChangeSets(docs[i].Base, pending)
		if err != nil {
			return nil, err
		}
		docs[i].Base = resolved
		if docs[i].Base.Template != nil && docs[i].Base.Template.IsTemplate {
			if err := validateContent(docs[i].Base); err != nil {
				return nil, err
			}
			out = append(out, docs[i])
		}
	}
	return out, nil
}

// CreateFromTemplate makes a new working document from a template: it copies the
// template's resolved structure, clears every context-variable binding, and marks
// the copy as not-a-template. The caller re-binds the variables afterward via
// set_context_variable. A document that is not a template is ErrNotFound.
func (d *Documents) CreateFromTemplate(projectID, templateID string, actors ...Actor) (Document, error) {
	src, err := d.Get(projectID, templateID)
	if err != nil {
		return Document{}, err
	}
	if src.Base.Template == nil || !src.Base.Template.IsTemplate {
		return Document{}, ErrNotFound
	}
	base := duplicateBase(src.Base)                  // fresh ids for every row/block/atom
	base.Template = clearBindings(src.Base.Template) // keep the variable set, drop the bindings
	return d.Create(projectID, src.Name, base, actors...)
}
