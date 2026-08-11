package access_test

import (
	"errors"
	"strings"
	"testing"

	"github.com/gccurtis/taurus-omega/core/capability/access"
)

func newAccess() *access.Access {
	store := access.NewMemoryStore()
	return access.New(stores(store), access.Options{})
}

func stores(s *access.MemoryStore) access.Stores {
	return access.Stores{Users: s, Sessions: s, Projects: s, Memberships: s, Links: s}
}

func TestRegisterLoginResolveLogout(t *testing.T) {
	a := newAccess()

	if _, err := a.Register("Dev@Example.com", "password123", ""); err != nil {
		t.Fatalf("register: %v", err)
	}
	if _, err := a.Register("dev@example.com", "password123", ""); !errors.Is(err, access.ErrEmailTaken) {
		t.Errorf("duplicate (case-insensitive): got %v, want ErrEmailTaken", err)
	}
	if _, err := a.Register("not-an-email", "password123", ""); !errors.Is(err, access.ErrInvalidEmail) {
		t.Errorf("bad email: got %v, want ErrInvalidEmail", err)
	}
	if _, err := a.Register("x@y.com", "short", ""); !errors.Is(err, access.ErrWeakPassword) {
		t.Errorf("weak password: got %v, want ErrWeakPassword", err)
	}

	if _, err := a.Login("dev@example.com", "wrong"); !errors.Is(err, access.ErrInvalidCredentials) {
		t.Errorf("wrong password: got %v, want ErrInvalidCredentials", err)
	}
	if _, err := a.Login("nobody@example.com", "password123"); !errors.Is(err, access.ErrInvalidCredentials) {
		t.Errorf("unknown email: got %v, want ErrInvalidCredentials", err)
	}

	sess, err := a.Login("dev@example.com", "password123")
	if err != nil {
		t.Fatalf("login: %v", err)
	}
	ctx, err := a.Resolve(sess.ID)
	if err != nil || ctx.User.Email != "dev@example.com" {
		t.Fatalf("resolve: ctx=%+v err=%v", ctx, err)
	}

	if err := a.Logout(sess.ID); err != nil {
		t.Fatalf("logout: %v", err)
	}
	if _, err := a.Resolve(sess.ID); !errors.Is(err, access.ErrNotFound) {
		t.Errorf("resolve after logout: got %v, want ErrNotFound", err)
	}
	if _, err := a.Resolve("bogus"); !errors.Is(err, access.ErrNotFound) {
		t.Errorf("resolve unknown: got %v, want ErrNotFound", err)
	}
}

func TestLoginNoPasswordSet(t *testing.T) {
	store := access.NewMemoryStore()
	a := access.New(stores(store), access.Options{})
	// An OIDC-only account: exists with no password hash.
	if err := store.CreateUser(access.User{ID: "u1", Email: "oidc@example.com"}); err != nil {
		t.Fatal(err)
	}
	if _, err := a.Login("oidc@example.com", "anything1"); !errors.Is(err, access.ErrNoPassword) {
		t.Errorf("got %v, want ErrNoPassword", err)
	}
}

func TestRegisterThenLogin(t *testing.T) {
	a := newAccess()
	if _, err := a.Register("dev@taurus.local", "devpassword", ""); err != nil {
		t.Fatalf("register: %v", err)
	}
	if _, err := a.Login("dev@taurus.local", "devpassword"); err != nil {
		t.Errorf("login registered user: %v", err)
	}
}

func TestSetUserName(t *testing.T) {
	a := newAccess()
	u, err := a.Register("a@b.com", "password123", "Ada")
	if err != nil {
		t.Fatalf("register: %v", err)
	}
	if u.Name != "Ada" {
		t.Fatalf("register name = %q; want Ada", u.Name)
	}
	got, err := a.SetUserName(u.ID, "  Ada L.  ")
	if err != nil || got.Name != "Ada L." {
		t.Fatalf("SetUserName = %q, err %v; want \"Ada L.\"", got.Name, err)
	}
	if _, err := a.SetUserName(u.ID, strings.Repeat("x", 81)); !errors.Is(err, access.ErrInvalidDisplayName) {
		t.Fatalf("long name err = %v; want ErrInvalidDisplayName", err)
	}
	if _, err := a.SetUserName("missing", "x"); !errors.Is(err, access.ErrNotFound) {
		t.Fatalf("unknown user err = %v; want ErrNotFound", err)
	}
}

func TestPublicUserInProjectIsMembershipBound(t *testing.T) {
	a := newAccess()
	owner, err := a.Register("owner@b.com", "password123", "Owner")
	if err != nil {
		t.Fatal(err)
	}
	project, err := a.CreateProject(owner.ID, "Alpha")
	if err != nil {
		t.Fatal(err)
	}
	member, err := a.Register("member@b.com", "password123", "Member")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := a.AddProjectMember(owner.ID, project.ID, member.Email, access.RoleRead); err != nil {
		t.Fatal(err)
	}

	got, err := a.PublicUserInProject(project.ID, member.ID)
	if err != nil || got.ID != member.ID || got.Name != "Member" {
		t.Fatalf("PublicUserInProject = %+v, %v", got, err)
	}
	if got.Kind != "person" {
		t.Fatalf("expected kind 'person', got %q", got.Kind)
	}
	if got.Email != "member@b.com" {
		t.Fatalf("expected email member@b.com, got %q", got.Email)
	}
	if got.Role != "read" {
		t.Fatalf("expected role 'read', got %q", got.Role)
	}
	if got.Description == "" {
		t.Fatalf("expected non-empty description")
	}
	if got.CreatedAt.IsZero() {
		t.Fatalf("expected non-zero createdAt")
	}
	if err := a.RemoveMember(owner.ID, project.ID, member.ID); err != nil {
		t.Fatal(err)
	}
	if _, err := a.PublicUserInProject(project.ID, member.ID); !errors.Is(err, access.ErrNotFound) {
		t.Fatalf("departed member = %v; want ErrNotFound", err)
	}
}

func TestPublicUserInProjectOwnerRole(t *testing.T) {
	a := newAccess()
	owner, err := a.Register("owner@b.com", "password123", "Owner")
	if err != nil {
		t.Fatal(err)
	}
	project, err := a.CreateProject(owner.ID, "Alpha")
	if err != nil {
		t.Fatal(err)
	}
	got, err := a.PublicUserInProject(project.ID, owner.ID)
	if err != nil {
		t.Fatalf("PublicUserInProject (owner): %v", err)
	}
	if got.Role != "owner" {
		t.Fatalf("expected role 'owner', got %q", got.Role)
	}
	if got.Kind != "person" {
		t.Fatalf("expected kind 'person', got %q", got.Kind)
	}
	if got.Email != "owner@b.com" {
		t.Fatalf("expected email, got %q", got.Email)
	}
}

func TestPublicUserInProjectEditRole(t *testing.T) {
	a := newAccess()
	owner, err := a.Register("owner@b.com", "password123", "Owner")
	if err != nil {
		t.Fatal(err)
	}
	project, err := a.CreateProject(owner.ID, "Alpha")
	if err != nil {
		t.Fatal(err)
	}
	member, err := a.Register("editor@b.com", "password123", "Editor")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := a.AddProjectMember(owner.ID, project.ID, member.Email, access.RoleEdit); err != nil {
		t.Fatal(err)
	}
	got, err := a.PublicUserInProject(project.ID, member.ID)
	if err != nil {
		t.Fatalf("PublicUserInProject (editor): %v", err)
	}
	if got.Role != "edit" {
		t.Fatalf("expected role 'edit', got %q", got.Role)
	}
}

func TestPublicUserInProjectEmptyName(t *testing.T) {
	a := newAccess()
	owner, err := a.Register("owner@b.com", "password123", "")
	if err != nil {
		t.Fatal(err)
	}
	project, err := a.CreateProject(owner.ID, "Alpha")
	if err != nil {
		t.Fatal(err)
	}
	got, err := a.PublicUserInProject(project.ID, owner.ID)
	if err != nil {
		t.Fatalf("PublicUserInProject (empty name): %v", err)
	}
	if got.Name != "" {
		t.Fatalf("expected empty name, got %q", got.Name)
	}
	if got.Kind != "person" {
		t.Fatalf("expected kind 'person' even with empty name, got %q", got.Kind)
	}
	if got.Email != "owner@b.com" {
		t.Fatalf("expected email, got %q", got.Email)
	}
}
