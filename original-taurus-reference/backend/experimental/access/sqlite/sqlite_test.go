package sqlite

import (
	"errors"
	"path/filepath"
	"testing"
	"time"

	"github.com/gccurtis/taurus-omega/core/access"
)

func openTemp(t *testing.T) *Store {
	t.Helper()
	s, err := Open(filepath.Join(t.TempDir(), "test.db"))
	if err != nil {
		t.Fatalf("open: %v", err)
	}
	t.Cleanup(func() { s.Close() })
	return s
}

func TestUserRoundTrip(t *testing.T) {
	s := openTemp(t)
	u := access.User{ID: "u1", Email: "u@b.com", PasswordHash: "hash", CreatedAt: time.Now().UTC().Truncate(time.Second)}
	if err := s.CreateUser(u); err != nil {
		t.Fatal(err)
	}

	got, err := s.UserByEmail("u@b.com")
	if err != nil || got.ID != "u1" || got.Email != "u@b.com" {
		t.Fatalf("UserByEmail = %+v, %v", got, err)
	}
	if !got.CreatedAt.Equal(u.CreatedAt) {
		t.Errorf("CreatedAt = %v, want %v", got.CreatedAt, u.CreatedAt)
	}
	if got, err := s.UserByID("u1"); err != nil || got.Email != "u@b.com" {
		t.Fatalf("UserByID = %+v, %v", got, err)
	}
	if _, err := s.UserByEmail("missing@b.com"); !errors.Is(err, access.ErrNotFound) {
		t.Errorf("missing user: got %v, want ErrNotFound", err)
	}
}

func TestProjectMembershipAndSessions(t *testing.T) {
	s := openTemp(t)
	now := time.Now().UTC().Truncate(time.Second)

	if err := s.CreateUser(access.User{ID: "u1", Email: "u@b.com", PasswordHash: "h", CreatedAt: now}); err != nil {
		t.Fatal(err)
	}
	if err := s.CreateProject(access.Project{ID: "p1", OwnerID: "u1", Name: "Alpha", CreatedAt: now}); err != nil {
		t.Fatal(err)
	}
	if err := s.AddMembership(access.Membership{UserID: "u1", ProjectID: "p1"}); err != nil {
		t.Fatal(err)
	}

	if ok, err := s.IsMember("u1", "p1"); err != nil || !ok {
		t.Errorf("IsMember(u1,p1) = %v, %v; want true", ok, err)
	}
	if ok, _ := s.IsMember("u1", "p2"); ok {
		t.Error("IsMember(u1,p2) = true; want false")
	}

	projects, err := s.ProjectsByUser("u1")
	if err != nil || len(projects) != 1 || projects[0].ID != "p1" {
		t.Fatalf("ProjectsByUser = %+v, %v", projects, err)
	}

	sess := access.Session{ID: "s1", UserID: "u1", CreatedAt: now, ExpiresAt: now.Add(time.Hour)}
	if err := s.CreateSession(sess); err != nil {
		t.Fatal(err)
	}
	sess.ProjectID = "p1"
	if err := s.UpdateSession(sess); err != nil {
		t.Fatal(err)
	}
	got, err := s.SessionByID("s1")
	if err != nil || got.ProjectID != "p1" {
		t.Fatalf("SessionByID = %+v, %v", got, err)
	}
	if err := s.DeleteSession("s1"); err != nil {
		t.Fatal(err)
	}
	if _, err := s.SessionByID("s1"); !errors.Is(err, access.ErrNotFound) {
		t.Errorf("deleted session: got %v, want ErrNotFound", err)
	}
}

func TestPersistsAcrossReopen(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "persist.db")

	s1, err := Open(path)
	if err != nil {
		t.Fatal(err)
	}
	if err := s1.CreateUser(access.User{ID: "u1", Email: "u@b.com", PasswordHash: "h", CreatedAt: time.Now().UTC()}); err != nil {
		t.Fatal(err)
	}
	s1.Close()

	s2, err := Open(path)
	if err != nil {
		t.Fatal(err)
	}
	defer s2.Close()
	if _, err := s2.UserByEmail("u@b.com"); err != nil {
		t.Errorf("user did not survive reopen: %v", err)
	}
}
