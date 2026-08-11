package organization

import (
	"errors"
	"testing"
)

func newService(t *testing.T) *Organizations {
	t.Helper()
	svc, err := New(NewMemoryStore())
	if err != nil {
		t.Fatal(err)
	}
	return svc
}

func TestCreateMakesCreatorTheOwner(t *testing.T) {
	svc := newService(t)
	org, err := svc.Create("user-1", "Acme")
	if err != nil {
		t.Fatal(err)
	}
	if org.ID == "" || org.Name != "Acme" || org.CreatedAt.IsZero() {
		t.Fatalf("unexpected org: %+v", org)
	}
	mine, err := svc.ListMine("user-1")
	if err != nil {
		t.Fatal(err)
	}
	if len(mine) != 1 || mine[0].Organization.ID != org.ID || mine[0].Role != RoleOwner {
		t.Fatalf("creator should own the org, got %+v", mine)
	}
}

func TestCreateRejectsBlankName(t *testing.T) {
	svc := newService(t)
	if _, err := svc.Create("user-1", "   "); !errors.Is(err, ErrInvalidName) {
		t.Fatalf("blank name = %v, want ErrInvalidName", err)
	}
}

func TestListMineIsIsolatedPerUser(t *testing.T) {
	svc := newService(t)
	org, _ := svc.Create("user-1", "Acme")
	mine, _ := svc.ListMine("user-2")
	if len(mine) != 0 {
		t.Fatalf("non-member should see no orgs, got %+v", mine)
	}
	if _, err := svc.AddMember("user-1", org.ID, "user-2", RoleMember); err != nil {
		t.Fatal(err)
	}
	mine, _ = svc.ListMine("user-2")
	if len(mine) != 1 || mine[0].Role != RoleMember {
		t.Fatalf("added member should see the org as member, got %+v", mine)
	}
}

func TestOnlyManagersRename(t *testing.T) {
	svc := newService(t)
	org, _ := svc.Create("owner", "Acme")
	if _, err := svc.AddMember("owner", org.ID, "member", RoleMember); err != nil {
		t.Fatal(err)
	}
	if _, err := svc.Rename("member", org.ID, "Nope"); !errors.Is(err, ErrForbidden) {
		t.Fatalf("member rename = %v, want ErrForbidden", err)
	}
	renamed, err := svc.Rename("owner", org.ID, "Acme Inc")
	if err != nil || renamed.Name != "Acme Inc" {
		t.Fatalf("owner rename failed: %v %+v", err, renamed)
	}
}

func TestAdminManagesMembersButOnlyOwnerGrantsOwner(t *testing.T) {
	svc := newService(t)
	org, _ := svc.Create("owner", "Acme")
	if _, err := svc.AddMember("owner", org.ID, "admin", RoleAdmin); err != nil {
		t.Fatal(err)
	}
	// Admin can add a plain member.
	if _, err := svc.AddMember("admin", org.ID, "member", RoleMember); err != nil {
		t.Fatalf("admin add member: %v", err)
	}
	// Admin cannot mint another owner.
	if _, err := svc.AddMember("admin", org.ID, "usurper", RoleOwner); !errors.Is(err, ErrForbidden) {
		t.Fatalf("admin granting owner = %v, want ErrForbidden", err)
	}
	// Owner can promote the admin to owner.
	if err := svc.SetRole("owner", org.ID, "admin", RoleOwner); err != nil {
		t.Fatalf("owner promote: %v", err)
	}
}

func TestLastOwnerCannotBeRemovedOrDemoted(t *testing.T) {
	svc := newService(t)
	org, _ := svc.Create("owner", "Acme")
	if err := svc.RemoveMember("owner", org.ID, "owner"); !errors.Is(err, ErrLastOwner) {
		t.Fatalf("removing last owner = %v, want ErrLastOwner", err)
	}
	if err := svc.SetRole("owner", org.ID, "owner", RoleMember); !errors.Is(err, ErrLastOwner) {
		t.Fatalf("demoting last owner = %v, want ErrLastOwner", err)
	}
}

func TestMembersRequiresMembership(t *testing.T) {
	svc := newService(t)
	org, _ := svc.Create("owner", "Acme")
	if _, err := svc.Members("stranger", org.ID); !errors.Is(err, ErrForbidden) {
		t.Fatalf("stranger listing members = %v, want ErrForbidden", err)
	}
	members, err := svc.Members("owner", org.ID)
	if err != nil || len(members) != 1 || members[0].UserID != "owner" || members[0].Role != RoleOwner {
		t.Fatalf("owner Members = %v %+v", err, members)
	}
}

func TestUserOrgIDsForAccessResolver(t *testing.T) {
	svc := newService(t)
	a, _ := svc.Create("user-1", "A")
	b, _ := svc.Create("user-1", "B")
	svc.Create("user-2", "C")
	ids, err := svc.UserOrgIDs("user-1")
	if err != nil {
		t.Fatal(err)
	}
	set := map[string]bool{}
	for _, id := range ids {
		set[id] = true
	}
	if len(ids) != 2 || !set[a.ID] || !set[b.ID] {
		t.Fatalf("UserOrgIDs(user-1) = %v, want {%s,%s}", ids, a.ID, b.ID)
	}
}
