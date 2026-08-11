package document

import "testing"

func TestContextVariableBoundResourceClonesDeeply(t *testing.T) {
	src := &TemplateInfo{Variables: []ContextVariable{{
		Name:          "sales",
		BoundResource: &ResourceRef{Kind: "connector", ID: "c1"},
	}}}
	cp := cloneTemplateInfo(src)
	cp.Variables[0].BoundResource.ID = "MUTATED"
	if src.Variables[0].BoundResource.ID != "c1" {
		t.Fatal("clone shared the BoundResource pointer")
	}
}

func TestNormalizeTemplateInfoNilsEmptyBoundResource(t *testing.T) {
	tmpl := &TemplateInfo{Variables: []ContextVariable{
		{Name: "a", BoundResource: &ResourceRef{Kind: " connector ", ID: " c1 "}},
		{Name: "b", BoundResource: &ResourceRef{Kind: "", ID: ""}},
	}}
	normalizeTemplateInfo(tmpl)
	if got := tmpl.Variables[0].BoundResource; got == nil || got.Kind != "connector" || got.ID != "c1" {
		t.Fatalf("bound resource not trimmed: %+v", tmpl.Variables[0].BoundResource)
	}
	if tmpl.Variables[1].BoundResource != nil {
		t.Fatalf("empty bound resource not nilled: %+v", tmpl.Variables[1].BoundResource)
	}
}

func TestValidateSetContextVariableResource(t *testing.T) {
	if err := validateOps([]ChangeOp{{Op: OpSetContextVariable, ContextVarName: "sales", BoundResource: &ResourceRef{Kind: "connector", ID: "c1"}}}); err != nil {
		t.Fatalf("valid resource binding rejected: %v", err)
	}
	if err := validateOps([]ChangeOp{{Op: OpSetContextVariable, ContextVarName: "sales", BoundContext: "x", BoundResource: &ResourceRef{Kind: "connector", ID: "c1"}}}); err == nil {
		t.Fatal("expected rejection when both bindings are set")
	}
	if err := validateOps([]ChangeOp{{Op: OpSetContextVariable, ContextVarName: "sales", BoundResource: &ResourceRef{Kind: "connector"}}}); err == nil {
		t.Fatal("expected rejection for an empty resource id")
	}
}

func TestApplySetContextVariableResourceAndInverse(t *testing.T) {
	base := Base{Template: &TemplateInfo{Variables: []ContextVariable{{Name: "sales", BoundContext: "old free text"}}}}
	op := ChangeOp{Op: OpSetContextVariable, ContextVarName: "sales", BoundResource: &ResourceRef{Kind: "connector", ID: "c1"}}

	next, inv, err := applyOpsWithInverse(base, []ChangeOp{op})
	if err != nil {
		t.Fatalf("apply: %v", err)
	}
	v := next.Template.contextVariable("sales")
	if v.BoundResource == nil || v.BoundResource.ID != "c1" || v.BoundContext != "" {
		t.Fatalf("bad binding after apply: %+v", v)
	}
	// The base must be untouched (copy-on-write).
	if base.Template.contextVariable("sales").BoundResource != nil {
		t.Fatal("apply mutated the input base")
	}
	// Applying the inverse restores the prior free text and clears the resource.
	restored, err := applyOps(next, inv)
	if err != nil {
		t.Fatalf("apply inverse: %v", err)
	}
	rv := restored.Template.contextVariable("sales")
	if rv.BoundResource != nil || rv.BoundContext != "old free text" {
		t.Fatalf("inverse did not restore prior binding: %+v", rv)
	}
}
