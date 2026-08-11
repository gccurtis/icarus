package resource_test

import (
	"errors"
	"testing"

	"github.com/gccurtis/taurus-omega/core/capability/resource"
)

// fakeOrgs is a static org-membership resolver for the access-scope tests.
type fakeOrgs map[string][]string

func (f fakeOrgs) UserOrgIDs(userID string) ([]string, error) { return f[userID], nil }

func newAccessCatalog(t *testing.T, orgs resource.OrgMembershipResolver) (*resource.Resources, *resource.MemoryAttributeStore) {
	t.Helper()
	store := resource.NewMemoryAttributeStore()
	fam := &fakeFamily{kind: resource.KindDocument, items: []resource.Summary{
		{ID: "doc", Kind: resource.KindDocument, Name: "Brief", CreatorID: "owner"},
	}}
	svc, err := resource.NewWithAttributes(store, fam)
	if err != nil {
		t.Fatal(err)
	}
	if orgs != nil {
		svc.UseOrgMembership(orgs)
	}
	return svc, store
}

func TestDefaultScopeAdmitsEveryMember(t *testing.T) {
	svc, _ := newAccessCatalog(t, nil)
	for _, user := range []string{"owner", "someone-else"} {
		ok, err := svc.CanAccessResource(user, "p", resource.KindDocument, "doc")
		if err != nil || !ok {
			t.Fatalf("default scope should admit %q: ok=%v err=%v", user, ok, err)
		}
	}
}

func TestOnlyOwnerMaySetAccess(t *testing.T) {
	svc, _ := newAccessCatalog(t, nil)
	if err := svc.SetAccess("someone-else", "p", resource.KindDocument, "doc", resource.AccessScope{}); !errors.Is(err, resource.ErrNotOwner) {
		t.Fatalf("non-owner SetAccess = %v, want ErrNotOwner", err)
	}
	if err := svc.SetAccess("owner", "p", resource.KindDocument, "doc", resource.AccessScope{}); err != nil {
		t.Fatalf("owner SetAccess: %v", err)
	}
}

func TestPrivateScopeAdmitsOnlyOwner(t *testing.T) {
	svc, _ := newAccessCatalog(t, nil)
	// Empty scope (projectWide=false, no orgs/users) = private.
	if err := svc.SetAccess("owner", "p", resource.KindDocument, "doc", resource.AccessScope{}); err != nil {
		t.Fatal(err)
	}
	ownerOK, _ := svc.CanAccessResource("owner", "p", resource.KindDocument, "doc")
	otherOK, _ := svc.CanAccessResource("intruder", "p", resource.KindDocument, "doc")
	if !ownerOK || otherOK {
		t.Fatalf("private scope: owner=%v (want true) other=%v (want false)", ownerOK, otherOK)
	}
}

func TestSpecificPeopleScope(t *testing.T) {
	svc, _ := newAccessCatalog(t, nil)
	if err := svc.SetAccess("owner", "p", resource.KindDocument, "doc", resource.AccessScope{UserIDs: []string{"alice"}}); err != nil {
		t.Fatal(err)
	}
	alice, _ := svc.CanAccessResource("alice", "p", resource.KindDocument, "doc")
	bob, _ := svc.CanAccessResource("bob", "p", resource.KindDocument, "doc")
	owner, _ := svc.CanAccessResource("owner", "p", resource.KindDocument, "doc")
	if !alice || bob || !owner {
		t.Fatalf("specific-people: alice=%v(want t) bob=%v(want f) owner=%v(want t)", alice, bob, owner)
	}
}

func TestOrganizationScopeUsesMembership(t *testing.T) {
	orgs := fakeOrgs{"member-a": {"org-1"}, "member-b": {"org-2"}}
	svc, _ := newAccessCatalog(t, orgs)
	if err := svc.SetAccess("owner", "p", resource.KindDocument, "doc", resource.AccessScope{OrgIDs: []string{"org-1"}}); err != nil {
		t.Fatal(err)
	}
	inOrg, _ := svc.CanAccessResource("member-a", "p", resource.KindDocument, "doc")
	otherOrg, _ := svc.CanAccessResource("member-b", "p", resource.KindDocument, "doc")
	if !inOrg || otherOrg {
		t.Fatalf("org scope: member-a=%v(want t) member-b=%v(want f)", inOrg, otherOrg)
	}
}

func TestCombinationScopeIsUnion(t *testing.T) {
	orgs := fakeOrgs{"orgster": {"org-1"}}
	svc, _ := newAccessCatalog(t, orgs)
	if err := svc.SetAccess("owner", "p", resource.KindDocument, "doc",
		resource.AccessScope{OrgIDs: []string{"org-1"}, UserIDs: []string{"named"}}); err != nil {
		t.Fatal(err)
	}
	for _, u := range []string{"orgster", "named", "owner"} {
		if ok, _ := svc.CanAccessResource(u, "p", resource.KindDocument, "doc"); !ok {
			t.Fatalf("union scope should admit %q", u)
		}
	}
	if ok, _ := svc.CanAccessResource("nobody", "p", resource.KindDocument, "doc"); ok {
		t.Fatalf("union scope should reject an unlisted non-member of the orgs")
	}
}

func TestSettingEveryoneClearsRestriction(t *testing.T) {
	svc, store := newAccessCatalog(t, nil)
	if err := svc.SetAccess("owner", "p", resource.KindDocument, "doc", resource.AccessScope{UserIDs: []string{"alice"}}); err != nil {
		t.Fatal(err)
	}
	// Restrict, then open back up to everyone — the stored restriction should clear.
	if err := svc.SetAccess("owner", "p", resource.KindDocument, "doc", resource.DefaultAccessScope()); err != nil {
		t.Fatal(err)
	}
	attrs, _ := store.ResourceAttributes("p", resource.KindDocument, "doc")
	if attrs.Access != nil {
		t.Fatalf("opening to everyone should clear the stored scope, got %+v", attrs.Access)
	}
	bob, _ := svc.CanAccessResource("bob", "p", resource.KindDocument, "doc")
	if !bob {
		t.Fatalf("after clearing, any member should have access")
	}
}

func TestFilterAccessibleHidesRestricted(t *testing.T) {
	svc, _ := newAccessCatalog(t, nil)
	if err := svc.SetAccess("owner", "p", resource.KindDocument, "doc", resource.AccessScope{UserIDs: []string{"alice"}}); err != nil {
		t.Fatal(err)
	}
	page, err := svc.List("p", resource.PageRequest{})
	if err != nil {
		t.Fatal(err)
	}
	// The listing merged the scope in; a non-permitted member sees nothing.
	visibleToBob, _ := svc.FilterAccessible("bob", page.Resources)
	visibleToAlice, _ := svc.FilterAccessible("alice", page.Resources)
	if len(visibleToBob) != 0 {
		t.Fatalf("bob should not see the restricted doc, got %d", len(visibleToBob))
	}
	if len(visibleToAlice) != 1 {
		t.Fatalf("alice should see the restricted doc, got %d", len(visibleToAlice))
	}
}
