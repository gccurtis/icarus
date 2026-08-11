package access_test

import (
	"errors"
	"strings"
	"testing"

	"github.com/gccurtis/taurus-omega/core/capability/access"
)

func registerLogin(t *testing.T, a *access.Access, email string) access.Session {
	t.Helper()
	if _, err := a.Register(email, "password123", ""); err != nil {
		t.Fatalf("register %s: %v", email, err)
	}
	s, err := a.Login(email, "password123")
	if err != nil {
		t.Fatalf("login %s: %v", email, err)
	}
	return s
}

func TestProjectLifecycle(t *testing.T) {
	a := newAccess()
	sess := registerLogin(t, a, "owner@b.com")

	p, err := a.CreateProject(sess.UserID, "Alpha")
	if err != nil {
		t.Fatalf("create: %v", err)
	}
	if _, err := a.CreateProject(sess.UserID, "   "); !errors.Is(err, access.ErrInvalidName) {
		t.Errorf("empty name: got %v, want ErrInvalidName", err)
	}

	pms, err := a.ProjectsForUser(sess.UserID)
	if err != nil || len(pms) != 1 || pms[0].Project.ID != p.ID || pms[0].Role != access.RoleOwner {
		t.Fatalf("list = %+v, %v", pms, err)
	}

	if _, err := a.SelectProject(sess.ID, p.ID); err != nil {
		t.Fatalf("select: %v", err)
	}
	ctx, err := a.Resolve(sess.ID)
	if err != nil || !ctx.HasProject() {
		t.Fatalf("resolve after select: ctx=%+v err=%v", ctx, err)
	}
	if ctx.Project.ID != p.ID || ctx.Role != access.RoleOwner {
		t.Errorf("context not scoped correctly: project=%v role=%v", ctx.Project, ctx.Role)
	}
}

func TestDeleteAndSelectRequireMembership(t *testing.T) {
	a := newAccess()
	owner := registerLogin(t, a, "owner@b.com")
	p, _ := a.CreateProject(owner.UserID, "Alpha")

	// A different user, not a member, can neither delete nor select it.
	intruder := registerLogin(t, a, "intruder@b.com")
	if err := a.DeleteProject(intruder.UserID, p.ID); !errors.Is(err, access.ErrForbidden) {
		t.Errorf("non-member delete: got %v, want ErrForbidden", err)
	}
	if _, err := a.SelectProject(intruder.ID, p.ID); !errors.Is(err, access.ErrForbidden) {
		t.Errorf("non-member select: got %v, want ErrForbidden", err)
	}

	// The owner can delete it; afterward it's gone from their list.
	if err := a.DeleteProject(owner.UserID, p.ID); err != nil {
		t.Fatalf("owner delete: %v", err)
	}
	if pms, _ := a.ProjectsForUser(owner.UserID); len(pms) != 0 {
		t.Errorf("after delete, list = %+v", pms)
	}
}

func TestLeaveProject(t *testing.T) {
	a := newAccess()
	owner := registerLogin(t, a, "owner@b.com")
	p, _ := a.CreateProject(owner.UserID, "Alpha")

	// The sole owner may not leave — it would strand the project.
	if err := a.LeaveProject(owner.UserID, p.ID); !errors.Is(err, access.ErrLastOwner) {
		t.Fatalf("sole-owner leave: got %v, want ErrLastOwner", err)
	}

	// A non-owner member leaves freely.
	reader, _ := a.Register("reader@b.com", "password123", "")
	if _, err := a.AddProjectMember(owner.UserID, p.ID, "reader@b.com", access.RoleRead); err != nil {
		t.Fatalf("add reader: %v", err)
	}
	if err := a.LeaveProject(reader.ID, p.ID); err != nil {
		t.Fatalf("reader leave: %v", err)
	}

	// Once a second owner exists, the original owner may leave.
	second, _ := a.Register("second@b.com", "password123", "")
	if _, err := a.AddProjectMember(owner.UserID, p.ID, "second@b.com", access.RoleOwner); err != nil {
		t.Fatalf("add second owner: %v", err)
	}
	if err := a.LeaveProject(owner.UserID, p.ID); err != nil {
		t.Fatalf("owner leave (not last): %v", err)
	}
	_ = second

	// Leaving when not a member is ErrNotFound.
	if err := a.LeaveProject(owner.UserID, p.ID); !errors.Is(err, access.ErrNotFound) {
		t.Errorf("leave when not a member: got %v, want ErrNotFound", err)
	}
}

func TestSetVisibility(t *testing.T) {
	a := newAccess()
	owner := registerLogin(t, a, "owner@b.com")
	p, _ := a.CreateProject(owner.UserID, "Alpha")
	if p.Visibility != access.VisibilityPrivate {
		t.Fatalf("new project visibility = %q; want private", p.Visibility)
	}

	link := string(access.VisibilityLink)
	got, _, err := a.UpdateProject(owner.UserID, p.ID, access.ProjectChanges{Visibility: &link})
	if err != nil || got.Visibility != access.VisibilityLink {
		t.Fatalf("set link = %+v, %v", got, err)
	}

	bad := "public"
	if _, _, err := a.UpdateProject(owner.UserID, p.ID, access.ProjectChanges{Visibility: &bad}); !errors.Is(err, access.ErrInvalidVisibility) {
		t.Errorf("bad visibility: got %v, want ErrInvalidVisibility", err)
	}

	stranger, _ := a.Register("nope@b.com", "password123", "")
	if _, _, err := a.UpdateProject(stranger.ID, p.ID, access.ProjectChanges{Visibility: &link}); !errors.Is(err, access.ErrForbidden) {
		t.Errorf("non-owner visibility: got %v, want ErrForbidden", err)
	}
}

func TestProjectLinks(t *testing.T) {
	a := newAccess()
	owner := registerLogin(t, a, "owner@b.com")
	p, _ := a.CreateProject(owner.UserID, "Alpha")
	joiner, _ := a.Register("joiner@b.com", "password123", "Joiner")

	// Only an owner mints links; a non-member is forbidden.
	if _, err := a.CreateOrRotateProjectLink(joiner.ID, p.ID, access.RoleRead); !errors.Is(err, access.ErrForbidden) {
		t.Fatalf("non-owner mint: got %v, want ErrForbidden", err)
	}
	// Links grant read or edit only — never owner.
	if _, err := a.CreateOrRotateProjectLink(owner.UserID, p.ID, access.RoleOwner); !errors.Is(err, access.ErrInvalidLinkRole) {
		t.Fatalf("owner-role link: got %v, want ErrInvalidLinkRole", err)
	}

	readLink, err := a.CreateOrRotateProjectLink(owner.UserID, p.ID, access.RoleRead)
	if err != nil || readLink.Token == "" {
		t.Fatalf("mint read link: %+v, %v", readLink, err)
	}
	editLink, _ := a.CreateOrRotateProjectLink(owner.UserID, p.ID, access.RoleEdit)

	// Master switch: while the project is private, links don't work (404, never revealing it).
	if _, _, err := a.JoinByLink(joiner.ID, readLink.Token); !errors.Is(err, access.ErrNotFound) {
		t.Fatalf("join while private: got %v, want ErrNotFound", err)
	}

	// Turn sharing on.
	link := string(access.VisibilityLink)
	if _, _, err := a.UpdateProject(owner.UserID, p.ID, access.ProjectChanges{Visibility: &link}); err != nil {
		t.Fatal(err)
	}

	// Read link → read member.
	if proj, role, err := a.JoinByLink(joiner.ID, readLink.Token); err != nil || role != access.RoleRead || proj.ID != p.ID {
		t.Fatalf("join read = (%q, %v); want read", role, err)
	}
	// Edit link → upgrade to edit.
	if _, role, err := a.JoinByLink(joiner.ID, editLink.Token); err != nil || role != access.RoleEdit {
		t.Fatalf("upgrade to edit = (%q, %v); want edit", role, err)
	}
	// Read link again → upgrade-only, keeps edit (never downgrades).
	if _, role, err := a.JoinByLink(joiner.ID, readLink.Token); err != nil || role != access.RoleEdit {
		t.Errorf("read link on editor = (%q, %v); want edit (no downgrade)", role, err)
	}
	// An owner opening any link stays owner (never demoted).
	if _, role, err := a.JoinByLink(owner.UserID, readLink.Token); err != nil || role != access.RoleOwner {
		t.Errorf("owner via read link = (%q, %v); want owner", role, err)
	}

	// Listing shows both links (owner only).
	if links, err := a.ProjectLinks(owner.UserID, p.ID); err != nil || len(links) != 2 {
		t.Errorf("links = %+v, %v; want 2", links, err)
	}

	// Rotating the read link invalidates the old token.
	rotated, _ := a.CreateOrRotateProjectLink(owner.UserID, p.ID, access.RoleRead)
	if rotated.Token == readLink.Token {
		t.Fatal("rotate reused the old token")
	}
	fresh, _ := a.Register("fresh@b.com", "password123", "Fresh")
	if _, _, err := a.JoinByLink(fresh.ID, readLink.Token); !errors.Is(err, access.ErrNotFound) {
		t.Errorf("old token after rotate: got %v, want ErrNotFound", err)
	}

	// Deleting a link turns it off.
	if err := a.DeleteProjectLink(owner.UserID, p.ID, access.RoleEdit); err != nil {
		t.Fatal(err)
	}
	if _, _, err := a.JoinByLink(fresh.ID, editLink.Token); !errors.Is(err, access.ErrNotFound) {
		t.Errorf("deleted edit link: got %v, want ErrNotFound", err)
	}

	// An unknown token is ErrNotFound.
	if _, _, err := a.JoinByLink(joiner.ID, "no-such-token"); !errors.Is(err, access.ErrNotFound) {
		t.Errorf("unknown token: got %v, want ErrNotFound", err)
	}
}

func TestProjectMembers(t *testing.T) {
	a := newAccess()
	owner := registerLogin(t, a, "owner@b.com")
	p, _ := a.CreateProject(owner.UserID, "Alpha")
	if _, err := a.Register("reader@b.com", "password123", "Reader"); err != nil {
		t.Fatal(err)
	}
	if _, err := a.AddProjectMember(owner.UserID, p.ID, "reader@b.com", access.RoleRead); err != nil {
		t.Fatalf("add reader: %v", err)
	}

	members, err := a.ProjectMembers(owner.UserID, p.ID)
	if err != nil || len(members) != 2 {
		t.Fatalf("members = %+v, %v; want 2", members, err)
	}

	// A non-member cannot read the member list.
	stranger, _ := a.Register("stranger@b.com", "password123", "")
	if _, err := a.ProjectMembers(stranger.ID, p.ID); !errors.Is(err, access.ErrForbidden) {
		t.Errorf("non-member list: got %v, want ErrForbidden", err)
	}
}

func TestAddProjectMember(t *testing.T) {
	a := newAccess()
	owner := registerLogin(t, a, "owner@b.com")
	p, _ := a.CreateProject(owner.UserID, "Alpha")
	a.Register("edit@b.com", "password123", "Editor")

	m, err := a.AddProjectMember(owner.UserID, p.ID, "EDIT@b.com", access.RoleEdit) // email normalized
	if err != nil || m.Role != access.RoleEdit || m.Name != "Editor" {
		t.Fatalf("add member = %+v, %v", m, err)
	}

	// Adding the same user again is a conflict.
	if _, err := a.AddProjectMember(owner.UserID, p.ID, "edit@b.com", access.RoleRead); !errors.Is(err, access.ErrAlreadyMember) {
		t.Errorf("dup add: got %v, want ErrAlreadyMember", err)
	}
	// No account for the email.
	if _, err := a.AddProjectMember(owner.UserID, p.ID, "ghost@b.com", access.RoleRead); !errors.Is(err, access.ErrNotFound) {
		t.Errorf("unknown email: got %v, want ErrNotFound", err)
	}
	// An invalid role is rejected before anything else.
	if _, err := a.AddProjectMember(owner.UserID, p.ID, "edit@b.com", access.Role("boss")); !errors.Is(err, access.ErrInvalidRole) {
		t.Errorf("bad role: got %v, want ErrInvalidRole", err)
	}
	// A non-owner cannot add members.
	if _, err := a.AddProjectMember("edit-user-not-owner", p.ID, "x@b.com", access.RoleRead); !errors.Is(err, access.ErrForbidden) {
		t.Errorf("non-owner add: got %v, want ErrForbidden", err)
	}
}

func TestMemberRoleAndRemove(t *testing.T) {
	a := newAccess()
	owner := registerLogin(t, a, "owner@b.com")
	p, _ := a.CreateProject(owner.UserID, "Alpha")
	reader, _ := a.Register("reader@b.com", "password123", "Reader")
	a.AddProjectMember(owner.UserID, p.ID, "reader@b.com", access.RoleRead)

	// Promote the reader to edit.
	if err := a.SetMemberRole(owner.UserID, p.ID, reader.ID, access.RoleEdit); err != nil {
		t.Fatalf("promote: %v", err)
	}
	// Cannot demote the sole owner.
	if err := a.SetMemberRole(owner.UserID, p.ID, owner.UserID, access.RoleRead); !errors.Is(err, access.ErrLastOwner) {
		t.Errorf("demote last owner: got %v, want ErrLastOwner", err)
	}
	// Cannot remove the sole owner.
	if err := a.RemoveMember(owner.UserID, p.ID, owner.UserID); !errors.Is(err, access.ErrLastOwner) {
		t.Errorf("remove last owner: got %v, want ErrLastOwner", err)
	}
	// An invalid role is rejected.
	if err := a.SetMemberRole(owner.UserID, p.ID, reader.ID, access.Role("boss")); !errors.Is(err, access.ErrInvalidRole) {
		t.Errorf("bad role: got %v, want ErrInvalidRole", err)
	}
	// Remove the reader.
	if err := a.RemoveMember(owner.UserID, p.ID, reader.ID); err != nil {
		t.Fatalf("remove reader: %v", err)
	}
	if members, _ := a.ProjectMembers(owner.UserID, p.ID); len(members) != 1 {
		t.Fatalf("after remove, members = %+v; want 1", members)
	}
	// Removing a non-member is ErrNotFound.
	if err := a.RemoveMember(owner.UserID, p.ID, reader.ID); !errors.Is(err, access.ErrNotFound) {
		t.Errorf("remove non-member: got %v, want ErrNotFound", err)
	}
}

func TestMembershipRole(t *testing.T) {
	a := newAccess()
	owner := registerLogin(t, a, "owner@b.com")
	p, _ := a.CreateProject(owner.UserID, "Alpha")
	reader, _ := a.Register("reader@b.com", "password123", "")
	if _, err := a.AddProjectMember(owner.UserID, p.ID, "reader@b.com", access.RoleRead); err != nil {
		t.Fatalf("add reader: %v", err)
	}

	if role, err := a.MembershipRole(owner.UserID, p.ID); err != nil || role != access.RoleOwner {
		t.Fatalf("owner role = %q, %v; want owner, nil", role, err)
	}
	if role, err := a.MembershipRole(reader.ID, p.ID); err != nil || role != access.RoleRead {
		t.Fatalf("reader role = %q, %v; want read, nil", role, err)
	}

	// A non-member cannot distinguish absence from denial: both collapse to
	// ErrForbidden.
	stranger, _ := a.Register("stranger@b.com", "password123", "")
	if _, err := a.MembershipRole(stranger.ID, p.ID); !errors.Is(err, access.ErrForbidden) {
		t.Errorf("non-member: got %v, want ErrForbidden", err)
	}
	if _, err := a.MembershipRole(stranger.ID, "no-such-project"); !errors.Is(err, access.ErrForbidden) {
		t.Errorf("unknown project: got %v, want ErrForbidden", err)
	}
}

func TestUpdateProject(t *testing.T) {
	a := newAccess()
	owner, err := a.Register("owner@x.com", "password123", "Owner")
	if err != nil {
		t.Fatalf("register: %v", err)
	}
	p, err := a.CreateProject(owner.ID, "Cockpit")
	if err != nil {
		t.Fatalf("create: %v", err)
	}

	name := "Renamed"
	icon := "intel"
	got, role, err := a.UpdateProject(owner.ID, p.ID, access.ProjectChanges{Name: &name, Icon: &icon})
	if err != nil {
		t.Fatalf("UpdateProject: %v", err)
	}
	if got.Name != "Renamed" || got.Icon != "intel" {
		t.Fatalf("got %+v; want name Renamed icon intel", got)
	}
	if role != access.RoleOwner {
		t.Fatalf("role = %q; want owner", role)
	}
	if got.UpdatedAt.Before(p.UpdatedAt) {
		t.Fatalf("updatedAt regressed: %v < %v", got.UpdatedAt, p.UpdatedAt)
	}

	empty := "   "
	if _, _, err := a.UpdateProject(owner.ID, p.ID, access.ProjectChanges{Name: &empty}); !errors.Is(err, access.ErrInvalidName) {
		t.Fatalf("empty name err = %v; want ErrInvalidName", err)
	}
	long := strings.Repeat("x", 65)
	if _, _, err := a.UpdateProject(owner.ID, p.ID, access.ProjectChanges{Icon: &long}); !errors.Is(err, access.ErrInvalidIcon) {
		t.Fatalf("long icon err = %v; want ErrInvalidIcon", err)
	}

	stranger, _ := a.Register("nope@x.com", "password123", "")
	if _, _, err := a.UpdateProject(stranger.ID, p.ID, access.ProjectChanges{Name: &name}); !errors.Is(err, access.ErrForbidden) {
		t.Fatalf("non-member err = %v; want ErrForbidden", err)
	}
}

func TestUpdateProjectPurposeAuthorizationAndNoOp(t *testing.T) {
	a := newAccess()
	owner, _ := a.Register("owner@x.com", "password123", "Owner")
	editor, _ := a.Register("editor@x.com", "password123", "Editor")
	reader, _ := a.Register("reader@x.com", "password123", "Reader")
	p, _ := a.CreateProject(owner.ID, "Cockpit")
	a.AddProjectMember(owner.ID, p.ID, editor.Email, access.RoleEdit)
	a.AddProjectMember(owner.ID, p.ID, reader.Email, access.RoleRead)

	purpose := "  Make knowledge useful.  "
	got, role, err := a.UpdateProject(editor.ID, p.ID, access.ProjectChanges{Purpose: &purpose})
	if err != nil || role != access.RoleEdit || got.Purpose != "Make knowledge useful." {
		t.Fatalf("editor purpose update = %+v, %q, %v", got, role, err)
	}

	unchanged, _, err := a.UpdateProject(editor.ID, p.ID, access.ProjectChanges{Purpose: &purpose})
	if err != nil || !unchanged.UpdatedAt.Equal(got.UpdatedAt) {
		t.Fatalf("normalized no-op changed timestamp: before=%v after=%v err=%v", got.UpdatedAt, unchanged.UpdatedAt, err)
	}

	name := "Forbidden mixed rename"
	otherPurpose := "Must not be applied"
	if _, _, err := a.UpdateProject(editor.ID, p.ID, access.ProjectChanges{Name: &name, Purpose: &otherPurpose}); !errors.Is(err, access.ErrForbidden) {
		t.Fatalf("mixed editor update err = %v; want ErrForbidden", err)
	}
	stored, _ := a.ProjectsForUser(owner.ID)
	if stored[0].Project.Purpose != got.Purpose || stored[0].Project.Name != p.Name {
		t.Fatalf("mixed update applied partially: %+v", stored[0].Project)
	}

	if _, _, err := a.UpdateProject(reader.ID, p.ID, access.ProjectChanges{Purpose: &otherPurpose}); !errors.Is(err, access.ErrForbidden) {
		t.Fatalf("reader purpose err = %v; want ErrForbidden", err)
	}
	if _, _, err := a.UpdateProject(owner.ID, p.ID, access.ProjectChanges{}); !errors.Is(err, access.ErrNoProjectChanges) {
		t.Fatalf("empty update err = %v; want ErrNoProjectChanges", err)
	}
	tooLong := strings.Repeat("界", access.MaxProjectPurposeRunes+1)
	if _, _, err := a.UpdateProject(owner.ID, p.ID, access.ProjectChanges{Purpose: &tooLong}); !errors.Is(err, access.ErrInvalidPurpose) {
		t.Fatalf("long purpose err = %v; want ErrInvalidPurpose", err)
	}

	clear := "   "
	cleared, _, err := a.UpdateProject(owner.ID, p.ID, access.ProjectChanges{Purpose: &clear})
	if err != nil || cleared.Purpose != "" {
		t.Fatalf("clear purpose = %+v, %v", cleared, err)
	}
}

// TestRoleCanWrite pins the single write-permission predicate: owner and edit
// may modify a project's contents, read may not, and an unknown role never can.
func TestRoleCanWrite(t *testing.T) {
	cases := []struct {
		role access.Role
		want bool
	}{
		{access.RoleOwner, true},
		{access.RoleEdit, true},
		{access.RoleRead, false},
		{access.Role(""), false},
		{access.Role("bogus"), false},
	}
	for _, c := range cases {
		if got := c.role.CanWrite(); got != c.want {
			t.Errorf("Role(%q).CanWrite() = %v, want %v", string(c.role), got, c.want)
		}
	}
}
