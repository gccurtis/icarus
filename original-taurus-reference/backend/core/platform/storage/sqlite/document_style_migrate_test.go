package sqlite

import (
	"encoding/json"
	"strings"
	"testing"
	"time"

	"github.com/gccurtis/taurus-omega/core/capability/document"
)

func TestDocumentStyleMigrationScrubsLegacyPayloadsAndIsIdempotent(t *testing.T) {
	path := t.TempDir() + "/legacy-style.db"
	store, err := Open(path)
	if err != nil {
		t.Fatal(err)
	}

	base := document.Base{
		DefaultTypography: &document.CustomTypography{
			FontFamily: "Arial;background:url(//evil.example)",
			Foreground: "#222222",
		},
		Template: &document.TemplateInfo{IsTemplate: true},
		Rows: []document.Row{{
			ID: "r1",
			Blocks: []document.Block{{
				ID:   "b1",
				Kind: document.BlockKindText,
				StyleRef: &document.BlockStyleRef{Overrides: document.StyleOverrides{
					Custom: &document.CustomTypography{FontSize: "calc(100vw)", Background: "#ffffff"},
				}},
				Atoms: []document.Atom{{ID: "a1", Kind: document.AtomKindText, Text: "hello"}},
				Marks: []document.Mark{
					{
						ID: "unsafe", Kind: document.MarkKindLink,
						Attrs: map[string]string{"href": "javascript:alert(1)"},
						Start: document.Anchor{AtomID: "a1", Offset: 0},
						End:   document.Anchor{AtomID: "a1", Offset: 5},
					},
					{
						ID: "bold", Kind: document.MarkKindBold,
						Attrs: map[string]string{"onclick": "evil()"},
						Start: document.Anchor{AtomID: "a1", Offset: 0},
						End:   document.Anchor{AtomID: "a1", Offset: 5},
					},
				},
			}},
		}},
	}
	baseRaw, err := json.Marshal(base)
	if err != nil {
		t.Fatal(err)
	}
	now := time.Now().UTC()
	if _, err := store.db.Exec(
		`INSERT INTO documents(
			id, project_id, name, base, creator_id, creator_name,
			base_seq, revision, created_at, updated_at, lifecycle, trashed_at
		) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', '')`,
		"d1", "p1", "Legacy", string(baseRaw), "u1", "Ada", 0, 1,
		sortableTime(now), sortableTime(now),
	); err != nil {
		t.Fatal(err)
	}

	unsafeMark := document.Mark{
		ID: "pending-unsafe", Kind: document.MarkKindFont,
		Attrs: map[string]string{"family": "Arial;background:url(//evil.example)"},
		Start: document.Anchor{AtomID: "a1", Offset: 0},
		End:   document.Anchor{AtomID: "a1", Offset: 5},
	}
	ops := []document.ChangeOp{
		{Op: document.OpAddMark, BlockID: "b1", Mark: &unsafeMark},
		{
			Op: document.OpSetBlockCustomTypography, BlockID: "b1",
			CustomTypography: &document.CustomTypography{
				FontFamily: "Georgia",
				Foreground: "red;}html{display:none",
			},
		},
	}
	inverse := []document.ChangeOp{{
		Op: document.OpAddMark, BlockID: "b1",
		Mark: &document.Mark{
			ID: "inverse-unsafe", Kind: document.MarkKindLink,
			Attrs: map[string]string{"href": "data:text/html,boom"},
			Start: document.Anchor{AtomID: "a1", Offset: 0},
			End:   document.Anchor{AtomID: "a1", Offset: 5},
		},
	}}
	opsRaw, _ := json.Marshal(ops)
	inverseRaw, _ := json.Marshal(inverse)
	if _, err := store.db.Exec(
		`INSERT INTO change_sets(
			id, document_id, author_id, author_name, submission_id, submission_hash,
			authored_revision, prior_revision, seq, created_at, ops, summary, inverse_ops
		) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '{}', ?)`,
		"c1", "d1", "u1", "Ada", "s1", "hash", 0, 0, 1,
		now.Format(timeLayout), string(opsRaw), string(inverseRaw),
	); err != nil {
		t.Fatal(err)
	}
	receiptRaw, err := json.Marshal(struct {
		ChangeSet document.ChangeSet  `json:"changeSet"`
		Inverse   []document.ChangeOp `json:"inverseOps"`
	}{
		ChangeSet: document.ChangeSet{
			ID: "c1", DocumentID: "d1", AuthorID: "u1", SubmissionID: "s1",
			Ops: ops,
		},
		Inverse: inverse,
	})
	if err != nil {
		t.Fatal(err)
	}
	if _, err := store.db.Exec(
		`INSERT INTO document_submissions(
			document_id, author_id, submission_id, submission_hash, receipt
		) VALUES(?, ?, ?, ?, ?)`,
		"d1", "u1", "s1", "hash", string(receiptRaw),
	); err != nil {
		t.Fatal(err)
	}
	if err := store.Close(); err != nil {
		t.Fatal(err)
	}

	migrated, err := Open(path)
	if err != nil {
		t.Fatal(err)
	}
	report := migrated.documentStyleScrub
	if report.DocumentsChanged != 1 || report.ChangeSetsChanged != 1 || report.SubmissionsChanged != 1 ||
		report.ValuesCleared == 0 || report.MarksRemoved == 0 || report.OperationsRemoved == 0 {
		t.Fatalf("scrub report = %+v", report)
	}
	for _, query := range []string{
		`SELECT base FROM documents WHERE id = 'd1'`,
		`SELECT ops || inverse_ops FROM change_sets WHERE id = 'c1'`,
		`SELECT receipt FROM document_submissions WHERE document_id = 'd1'`,
	} {
		var raw string
		if err := migrated.db.QueryRow(query).Scan(&raw); err != nil {
			t.Fatal(err)
		}
		for _, unsafe := range []string{"javascript:", "data:text/html", "background:url", "calc(100vw)", "display:none", "onclick"} {
			if strings.Contains(raw, unsafe) {
				t.Errorf("migration retained %q in %s", unsafe, raw)
			}
		}
	}

	docs := document.New(migrated, document.Options{})
	got, err := docs.Get("p1", "d1")
	if err != nil {
		t.Fatalf("scrubbed document is not readable: %v", err)
	}
	block := got.Base.Rows[0].Blocks[0]
	if got.Base.DefaultTypography == nil || got.Base.DefaultTypography.FontFamily != "" ||
		got.Base.DefaultTypography.Foreground != "#222222" {
		t.Fatalf("default typography scrub = %+v", got.Base.DefaultTypography)
	}
	if len(block.Marks) != 1 || block.Marks[0].Kind != document.MarkKindBold || len(block.Marks[0].Attrs) != 0 {
		t.Fatalf("base marks scrub = %+v", block.Marks)
	}
	if block.StyleRef == nil || block.StyleRef.Overrides.Custom == nil ||
		block.StyleRef.Overrides.Custom.FontFamily != "Georgia" ||
		block.StyleRef.Overrides.Custom.Foreground != "" {
		t.Fatalf("pending custom typography scrub = %+v", block.StyleRef)
	}
	changeSet, err := docs.ChangeSet("p1", "d1", "c1")
	if err != nil {
		t.Fatalf("scrubbed change set is not readable: %v", err)
	}
	if len(changeSet.Ops) != 1 || changeSet.Ops[0].CustomTypography == nil ||
		changeSet.Ops[0].CustomTypography.FontFamily != "Georgia" ||
		changeSet.Ops[0].CustomTypography.Foreground != "" {
		t.Fatalf("change set style scrub = %+v", changeSet.Ops)
	}
	templates, err := docs.Templates("p1")
	if err != nil || len(templates) != 1 {
		t.Fatalf("scrubbed template listing = %+v, %v", templates, err)
	}
	if err := migrated.Close(); err != nil {
		t.Fatal(err)
	}

	second, err := Open(path)
	if err != nil {
		t.Fatal(err)
	}
	defer second.Close()
	if second.documentStyleScrub.changed() {
		t.Fatalf("second migration was not a no-op: %+v", second.documentStyleScrub)
	}
}
