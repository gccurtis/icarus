package document

import (
	"testing"
	"time"
)

func promptBlockBase(blockID string, resolvedAt time.Time) Base {
	return Base{Rows: []Row{{ID: "r1", Blocks: []Block{{
		ID:   blockID,
		Kind: BlockKindPrompt,
		Data: PromptData{Instruction: "summarize", ResolvedAt: resolvedAt},
	}}}}}
}

func TestValidateSetBlockContext(t *testing.T) {
	ok := ChangeOp{Op: OpSetBlockContext, BlockID: "b1", BlockContext: &BlockContext{Include: []string{"sales"}}}
	if err := validateOps([]ChangeOp{ok}); err != nil {
		t.Fatalf("valid op rejected: %v", err)
	}
	// Missing block id.
	if err := validateOps([]ChangeOp{{Op: OpSetBlockContext, BlockContext: &BlockContext{Include: []string{"a"}}}}); err == nil {
		t.Fatal("expected rejection for empty block id")
	}
	// A name in both include and exclude is valid — it is the primary exclude use
	// case (include a broad set, exclude one of them); resolveBlockScope subtracts
	// it so exclude wins.
	both := ChangeOp{Op: OpSetBlockContext, BlockID: "b1", BlockContext: &BlockContext{Include: []string{"a"}, Exclude: []string{"a"}}}
	if err := validateOps([]ChangeOp{both}); err != nil {
		t.Fatalf("include+exclude of the same name should be valid: %v", err)
	}
	// A blank name is rejected.
	blank := ChangeOp{Op: OpSetBlockContext, BlockID: "b1", BlockContext: &BlockContext{Include: []string{"  "}}}
	if err := validateOps([]ChangeOp{blank}); err == nil {
		t.Fatal("expected rejection for a blank variable name")
	}
}

func TestApplySetBlockContextClearsResolvedAtAndInverts(t *testing.T) {
	resolved := time.Unix(10, 0).UTC()
	base := promptBlockBase("b1", resolved)
	op := ChangeOp{Op: OpSetBlockContext, BlockID: "b1", BlockContext: &BlockContext{Include: []string{"sales"}}}

	next, inv, err := applyOpsWithInverse(base, []ChangeOp{op})
	if err != nil {
		t.Fatalf("apply: %v", err)
	}
	blk := next.Rows[0].Blocks[0]
	if blk.Context == nil || len(blk.Context.Include) != 1 || blk.Context.Include[0] != "sales" {
		t.Fatalf("context not set: %+v", blk.Context)
	}
	if pd, _ := blk.Data.(PromptData); !pd.ResolvedAt.IsZero() {
		t.Fatalf("ResolvedAt not cleared: %v", pd.ResolvedAt)
	}
	// The input base is untouched (copy-on-write).
	if base.Rows[0].Blocks[0].Context != nil {
		t.Fatal("apply mutated the input base's context")
	}
	if pd, _ := base.Rows[0].Blocks[0].Data.(PromptData); pd.ResolvedAt.IsZero() {
		t.Fatal("apply mutated the input base's ResolvedAt")
	}

	// The inverse restores both the prior (nil) context and the prior ResolvedAt.
	restored, err := applyOps(next, inv)
	if err != nil {
		t.Fatalf("apply inverse: %v", err)
	}
	rblk := restored.Rows[0].Blocks[0]
	if rblk.Context != nil {
		t.Fatalf("inverse did not restore the prior nil context: %+v", rblk.Context)
	}
	if pd, _ := rblk.Data.(PromptData); !pd.ResolvedAt.Equal(resolved) {
		t.Fatalf("inverse did not restore ResolvedAt: got %v, want %v", pd.ResolvedAt, resolved)
	}
}

// A scope change invalidates the prior answer as a formatting draft: it was
// synthesized from a different source set, and feeding it to the next
// resolution leaks old-scope content into the new scope (and biases the model
// into judging in-scope evidence insufficient). set_block_context must clear
// the carryover along with ResolvedAt; undo restores it with the prior block.
func TestApplySetBlockContextClearsPriorAnswerCarryover(t *testing.T) {
	base := promptBlockBase("b1", time.Unix(10, 0).UTC())
	pd := base.Rows[0].Blocks[0].Data.(PromptData)
	pd.LastInstruction = "summarize"
	pd.LastOutput = "The Zephyrite reactor is a solar technology."
	base.Rows[0].Blocks[0].Data = pd
	op := ChangeOp{Op: OpSetBlockContext, BlockID: "b1", BlockContext: &BlockContext{Include: []string{"wind"}}}

	next, inv, err := applyOpsWithInverse(base, []ChangeOp{op})
	if err != nil {
		t.Fatalf("apply: %v", err)
	}
	got, _ := next.Rows[0].Blocks[0].Data.(PromptData)
	if got.LastInstruction != "" || got.LastOutput != "" {
		t.Fatalf("prior answer carryover not cleared: LastInstruction=%q LastOutput=%q", got.LastInstruction, got.LastOutput)
	}

	restored, err := applyOps(next, inv)
	if err != nil {
		t.Fatalf("apply inverse: %v", err)
	}
	rpd, _ := restored.Rows[0].Blocks[0].Data.(PromptData)
	if rpd.LastInstruction != "summarize" || rpd.LastOutput != pd.LastOutput {
		t.Fatalf("inverse did not restore the carryover: LastInstruction=%q LastOutput=%q", rpd.LastInstruction, rpd.LastOutput)
	}
}

func TestApplySetBlockContextUnknownBlockConflicts(t *testing.T) {
	base := promptBlockBase("b1", time.Time{})
	op := ChangeOp{Op: OpSetBlockContext, BlockID: "nope", BlockContext: &BlockContext{Include: []string{"a"}}}
	if _, err := applyOp(base, op); err != ErrConflict {
		t.Fatalf("unknown block: err = %v, want ErrConflict", err)
	}
}

func TestCloneBlockContextIsDeep(t *testing.T) {
	src := &BlockContext{Include: []string{"sales"}, Exclude: []string{"legacy"}}
	cp := cloneBlockContext(src)
	cp.Include[0] = "MUT"
	if src.Include[0] != "sales" {
		t.Fatal("clone shared the include slice")
	}
	cp.Exclude[0] = "MUT"
	if src.Exclude[0] != "legacy" {
		t.Fatal("clone shared the exclude slice")
	}
	if cloneBlockContext(nil) != nil {
		t.Fatal("clone of nil should be nil")
	}
}

func TestResolveBlockScopeUnionMinusExclude(t *testing.T) {
	tmpl := &TemplateInfo{Variables: []ContextVariable{
		{Name: "a", BoundResource: &ResourceRef{Kind: "connector", ID: "CA"}},
		{Name: "b", BoundResource: &ResourceRef{Kind: "connector", ID: "CB"}},
		{Name: "legacy", BoundResource: &ResourceRef{Kind: "connector", ID: "OLD"}},
		{Name: "freeform", BoundContext: "no resource"}, // unbound → contributes nothing
	}}
	got := resolveBlockScope(tmpl, &BlockContext{Include: []string{"a", "b", "freeform"}, Exclude: []string{"legacy"}})
	// expect {CA, CB} in include order, no OLD, no freeform.
	if len(got) != 2 || got[0] != (ScopeOrigin{"connector", "CA"}) || got[1] != (ScopeOrigin{"connector", "CB"}) {
		t.Fatalf("scope = %+v", got)
	}
	// Excluding a source that was also included removes it.
	got2 := resolveBlockScope(tmpl, &BlockContext{Include: []string{"a", "b"}, Exclude: []string{"a"}})
	if len(got2) != 1 || got2[0].ID != "CB" {
		t.Fatalf("exclude-of-include failed: %+v", got2)
	}
	// An unknown variable name contributes nothing; a nil context yields nil.
	if got3 := resolveBlockScope(tmpl, &BlockContext{Include: []string{"nope"}}); got3 != nil {
		t.Fatalf("unknown name should contribute nothing: %+v", got3)
	}
	if resolveBlockScope(tmpl, nil) != nil {
		t.Fatal("nil context should yield nil scope")
	}
}

func TestResolveBlockScopeSelectionSplitsIncludeExclude(t *testing.T) {
	tmpl := &TemplateInfo{Variables: []ContextVariable{
		{Name: "all", BoundResource: &ResourceRef{Kind: "context", ID: "C"}},
		{Name: "drop", BoundResource: &ResourceRef{Kind: "document", ID: "d1"}},
	}}
	inc, exc := resolveBlockScopeSelection(tmpl, &BlockContext{Include: []string{"all"}, Exclude: []string{"drop"}})
	if len(inc) != 1 || inc[0] != (ScopeOrigin{Kind: "context", ID: "C"}) {
		t.Fatalf("include: %+v", inc)
	}
	if len(exc) != 1 || exc[0] != (ScopeOrigin{Kind: "document", ID: "d1"}) {
		t.Fatalf("exclude: %+v", exc)
	}
	// Behavior preserved: resolveBlockScope still returns include − exclude
	// (here the two origins differ, so both-set subtraction leaves the include).
	got := resolveBlockScope(tmpl, &BlockContext{Include: []string{"all"}, Exclude: []string{"drop"}})
	if len(got) != 1 || got[0] != (ScopeOrigin{Kind: "context", ID: "C"}) {
		t.Fatalf("resolveBlockScope changed: %+v", got)
	}
}
