package access_test

import (
	"errors"
	"strings"
	"testing"

	"github.com/gccurtis/taurus-omega/core/capability/access"
)

func ptr(s string) *string { return &s }

func TestUpdateProfileSetsColorAndAvatar(t *testing.T) {
	a := newAccess()
	owner, err := a.Register("ann@example.com", "password123", "Ann")
	if err != nil {
		t.Fatalf("register: %v", err)
	}

	u, err := a.UpdateProfile(owner.ID, ptr("Annie"), ptr("#3b82f6"), ptr("/files/abc/meta"))
	if err != nil {
		t.Fatalf("UpdateProfile: %v", err)
	}
	if u.Name != "Annie" || u.Color != "#3b82f6" || u.AvatarURL != "/files/abc/meta" {
		t.Fatalf("profile not applied: %+v", u)
	}

	// The identity enrichment surfaces in the project-peer projection.
	project, err := a.CreateProject(owner.ID, "Alpha")
	if err != nil {
		t.Fatalf("CreateProject: %v", err)
	}
	pub, err := a.PublicUserInProject(project.ID, owner.ID)
	if err != nil {
		t.Fatalf("PublicUserInProject: %v", err)
	}
	if pub.Color != "#3b82f6" || pub.AvatarURL != "/files/abc/meta" || pub.Name != "Annie" {
		t.Errorf("public projection missing identity: %+v", pub)
	}
}

func TestUpdateProfilePartialLeavesOthersUnchanged(t *testing.T) {
	a := newAccess()
	owner, _ := a.Register("ann@example.com", "password123", "Ann")
	if _, err := a.UpdateProfile(owner.ID, nil, ptr("teal"), nil); err != nil {
		t.Fatalf("UpdateProfile color-only: %v", err)
	}
	// Now change only the avatar; name and color must persist.
	u, err := a.UpdateProfile(owner.ID, nil, nil, ptr("/files/xyz/meta"))
	if err != nil {
		t.Fatalf("UpdateProfile avatar-only: %v", err)
	}
	if u.Name != "Ann" || u.Color != "teal" || u.AvatarURL != "/files/xyz/meta" {
		t.Errorf("partial update clobbered fields: %+v", u)
	}
}

func TestUpdateProfileValidation(t *testing.T) {
	a := newAccess()
	owner, _ := a.Register("ann@example.com", "password123", "Ann")

	if _, err := a.UpdateProfile(owner.ID, nil, ptr("not a color!"), nil); !errors.Is(err, access.ErrInvalidColor) {
		t.Errorf("bad color: want ErrInvalidColor, got %v", err)
	}
	if _, err := a.UpdateProfile(owner.ID, nil, ptr("#zzzzzz"), nil); !errors.Is(err, access.ErrInvalidColor) {
		t.Errorf("bad hex: want ErrInvalidColor, got %v", err)
	}
	if _, err := a.UpdateProfile(owner.ID, nil, nil, ptr(strings.Repeat("x", 600))); !errors.Is(err, access.ErrInvalidAvatar) {
		t.Errorf("long avatar: want ErrInvalidAvatar, got %v", err)
	}
	if _, err := a.UpdateProfile(owner.ID, ptr(strings.Repeat("n", 81)), nil, nil); !errors.Is(err, access.ErrInvalidDisplayName) {
		t.Errorf("long name: want ErrInvalidDisplayName, got %v", err)
	}
	// Empty color clears it and is valid.
	if _, err := a.UpdateProfile(owner.ID, nil, ptr(""), nil); err != nil {
		t.Errorf("empty color should clear, got %v", err)
	}
}

func TestUpdateProfileAvatarURLScheme(t *testing.T) {
	a := newAccess()
	owner, _ := a.Register("ann@example.com", "password123", "Ann")

	// Dangerous schemes are rejected (a stored avatar must never become a script
	// or data URL when a client binds it to href/src).
	for _, bad := range []string{"javascript:alert(1)", "data:text/html,x", "http://insecure/a.png", "//evil.example/a.png", "vbscript:x"} {
		if _, err := a.UpdateProfile(owner.ID, nil, nil, ptr(bad)); !errors.Is(err, access.ErrInvalidAvatar) {
			t.Errorf("avatar %q: want ErrInvalidAvatar, got %v", bad, err)
		}
	}
	// A same-origin relative path (the intended fileId-derived form) and an https
	// URL are accepted; empty clears.
	for _, ok := range []string{"/files/abc/meta", "https://cdn.example/a.png", ""} {
		if _, err := a.UpdateProfile(owner.ID, nil, nil, ptr(ok)); err != nil {
			t.Errorf("avatar %q should be accepted, got %v", ok, err)
		}
	}
}
