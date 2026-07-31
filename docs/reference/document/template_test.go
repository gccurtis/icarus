package document_test

import (
	"errors"
	"testing"

	"github.com/gccurtis/taurus-omega/core/capability/document"
)

func templateOf(t *testing.T, docs *document.Documents, id string) *document.TemplateInfo {
	t.Helper()
	got, err := docs.Get("p", id)
	if err != nil {
		t.Fatalf("Get: %v", err)
	}
	return got.Base.Template
}

func TestSetTemplateDefinesVariablesAndLists(t *testing.T) {
	docs := newDocs()
	doc, _ := docs.Create("p", "Doc", oneAtomDoc("hello"))

	if _, err := submitChanges(docs, "p", doc.ID, "u1", []document.ChangeOp{
		{Op: document.OpSetTemplate, Template: &document.TemplateInfo{
			IsTemplate: true,
			Variables: []document.ContextVariable{
				{Name: "customer", Description: "The customer this doc is for"},
				{Name: "product", Description: "The product in scope"},
			},
		}},
	}); err != nil {
		t.Fatalf("set_template: %v", err)
	}

	tmpl := templateOf(t, docs, doc.ID)
	if tmpl == nil || !tmpl.IsTemplate || len(tmpl.Variables) != 2 || tmpl.Variables[0].Name != "customer" {
		t.Fatalf("template not stored: %+v", tmpl)
	}

	list, err := docs.Templates("p")
	if err != nil {
		t.Fatalf("Templates: %v", err)
	}
	if len(list) != 1 || list[0].ID != doc.ID {
		t.Fatalf("template list wrong: %+v", list)
	}
	// A non-template document is not listed.
	other, _ := docs.Create("p", "Plain", oneAtomDoc("x"))
	if list, _ := docs.Templates("p"); len(list) != 1 || list[0].ID == other.ID {
		t.Errorf("a plain doc should not be listed as a template: %+v", list)
	}
}

func TestSetContextVariableBindsAndRejectsUndeclared(t *testing.T) {
	docs := newDocs()
	doc, _ := docs.Create("p", "Doc", oneAtomDoc("hello"))
	if _, err := submitChanges(docs, "p", doc.ID, "u1", []document.ChangeOp{
		{Op: document.OpSetTemplate, Template: &document.TemplateInfo{
			IsTemplate: true, Variables: []document.ContextVariable{{Name: "customer"}},
		}},
	}); err != nil {
		t.Fatalf("set_template: %v", err)
	}

	// Bind the declared variable.
	if _, err := submitChanges(docs, "p", doc.ID, "u1", []document.ChangeOp{
		{Op: document.OpSetContextVariable, ContextVarName: "customer", BoundContext: "Acme Corp"},
	}); err != nil {
		t.Fatalf("set_context_variable: %v", err)
	}
	if v := templateOf(t, docs, doc.ID).Variables[0]; v.BoundContext != "Acme Corp" {
		t.Fatalf("binding not applied: %+v", v)
	}

	// An undeclared variable is rejected.
	if _, err := submitChanges(docs, "p", doc.ID, "u1", []document.ChangeOp{
		{Op: document.OpSetContextVariable, ContextVarName: "ghost", BoundContext: "x"},
	}); err == nil {
		t.Errorf("binding an undeclared variable should fail")
	}
}

func TestCreateFromTemplateClearsBindings(t *testing.T) {
	docs := newDocs()
	doc, _ := docs.Create("p", "Template Doc", oneAtomDoc("hello"))
	if _, err := submitChanges(docs, "p", doc.ID, "u1", []document.ChangeOp{
		{Op: document.OpSetTemplate, Template: &document.TemplateInfo{
			IsTemplate: true, Variables: []document.ContextVariable{{Name: "customer", Description: "d"}},
		}},
		{Op: document.OpSetContextVariable, ContextVarName: "customer", BoundContext: "Acme"},
	}); err != nil {
		t.Fatalf("setup: %v", err)
	}

	inst, err := docs.CreateFromTemplate("p", doc.ID)
	if err != nil {
		t.Fatalf("CreateFromTemplate: %v", err)
	}
	if inst.ID == doc.ID {
		t.Fatal("instance must be a new document")
	}
	tmpl := templateOf(t, docs, inst.ID)
	if tmpl == nil || tmpl.IsTemplate {
		t.Fatalf("instance must not be a template: %+v", tmpl)
	}
	if len(tmpl.Variables) != 1 || tmpl.Variables[0].Name != "customer" || tmpl.Variables[0].Description != "d" {
		t.Fatalf("instance should keep the variable set + descriptions: %+v", tmpl)
	}
	if tmpl.Variables[0].BoundContext != "" {
		t.Errorf("instance bindings must be cleared, got %q", tmpl.Variables[0].BoundContext)
	}
	// Instantiating a non-template document is not found.
	plain, _ := docs.Create("p", "Plain", oneAtomDoc("x"))
	if _, err := docs.CreateFromTemplate("p", plain.ID); !errors.Is(err, document.ErrNotFound) {
		t.Errorf("CreateFromTemplate on a non-template: want ErrNotFound, got %v", err)
	}
}

func TestTemplateOpsUndoRedo(t *testing.T) {
	docs := newDocs()
	doc, _ := docs.Create("p", "Doc", oneAtomDoc("hello"))
	define, _ := submitChanges(docs, "p", doc.ID, "u1", []document.ChangeOp{
		{Op: document.OpSetTemplate, Template: &document.TemplateInfo{
			IsTemplate: true, Variables: []document.ContextVariable{{Name: "customer"}},
		}},
	})
	bind, _ := submitChanges(docs, "p", doc.ID, "u1", []document.ChangeOp{
		{Op: document.OpSetContextVariable, ContextVarName: "customer", BoundContext: "Acme"},
	})

	// Undo the binding → back to empty.
	undo, err := docs.Undo("p", doc.ID, "u1", bind.ID)
	if err != nil {
		t.Fatalf("undo bind: %v", err)
	}
	if v := templateOf(t, docs, doc.ID).Variables[0]; v.BoundContext != "" {
		t.Errorf("undo should clear the binding, got %q", v.BoundContext)
	}
	// Redo → binding back.
	if _, err := docs.Redo("p", doc.ID, "u1", undo.ID); err != nil {
		t.Fatalf("redo bind: %v", err)
	}
	if v := templateOf(t, docs, doc.ID).Variables[0]; v.BoundContext != "Acme" {
		t.Errorf("redo should restore the binding, got %q", v.BoundContext)
	}
	_ = define
}
