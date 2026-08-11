package access_test

import (
	"fmt"
	"testing"

	"github.com/gccurtis/taurus-omega/core/capability/access"
)

// MembersSummaryByProjects returns a bounded, public-safe stack plus the exact
// total, batched across projects, and an empty summary for a project with no
// extra members.
func TestMembersSummaryByProjects(t *testing.T) {
	a := newAccess()
	owner, _ := a.Register("owner@example.com", "password123", "Owner")
	if _, err := a.UpdateProfile(owner.ID, nil, nil, ptr("/files/owner/meta")); err != nil {
		t.Fatalf("avatar: %v", err)
	}
	projectA, _ := a.CreateProject(owner.ID, "Alpha")
	projectB, _ := a.CreateProject(owner.ID, "Beta")

	// Alpha gets seven more members (eight total, over the stack size of five).
	for i := 0; i < 7; i++ {
		email := fmt.Sprintf("m%02d@example.com", i)
		if _, err := a.Register(email, "password123", fmt.Sprintf("Member %d", i)); err != nil {
			t.Fatalf("register %s: %v", email, err)
		}
		if _, err := a.AddProjectMember(owner.ID, projectA.ID, email, access.RoleEdit); err != nil {
			t.Fatalf("add member %s: %v", email, err)
		}
	}

	summaries, err := a.MembersSummaryByProjects([]string{projectA.ID, projectB.ID}, access.DefaultMemberStackSize)
	if err != nil {
		t.Fatalf("summary: %v", err)
	}

	alpha := summaries[projectA.ID]
	if alpha.Total != 8 {
		t.Errorf("Alpha total = %d, want 8", alpha.Total)
	}
	if len(alpha.Items) != access.DefaultMemberStackSize {
		t.Errorf("Alpha items = %d, want capped at %d", len(alpha.Items), access.DefaultMemberStackSize)
	}

	beta := summaries[projectB.ID]
	if beta.Total != 1 || len(beta.Items) != 1 {
		t.Errorf("Beta summary = %+v, want the owner alone", beta)
	}
	// The owner's avatar surfaces in the summary (public-safe identity).
	found := false
	for _, m := range beta.Items {
		if m.UserID == owner.ID && m.AvatarURL == "/files/owner/meta" && m.Name == "Owner" {
			found = true
		}
	}
	if !found {
		t.Errorf("owner avatar missing from Beta summary: %+v", beta.Items)
	}
}

func TestMembersSummaryEmptyInput(t *testing.T) {
	a := newAccess()
	out, err := a.MembersSummaryByProjects(nil, access.DefaultMemberStackSize)
	if err != nil {
		t.Fatalf("empty: %v", err)
	}
	if len(out) != 0 {
		t.Fatalf("empty input = %+v, want no entries", out)
	}
}
