package document

import (
	"testing"
	"time"
)

func TestClonePromptDataPersonaIsDeep(t *testing.T) {
	src := PromptData{Instruction: "x", Persona: &PersonaRef{ID: "p1", Version: 3}}
	cp, ok := cloneBlockData(src).(PromptData)
	if !ok {
		t.Fatal("clone did not return PromptData")
	}
	cp.Persona.ID = "MUT"
	if src.Persona.ID != "p1" {
		t.Fatal("clone shared the Persona pointer")
	}
}

func TestValidateSetBlockPersona(t *testing.T) {
	ok := ChangeOp{Op: OpSetBlockPersona, BlockID: "b1", BlockPersona: &PersonaRef{ID: "p1", Version: 2}}
	if err := validateOps([]ChangeOp{ok}); err != nil {
		t.Fatalf("valid op rejected: %v", err)
	}
	// Clearing the persona (nil ref) is valid.
	if err := validateOps([]ChangeOp{{Op: OpSetBlockPersona, BlockID: "b1"}}); err != nil {
		t.Fatalf("clear-persona op rejected: %v", err)
	}
	// Missing block id.
	if err := validateOps([]ChangeOp{{Op: OpSetBlockPersona, BlockPersona: &PersonaRef{ID: "p1"}}}); err == nil {
		t.Fatal("expected rejection for empty block id")
	}
	// A present ref with a blank id is rejected.
	if err := validateOps([]ChangeOp{{Op: OpSetBlockPersona, BlockID: "b1", BlockPersona: &PersonaRef{ID: "  "}}}); err == nil {
		t.Fatal("expected rejection for a blank persona id")
	}
	// A negative version is rejected.
	if err := validateOps([]ChangeOp{{Op: OpSetBlockPersona, BlockID: "b1", BlockPersona: &PersonaRef{ID: "p1", Version: -1}}}); err == nil {
		t.Fatal("expected rejection for a negative persona version")
	}
}

func TestApplySetBlockPersonaClearsResolvedAtAndInverts(t *testing.T) {
	resolved := time.Unix(10, 0).UTC()
	base := promptBlockBase("b1", resolved) // helper in context_test.go
	op := ChangeOp{Op: OpSetBlockPersona, BlockID: "b1", BlockPersona: &PersonaRef{ID: "p1", Version: 2}}

	next, inv, err := applyOpsWithInverse(base, []ChangeOp{op})
	if err != nil {
		t.Fatalf("apply: %v", err)
	}
	pd, _ := next.Rows[0].Blocks[0].Data.(PromptData)
	if pd.Persona == nil || pd.Persona.ID != "p1" || pd.Persona.Version != 2 {
		t.Fatalf("persona not set: %+v", pd.Persona)
	}
	if !pd.ResolvedAt.IsZero() {
		t.Fatalf("ResolvedAt not cleared: %v", pd.ResolvedAt)
	}
	// Input base untouched (copy-on-write).
	if bpd, _ := base.Rows[0].Blocks[0].Data.(PromptData); bpd.Persona != nil || bpd.ResolvedAt.IsZero() {
		t.Fatal("apply mutated the input base")
	}
	// Inverse restores the prior (nil) persona and prior ResolvedAt.
	restored, err := applyOps(next, inv)
	if err != nil {
		t.Fatalf("apply inverse: %v", err)
	}
	rpd, _ := restored.Rows[0].Blocks[0].Data.(PromptData)
	if rpd.Persona != nil {
		t.Fatalf("inverse did not restore nil persona: %+v", rpd.Persona)
	}
	if !rpd.ResolvedAt.Equal(resolved) {
		t.Fatalf("inverse did not restore ResolvedAt: got %v, want %v", rpd.ResolvedAt, resolved)
	}
}

func TestApplySetBlockPersonaRejectsNonPromptAndUnknownBlock(t *testing.T) {
	// Unknown block.
	base := promptBlockBase("b1", time.Time{})
	if _, err := applyOp(base, ChangeOp{Op: OpSetBlockPersona, BlockID: "nope", BlockPersona: &PersonaRef{ID: "p1"}}); err != ErrConflict {
		t.Fatalf("unknown block: err = %v, want ErrConflict", err)
	}
	// Non-prompt block.
	textBase := Base{Rows: []Row{{ID: "r1", Blocks: []Block{{ID: "t1", Kind: BlockKindText}}}}}
	if _, err := applyOp(textBase, ChangeOp{Op: OpSetBlockPersona, BlockID: "t1", BlockPersona: &PersonaRef{ID: "p1"}}); err != ErrConflict {
		t.Fatalf("non-prompt block: err = %v, want ErrConflict", err)
	}
}
