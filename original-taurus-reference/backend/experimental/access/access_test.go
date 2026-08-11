package access_test

import (
	"errors"
	"testing"

	"github.com/gccurtis/taurus-omega/core/access"
	"github.com/gccurtis/taurus-omega/core/access/memory"
)

func newAccess() *access.Access {
	store := memory.New()
	return access.New(
		access.Stores{Users: store, Projects: store, Memberships: store, Sessions: store},
		access.PasswordAuthenticator{},
		access.NewCellRegistry(),
		access.Options{},
	)
}

func TestRegisterValidation(t *testing.T) {
	a := newAccess()

	if _, err := a.Register(access.Credentials{Email: "nope", Password: "password123"}); !errors.Is(err, access.ErrInvalidEmail) {
		t.Errorf("bad email: got %v, want ErrInvalidEmail", err)
	}
	if _, err := a.Register(access.Credentials{Email: "a@b.com", Password: "short"}); !errors.Is(err, access.ErrWeakPassword) {
		t.Errorf("weak password: got %v, want ErrWeakPassword", err)
	}
	if _, err := a.Register(access.Credentials{Email: "a@b.com", Password: "password123"}); err != nil {
		t.Fatalf("valid register: %v", err)
	}
	if _, err := a.Register(access.Credentials{Email: "A@b.com", Password: "password123"}); !errors.Is(err, access.ErrEmailTaken) {
		t.Errorf("duplicate email (case-insensitive): got %v, want ErrEmailTaken", err)
	}
}

func TestLoginAndResolve(t *testing.T) {
	a := newAccess()
	if _, err := a.Register(access.Credentials{Email: "u@b.com", Password: "password123"}); err != nil {
		t.Fatal(err)
	}

	if _, err := a.Login(access.Credentials{Email: "u@b.com", Password: "wrong"}); !errors.Is(err, access.ErrInvalidCredentials) {
		t.Errorf("wrong password: got %v, want ErrInvalidCredentials", err)
	}

	sess, err := a.Login(access.Credentials{Email: "u@b.com", Password: "password123"})
	if err != nil {
		t.Fatalf("login: %v", err)
	}

	ctx, err := a.Resolve(sess.ID)
	if err != nil {
		t.Fatalf("resolve: %v", err)
	}
	if !ctx.Authenticated() {
		t.Fatal("resolved context is not authenticated")
	}
	if ctx.HasProject() {
		t.Fatal("no project should be selected right after login")
	}

	if _, err := a.Resolve("bogus"); !errors.Is(err, access.ErrNotFound) {
		t.Errorf("unknown session: got %v, want ErrNotFound", err)
	}
}

func TestProjectSelectionProducesCell(t *testing.T) {
	a := newAccess()
	u, err := a.Register(access.Credentials{Email: "u@b.com", Password: "password123"})
	if err != nil {
		t.Fatal(err)
	}
	sess, err := a.Login(access.Credentials{Email: "u@b.com", Password: "password123"})
	if err != nil {
		t.Fatal(err)
	}

	p, err := a.CreateProject(u.ID, "Alpha")
	if err != nil {
		t.Fatalf("create project: %v", err)
	}

	projects, err := a.ProjectsForUser(u.ID)
	if err != nil || len(projects) != 1 || projects[0].ID != p.ID {
		t.Fatalf("projects for user = %+v, %v", projects, err)
	}

	if _, err := a.SelectProject(sess.ID, p.ID); err != nil {
		t.Fatalf("select project: %v", err)
	}

	ctx, err := a.Resolve(sess.ID)
	if err != nil {
		t.Fatal(err)
	}
	if !ctx.HasProject() {
		t.Fatal("expected a selected project and cell after select")
	}
	if ctx.Project.ID != p.ID || ctx.Cell.ProjectID != p.ID || ctx.Cell.UserID != u.ID {
		t.Errorf("cell not scoped correctly: project=%v cell=%+v", ctx.Project.ID, ctx.Cell)
	}
}

func TestSelectProjectRequiresMembership(t *testing.T) {
	a := newAccess()
	// Owner creates a project.
	owner, _ := a.Register(access.Credentials{Email: "owner@b.com", Password: "password123"})
	p, _ := a.CreateProject(owner.ID, "Private")

	// A different user signs in and tries to select it.
	if _, err := a.Register(access.Credentials{Email: "intruder@b.com", Password: "password123"}); err != nil {
		t.Fatal(err)
	}
	sess, _ := a.Login(access.Credentials{Email: "intruder@b.com", Password: "password123"})

	if _, err := a.SelectProject(sess.ID, p.ID); !errors.Is(err, access.ErrForbidden) {
		t.Errorf("non-member select: got %v, want ErrForbidden", err)
	}
}

func TestLogout(t *testing.T) {
	a := newAccess()
	a.Register(access.Credentials{Email: "u@b.com", Password: "password123"})
	sess, _ := a.Login(access.Credentials{Email: "u@b.com", Password: "password123"})

	if err := a.Logout(sess.ID); err != nil {
		t.Fatalf("logout: %v", err)
	}
	if _, err := a.Resolve(sess.ID); !errors.Is(err, access.ErrNotFound) {
		t.Errorf("session after logout: got %v, want ErrNotFound", err)
	}
}
