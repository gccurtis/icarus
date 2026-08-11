package sqlite

import (
	"errors"
	"fmt"
	"path/filepath"
	"reflect"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/gccurtis/taurus-omega/core/capability/access"
	"github.com/gccurtis/taurus-omega/core/capability/activity"
	"github.com/gccurtis/taurus-omega/core/capability/agent"
	"github.com/gccurtis/taurus-omega/core/capability/chat"
	"github.com/gccurtis/taurus-omega/core/capability/comment"
	"github.com/gccurtis/taurus-omega/core/capability/connector"
	"github.com/gccurtis/taurus-omega/core/capability/contexts"
	"github.com/gccurtis/taurus-omega/core/capability/document"
	"github.com/gccurtis/taurus-omega/core/capability/file"
	"github.com/gccurtis/taurus-omega/core/capability/formula"
	"github.com/gccurtis/taurus-omega/core/capability/formula/names"
	"github.com/gccurtis/taurus-omega/core/capability/knowledge"
	"github.com/gccurtis/taurus-omega/core/capability/persona"
	"github.com/gccurtis/taurus-omega/core/capability/session"
	"github.com/gccurtis/taurus-omega/core/platform/job"
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
	if err != nil || got.ID != "u1" || got.PasswordHash != "hash" {
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

func TestSessionRoundTrip(t *testing.T) {
	s := openTemp(t)
	now := time.Now().UTC().Truncate(time.Second)
	if err := s.CreateUser(access.User{ID: "u1", Email: "u@b.com", PasswordHash: "h", CreatedAt: now}); err != nil {
		t.Fatal(err)
	}

	sess := access.Session{ID: "s1", UserID: "u1", CreatedAt: now, ExpiresAt: now.Add(time.Hour)}
	if err := s.CreateSession(sess); err != nil {
		t.Fatal(err)
	}
	got, err := s.SessionByID("s1")
	if err != nil || got.UserID != "u1" || !got.ExpiresAt.Equal(sess.ExpiresAt) {
		t.Fatalf("SessionByID = %+v, %v", got, err)
	}
	if err := s.DeleteSession("s1"); err != nil {
		t.Fatal(err)
	}
	if _, err := s.SessionByID("s1"); !errors.Is(err, access.ErrNotFound) {
		t.Errorf("deleted session: got %v, want ErrNotFound", err)
	}
}

func TestProjectAndMembershipRoundTrip(t *testing.T) {
	s := openTemp(t)
	now := time.Now().UTC().Truncate(time.Second)
	if err := s.CreateUser(access.User{ID: "u1", Email: "u@b.com", PasswordHash: "h", CreatedAt: now}); err != nil {
		t.Fatal(err)
	}
	if err := s.CreateProject(access.Project{ID: "p1", Name: "Alpha", CreatedAt: now}); err != nil {
		t.Fatal(err)
	}
	if err := s.AddMembership(access.Membership{UserID: "u1", ProjectID: "p1", Role: access.RoleOwner}); err != nil {
		t.Fatal(err)
	}

	m, err := s.Membership("u1", "p1")
	if err != nil || m.Role != access.RoleOwner {
		t.Fatalf("Membership = %+v, %v", m, err)
	}
	pms, err := s.ProjectsForUser("u1")
	if err != nil || len(pms) != 1 || pms[0].Project.Name != "Alpha" || pms[0].Role != access.RoleOwner {
		t.Fatalf("ProjectsForUser = %+v, %v", pms, err)
	}

	// A session's selected project persists through UpdateSession.
	sess := access.Session{ID: "s1", UserID: "u1", CreatedAt: now, ExpiresAt: now.Add(time.Hour)}
	if err := s.CreateSession(sess); err != nil {
		t.Fatal(err)
	}
	sess.ProjectID = "p1"
	if err := s.UpdateSession(sess); err != nil {
		t.Fatal(err)
	}
	if got, _ := s.SessionByID("s1"); got.ProjectID != "p1" {
		t.Errorf("session project_id = %q, want p1", got.ProjectID)
	}

	if err := s.RemoveMembership("u1", "p1"); err != nil {
		t.Fatal(err)
	}
	if _, err := s.Membership("u1", "p1"); !errors.Is(err, access.ErrNotFound) {
		t.Errorf("after remove: got %v, want ErrNotFound", err)
	}
}

func TestActivityReadStorePagesAndFindsLatest(t *testing.T) {
	s := openTemp(t)
	now := time.Date(2026, 7, 21, 12, 0, 0, 0, time.UTC)
	for _, p := range []access.Project{
		{ID: "p1", Name: "One", Visibility: access.VisibilityPrivate, CreatedAt: now, UpdatedAt: now},
		{ID: "p2", Name: "Two", Visibility: access.VisibilityPrivate, CreatedAt: now, UpdatedAt: now},
	} {
		if err := s.CreateProject(p); err != nil {
			t.Fatal(err)
		}
	}
	insert := func(id, projectID string, at time.Time) {
		t.Helper()
		_, err := s.db.Exec(`INSERT INTO activity_events(
			id, project_id, actor_id, actor_name, action, target_id, target_kind,
			target_name, occurred_at, source_kind, source_id
		) VALUES(?, ?, 'u1', 'Ada', 'edited', ?, 'document', 'Plan', ?, 'test', ?)`,
			id, projectID, "doc-"+id, sortableTime(at), "source-"+id)
		if err != nil {
			t.Fatal(err)
		}
	}
	insert("b", "p1", now)
	insert("a", "p1", now)
	insert("c", "p1", now.Add(-time.Hour))
	insert("z", "p2", now.Add(time.Hour))

	feed := activity.New(s)
	first, err := feed.List("p1", activity.PageRequest{Limit: 2})
	if err != nil || len(first.Events) != 2 || first.Events[0].ID != "b" || first.Events[1].ID != "a" {
		t.Fatalf("first page = %+v, %v", first, err)
	}
	second, err := feed.List("p1", activity.PageRequest{Limit: 2, Cursor: first.NextCursor})
	if err != nil || len(second.Events) != 1 || second.Events[0].ID != "c" {
		t.Fatalf("second page = %+v, %v", second, err)
	}
	latest, err := feed.LatestByProjects([]string{"p1"})
	if err != nil || !latest["p1"].Equal(now) {
		t.Fatalf("latest = %+v, %v", latest, err)
	}
}

func TestProjectAndUserFieldsRoundTrip(t *testing.T) {
	s := openTemp(t)
	now := time.Now().UTC().Truncate(time.Second)

	u := access.User{ID: "u1", Email: "a@b.com", Name: "Ada", PasswordHash: "x", CreatedAt: now}
	if err := s.CreateUser(u); err != nil {
		t.Fatalf("CreateUser: %v", err)
	}
	got, err := s.UserByID("u1")
	if err != nil || got.Name != "Ada" {
		t.Fatalf("UserByID name = %q, err %v; want \"Ada\"", got.Name, err)
	}
	if err := s.UpdateUserName("u1", "Ada L."); err != nil {
		t.Fatalf("UpdateUserName: %v", err)
	}
	if got, _ = s.UserByID("u1"); got.Name != "Ada L." {
		t.Fatalf("after UpdateUserName name = %q; want \"Ada L.\"", got.Name)
	}

	p := access.Project{ID: "p1", Name: "Cockpit", Icon: "action", Purpose: "Ship useful work", Visibility: access.VisibilityPrivate, CreatedAt: now, UpdatedAt: now}
	if err := s.CreateProject(p); err != nil {
		t.Fatalf("CreateProject: %v", err)
	}
	if err := s.AddMembership(access.Membership{UserID: "u1", ProjectID: "p1", Role: access.RoleOwner}); err != nil {
		t.Fatalf("AddMembership: %v", err)
	}
	pms, err := s.ProjectsForUser("u1")
	if err != nil || len(pms) != 1 || pms[0].Project.Icon != "action" || pms[0].Project.Purpose != "Ship useful work" || pms[0].Project.Visibility != access.VisibilityPrivate {
		t.Fatalf("ProjectsForUser = %+v, err %v; want icon, purpose, and private visibility", pms, err)
	}

	later := now.Add(time.Hour)
	p.Name, p.Icon, p.Purpose, p.Visibility, p.UpdatedAt = "Renamed", "intel", "A clearer purpose", access.VisibilityLink, later
	if err := s.UpdateProject(p); err != nil {
		t.Fatalf("UpdateProject: %v", err)
	}
	got2, err := s.ProjectByID("p1")
	if err != nil || got2.Name != "Renamed" || got2.Icon != "intel" || got2.Purpose != "A clearer purpose" || got2.Visibility != access.VisibilityLink || !got2.UpdatedAt.Equal(later) {
		t.Fatalf("ProjectByID = %+v, err %v; want all profile fields and updated %v", got2, err, later)
	}

	if err := s.UpdateProject(access.Project{ID: "missing"}); !errors.Is(err, access.ErrNotFound) {
		t.Fatalf("UpdateProject(missing) err = %v; want ErrNotFound", err)
	}
	if err := s.UpdateUserName("missing", "x"); !errors.Is(err, access.ErrNotFound) {
		t.Fatalf("UpdateUserName(missing) err = %v; want ErrNotFound", err)
	}
}

func TestMembersForProject(t *testing.T) {
	s := openTemp(t)
	now := time.Now().UTC().Truncate(time.Second)
	if err := s.CreateUser(access.User{ID: "u1", Email: "owner@b.com", Name: "Owner", PasswordHash: "h", CreatedAt: now}); err != nil {
		t.Fatal(err)
	}
	if err := s.CreateUser(access.User{ID: "u2", Email: "reader@b.com", Name: "Reader", PasswordHash: "h", CreatedAt: now}); err != nil {
		t.Fatal(err)
	}
	if err := s.CreateProject(access.Project{ID: "p1", Name: "P", CreatedAt: now, UpdatedAt: now}); err != nil {
		t.Fatal(err)
	}
	if err := s.AddMembership(access.Membership{UserID: "u1", ProjectID: "p1", Role: access.RoleOwner}); err != nil {
		t.Fatal(err)
	}
	if err := s.AddMembership(access.Membership{UserID: "u2", ProjectID: "p1", Role: access.RoleRead}); err != nil {
		t.Fatal(err)
	}

	members, err := s.MembersForProject("p1")
	if err != nil || len(members) != 2 {
		t.Fatalf("MembersForProject = %+v, %v; want 2", members, err)
	}
	// Ordered by email: owner@b.com then reader@b.com.
	if members[0].Email != "owner@b.com" || members[0].Name != "Owner" || members[0].Role != access.RoleOwner {
		t.Fatalf("member[0] = %+v", members[0])
	}
	if members[1].UserID != "u2" || members[1].Role != access.RoleRead {
		t.Fatalf("member[1] = %+v", members[1])
	}

	// Removing a membership drops it from the list.
	if err := s.RemoveMembership("u2", "p1"); err != nil {
		t.Fatal(err)
	}
	if members, _ := s.MembersForProject("p1"); len(members) != 1 {
		t.Fatalf("after remove, members = %+v; want 1", members)
	}
}

func TestDocumentRoundTrip(t *testing.T) {
	s := openTemp(t)
	now := time.Now().UTC().Truncate(time.Second)
	d := document.Document{
		ID:          "d1",
		ProjectID:   "p1",
		Name:        "Notes",
		CreatorID:   "u1",
		CreatorName: "Ada",
		Base: document.Base{
			PageLayout: document.PageLayout{
				Width: 612, Height: 792,
				MarginTop: 72, MarginRight: 72, MarginBottom: 72, MarginLeft: 72,
			},
			LayoutRules: document.LayoutRules{
				MaxFontHeight: 20, MinRowPadding: 3, CharWidth: 8,
			},
			Rows: []document.Row{
				{ID: "r1", Blocks: []document.Block{
					{
						ID: "b1", Kind: "text",
						Style: document.BlockStyle{
							HorizontalAlign: document.HorizontalAlignCenter,
							VerticalAlign:   document.VerticalAlignMiddle,
						},
						Atoms: []document.Atom{{ID: "a1", Kind: "text", Text: "hi"}},
					},
				}},
			}},
		CreatedAt: now,
		UpdatedAt: now,
	}
	if err := s.CreateDocument(d, testDocumentFact(d, document.ActivityCreated, "create-d1", now)); err != nil {
		t.Fatal(err)
	}
	duplicate := d
	duplicate.ID = "d2"
	if err := s.CreateDocument(duplicate, testDocumentFact(duplicate, document.ActivityCreated, "create-d1", now)); err == nil {
		t.Fatal("duplicate activity source unexpectedly succeeded")
	}
	if _, err := s.DocumentByID("p1", "d2"); !errors.Is(err, document.ErrNotFound) {
		t.Fatalf("canonical create survived failed activity insert: %v", err)
	}

	got, err := s.DocumentByID("p1", "d1")
	if err != nil {
		t.Fatal(err)
	}
	if got.Name != "Notes" || len(got.Base.Rows) != 1 || got.Base.Rows[0].Blocks[0].DisplayText() != "hi" {
		t.Fatalf("round trip = %+v", got)
	}
	if got.CreatorID != "u1" || got.CreatorName != "Ada" {
		t.Fatalf("creator round trip: %q / %q", got.CreatorID, got.CreatorName)
	}
	if got.Base.PageLayout != d.Base.PageLayout || got.Base.LayoutRules != d.Base.LayoutRules ||
		got.Base.Rows[0].Style != d.Base.Rows[0].Style ||
		got.Base.Rows[0].Blocks[0].Style != d.Base.Rows[0].Blocks[0].Style {
		t.Fatalf("layout/style round trip = %+v", got.Base)
	}
	if !got.CreatedAt.Equal(now) {
		t.Errorf("CreatedAt = %v, want %v", got.CreatedAt, now)
	}
	if got.Revision != 0 {
		t.Errorf("Revision = %d, want 0", got.Revision)
	}

	list, err := s.DocumentsByProject("p1")
	if err != nil || len(list) != 1 {
		t.Fatalf("DocumentsByProject(p1) = %+v, %v", list, err)
	}
	if other, _ := s.DocumentsByProject("p2"); len(other) != 0 {
		t.Errorf("DocumentsByProject(p2) = %+v, want empty", other)
	}

	if err := s.DeleteDocument("d1", testDocumentFact(d, document.ActivityDeleted, "delete-d1", now.Add(time.Second))); err != nil {
		t.Fatal(err)
	}
	if _, err := s.DocumentByID("p1", "d1"); !errors.Is(err, document.ErrNotFound) {
		t.Errorf("after delete: got %v, want ErrNotFound", err)
	}
	feed, err := activity.New(s).List("p1", activity.PageRequest{Limit: 10})
	if err != nil || len(feed.Events) != 2 || feed.Events[0].Action != activity.ActionDeleted || feed.Events[1].Action != activity.ActionCreated {
		t.Fatalf("document activity = %+v, %v", feed, err)
	}
	if feed.Events[0].Target.Name != "Notes" {
		t.Fatalf("deleted target snapshot = %+v", feed.Events[0].Target)
	}
}

func strPtr(s string) *string { return &s }

func testDocumentFact(d document.Document, action, sourceID string, at time.Time) document.ActivityFact {
	return document.ActivityFact{
		ID: "event-" + sourceID, ProjectID: d.ProjectID,
		Actor: document.Actor{ID: "u", Name: "User"}, Action: action,
		TargetID: d.ID, TargetName: d.Name, OccurredAt: at,
		SourceKind: "test", SourceID: sourceID,
	}
}

func TestChangeSetStore(t *testing.T) {
	s := openTemp(t)
	now := time.Now().UTC().Truncate(time.Second)
	doc := document.Document{ID: "d1", ProjectID: "p1", Name: "D", CreatedAt: now, UpdatedAt: now}
	if err := s.CreateDocument(doc, testDocumentFact(doc, document.ActivityCreated, "create-d1", now)); err != nil {
		t.Fatal(err)
	}

	cs1, err := s.AppendChangeSet(document.ChangeSet{
		ID: "c1", DocumentID: "d1", AuthorID: "u1", AuthorName: "Ada", CreatedAt: now,
		SubmissionID: "submission-1", SubmissionHash: "hash-1",
		Ops:        []document.ChangeOp{{Op: document.OpSetBlock, BlockID: "b", SetKind: strPtr("heading_1")}},
		Summary:    document.SummarizeChangeOps([]document.ChangeOp{{Op: document.OpSetBlock, BlockID: "b", SetKind: strPtr("heading_1")}}),
		InverseOps: []document.ChangeOp{{Op: document.OpSetBlock, BlockID: "b", SetKind: strPtr("paragraph")}},
	}, 0, testDocumentFact(doc, document.ActivityEdited, "c1", now))
	if err != nil || cs1.Seq != 1 || cs1.PriorRevision != 0 {
		t.Fatalf("append1: seq=%d err=%v", cs1.Seq, err)
	}
	retry, err := s.AppendChangeSet(document.ChangeSet{
		ID: "retry", DocumentID: "d1", AuthorID: "u1", CreatedAt: now,
		SubmissionID: "submission-1", SubmissionHash: "hash-1",
		Ops: []document.ChangeOp{{Op: document.OpDeleteRow, RowID: "ignored-after-hash-match"}},
	}, 0, testDocumentFact(doc, document.ActivityEdited, "retry", now))
	if err != nil || retry.ID != cs1.ID || retry.Seq != cs1.Seq {
		t.Fatalf("identical submission retry = %+v, %v; want c1", retry, err)
	}
	if _, err := s.AppendChangeSet(document.ChangeSet{
		ID: "mismatch", DocumentID: "d1", AuthorID: "u1", CreatedAt: now,
		SubmissionID: "submission-1", SubmissionHash: "different-hash",
	}, 1, testDocumentFact(doc, document.ActivityEdited, "mismatch", now)); !errors.Is(err, document.ErrSubmissionConflict) {
		t.Fatalf("submission id mismatch err = %v, want ErrSubmissionConflict", err)
	}
	cs2, err := s.AppendChangeSet(document.ChangeSet{
		ID: "c2", DocumentID: "d1", AuthorID: "u1", AuthorName: "Ada", CreatedAt: now,
		AuthoredRevision: 1,
		Ops:              []document.ChangeOp{{Op: document.OpSetBlock, BlockID: "b", SetKind: strPtr("paragraph")}},
		UndoOf:           "c1",
		Summary:          document.SummarizeChangeOps([]document.ChangeOp{{Op: document.OpSetBlock, BlockID: "b", SetKind: strPtr("paragraph")}}),
		InverseOps: []document.ChangeOp{{
			Op: document.OpSetBlock, BlockID: "b", SetKind: strPtr("heading_1"),
		}},
	}, 1, testDocumentFact(doc, document.ActivityEdited, "c2", now))
	if err != nil || cs2.Seq != 2 {
		t.Fatalf("append2: seq=%d err=%v", cs2.Seq, err)
	}
	insert := "new"
	cs3Ops := []document.ChangeOp{{
		Op: document.OpSpliceAtomText, BlockID: "b", AtomID: "a",
		StartOffset: 1, EndOffset: 2, InsertText: &insert,
		ExpectedTextHash: "0000000000000000000000000000000000000000000000000000000000000000",
	}}
	inverseInsert := "old"
	cs3, err := s.AppendChangeSet(document.ChangeSet{
		ID: "c3", DocumentID: "d1", AuthorID: "u1", AuthorName: "Ada", CreatedAt: now,
		SubmissionID: "rebased-submission", SubmissionHash: "rebased-hash",
		AuthoredRevision: 0,
		Ops:              cs3Ops, RedoOf: "c2", Summary: document.SummarizeChangeOps(cs3Ops),
		InverseOps: []document.ChangeOp{{
			Op: document.OpSpliceAtomText, BlockID: "b", AtomID: "a",
			StartOffset: 1, EndOffset: 4, InsertText: &inverseInsert,
			ExpectedTextHash: "1111111111111111111111111111111111111111111111111111111111111111",
		}},
	}, 2, testDocumentFact(doc, document.ActivityEdited, "c3", now))
	if err != nil || cs3.Seq != 3 {
		t.Fatalf("append3: seq=%d err=%v", cs3.Seq, err)
	}
	if _, err := s.AppendChangeSet(document.ChangeSet{
		ID: "stale", DocumentID: "d1", AuthorID: "u3", CreatedAt: now,
		Ops: []document.ChangeOp{{Op: document.OpDeleteRow, RowID: "r"}},
	}, 2, testDocumentFact(doc, document.ActivityEdited, "stale", now)); !errors.Is(err, document.ErrRevisionConflict) {
		t.Fatalf("stale append err = %v, want ErrRevisionConflict", err)
	}
	if got, _ := s.DocumentByID("p1", "d1"); got.Revision != 3 {
		t.Fatalf("document revision = %d, want 3", got.Revision)
	}
	if _, err := s.db.Exec(`UPDATE documents SET revision = 0 WHERE id = 'd1'`); err != nil {
		t.Fatal(err)
	}
	if err := s.migrate(); err != nil {
		t.Fatalf("re-run migration: %v", err)
	}
	if got, _ := s.DocumentByID("p1", "d1"); got.Revision != 3 {
		t.Fatalf("backfilled revision = %d, want 3", got.Revision)
	}

	since0, err := s.ChangeSetsSince("d1", 0)
	if err != nil || len(since0) != 3 || since0[0].Seq != 1 || since0[2].Seq != 3 {
		t.Fatalf("ChangeSetsSince(0) = %+v, %v", since0, err)
	}
	if since0[0].AuthorID != "u1" || since0[0].SubmissionID != "submission-1" ||
		since0[0].SubmissionHash != "hash-1" || since0[0].PriorRevision != 0 ||
		since0[0].Ops[0].Op != document.OpSetBlock || since0[0].Ops[0].SetKind == nil {
		t.Errorf("ops did not round-trip: %+v", since0[0])
	}
	if len(since0[0].InverseOps) != 1 || since0[1].UndoOf != "c1" ||
		since0[2].RedoOf != "c2" || len(since0[2].InverseOps) != 1 ||
		since0[1].AuthoredRevision != 1 || since0[2].AuthoredRevision != 0 ||
		since0[2].PriorRevision != 2 ||
		since0[2].Ops[0].InsertText == nil || *since0[2].Ops[0].InsertText != "new" ||
		since0[2].InverseOps[0].InsertText == nil ||
		*since0[2].InverseOps[0].InsertText != "old" {
		t.Errorf("undo metadata did not round-trip: %+v", since0)
	}
	if since1, _ := s.ChangeSetsSince("d1", 1); len(since1) != 2 || since1[0].Seq != 2 || since1[1].Seq != 3 {
		t.Fatalf("ChangeSetsSince(1) = %+v", since1)
	}
	if byID, err := s.ChangeSetByID("d1", "c2"); err != nil || byID.UndoOf != "c1" {
		t.Fatalf("ChangeSetByID(c2) = %+v, %v", byID, err)
	}
	if history, err := s.ListChangeSetHistory("d1", 0, 2); err != nil ||
		len(history) != 2 || history[0].ID != "c3" || history[0].RedoOf != "c2" ||
		history[0].AuthoredRevision != 0 || history[0].PriorRevision != 2 ||
		history[0].Author.Name != "Ada" || history[0].Summary.OperationCount != 1 ||
		history[1].ID != "c2" || history[1].AuthoredRevision != 1 ||
		history[1].UndoOf != "c1" {
		t.Fatalf("ListChangeSetHistory = %+v, %v", history, err)
	}
	if history, err := s.ListChangeSetHistory("d1", 2, 2); err != nil ||
		len(history) != 1 || history[0].ID != "c1" {
		t.Fatalf("ListChangeSetHistory(before 2) = %+v, %v", history, err)
	}
	if bySubmission, err := s.ChangeSetBySubmission("d1", "u1", "submission-1"); err != nil ||
		bySubmission.ID != "c1" {
		t.Fatalf("ChangeSetBySubmission = %+v, %v", bySubmission, err)
	}
	if bySubmission, err := s.ChangeSetBySubmission("d1", "u1", "rebased-submission"); err != nil ||
		bySubmission.ID != "c3" || bySubmission.AuthoredRevision != 0 ||
		bySubmission.PriorRevision != 2 {
		t.Fatalf("rebased submission receipt = %+v, %v", bySubmission, err)
	}
	if _, err := s.ChangeSetByID("d1", "missing"); !errors.Is(err, document.ErrChangeSetNotFound) {
		t.Fatalf("ChangeSetByID(missing) err = %v, want ErrChangeSetNotFound", err)
	}

	// Re-base advances base + watermark; the change sets stay put.
	if err := s.RebaseDocument("d1", document.Base{Rows: []document.Row{{ID: "r1"}}}, 3); err != nil {
		t.Fatal(err)
	}
	if got, _ := s.DocumentByID("p1", "d1"); got.BaseSeq != 3 || len(got.Base.Rows) != 1 {
		t.Fatalf("after re-base = %+v", got)
	}
	if all, _ := s.ChangeSetsSince("d1", 0); len(all) != 3 {
		t.Errorf("change sets deleted on re-base: %d, want 3", len(all))
	}
}

func TestPruneChangeSets(t *testing.T) {
	s := openTemp(t)
	now := time.Now().UTC().Truncate(time.Second)
	doc := document.Document{ID: "d1", ProjectID: "p1", Name: "D", CreatedAt: now, UpdatedAt: now}
	if err := s.CreateDocument(doc, testDocumentFact(doc, document.ActivityCreated, "create-d1", now)); err != nil {
		t.Fatal(err)
	}
	for i := 1; i <= 5; i++ {
		cs := document.ChangeSet{
			ID: "c" + string(rune('0'+i)), DocumentID: "d1", AuthorID: "u", CreatedAt: now,
			Ops: []document.ChangeOp{{Op: document.OpDeleteRow, RowID: "r"}},
		}
		if i == 1 {
			cs.SubmissionID = "retained-receipt"
			cs.SubmissionHash = "retained-hash"
		}
		if _, err := s.AppendChangeSet(
			cs, int64(i-1),
			testDocumentFact(doc, document.ActivityEdited, "prune-"+string(rune('0'+i)), now),
		); err != nil {
			t.Fatal(err)
		}
	}
	// Fold seq 1..3 into the base (leaving 4,5 pending), then bound summary
	// History to one entry.
	if err := s.RebaseDocument("d1", document.Base{}, 3); err != nil {
		t.Fatal(err)
	}
	if err := s.PruneChangeSets("d1", 1); err != nil {
		t.Fatal(err)
	}
	all, _ := s.ChangeSetsSince("d1", 0)
	// Detailed reconstruction retains pending seq 4,5; folded details are no
	// longer active compensation recipes.
	if len(all) != 2 || all[0].Seq != 4 || all[1].Seq != 5 {
		t.Fatalf("after prune = %+v (want seq 4,5)", seqs(all))
	}
	history, err := s.ListChangeSetHistory("d1", 0, 10)
	if err != nil || len(history) != 1 || history[0].Revision != 5 ||
		!history[0].DetailAvailable {
		t.Fatalf("bounded summary history = %+v, %v", history, err)
	}
	if _, err := s.ChangeSetByID("d1", "c3"); !errors.Is(err, document.ErrChangeSetNotFound) {
		t.Fatalf("folded detail err = %v, want ErrChangeSetNotFound", err)
	}
	if err := s.RebaseDocument("d1", document.Base{}, 5); err != nil {
		t.Fatal(err)
	}
	if err := s.PruneChangeSets("d1", 1); err != nil {
		t.Fatal(err)
	}
	if all, _ := s.ChangeSetsSince("d1", 0); len(all) != 1 || all[0].Seq != 5 {
		t.Fatalf("fully folded detail = %+v, want current head 5", seqs(all))
	}
	if err := s.migrate(); err != nil {
		t.Fatal(err)
	}
	if history, err := s.ListChangeSetHistory("d1", 0, 10); err != nil ||
		len(history) != 1 || history[0].Revision != 5 {
		t.Fatalf("migration re-expanded pruned history = %+v, %v", history, err)
	}
	receipt, err := s.ChangeSetBySubmission("d1", "u", "retained-receipt")
	if err != nil || receipt.ID != "c1" || receipt.SubmissionHash != "retained-hash" {
		t.Fatalf("pruned submission receipt = %+v, %v", receipt, err)
	}
	retry, err := s.AppendChangeSet(document.ChangeSet{
		ID: "retry-c1", DocumentID: "d1", AuthorID: "u", CreatedAt: now,
		SubmissionID: "retained-receipt", SubmissionHash: "retained-hash",
	}, 0, testDocumentFact(doc, document.ActivityEdited, "retry-c1", now))
	if err != nil || retry.ID != "c1" {
		t.Fatalf("retry after history prune = %+v, %v", retry, err)
	}
}

func seqs(css []document.ChangeSet) []int64 {
	out := make([]int64, len(css))
	for i, cs := range css {
		out[i] = cs.Seq
	}
	return out
}

// TestConcurrentAppendAssignsUniqueSeqs proves revision compare-and-swap is
// race-free under the WAL connection pool: many concurrent writers retry stale
// revisions until each receives one unique, contiguous sequence.
func TestConcurrentAppendAssignsUniqueSeqs(t *testing.T) {
	s := openTemp(t)
	now := time.Now().UTC()
	doc := document.Document{ID: "d1", ProjectID: "p1", Name: "D", CreatedAt: now, UpdatedAt: now}
	if err := s.CreateDocument(doc, testDocumentFact(doc, document.ActivityCreated, "create-d1", now)); err != nil {
		t.Fatal(err)
	}

	const writers, each = 8, 25
	var wg sync.WaitGroup
	errs := make(chan error, writers*each)
	for w := 0; w < writers; w++ {
		wg.Add(1)
		go func(w int) {
			defer wg.Done()
			for i := 0; i < each; i++ {
				sourceID := fmt.Sprintf("concurrent-%d-%d", w, i)
				for {
					current, err := s.DocumentByID("p1", "d1")
					if err != nil {
						errs <- err
						break
					}
					_, err = s.AppendChangeSet(document.ChangeSet{
						ID: fmt.Sprintf("c-%d-%d", w, i), DocumentID: "d1", AuthorID: "u", CreatedAt: now,
						Ops: []document.ChangeOp{{Op: document.OpDeleteRow, RowID: "r"}},
					}, current.Revision, testDocumentFact(doc, document.ActivityEdited, sourceID, now))
					if errors.Is(err, document.ErrRevisionConflict) {
						continue
					}
					if err != nil {
						errs <- err
					}
					break
				}
			}
		}(w)
	}
	wg.Wait()
	close(errs)
	for err := range errs {
		t.Fatalf("concurrent append: %v", err)
	}

	all, err := s.ChangeSetsSince("d1", 0)
	if err != nil {
		t.Fatal(err)
	}
	if len(all) != writers*each {
		t.Fatalf("appended %d change sets, want %d", len(all), writers*each)
	}
	seen := make(map[int64]bool)
	for _, cs := range all {
		if seen[cs.Seq] {
			t.Fatalf("duplicate seq %d assigned", cs.Seq)
		}
		seen[cs.Seq] = true
	}
	for i := int64(1); i <= int64(writers*each); i++ {
		if !seen[i] {
			t.Errorf("missing seq %d (not contiguous)", i)
		}
	}
	if got, _ := s.DocumentByID("p1", "d1"); got.Revision != writers*each {
		t.Errorf("document revision = %d, want %d", got.Revision, writers*each)
	}
}

func TestJobStore(t *testing.T) {
	s := openTemp(t)
	now := time.Now().UTC().Truncate(time.Millisecond)

	if _, err := s.Enqueue(job.Job{
		ID: "j1", Type: "greet", Payload: []byte(`{"name":"ada"}`),
		Status: job.StatusQueued, MaxAttempts: 3, RunAt: now, CreatedAt: now, UpdatedAt: now,
	}); err != nil {
		t.Fatal(err)
	}
	// A job scheduled for the future is not yet due.
	if _, err := s.Enqueue(job.Job{
		ID: "future", Type: "greet", Status: job.StatusQueued, MaxAttempts: 3,
		RunAt: now.Add(time.Hour), CreatedAt: now, UpdatedAt: now,
	}); err != nil {
		t.Fatal(err)
	}

	claimed, ok, err := s.ClaimDue(now)
	if err != nil || !ok || claimed.ID != "j1" || claimed.Status != job.StatusRunning || claimed.Attempts != 1 {
		t.Fatalf("claim = %+v ok=%v err=%v", claimed, ok, err)
	}
	if string(claimed.Payload) != `{"name":"ada"}` {
		t.Errorf("payload = %s", claimed.Payload)
	}
	// Nothing else is due now (the future job is not, the claimed one is running).
	if _, ok, _ := s.ClaimDue(now); ok {
		t.Error("a second claim found a due job, want none")
	}

	if err := s.Complete("j1"); err != nil {
		t.Fatal(err)
	}
	if got, _ := s.JobByID("j1"); got.Status != job.StatusDone {
		t.Errorf("after complete = %q, want done", got.Status)
	}
	if _, err := s.JobByID("missing"); !errors.Is(err, job.ErrNotFound) {
		t.Errorf("JobByID(missing) = %v, want ErrNotFound", err)
	}
}

func TestJobRetryReschedules(t *testing.T) {
	s := openTemp(t)
	now := time.Now().UTC().Truncate(time.Millisecond)
	if _, err := s.Enqueue(job.Job{
		ID: "j1", Type: "boom", Status: job.StatusQueued, MaxAttempts: 3,
		RunAt: now, CreatedAt: now, UpdatedAt: now,
	}); err != nil {
		t.Fatal(err)
	}
	if _, _, err := s.ClaimDue(now); err != nil {
		t.Fatal(err)
	}
	// Retry a minute out: not due now, but due later.
	if err := s.Retry("j1", "boom", now.Add(time.Minute)); err != nil {
		t.Fatal(err)
	}
	if _, ok, _ := s.ClaimDue(now); ok {
		t.Error("retried job claimed before its run_at")
	}
	if _, ok, _ := s.ClaimDue(now.Add(2 * time.Minute)); !ok {
		t.Error("retried job not claimable after its run_at")
	}
}

func TestPersistsAcrossReopen(t *testing.T) {
	path := filepath.Join(t.TempDir(), "persist.db")

	s1, err := Open(path)
	if err != nil {
		t.Fatal(err)
	}
	now := time.Now().UTC().Truncate(time.Second)
	if err := s1.CreateUser(access.User{ID: "u1", Email: "u@b.com", PasswordHash: "h", CreatedAt: now}); err != nil {
		t.Fatal(err)
	}
	if err := s1.CreateSession(access.Session{ID: "s1", UserID: "u1", CreatedAt: now, ExpiresAt: now.Add(time.Hour)}); err != nil {
		t.Fatal(err)
	}
	s1.Close()

	// Reopening the same file recovers both the user and the session — the whole
	// point of durable storage.
	s2, err := Open(path)
	if err != nil {
		t.Fatal(err)
	}
	defer s2.Close()
	if _, err := s2.UserByEmail("u@b.com"); err != nil {
		t.Errorf("user did not survive reopen: %v", err)
	}
	if _, err := s2.SessionByID("s1"); err != nil {
		t.Errorf("session did not survive reopen: %v", err)
	}
}

func TestKnowledgeStoreRoundTrip(t *testing.T) {
	s := openTemp(t)
	now := time.Now().UTC().Truncate(time.Second)

	src := knowledge.Source{
		LocalRefID: "ref1", SourceType: "document", SourceID: "doc1",
		ProjectID: "p1", SizeBytes: 16, LineCount: 1, ContentHash: knowledge.ContentHash("hello world text"),
		AddedAt: now, SyncedAt: now,
	}
	windows := []knowledge.Window{
		{ID: "w1", LocalRefID: "ref1", Ordinal: 0, Start: 0, End: 11, Embedding: []float64{1, 0}},
		{ID: "w2", LocalRefID: "ref1", Ordinal: 1, Start: 6, End: 16, Embedding: []float64{0.9, 0.1}},
		{ID: "w3", LocalRefID: "ref1", Ordinal: 2, Start: 12, End: 16, Embedding: []float64{0, 1}},
	}
	// One cluster over w1+w2; w3 stays an orphan.
	nodes := []knowledge.Node{{
		ID: "n1", ProjectID: "p1", LocalRefID: "ref1", Level: 1,
		Centroid: []float64{0.95, 0.05}, Count: 2, Cohesion: 0.9,
		MemberIDs: []string{"w1", "w2"}, CreatedAt: now,
	}}

	if err := s.ReplaceSources([]knowledge.SourceWrite{{Source: src, Windows: windows, Nodes: nodes}}); err != nil {
		t.Fatal(err)
	}
	// The frontier is the complete set the corpus tier clusters: the cluster root
	// plus the orphan window — never the clustered windows.
	seen, err := s.SourceFrontier("p1")
	if err != nil {
		t.Fatal(err)
	}
	if len(seen) != 2 || seen[0].ID != "n1" || seen[0].IsWindow || seen[1].ID != "w3" || !seen[1].IsWindow {
		t.Fatalf("frontier = %+v", seen)
	}
	// A write leaves the corpus tier stale — it does not rebuild.
	dirty, built, err := s.CorpusSeq("p1")
	if err != nil {
		t.Fatal(err)
	}
	if dirty == built {
		t.Errorf("a write left the corpus current (dirty=%d built=%d); it must defer the rebuild", dirty, built)
	}

	// Round trip: the node comes back (by id) with its membership edges in order.
	gotNodes, err := s.NodesByID([]string{"n1"})
	if err != nil {
		t.Fatal(err)
	}
	gotWindows, err := s.ProjectWindows("p1")
	if err != nil {
		t.Fatal(err)
	}
	sources, err := s.SourcesByRef([]string{"ref1"})
	if err != nil {
		t.Fatal(err)
	}
	if len(gotNodes) != 1 || len(gotWindows) != 3 || len(sources) != 1 {
		t.Fatalf("load = %d nodes, %d windows, %d sources", len(gotNodes), len(gotWindows), len(sources))
	}
	n := gotNodes[0]
	if n.Count != 2 || n.Cohesion != 0.9 || len(n.MemberIDs) != 2 || n.MemberIDs[0] != "w1" || n.MemberIDs[1] != "w2" {
		t.Errorf("node = %+v", n)
	}
	if src2, ok, _ := s.SourceByOrigin("p1", "document", "doc1"); !ok || src2.LocalRefID != "ref1" || !src2.AddedAt.Equal(now) {
		t.Errorf("SourceByOrigin = %+v ok=%v", src2, ok)
	}

	// The frontier read exposes the cluster root and the orphan window (no text).
	fr, err := s.EntryFrontier("p1")
	if err != nil {
		t.Fatal(err)
	}
	if len(fr) != 2 {
		t.Errorf("EntryFrontier = %+v", fr)
	}
	if ids, err := s.Identities("p1"); err != nil || len(ids) != 1 {
		t.Errorf("Identities = %+v, %v", ids, err)
	}

	// Replacing the source again swaps everything atomically; a separate
	// RebuildCorpus stores the corpus nodes with their memberships, and the old
	// ones are gone.
	corpus := []knowledge.Node{{
		ID: "c1", ProjectID: "p1", LocalRefID: "", Level: 1,
		Centroid: []float64{1, 0}, Count: 2, Cohesion: 0.8,
		MemberIDs: []string{"n1", "w3"}, CreatedAt: now,
	}}
	if err := s.ReplaceSources([]knowledge.SourceWrite{{Source: src, Windows: windows, Nodes: nodes}}); err != nil {
		t.Fatal(err)
	}
	dirty, _, err = s.CorpusSeq("p1")
	if err != nil {
		t.Fatal(err)
	}
	if err := s.RebuildCorpus("p1", corpus, dirty, nil); err != nil {
		t.Fatal(err)
	}
	// Built at the sequence it was computed against, so the project reads current.
	if d, b, err := s.CorpusSeq("p1"); err != nil || d != b {
		t.Errorf("after rebuild: dirty=%d built=%d err=%v; want equal", d, b, err)
	}
	gotNodes, err = s.NodesByID([]string{"n1", "c1"})
	if err != nil {
		t.Fatal(err)
	}
	var corpusNodes, sourceNodes int
	for _, n := range gotNodes {
		if n.LocalRefID == "" {
			corpusNodes++
			if len(n.MemberIDs) != 2 || n.MemberIDs[0] != "n1" || n.MemberIDs[1] != "w3" {
				t.Errorf("corpus node = %+v", n)
			}
		} else {
			sourceNodes++
		}
	}
	if corpusNodes != 1 || sourceNodes != 1 {
		t.Errorf("nodes after re-replace: corpus=%d source=%d", corpusNodes, sourceNodes)
	}
	// The corpus root is the only entry point now (it absorbs n1 and w3).
	if fr, err := s.EntryFrontier("p1"); err != nil || len(fr) != 1 || fr[0].ID != "c1" {
		t.Errorf("EntryFrontier after corpus build = %+v, %v", fr, err)
	}
}

func TestKnowledgeDeleteSource(t *testing.T) {
	s := openTemp(t)
	now := time.Now().UTC().Truncate(time.Second)

	src := knowledge.Source{
		LocalRefID: "ref1", SourceType: "document", SourceID: "doc1",
		ProjectID: "p1", SizeBytes: 11, LineCount: 1, ContentHash: knowledge.ContentHash("hello world"),
		AddedAt: now, SyncedAt: now,
	}
	windows := []knowledge.Window{{ID: "w1", LocalRefID: "ref1", Start: 0, End: 5, Embedding: []float64{1, 0}}}
	nodes := []knowledge.Node{{ID: "n1", ProjectID: "p1", LocalRefID: "ref1", Level: 1, Centroid: []float64{1, 0}, Count: 1, MemberIDs: []string{"w1"}, CreatedAt: now}}
	if err := s.ReplaceSources([]knowledge.SourceWrite{{Source: src, Windows: windows, Nodes: nodes}}); err != nil {
		t.Fatal(err)
	}

	// Deleting an unknown origin is a no-op reporting false.
	if existed, err := s.DeleteSource("p1", "document", "missing"); err != nil || existed {
		t.Fatalf("DeleteSource(missing) = %v, %v; want false, nil", existed, err)
	}

	// Deleting the real origin removes source, windows and nodes and reports true.
	existed, err := s.DeleteSource("p1", "document", "doc1")
	if err != nil || !existed {
		t.Fatalf("DeleteSource(doc1) = %v, %v; want true, nil", existed, err)
	}
	if _, ok, _ := s.SourceByOrigin("p1", "document", "doc1"); ok {
		t.Error("source survives delete")
	}
	if w, _ := s.ProjectWindows("p1"); len(w) != 0 {
		t.Errorf("windows survive delete: %d", len(w))
	}
	if got, _ := s.NodesByID([]string{"n1"}); len(got) != 0 {
		t.Errorf("nodes survive delete: %d", len(got))
	}
}

// TestSourcesUnderReturnsPrefixMatches proves the lattice enumeration primitive
// round-trips through SQLite: every source whose SourceID starts with the given
// prefix, scoped to the project, with literal (not LIKE-wildcard) matching.
func TestSourcesUnderReturnsPrefixMatches(t *testing.T) {
	s := openTemp(t)
	now := time.Now().UTC().Truncate(time.Second)

	seed := func(projectID, localRef, sourceID string) {
		t.Helper()
		src := knowledge.Source{
			LocalRefID: localRef, SourceType: "connector", SourceID: sourceID,
			ProjectID: projectID, SizeBytes: 4, LineCount: 1, ContentHash: knowledge.ContentHash("text"),
			AddedAt: now, SyncedAt: now,
		}
		if err := s.ReplaceSources([]knowledge.SourceWrite{{Source: src}}); err != nil {
			t.Fatalf("seed %q/%q: %v", projectID, sourceID, err)
		}
	}
	seed("p1", "ref1", "X\x1fa")
	seed("p1", "ref2", "X\x1fb")
	seed("p1", "ref3", "Y\x1fa")
	// A source in a different project sharing the same prefix must not leak in.
	seed("p2", "ref4", "X\x1fa")

	got, err := s.SourcesUnder("p1", "connector", "X\x1f")
	if err != nil {
		t.Fatal(err)
	}
	if len(got) != 2 {
		t.Fatalf("SourcesUnder = %+v, want 2 origins", got)
	}
	seen := map[string]bool{}
	for _, o := range got {
		if o.SourceType != "connector" {
			t.Errorf("origin has wrong source type: %+v", o)
		}
		seen[o.SourceID] = true
	}
	if !seen["X\x1fa"] || !seen["X\x1fb"] || seen["Y\x1fa"] {
		t.Fatalf("SourcesUnder = %+v, want exactly {X\\x1fa, X\\x1fb}", got)
	}

	// Cross-project isolation: p2's own X-prefixed source is reachable from p2...
	if got, err := s.SourcesUnder("p2", "connector", "X\x1f"); err != nil || len(got) != 1 || got[0].SourceID != "X\x1fa" {
		t.Fatalf("SourcesUnder(p2) = %+v, %v; want exactly {X\\x1fa}", got, err)
	}
	// ...and unreachable from p1's empty other-type/prefix query.
	if got, err := s.SourcesUnder("p1", "document", "X\x1f"); err != nil || len(got) != 0 {
		t.Fatalf("SourcesUnder(p1, document) = %+v, %v; want none", got, err)
	}

	// Prefix matching is literal, not a LIKE-style pattern: a prefix that happens
	// to contain a wildcard metacharacter must not over-match.
	seed("p1", "ref5", "X%foo")
	seed("p1", "ref6", "Xbarfoo")
	got, err = s.SourcesUnder("p1", "connector", "X%")
	if err != nil {
		t.Fatal(err)
	}
	if len(got) != 1 || got[0].SourceID != "X%foo" {
		t.Fatalf("SourcesUnder(%q) = %+v, want exactly {X%%foo}", "X%", got)
	}

	// Prefix matching is case-sensitive, matching strings.HasPrefix (and
	// MemoryStore) exactly. SQLite's LIKE is case-insensitive for ASCII by
	// default, so this catches a substr/LIKE regression: "AbC\x1f" must not
	// also match a source starting with "abc\x1f".
	seed("p1", "ref7", "AbC\x1fone")
	seed("p1", "ref8", "abc\x1ftwo")
	got, err = s.SourcesUnder("p1", "connector", "AbC\x1f")
	if err != nil {
		t.Fatal(err)
	}
	if len(got) != 1 || got[0].SourceID != "AbC\x1fone" {
		t.Fatalf("SourcesUnder(%q) = %+v, want exactly {AbC\\x1fone}", "AbC\x1f", got)
	}
}

func TestNameStoreRoundTrip(t *testing.T) {
	s := openTemp(t)

	price, err := formula.NumberValue("42")
	if err != nil {
		t.Fatal(err)
	}
	if err := s.PutName("p1", names.Entry{Name: "price", Type: names.TypeNumber, Value: price}); err != nil {
		t.Fatalf("PutName scalar: %v", err)
	}

	got, err := s.Name("p1", "price")
	if err != nil {
		t.Fatalf("Name: %v", err)
	}
	if got.Type != names.TypeNumber || !got.Value.Equal(price) {
		t.Fatalf("scalar round trip = %+v", got)
	}
	if got.CreatedAt.IsZero() || got.UpdatedAt.IsZero() {
		t.Fatalf("timestamps not stamped: %+v", got)
	}
	createdAt := got.CreatedAt

	// A table entry round-trips its schema and rows.
	cell, err := formula.TextValue("widget")
	if err != nil {
		t.Fatal(err)
	}
	table := names.Entry{
		Name:   "items",
		Type:   names.TypeTable,
		Schema: []names.Column{{Name: "label", Type: names.ColumnText}},
		Rows:   [][]formula.Value{{cell}},
	}
	if err := s.PutName("p1", table); err != nil {
		t.Fatalf("PutName table: %v", err)
	}
	gotTable, err := s.Name("p1", "items")
	if err != nil {
		t.Fatalf("Name table: %v", err)
	}
	if len(gotTable.Schema) != 1 || gotTable.Schema[0].Name != "label" || gotTable.Schema[0].Type != names.ColumnText {
		t.Fatalf("table schema = %+v", gotTable.Schema)
	}
	if len(gotTable.Rows) != 1 || !gotTable.Rows[0][0].Equal(cell) {
		t.Fatalf("table rows = %+v", gotTable.Rows)
	}

	// Updating an existing name preserves created_at and advances updated_at.
	updated, err := formula.NumberValue("43")
	if err != nil {
		t.Fatal(err)
	}
	if err := s.PutName("p1", names.Entry{Name: "price", Type: names.TypeNumber, Value: updated}); err != nil {
		t.Fatalf("PutName update: %v", err)
	}
	got2, err := s.Name("p1", "price")
	if err != nil {
		t.Fatalf("Name after update: %v", err)
	}
	if !got2.Value.Equal(updated) {
		t.Fatalf("updated value = %+v, want 43", got2.Value)
	}
	if !got2.CreatedAt.Equal(createdAt) {
		t.Errorf("CreatedAt changed on update: got %v, want %v", got2.CreatedAt, createdAt)
	}
	if got2.UpdatedAt.Before(got2.CreatedAt) {
		t.Errorf("UpdatedAt %v before CreatedAt %v", got2.UpdatedAt, got2.CreatedAt)
	}

	// Names lists the whole namespace, ordered, and isolated per project.
	list, err := s.Names("p1")
	if err != nil || len(list) != 2 {
		t.Fatalf("Names(p1) = %+v, %v; want 2 entries", list, err)
	}
	if other, err := s.Names("p2"); err != nil || len(other) != 0 {
		t.Fatalf("Names(p2) = %+v, %v; want empty (project isolation)", other, err)
	}
	if _, err := s.Name("p2", "price"); !errors.Is(err, names.ErrNotFound) {
		t.Errorf("Name in other project: got %v, want ErrNotFound", err)
	}

	// Delete removes the row; deleting again is ErrNotFound.
	if err := s.DeleteName("p1", "price"); err != nil {
		t.Fatalf("DeleteName: %v", err)
	}
	if _, err := s.Name("p1", "price"); !errors.Is(err, names.ErrNotFound) {
		t.Errorf("Name after delete: got %v, want ErrNotFound", err)
	}
	if err := s.DeleteName("p1", "price"); !errors.Is(err, names.ErrNotFound) {
		t.Errorf("DeleteName again: got %v, want ErrNotFound", err)
	}
}

func TestProjectSessionRoundTrip(t *testing.T) {
	s := openTemp(t)
	now := time.Now().UTC().Truncate(time.Second)
	later := now.Add(10 * time.Minute)

	sess := session.Session{
		ProjectID:            "p1",
		UserID:               "u1",
		SessionID:            "sess-abc",
		UserName:             "Alice",
		CurrentDocumentID:    "doc-1",
		CaretAtomID:          "a1",
		CaretOffset:          5,
		SelectionStartAtomID: "a1",
		SelectionStartOffset: 3,
		SelectionEndAtomID:   "a2",
		SelectionEndOffset:   7,
		StartedAt:            now,
		LastActivityAt:       now,
	}
	if err := s.UpsertProjectSession(sess); err != nil {
		t.Fatalf("UpsertProjectSession: %v", err)
	}

	list, err := s.ListProjectSessions("p1")
	if err != nil {
		t.Fatalf("ListProjectSessions: %v", err)
	}
	if len(list) != 1 {
		t.Fatalf("expected 1 session, got %d", len(list))
	}
	got := list[0]
	if got.ProjectID != "p1" || got.UserID != "u1" || got.SessionID != "sess-abc" {
		t.Fatalf("identity mismatch: %+v", got)
	}
	if got.UserName != "Alice" {
		t.Fatalf("user_name mismatch: got %q", got.UserName)
	}
	if got.CurrentDocumentID != "doc-1" || got.CaretAtomID != "a1" || got.CaretOffset != 5 {
		t.Fatalf("caret mismatch: %+v", got)
	}
	if got.SelectionStartAtomID != "a1" || got.SelectionStartOffset != 3 {
		t.Fatalf("selection start mismatch: %+v", got)
	}
	if got.SelectionEndAtomID != "a2" || got.SelectionEndOffset != 7 {
		t.Fatalf("selection end mismatch: %+v", got)
	}

	if err := s.BumpProjectSessionActivity("p1", "u1", later); err != nil {
		t.Fatalf("BumpProjectSessionActivity: %v", err)
	}
	list, _ = s.ListProjectSessions("p1")
	if len(list) != 1 {
		t.Fatalf("session disappeared after bump: %d", len(list))
	}
	if !list[0].LastActivityAt.After(now) && !list[0].LastActivityAt.Equal(later) {
		t.Fatalf("last_activity_at not updated: %v (expected >= %v)", list[0].LastActivityAt, later)
	}

	if err := s.UpdateProjectSession(session.Session{
		ProjectID:         "p1",
		UserID:            "u1",
		CurrentDocumentID: "doc-2",
		CaretAtomID:       "a5",
		CaretOffset:       1,
		LastActivityAt:    later,
	}); err != nil {
		t.Fatalf("UpdateProjectSession: %v", err)
	}
	list, _ = s.ListProjectSessions("p1")
	got = list[0]
	if got.CurrentDocumentID != "doc-2" || got.CaretAtomID != "a5" {
		t.Fatalf("update not persisted: %+v", got)
	}
	if got.SelectionStartAtomID != "" || got.SelectionStartOffset != 0 {
		t.Fatalf("selection should be cleared: %+v", got)
	}

	// Upsert reactivates.
	sess2 := session.Session{
		ProjectID:      "p1",
		UserID:         "u1",
		SessionID:      "sess-xyz",
		UserName:       "Alice-v2",
		StartedAt:      later,
		LastActivityAt: later,
	}
	if err := s.UpsertProjectSession(sess2); err != nil {
		t.Fatalf("upsert: %v", err)
	}
	list, _ = s.ListProjectSessions("p1")
	got = list[0]
	if got.SessionID != "sess-xyz" || got.UserName != "Alice-v2" {
		t.Fatalf("upsert did not update identity: %+v", got)
	}
	// Caret/selection should be preserved from upsert (not overwritten)
	if got.CaretAtomID != "a5" || got.CurrentDocumentID != "doc-2" {
		t.Fatalf("upsert cleared caret state: %+v", got)
	}

	if err := s.CloseProjectSession("p1", "u1"); err != nil {
		t.Fatalf("CloseProjectSession: %v", err)
	}
	list, _ = s.ListProjectSessions("p1")
	if len(list) != 0 {
		t.Fatalf("session not deleted: %d", len(list))
	}
}

func TestProjectSessionProjectIsolation(t *testing.T) {
	s := openTemp(t)
	now := time.Now().UTC()

	s.UpsertProjectSession(session.Session{
		ProjectID: "p1", UserID: "u1", SessionID: "sa", UserName: "A",
		StartedAt: now, LastActivityAt: now,
	})
	s.UpsertProjectSession(session.Session{
		ProjectID: "p2", UserID: "u1", SessionID: "sb", UserName: "A",
		StartedAt: now, LastActivityAt: now,
	})

	list, _ := s.ListProjectSessions("p1")
	if len(list) != 1 {
		t.Fatalf("p1: expected 1, got %d", len(list))
	}
	list, _ = s.ListProjectSessions("p2")
	if len(list) != 1 {
		t.Fatalf("p2: expected 1, got %d", len(list))
	}
}

func TestDeleteStaleProjectSessions(t *testing.T) {
	s := openTemp(t)
	now := time.Now().UTC()
	old := now.Add(-2 * time.Hour)
	recent := now.Add(-1 * time.Minute)

	s.UpsertProjectSession(session.Session{
		ProjectID: "p1", UserID: "u1", SessionID: "sa", UserName: "Alice",
		StartedAt: old, LastActivityAt: old,
	})
	s.UpsertProjectSession(session.Session{
		ProjectID: "p1", UserID: "u2", SessionID: "sb", UserName: "Bob",
		StartedAt: recent, LastActivityAt: recent,
	})

	if err := s.DeleteStaleProjectSessions(now.Add(-1 * time.Hour)); err != nil {
		t.Fatalf("DeleteStaleProjectSessions: %v", err)
	}

	list, _ := s.ListProjectSessions("p1")
	if len(list) != 1 {
		t.Fatalf("expected 1 session after sweep, got %d", len(list))
	}
	if list[0].UserID != "u2" {
		t.Fatalf("expected Bob to survive, got %s", list[0].UserID)
	}
}

func TestPersonaRoundTrip(t *testing.T) {
	s := openTemp(t)
	now := time.Now().UTC().Truncate(time.Second)

	// Create
	item := persona.Persona{ProjectID: "p1", ID: "pers-1", Name: "Helper", Description: "A helper persona", CurrentVersion: 1, CreatedBy: "u1", CreatedAt: now, UpdatedAt: now}
	version := persona.Version{ProjectID: "p1", PersonaID: "pers-1", Version: 1, Definition: persona.Definition{BehavioralGuidance: "Be helpful."}, CreatedBy: "u1", CreatedAt: now}
	if err := s.CreatePersona(item, version); err != nil {
		t.Fatal(err)
	}

	// Read back
	got, err := s.PersonaByID("p1", "pers-1")
	if err != nil {
		t.Fatal(err)
	}
	if got.Name != "Helper" || got.Description != "A helper persona" || got.CurrentVersion != 1 || got.CreatedBy != "u1" {
		t.Errorf("persona round trip = %+v", got)
	}

	// Read version
	gotVersion, err := s.PersonaVersion("p1", "pers-1", 1)
	if err != nil {
		t.Fatal(err)
	}
	if gotVersion.Definition.BehavioralGuidance != "Be helpful." {
		t.Errorf("version round trip = %+v", gotVersion)
	}

	// Update version
	item.Name = "Super Helper"
	item.Description = "An updated helper"
	item.CurrentVersion = 2
	item.UpdatedAt = now.Add(time.Second)
	newVersion := persona.Version{ProjectID: "p1", PersonaID: "pers-1", Version: 2, Definition: persona.Definition{BehavioralGuidance: "Be super helpful."}, CreatedBy: "u1", CreatedAt: now.Add(time.Second)}
	if err := s.UpdatePersonaVersion(item, newVersion, 1); err != nil {
		t.Fatal(err)
	}

	// Verify updated
	got, err = s.PersonaByID("p1", "pers-1")
	if err != nil {
		t.Fatal(err)
	}
	if got.CurrentVersion != 2 || got.Name != "Super Helper" {
		t.Errorf("update = %+v", got)
	}

	// Version conflict
	if err := s.UpdatePersonaVersion(item, newVersion, 1); !errors.Is(err, persona.ErrVersionConflict) {
		t.Fatalf("expected version conflict, got %v", err)
	}

	// List
	list, err := s.PersonasByProject("p1")
	if err != nil || len(list) != 1 {
		t.Fatalf("list = %+v, %v", list, err)
	}

	// Versions
	versions, err := s.PersonaVersions("p1", "pers-1")
	if err != nil || len(versions) != 2 {
		t.Fatalf("versions = %+v, %v", versions, err)
	}

	// Defaults
	if err := s.SetDefaultPersona(persona.Default{ProjectID: "p1", UserID: "u1", PersonaID: "pers-1", UpdatedAt: now}); err != nil {
		t.Fatal(err)
	}
	def, err := s.DefaultPersona("p1", "u1")
	if err != nil || def.PersonaID != "pers-1" {
		t.Errorf("default = %+v, %v", def, err)
	}

	// Delete
	if err := s.DeletePersona("p1", "pers-1"); err != nil {
		t.Fatal(err)
	}
	if _, err := s.PersonaByID("p1", "pers-1"); !errors.Is(err, persona.ErrNotFound) {
		t.Fatalf("delete error = %v", err)
	}
	if _, err := s.PersonaVersions("p1", "pers-1"); !errors.Is(err, persona.ErrNotFound) {
		t.Fatalf("versions after delete error = %v", err)
	}
	if _, err := s.DefaultPersona("p1", "u1"); !errors.Is(err, persona.ErrNotFound) {
		t.Fatalf("default after delete error = %v, want ErrNotFound", err)
	}
}

func TestAgentTaskRoundTrip(t *testing.T) {
	s := openTemp(t)
	now := time.Now().UTC().Truncate(time.Second)

	task := agent.Task{
		ID: "task-1", ProjectID: "p1", RequesterID: "u1",
		Mode: agent.TaskModePlan, State: agent.TaskStateQueued,
		Objective: "Plan the launch.",
		Persona:   agent.PersonaSnapshot{ID: "general", Version: 1, Name: "General", Instructions: "Help."},
		Runs:      []agent.TaskRun{{ID: "run-1", State: agent.TaskStateQueued, Attempt: 1}},
		CreatedAt: now, UpdatedAt: now,
	}
	if err := s.CreateTask(task); err != nil {
		t.Fatal(err)
	}

	got, err := s.TaskByID("task-1")
	if err != nil {
		t.Fatal(err)
	}
	if got.Objective != "Plan the launch." || got.State != agent.TaskStateQueued || len(got.Runs) != 1 {
		t.Errorf("task round trip = %+v", got)
	}

	// Update
	got.State = agent.TaskStateRunning
	got.UpdatedAt = now.Add(time.Second)
	if err := s.UpdateTask(got); err != nil {
		t.Fatal(err)
	}
	updated, err := s.TaskByID("task-1")
	if err != nil {
		t.Fatal(err)
	}
	if updated.State != agent.TaskStateRunning {
		t.Errorf("update state = %s", updated.State)
	}

	// List by project
	list, err := s.TasksByProject("p1")
	if err != nil || len(list) != 1 {
		t.Fatalf("list = %+v, %v", list, err)
	}

	// List by persona
	byPersona, err := s.TasksByPersona("p1", "general")
	if err != nil || len(byPersona) != 1 {
		t.Fatalf("by persona = %+v, %v", byPersona, err)
	}
	empty, err := s.TasksByPersona("p1", "nobody")
	if err != nil || len(empty) != 0 {
		t.Fatalf("empty by persona = %+v, %v", empty, err)
	}
}

func TestChatRoundTrip(t *testing.T) {
	s := openTemp(t)
	now := time.Now().UTC().Truncate(time.Second)

	ch := chat.Chat{
		ID: "chat-1", ProjectID: "p1", RequesterID: "u1", Title: "Findings",
		Mode: chat.ModeAsk, ResourceID: "doc-1", CreatedAt: now, UpdatedAt: now,
	}
	if err := s.CreateChat(ch); err != nil {
		t.Fatal(err)
	}

	got, err := s.ChatByID("p1", "chat-1")
	if err != nil {
		t.Fatal(err)
	}
	if got.Title != "Findings" || got.Mode != chat.ModeAsk || got.ResourceID != "doc-1" ||
		got.ProjectID != "p1" || got.RequesterID != "u1" || !got.CreatedAt.Equal(now) {
		t.Fatalf("chat round-trip mismatch: %+v", got)
	}

	if err := s.AppendTurn(chat.Turn{ID: "t1", ChatID: "chat-1", ProjectID: "p1", Role: chat.RoleUser, Body: "hi", CreatedAt: now}); err != nil {
		t.Fatal(err)
	}
	if err := s.AppendTurn(chat.Turn{ID: "t2", ChatID: "chat-1", ProjectID: "p1", Role: chat.RoleAgent, Body: "hello", TaskID: "task-9", CreatedAt: now}); err != nil {
		t.Fatal(err)
	}
	turns, err := s.TurnsByChat("chat-1")
	if err != nil {
		t.Fatal(err)
	}
	if len(turns) != 2 || turns[0].ID != "t1" || turns[1].ID != "t2" || turns[1].TaskID != "task-9" {
		t.Fatalf("turns mismatch: %+v", turns)
	}

	_ = s.CreateChat(chat.Chat{ID: "chat-2", ProjectID: "p1", RequesterID: "u1", Mode: chat.ModePlan, CreatedAt: now, UpdatedAt: now})
	_ = s.CreateChat(chat.Chat{ID: "chat-3", ProjectID: "p2", RequesterID: "u9", Mode: chat.ModeAsk, ResourceID: "doc-1", CreatedAt: now, UpdatedAt: now})

	p1all, _ := s.ChatsByProject("p1", "")
	if len(p1all) != 2 {
		t.Fatalf("p1 chats = %d, want 2 (project isolation)", len(p1all))
	}
	p1doc1, _ := s.ChatsByProject("p1", "doc-1")
	if len(p1doc1) != 1 || p1doc1[0].ID != "chat-1" {
		t.Fatalf("p1 doc-1 chats = %+v", p1doc1)
	}

	later := now.Add(time.Minute)
	if err := s.TouchChat("chat-1", later); err != nil {
		t.Fatal(err)
	}
	if got2, _ := s.ChatByID("p1", "chat-1"); !got2.UpdatedAt.Equal(later) {
		t.Fatalf("touch didn't update updated_at: %v want %v", got2.UpdatedAt, later)
	}

	if _, err := s.ChatByID("p1", "nope"); !errors.Is(err, chat.ErrNotFound) {
		t.Fatalf("missing chat = %v, want ErrNotFound", err)
	}
}

func TestConnectorPersistsAcrossReopen(t *testing.T) {
	dsn := filepath.Join(t.TempDir(), "connector.db")
	s, err := Open(dsn)
	if err != nil {
		t.Fatalf("open: %v", err)
	}
	rec := connector.Connector{
		ID: "c1", ProjectID: "p1", Name: "Drive", SubKind: connector.SubKindLocalFolder,
		Path: "/data/x", CreatorID: "u1", CreatedAt: time.Unix(1, 0).UTC(), UpdatedAt: time.Unix(2, 0).UTC(),
	}
	if err := s.InsertConnector(rec); err != nil {
		t.Fatalf("insert: %v", err)
	}
	_ = s.Close()

	s2, err := Open(dsn)
	if err != nil {
		t.Fatalf("reopen: %v", err)
	}
	got, err := s2.ConnectorByID("p1", "c1")
	if err != nil {
		t.Fatalf("get: %v", err)
	}
	if got.Name != "Drive" || got.Path != "/data/x" || got.SubKind != connector.SubKindLocalFolder {
		t.Fatalf("round-trip mismatch: %+v", got)
	}
}

func TestConnectorSyncStatePersists(t *testing.T) {
	dsn := filepath.Join(t.TempDir(), "syncstate.db")
	s, err := Open(dsn)
	if err != nil {
		t.Fatalf("open: %v", err)
	}
	rec := connector.Connector{
		ID: "c1", ProjectID: "p1", Name: "Drive", SubKind: connector.SubKindLocalFolder,
		Path: "/data/x", CreatorID: "u1", CreatedAt: time.Unix(1, 0).UTC(), UpdatedAt: time.Unix(1, 0).UTC(),
	}
	if err := s.InsertConnector(rec); err != nil {
		t.Fatalf("insert: %v", err)
	}
	at := time.Unix(9, 0).UTC()
	if err := s.SetConnectorSyncState("p1", "c1", "fp-abc", 3, at); err != nil {
		t.Fatalf("set sync state: %v", err)
	}
	_ = s.Close()

	s2, err := Open(dsn)
	if err != nil {
		t.Fatalf("reopen: %v", err)
	}
	got, err := s2.ConnectorByID("p1", "c1")
	if err != nil {
		t.Fatalf("get: %v", err)
	}
	if got.Fingerprint != "fp-abc" || got.SyncSeq != 3 || !got.SyncedAt.Equal(at) {
		t.Fatalf("sync state not persisted: %+v", got)
	}
}

func TestContextStoreRoundTrip(t *testing.T) {
	s := openTemp(t)
	rec := contexts.Context{
		ID: "c1", ProjectID: "p", Name: "Design", CreatorID: "u1",
		Includes:  []contexts.Ref{{Kind: "document", ID: "d1", Name: "Doc 1"}},
		Excludes:  []contexts.Ref{{Kind: "connector", ID: "k1"}},
		CreatedAt: time.Now().UTC().Truncate(time.Second),
		UpdatedAt: time.Now().UTC().Truncate(time.Second),
	}
	if err := s.InsertContext(rec); err != nil {
		t.Fatalf("insert: %v", err)
	}
	got, err := s.ContextByID("p", "c1")
	if err != nil {
		t.Fatalf("byID: %v", err)
	}
	if got.Name != "Design" || len(got.Includes) != 1 || got.Includes[0].ID != "d1" || len(got.Excludes) != 1 {
		t.Fatalf("round-trip mismatch: %+v", got)
	}
	if _, err := s.ContextByID("other", "c1"); err != contexts.ErrNotFound {
		t.Fatalf("cross-project isolation: want ErrNotFound, got %v", err)
	}

	rec.Name = "Design v2"
	rec.Excludes = nil
	if err := s.UpdateContext(rec); err != nil {
		t.Fatalf("update: %v", err)
	}
	got, _ = s.ContextByID("p", "c1")
	if got.Name != "Design v2" || len(got.Excludes) != 0 {
		t.Fatalf("update mismatch: %+v", got)
	}

	list, err := s.ContextSummaries("p")
	if err != nil || len(list) != 1 {
		t.Fatalf("summaries: %v %d", err, len(list))
	}
	if err := s.DeleteContext("p", "c1"); err != nil {
		t.Fatalf("delete: %v", err)
	}
	if _, err := s.ContextByID("p", "c1"); err != contexts.ErrNotFound {
		t.Fatalf("post-delete: want ErrNotFound, got %v", err)
	}
}

// TestRebaseDocumentIgnoresStaleWatermark pins BUG-1: RebaseDocument is the one
// write to the document head that historically skipped the revision/watermark
// guard. With two job workers and no rebase-job dedup, a duplicate or stale
// rebase (one that folded an older view) could wind base_seq backward and
// clobber a newer base, losing content. A stale rebase must be a no-op.
func TestRebaseDocumentIgnoresStaleWatermark(t *testing.T) {
	s := openTemp(t)
	now := time.Now().UTC().Truncate(time.Second)
	doc := document.Document{ID: "d1", ProjectID: "p1", Name: "D", CreatedAt: now, UpdatedAt: now}
	if err := s.CreateDocument(doc, testDocumentFact(doc, document.ActivityCreated, "create-d1", now)); err != nil {
		t.Fatal(err)
	}
	for i := 1; i <= 3; i++ {
		cs := document.ChangeSet{
			ID: "c" + string(rune('0'+i)), DocumentID: "d1", AuthorID: "u", CreatedAt: now,
			Ops: []document.ChangeOp{{Op: document.OpDeleteRow, RowID: "r"}},
		}
		if _, err := s.AppendChangeSet(cs, int64(i-1),
			testDocumentFact(doc, document.ActivityEdited, "edit-"+string(rune('0'+i)), now)); err != nil {
			t.Fatal(err)
		}
	}

	// A rebase folds pending through seq 3, advancing the watermark to 3.
	fresh := document.Base{Rows: []document.Row{{ID: "fresh"}}}
	if err := s.RebaseDocument("d1", fresh, 3); err != nil {
		t.Fatal(err)
	}

	// A stale rebase (older watermark) must not overwrite the newer base.
	stale := document.Base{Rows: []document.Row{{ID: "stale"}}}
	if err := s.RebaseDocument("d1", stale, 2); err != nil {
		t.Fatal(err)
	}
	got, err := s.DocumentByID("p1", "d1")
	if err != nil {
		t.Fatal(err)
	}
	if got.BaseSeq != 3 {
		t.Fatalf("stale rebase wound base_seq back to %d, want 3", got.BaseSeq)
	}
	if len(got.Base.Rows) != 1 || got.Base.Rows[0].ID != "fresh" {
		t.Fatalf("stale rebase clobbered base = %+v, want the fresh row", got.Base)
	}

	// A duplicate rebase at the same watermark is likewise a no-op.
	if err := s.RebaseDocument("d1", stale, 3); err != nil {
		t.Fatal(err)
	}
	if got, _ := s.DocumentByID("p1", "d1"); got.Base.Rows[0].ID != "fresh" {
		t.Fatalf("same-watermark rebase clobbered base = %+v", got.Base)
	}

	// A genuinely newer rebase still advances normally.
	newer := document.Base{Rows: []document.Row{{ID: "newer"}}}
	if err := s.RebaseDocument("d1", newer, 4); err != nil {
		t.Fatal(err)
	}
	if got, _ := s.DocumentByID("p1", "d1"); got.BaseSeq != 4 || got.Base.Rows[0].ID != "newer" {
		t.Fatalf("forward rebase did not apply = %+v", got)
	}
}

// TestDocumentsProjectIndexExists pins PERF-1: documents are listed by project
// on hot read paths (List, RevisionHints, duplicate-name), so documents.project_id
// must be indexed rather than full-scanned.
func TestDocumentsProjectIndexExists(t *testing.T) {
	s := openTemp(t)
	var n int
	err := s.db.QueryRow(
		`SELECT count(*) FROM sqlite_master WHERE type='index' AND name='idx_documents_project'`,
	).Scan(&n)
	if err != nil {
		t.Fatal(err)
	}
	if n != 1 {
		t.Fatalf("idx_documents_project missing (found %d); documents(project_id) is unindexed", n)
	}
}

// TestFileReadsAreProjectScoped pins DEF-1: file content and metadata reads are
// scoped in SQL, so a foreign project id yields not-found instead of another
// project's bytes — the boundary no longer depends on the caller checking the
// metadata first.
func TestFileReadsAreProjectScoped(t *testing.T) {
	s := openTemp(t)
	now := time.Now().UTC().Truncate(time.Second)
	f := file.File{
		ID: "f1", ProjectID: "p1", Name: "secret.txt", ContentType: "text/plain",
		Size: 4, UploaderID: "u1", UploaderName: "Ann", CreatedAt: now,
	}
	if err := s.Put(f, []byte("mine")); err != nil {
		t.Fatal(err)
	}

	if got, err := s.Content("p1", "f1"); err != nil || string(got) != "mine" {
		t.Fatalf("owning-project Content = %q, %v; want \"mine\"", got, err)
	}
	if got, err := s.Meta("p1", "f1"); err != nil || got.Name != "secret.txt" {
		t.Fatalf("owning-project Meta = %+v, %v", got, err)
	}
	if got, err := s.Content("p2", "f1"); !errors.Is(err, file.ErrNotFound) || got != nil {
		t.Errorf("foreign-project Content = %q, %v; want nil, ErrNotFound", got, err)
	}
	if got, err := s.Meta("p2", "f1"); !errors.Is(err, file.ErrNotFound) {
		t.Errorf("foreign-project Meta = %+v, %v; want ErrNotFound", got, err)
	}
}

// TestDocumentReadsAreProjectScoped finishes DEF-1 for documents: DocumentByID
// filters on the project in SQL, so a foreign project id reads as
// document.ErrNotFound rather than another project's document.
func TestDocumentReadsAreProjectScoped(t *testing.T) {
	s := openTemp(t)
	now := time.Now().UTC().Truncate(time.Second)
	d := document.Document{
		ID: "d1", ProjectID: "p1", Name: "Notes", CreatorID: "u1", CreatorName: "Ada",
		Lifecycle: document.LifecycleActive, CreatedAt: now, UpdatedAt: now,
	}
	if err := s.CreateDocument(d, testDocumentFact(d, document.ActivityCreated, "create-d1", now)); err != nil {
		t.Fatal(err)
	}

	if got, err := s.DocumentByID("p1", "d1"); err != nil || got.Name != "Notes" {
		t.Fatalf("owning-project DocumentByID = %+v, %v", got, err)
	}
	if got, err := s.DocumentByID("p2", "d1"); !errors.Is(err, document.ErrNotFound) {
		t.Errorf("foreign-project DocumentByID = %+v, %v; want ErrNotFound", got, err)
	}
}

// TestCommentReadsAreProjectScoped finishes DEF-1 for comments: CommentByID
// filters on the project in SQL, so a foreign project id reads as
// comment.ErrNotFound rather than another project's thread head.
func TestCommentReadsAreProjectScoped(t *testing.T) {
	s := openTemp(t)
	now := time.Now().UTC().Truncate(time.Second)
	if err := s.CreateComment(comment.Comment{
		ID: "c1", ProjectID: "p1", DocumentID: "d1", AnchorID: "a1",
		AuthorID: "u1", AuthorName: "Ann", Body: "needs a citation",
		CreatedAt: now, UpdatedAt: now,
	}); err != nil {
		t.Fatal(err)
	}

	if got, err := s.CommentByID("p1", "c1"); err != nil || got.Body != "needs a citation" {
		t.Fatalf("owning-project CommentByID = %+v, %v", got, err)
	}
	if got, err := s.CommentByID("p2", "c1"); !errors.Is(err, comment.ErrNotFound) {
		t.Errorf("foreign-project CommentByID = %+v, %v; want ErrNotFound", got, err)
	}
}

// TestChatReadsAreProjectScoped finishes DEF-1 for chats: both ChatByID and
// ChatAttachmentByID filter on the project in SQL, so a foreign project id
// reads as chat.ErrNotFound rather than another project's conversation or its
// attachment manifest.
func TestChatReadsAreProjectScoped(t *testing.T) {
	s := openTemp(t)
	now := time.Now().UTC().Truncate(time.Second)
	if err := s.CreateChat(chat.Chat{
		ID: "chat-1", ProjectID: "p1", RequesterID: "u1", Title: "Findings",
		Mode: chat.ModeAsk, CreatedAt: now, UpdatedAt: now,
	}); err != nil {
		t.Fatal(err)
	}
	if err := s.CreateChatAttachment(chat.Attachment{
		ID: "att-1", ProjectID: "p1", ChatID: "chat-1", Kind: chat.AttachmentFile,
		FileID: "f1", Name: "secret.txt", CreatedAt: now,
	}); err != nil {
		t.Fatal(err)
	}

	if got, err := s.ChatByID("p1", "chat-1"); err != nil || got.Title != "Findings" {
		t.Fatalf("owning-project ChatByID = %+v, %v", got, err)
	}
	if got, err := s.ChatByID("p2", "chat-1"); !errors.Is(err, chat.ErrNotFound) {
		t.Errorf("foreign-project ChatByID = %+v, %v; want ErrNotFound", got, err)
	}
	if got, err := s.ChatAttachmentByID("p1", "att-1"); err != nil || got.Name != "secret.txt" {
		t.Fatalf("owning-project ChatAttachmentByID = %+v, %v", got, err)
	}
	if got, err := s.ChatAttachmentByID("p2", "att-1"); !errors.Is(err, chat.ErrNotFound) {
		t.Errorf("foreign-project ChatAttachmentByID = %+v, %v; want ErrNotFound", got, err)
	}
}

// TestRedundantChangeSetIndexDropped pins PERF-2: idx_change_sets_doc_seq
// duplicated the unique idx_change_sets_doc_revision over the same
// (document_id, seq) columns. The schema no longer creates it, and opening a
// database that already has it drops it.
func TestRedundantChangeSetIndexDropped(t *testing.T) {
	path := filepath.Join(t.TempDir(), "indexes.db")
	s1, err := Open(path)
	if err != nil {
		t.Fatal(err)
	}
	if n := indexCount(t, s1, "idx_change_sets_doc_seq"); n != 0 {
		t.Errorf("fresh database still creates the redundant index (found %d)", n)
	}
	if n := indexCount(t, s1, "idx_change_sets_doc_revision"); n != 1 {
		t.Fatalf("the unique (document_id, seq) index is missing (found %d)", n)
	}
	// Simulate an existing database carrying the redundant index.
	if _, err := s1.db.Exec(`CREATE INDEX IF NOT EXISTS idx_change_sets_doc_seq ON change_sets(document_id, seq)`); err != nil {
		t.Fatal(err)
	}
	s1.Close()

	s2, err := Open(path)
	if err != nil {
		t.Fatal(err)
	}
	defer s2.Close()
	if n := indexCount(t, s2, "idx_change_sets_doc_seq"); n != 0 {
		t.Errorf("reopening did not shed the redundant index (found %d)", n)
	}
	if n := indexCount(t, s2, "idx_change_sets_doc_revision"); n != 1 {
		t.Errorf("the unique (document_id, seq) index was lost (found %d)", n)
	}
}

func indexCount(t *testing.T, s *Store, name string) int {
	t.Helper()
	var n int
	if err := s.db.QueryRow(
		`SELECT count(*) FROM sqlite_master WHERE type='index' AND name=?`, name).Scan(&n); err != nil {
		t.Fatal(err)
	}
	return n
}

// TestRepliesByCommentsBatchesThreads pins PERF-2: one query loads every
// thread on a page, grouped by comment, matching what per-comment loads return.
func TestRepliesByCommentsBatchesThreads(t *testing.T) {
	s := openTemp(t)
	now := time.Now().UTC().Truncate(time.Second)
	for _, id := range []string{"c1", "c2", "c3"} {
		if err := s.CreateComment(comment.Comment{
			ID: id, ProjectID: "p1", DocumentID: "d1", AnchorID: "a1",
			AuthorID: "u1", AuthorName: "Ann", Body: "b", CreatedAt: now, UpdatedAt: now,
		}); err != nil {
			t.Fatal(err)
		}
	}
	replies := []comment.Reply{
		{ID: "r1", CommentID: "c1", ProjectID: "p1", AuthorID: "u2", Body: "first", CreatedAt: now},
		{ID: "r2", CommentID: "c1", ProjectID: "p1", AuthorID: "u2", Body: "second", CreatedAt: now.Add(time.Second)},
		{ID: "r3", CommentID: "c3", ProjectID: "p1", AuthorID: "u2", Body: "only", CreatedAt: now},
		{ID: "r4", CommentID: "cX", ProjectID: "p1", AuthorID: "u2", Body: "unrelated", CreatedAt: now},
	}
	for _, r := range replies {
		if err := s.AddReply(r); err != nil {
			t.Fatal(err)
		}
	}

	got, err := s.RepliesByComments([]string{"c1", "c2", "c3"})
	if err != nil {
		t.Fatal(err)
	}
	if len(got) != 2 { // c2 has no replies, so it is simply absent
		t.Fatalf("batched map has %d entries, want 2: %+v", len(got), got)
	}
	for _, id := range []string{"c1", "c2", "c3"} {
		one, err := s.RepliesByComment(id)
		if err != nil {
			t.Fatal(err)
		}
		batched := got[id]
		if len(batched) != len(one) {
			t.Fatalf("comment %s: batched %d replies, per-comment %d", id, len(batched), len(one))
		}
		for i := range one {
			if batched[i].ID != one[i].ID || batched[i].Body != one[i].Body || !batched[i].CreatedAt.Equal(one[i].CreatedAt) {
				t.Errorf("comment %s reply %d: batched %+v != per-comment %+v", id, i, batched[i], one[i])
			}
		}
	}
	if empty, err := s.RepliesByComments(nil); err != nil || len(empty) != 0 {
		t.Errorf("empty id list = %+v, %v; want an empty map and no query", empty, err)
	}
}

// TestJobReapStale pins BUG-2 at the SQLite layer: ReapStale returns orphaned
// running jobs to queued (claimable again) with attempts preserved, and leaves
// recently-touched running jobs alone.
func TestJobReapStale(t *testing.T) {
	s := openTemp(t)
	now := time.Now().UTC().Truncate(time.Millisecond)
	old := now.Add(-time.Hour)
	if _, err := s.Enqueue(job.Job{
		ID: "orphan", Type: "x", Status: job.StatusRunning, Attempts: 2, MaxAttempts: 5,
		RunAt: old, CreatedAt: old, UpdatedAt: old,
	}); err != nil {
		t.Fatal(err)
	}
	if _, err := s.Enqueue(job.Job{
		ID: "live", Type: "x", Status: job.StatusRunning, Attempts: 1, MaxAttempts: 5,
		RunAt: now, CreatedAt: now, UpdatedAt: now,
	}); err != nil {
		t.Fatal(err)
	}
	n, err := s.ReapStale(now.Add(-time.Minute))
	if err != nil {
		t.Fatal(err)
	}
	if n != 1 {
		t.Fatalf("reaped %d, want 1", n)
	}
	if got, _ := s.JobByID("orphan"); got.Status != job.StatusQueued || got.Attempts != 2 {
		t.Fatalf("orphan after reap = %+v, want queued attempts=2", got)
	}
	if claimed, ok, _ := s.ClaimDue(now); !ok || claimed.ID != "orphan" {
		t.Fatalf("reaped job not claimable: %+v ok=%v", claimed, ok)
	}
	if got, _ := s.JobByID("live"); got.Status != job.StatusRunning {
		t.Fatalf("live job requeued = %+v", got)
	}
}

// TestJobsByStatusAndCounts pins JOB-1 at the SQLite layer: the observability
// read filters by status, orders newest-first, honours (and caps) the limit, and
// the summary counts every status in the table.
func TestJobsByStatusAndCounts(t *testing.T) {
	s := openTemp(t)
	base := time.Now().UTC().Truncate(time.Millisecond)
	seed := []job.Job{
		{ID: "f1", Type: "x", Status: job.StatusFailed, LastError: "boom", MaxAttempts: 5, RunAt: base, CreatedAt: base.Add(-3 * time.Hour), UpdatedAt: base},
		{ID: "f2", Type: "x", Status: job.StatusFailed, LastError: "boom", MaxAttempts: 5, RunAt: base, CreatedAt: base.Add(-2 * time.Hour), UpdatedAt: base},
		{ID: "q1", Type: "x", Status: job.StatusQueued, MaxAttempts: 5, RunAt: base, CreatedAt: base.Add(-time.Hour), UpdatedAt: base},
		{ID: "r1", Type: "x", Status: job.StatusRunning, MaxAttempts: 5, RunAt: base, CreatedAt: base, UpdatedAt: base},
	}
	for _, j := range seed {
		if _, err := s.Enqueue(j); err != nil {
			t.Fatal(err)
		}
	}

	failed, err := s.JobsByStatus(job.StatusFailed, 10)
	if err != nil {
		t.Fatal(err)
	}
	if len(failed) != 2 || failed[0].ID != "f2" || failed[1].ID != "f1" {
		t.Fatalf("failed jobs = %+v, want f2, f1 (newest first)", failed)
	}
	if failed[0].LastError != "boom" || failed[0].Type != "x" {
		t.Errorf("lifecycle fields not read back: %+v", failed[0])
	}
	if one, err := s.JobsByStatus(job.StatusFailed, 1); err != nil || len(one) != 1 || one[0].ID != "f2" {
		t.Errorf("limit 1 = %+v (%v), want just f2", one, err)
	}
	if all, err := s.JobsByStatus("", 10); err != nil || len(all) != len(seed) {
		t.Errorf("empty status = %d jobs (%v), want all %d", len(all), err, len(seed))
	}
	// A non-positive limit still returns a bounded page rather than the table.
	if bounded, err := s.JobsByStatus("", 0); err != nil || len(bounded) != len(seed) {
		t.Errorf("limit 0 = %d jobs (%v), want the %d seeded (under the cap)", len(bounded), err, len(seed))
	}

	counts, err := s.JobCounts()
	if err != nil {
		t.Fatal(err)
	}
	if counts[job.StatusFailed] != 2 || counts[job.StatusQueued] != 1 || counts[job.StatusRunning] != 1 || counts[job.StatusDone] != 0 {
		t.Fatalf("counts = %+v, want failed=2 queued=1 running=1 done=0", counts)
	}
}

// The persisted corpus index must survive the round trip exactly: levels
// ascending, artifacts ascending by id, matrices and edge similarities intact
// (the fixture uses float32-exact values so equality is equality, not
// tolerance). Replacement is wholesale, nil clears, and a corrupt edge id
// fails the whole write rather than storing a mangled row.
func TestCorpusIndexRoundTrip(t *testing.T) {
	s := openTemp(t)
	idA := strings.Repeat("aa", 16)
	idB := strings.Repeat("bb", 16)
	idC := strings.Repeat("cc", 16)
	indexes := []knowledge.CorpusLevelIndex{
		{
			Level: 1, Threshold: 0.3, K: 32,
			Basis:     [][]float64{{0.5, -0.25, 0.125}, {0.875, 0.5, -0.5}},
			Centroids: [][]float64{{1.5, 0.25, 0}},
			Artifacts: []knowledge.CorpusIndexArtifact{
				{ID: idA, Cell: 0, Edges: []knowledge.CorpusIndexEdge{{To: idB, Sim: 0.875}}},
				{ID: idB, Cell: 1, Edges: []knowledge.CorpusIndexEdge{{To: idA, Sim: 0.875}}},
			},
		},
		{
			Level: 2, Threshold: 0.5, K: 16,
			Artifacts: []knowledge.CorpusIndexArtifact{{ID: idC, Cell: 3}},
		},
	}
	if err := s.RebuildCorpus("p1", nil, 1, indexes); err != nil {
		t.Fatal(err)
	}
	got, err := s.CorpusIndexes("p1")
	if err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(got, indexes) {
		t.Errorf("round trip changed the index:\ngot  %+v\nwant %+v", got, indexes)
	}
	if other, err := s.CorpusIndexes("p2"); err != nil || other != nil {
		t.Errorf("another project sees %+v, %v; want none", other, err)
	}

	// A corrupt edge id fails the whole write, and the stored state survives.
	bad := []knowledge.CorpusLevelIndex{{
		Level: 1, Threshold: 0.3, K: 8,
		Artifacts: []knowledge.CorpusIndexArtifact{
			{ID: idA, Edges: []knowledge.CorpusIndexEdge{{To: "not-a-lattice-id", Sim: 0.5}}},
		},
	}}
	if err := s.RebuildCorpus("p1", nil, 2, bad); err == nil {
		t.Fatal("a corrupt edge id was accepted")
	}
	if got, err := s.CorpusIndexes("p1"); err != nil || !reflect.DeepEqual(got, indexes) {
		t.Errorf("failed write did not roll back cleanly: %+v, %v", got, err)
	}

	// Replacement is wholesale: a one-level write leaves nothing of level 2.
	replacement := []knowledge.CorpusLevelIndex{{
		Level: 1, Threshold: 0.4, K: 8,
		Artifacts: []knowledge.CorpusIndexArtifact{{ID: idB, Cell: 2}},
	}}
	if err := s.RebuildCorpus("p1", nil, 2, replacement); err != nil {
		t.Fatal(err)
	}
	if got, err := s.CorpusIndexes("p1"); err != nil || !reflect.DeepEqual(got, replacement) {
		t.Errorf("replacement was not wholesale: %+v, %v", got, err)
	}

	// And nil clears.
	if err := s.RebuildCorpus("p1", nil, 3, nil); err != nil {
		t.Fatal(err)
	}
	if got, err := s.CorpusIndexes("p1"); err != nil || got != nil {
		t.Errorf("nil did not clear the index: %+v, %v", got, err)
	}
}

// The probed entry frontier's contract, pinned row by row: an artifact the
// index covers survives only if its cell is probed; an artifact the index
// does not cover ALWAYS survives — the probe may narrow the indexed mass,
// never hide the unindexed remainder.
func TestEntryFrontierProbed(t *testing.T) {
	s := openTemp(t)
	now := time.Now().UTC()
	src := knowledge.Source{
		LocalRefID: "r1", ProjectID: "p1",
		SourceType: knowledge.SourceTypeDocument, SourceID: "d1",
		SizeBytes: 3, LineCount: 1, ContentHash: knowledge.ContentHash("abc"),
		AddedAt: now, SyncedAt: now,
	}
	windows := []knowledge.Window{
		{ID: "w1", LocalRefID: "r1", Ordinal: 0, Start: 0, End: 1, Embedding: []float64{1, 0}},
		{ID: "w2", LocalRefID: "r1", Ordinal: 1, Start: 1, End: 2, Embedding: []float64{0, 1}},
		{ID: "w3", LocalRefID: "r1", Ordinal: 2, Start: 2, End: 3, Embedding: []float64{1, 1}},
	}
	if err := s.ReplaceSources([]knowledge.SourceWrite{{Source: src, Windows: windows}}); err != nil {
		t.Fatal(err)
	}
	// A corpus node the index does not cover (its dangling member keeps every
	// window an orphan), and an index covering w1 and w2 only.
	corpus := []knowledge.Node{{
		ID: "c1", ProjectID: "p1", LocalRefID: "", Level: 2,
		Centroid: []float64{1, 0}, Count: 1, MemberIDs: []string{"wx"}, CreatedAt: now,
	}}
	indexes := []knowledge.CorpusLevelIndex{{
		Level: 1, Threshold: 0.3, K: 8,
		Artifacts: []knowledge.CorpusIndexArtifact{
			{ID: "w1", Cell: 0},
			{ID: "w2", Cell: 1},
		},
	}}
	dirty, _, err := s.CorpusSeq("p1")
	if err != nil {
		t.Fatal(err)
	}
	if err := s.RebuildCorpus("p1", corpus, dirty, indexes); err != nil {
		t.Fatal(err)
	}

	probeIDs := func(cells []int) []string {
		t.Helper()
		got, err := s.EntryFrontierProbed("p1", 1, cells)
		if err != nil {
			t.Fatal(err)
		}
		ids := make([]string, len(got))
		for i, f := range got {
			ids[i] = f.ID
		}
		return ids
	}
	if got := probeIDs([]int{0}); !reflect.DeepEqual(got, []string{"c1", "w1", "w3"}) {
		t.Errorf("probe cell 0 = %v, want [c1 w1 w3]", got)
	}
	if got := probeIDs(nil); !reflect.DeepEqual(got, []string{"c1", "w3"}) {
		t.Errorf("probe no cells = %v, want the uncovered remainder [c1 w3]", got)
	}
	if got := probeIDs([]int{0, 1}); !reflect.DeepEqual(got, []string{"c1", "w1", "w2", "w3"}) {
		t.Errorf("probe all cells = %v, want the full frontier", got)
	}
	hdr, ok, err := s.CorpusIndexHeader("p1", 1)
	if err != nil || !ok || hdr.Threshold != 0.3 || hdr.K != 8 || hdr.Artifacts != nil {
		t.Errorf("header = %+v ok=%v err=%v; want the level machinery without artifacts", hdr, ok, err)
	}
	if _, ok, err := s.CorpusIndexHeader("p1", 9); err != nil || ok {
		t.Errorf("a missing level reported ok=%v err=%v", ok, err)
	}
}
