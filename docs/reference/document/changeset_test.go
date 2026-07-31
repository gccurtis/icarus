package document_test

import (
	"context"
	"crypto/sha256"
	"encoding/json"
	"errors"
	"fmt"
	"reflect"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/gccurtis/taurus-omega/core/capability/document"
	"github.com/gccurtis/taurus-omega/core/platform/job"
)

func strp(s string) *string { return &s }

func textHash(text string) string {
	sum := sha256.Sum256([]byte(text))
	return fmt.Sprintf("%x", sum)
}

func markHash(mark document.Mark) string {
	raw, _ := json.Marshal(mark)
	sum := sha256.Sum256(raw)
	return fmt.Sprintf("%x", sum)
}

var testSubmissionSeq atomic.Int64

func submitChanges(
	d *document.Documents,
	projectID, documentID, authorID string,
	ops []document.ChangeOp,
	actorNames ...string,
) (document.ChangeSet, error) {
	doc, err := d.Get(projectID, documentID)
	if err != nil {
		return document.ChangeSet{}, err
	}
	return d.SubmitChanges(projectID, documentID, authorID, document.ChangeSubmission{
		SubmissionID:     fmt.Sprintf("test-submission-%d", testSubmissionSeq.Add(1)),
		ExpectedRevision: doc.Revision,
		Operations:       ops,
	}, actorNames...)
}

// spyEnqueuer records enqueued jobs without running them.
type spyEnqueuer struct{ jobs []spyJob }

type spyJob struct {
	typ     string
	payload any
}

// appendGateStore holds the first two append attempts at the storage boundary,
// forcing both exact submissions to validate against the same revision.
type appendGateStore struct {
	*document.MemoryStore
	calls   atomic.Int32
	arrived chan struct{}
	release chan struct{}
}

func newAppendGateStore() *appendGateStore {
	return &appendGateStore{
		MemoryStore: document.NewMemoryStore(),
		arrived:     make(chan struct{}, 2),
		release:     make(chan struct{}),
	}
}

func (s *appendGateStore) AppendChangeSet(cs document.ChangeSet, expectedRevision int64, fact document.ActivityFact) (document.ChangeSet, error) {
	if s.calls.Add(1) <= 2 {
		s.arrived <- struct{}{}
		<-s.release
	}
	return s.MemoryStore.AppendChangeSet(cs, expectedRevision, fact)
}

func (e *spyEnqueuer) Enqueue(ctx context.Context, typ string, payload any) (job.Job, error) {
	e.jobs = append(e.jobs, spyJob{typ: typ, payload: payload})
	return job.Job{ID: "spy"}, nil
}

// oneAtomDoc is a base with one row, one paragraph block "b1" and one text atom
// "a1" holding the given text.
func oneAtomDoc(text string) document.Base {
	return document.Base{Rows: []document.Row{
		{ID: "r1", Blocks: []document.Block{
			{ID: "b1", Kind: "text", Atoms: []document.Atom{{ID: "a1", Kind: "text", Text: text}}},
		}},
	}}
}

func TestChangeSetOpsResolve(t *testing.T) {
	d := newDocs()
	doc, err := d.Create("p", "Doc", oneAtomDoc("hello"))
	if err != nil {
		t.Fatal(err)
	}

	changes := [][]document.ChangeOp{
		// Edit the atom's text.
		{{Op: document.OpSetAtomText, BlockID: "b1", AtomID: "a1", SetText: strp("world")}},
		// Add a second atom after it.
		{{Op: document.OpInsertAtom, BlockID: "b1", AfterAtom: "a1", Atom: &document.Atom{ID: "a2", Kind: "text", Text: "!"}}},
		// Add a heading block after b1.
		{{Op: document.OpInsertBlock, RowID: "r1", AfterBlock: "b1", Block: &document.Block{ID: "b2", Kind: "text", SubKind: "heading_1", Atoms: []document.Atom{{ID: "a0", Kind: "text", Text: "Title"}}}}},
		// Bold the whole first atom.
		{{Op: document.OpAddMark, BlockID: "b1", Mark: &document.Mark{ID: "m1", Kind: document.MarkKindBold, Start: document.Anchor{AtomID: "a1", Offset: 0}, End: document.Anchor{AtomID: "a1", Offset: 5}}}},
	}
	for _, ops := range changes {
		if _, err := submitChanges(d, "p", doc.ID, "u1", ops); err != nil {
			t.Fatalf("append: %v", err)
		}
	}

	got, err := d.Get("p", doc.ID)
	if err != nil {
		t.Fatal(err)
	}
	blocks := got.Base.Rows[0].Blocks
	if len(blocks) != 2 || blocks[0].ID != "b1" || blocks[1].ID != "b2" {
		t.Fatalf("blocks = %+v", blocks)
	}
	if dt := blocks[0].DisplayText(); dt != "world!" {
		t.Errorf("b1 display text = %q, want %q", dt, "world!")
	}
	if blocks[1].Kind != "text" || blocks[1].SubKind != "heading_1" || blocks[1].DisplayText() != "Title" {
		t.Errorf("b2 = %+v", blocks[1])
	}
	if len(blocks[0].Marks) != 1 || blocks[0].Marks[0].Kind != document.MarkKindBold {
		t.Errorf("marks = %+v", blocks[0].Marks)
	}

	// Delete the second atom and the heading block.
	if _, err := submitChanges(d, "p", doc.ID, "u1", []document.ChangeOp{
		{Op: document.OpDeleteAtom, BlockID: "b1", AtomID: "a2"},
		{Op: document.OpDeleteBlock, BlockID: "b2"},
	}); err != nil {
		t.Fatal(err)
	}
	got, _ = d.Get("p", doc.ID)
	blocks = got.Base.Rows[0].Blocks
	if len(blocks) != 1 || blocks[0].DisplayText() != "world" {
		t.Errorf("after deletes = %+v", blocks)
	}
	// The bold mark still fits a1 ("world", 5 bytes), so it survives.
	if len(blocks[0].Marks) != 1 {
		t.Errorf("mark should survive: %+v", blocks[0].Marks)
	}
}

func TestSetAtomTextDropsInvalidatedMark(t *testing.T) {
	d := newDocs()
	base := oneAtomDoc("hello")
	base.Rows[0].Blocks[0].Marks = []document.Mark{
		{ID: "m1", Kind: document.MarkKindBold, Start: document.Anchor{AtomID: "a1", Offset: 0}, End: document.Anchor{AtomID: "a1", Offset: 5}},
	}
	doc, _ := d.Create("p", "Doc", base)

	// Shrink the text so the mark's end (5) no longer fits: the mark is dropped.
	if _, err := submitChanges(d, "p", doc.ID, "u", []document.ChangeOp{
		{Op: document.OpSetAtomText, BlockID: "b1", AtomID: "a1", SetText: strp("hi")},
	}); err != nil {
		t.Fatal(err)
	}
	got, _ := d.Get("p", doc.ID)
	if b := got.Base.Rows[0].Blocks[0]; b.DisplayText() != "hi" || len(b.Marks) != 0 {
		t.Errorf("block = %+v (want text hi, no marks)", b)
	}
}

func TestBlockKinds(t *testing.T) {
	d := newDocs()

	// Create with an unknown block kind fails closed.
	bad := oneAtomDoc("x")
	bad.Rows[0].Blocks[0].Kind = "bogus"
	if _, err := d.Create("p", "Doc", bad); !errors.Is(err, document.ErrInvalidContent) {
		t.Errorf("create bad kind: got %v, want ErrInvalidContent", err)
	}

	doc, _ := d.Create("p", "Doc", oneAtomDoc("x"))
	// set_block_subkind converts a text block to a heading sub-kind in place.
	if _, err := submitChanges(d, "p", doc.ID, "u", []document.ChangeOp{
		{Op: document.OpSetBlockSubkind, BlockID: "b1", SetSubKind: strp(document.SubKindHeading2)},
	}); err != nil {
		t.Fatalf("set heading sub-kind: %v", err)
	}
	if got, _ := d.Get("p", doc.ID); got.Base.Rows[0].Blocks[0].SubKind != document.SubKindHeading2 {
		t.Errorf("subKind = %q, want heading_2", got.Base.Rows[0].Blocks[0].SubKind)
	}
	// set_block to an unknown kind is rejected as invalid.
	if _, err := submitChanges(d, "p", doc.ID, "u", []document.ChangeOp{
		{Op: document.OpSetBlock, BlockID: "b1", SetKind: strp("bogus")},
	}); !errors.Is(err, document.ErrInvalidChangeSet) {
		t.Errorf("set bad kind: got %v, want ErrInvalidChangeSet", err)
	}
}

func TestChangeSetValidationScopeAndAuthor(t *testing.T) {
	d := newDocs()
	doc, _ := d.Create("p", "Doc", oneAtomDoc(""))

	if _, err := submitChanges(d, "p", doc.ID, "u1", nil); !errors.Is(err, document.ErrInvalidChangeSet) {
		t.Errorf("empty ops: got %v, want ErrInvalidChangeSet", err)
	}
	if _, err := submitChanges(d, "p", doc.ID, "u1", []document.ChangeOp{{Op: "bogus"}}); !errors.Is(err, document.ErrInvalidChangeSet) {
		t.Errorf("unknown op: got %v, want ErrInvalidChangeSet", err)
	}
	if _, err := submitChanges(d, "other", doc.ID, "u1", []document.ChangeOp{{Op: document.OpDeleteAtom, BlockID: "b1", AtomID: "a1"}}); !errors.Is(err, document.ErrNotFound) {
		t.Errorf("cross-project: got %v, want ErrNotFound", err)
	}

	cs, err := submitChanges(d, "p", doc.ID, "author-9", []document.ChangeOp{{Op: document.OpSetAtomText, BlockID: "b1", AtomID: "a1", SetText: strp("x")}})
	if err != nil {
		t.Fatal(err)
	}
	if cs.AuthorID != "author-9" || cs.Seq < 1 {
		t.Errorf("changeset = %+v (want authorId author-9, seq>=1)", cs)
	}
}

func TestChangeSubmissionIsExactAndIdempotent(t *testing.T) {
	store := document.NewMemoryStore()
	docs := document.New(store, document.Options{})
	doc, err := docs.Create("p", "Doc", oneAtomDoc("hello"))
	if err != nil {
		t.Fatal(err)
	}

	invalid := document.ChangeSubmission{
		ExpectedRevision: 0,
		Operations: []document.ChangeOp{{
			Op: document.OpDeleteAtom, BlockID: "b1", AtomID: "a1",
		}},
	}
	if _, err := docs.SubmitChanges("p", doc.ID, "u1", invalid); !errors.Is(err, document.ErrInvalidSubmission) {
		t.Fatalf("missing submission id err = %v", err)
	}
	invalid.SubmissionID = "bad-revision"
	invalid.ExpectedRevision = -1
	if _, err := docs.SubmitChanges("p", doc.ID, "u1", invalid); !errors.Is(err, document.ErrInvalidSubmission) {
		t.Fatalf("negative revision err = %v", err)
	}

	submission := document.ChangeSubmission{
		SubmissionID: "insert-generated-content", ExpectedRevision: 0,
		Operations: []document.ChangeOp{{
			Op: document.OpInsertRow, AfterRow: "r1",
			Row: &document.Row{Blocks: []document.Block{{
				Kind:  document.BlockKindText,
				Atoms: []document.Atom{{Kind: document.AtomKindText, Text: "second"}},
			}}},
		}},
	}
	first, err := docs.SubmitChanges("p", doc.ID, "u1", submission, "Ada")
	if err != nil {
		t.Fatal(err)
	}
	if first.SubmissionID != submission.SubmissionID || first.PriorRevision != 0 ||
		first.Seq != 1 || first.ID == "" || first.Ops[0].Row.ID == "" ||
		first.Ops[0].Row.Blocks[0].ID == "" || first.Ops[0].Row.Blocks[0].Atoms[0].ID == "" {
		t.Fatalf("accepted change = %+v", first)
	}

	// The retry carries the original unassigned payload. It still returns the
	// exact stored ChangeSet, including the IDs generated during first admission.
	retried, err := docs.SubmitChanges("p", doc.ID, "u1", submission, "Ada")
	if err != nil || !reflect.DeepEqual(retried, first) {
		t.Fatalf("identical retry = %+v, %v; want %+v", retried, err, first)
	}
	if got, _ := docs.Get("p", doc.ID); got.Revision != 1 || len(got.Base.Rows) != 2 {
		t.Fatalf("retry changed document = %+v", got)
	}
	if facts := store.ActivityFacts(); len(facts) != 2 {
		t.Fatalf("retry activity = %+v; want create + one edit", facts)
	}

	different := submission
	different.Operations = []document.ChangeOp{{
		Op: document.OpSetAtomText, BlockID: "b1", AtomID: "a1", SetText: strp("different"),
	}}
	_, err = docs.SubmitChanges("p", doc.ID, "u1", different)
	var reused *document.AdmissionConflict
	if !errors.Is(err, document.ErrSubmissionConflict) || !errors.As(err, &reused) ||
		reused.Code != document.ConflictCodeSubmission || reused.CurrentRevision != 1 {
		t.Fatalf("reused id err = %#v", err)
	}

	stale := different
	stale.SubmissionID = "stale-non-overlap"
	rebased, err := docs.SubmitChanges("p", doc.ID, "u1", stale)
	if err != nil || rebased.AuthoredRevision != 0 || rebased.PriorRevision != 1 ||
		rebased.Seq != 2 {
		t.Fatalf("safe stale revision = %+v, %v", rebased, err)
	}
	history, err := docs.History("p", doc.ID, "u1", document.HistoryRequest{Limit: 1})
	if err != nil || len(history.Entries) != 1 ||
		history.Entries[0].AuthoredRevision != 0 ||
		history.Entries[0].PriorRevision != 1 {
		t.Fatalf("rebased history = %+v, %v", history, err)
	}

	overlap := stale
	overlap.SubmissionID = "stale-overlap"
	overlap.Operations = []document.ChangeOp{{
		Op: document.OpSetAtomText, BlockID: "b1", AtomID: "a1", SetText: strp("overlap"),
	}}
	_, err = docs.SubmitChanges("p", doc.ID, "u1", overlap)
	var revision *document.AdmissionConflict
	if !errors.Is(err, document.ErrRevisionConflict) || !errors.As(err, &revision) ||
		revision.Code != document.ConflictCodeRevision ||
		revision.ExpectedRevision != 0 || revision.CurrentRevision != 2 ||
		revision.ResyncRevision != 2 {
		t.Fatalf("stale revision err = %#v", err)
	}
	if sets, _ := store.ChangeSetsSince(doc.ID, 0); len(sets) != 2 {
		t.Fatalf("conflicts wrote revisions = %+v", sets)
	}
}

func TestChangeSetRejectsMissingOrDuplicateID(t *testing.T) {
	d := newDocs()
	base := oneAtomDoc("hello")
	base.Rows[0].Blocks[0].Marks = []document.Mark{
		{ID: "m1", Kind: document.MarkKindBold, Start: document.Anchor{AtomID: "a1", Offset: 0}, End: document.Anchor{AtomID: "a1", Offset: 5}},
	}
	doc, _ := d.Create("p", "Doc", base)

	bold := func(start, end int, atom string) *document.Mark {
		return &document.Mark{Kind: document.MarkKindBold, Start: document.Anchor{AtomID: atom, Offset: start}, End: document.Anchor{AtomID: atom, Offset: end}}
	}
	cases := []struct {
		name string
		op   document.ChangeOp
	}{
		{"set missing atom", document.ChangeOp{Op: document.OpSetAtomText, BlockID: "b1", AtomID: "nope", SetText: strp("y")}},
		{"set atom in missing block", document.ChangeOp{Op: document.OpSetAtomText, BlockID: "nope", AtomID: "a1", SetText: strp("y")}},
		{"delete missing atom", document.ChangeOp{Op: document.OpDeleteAtom, BlockID: "b1", AtomID: "nope"}},
		{"delete missing block", document.ChangeOp{Op: document.OpDeleteBlock, BlockID: "nope"}},
		{"delete missing row", document.ChangeOp{Op: document.OpDeleteRow, RowID: "nope"}},
		{"insert atom into missing block", document.ChangeOp{Op: document.OpInsertAtom, BlockID: "nope", Atom: &document.Atom{ID: "a9", Kind: "text"}}},
		{"insert atom after missing anchor", document.ChangeOp{Op: document.OpInsertAtom, BlockID: "b1", AfterAtom: "nope", Atom: &document.Atom{ID: "a9", Kind: "text"}}},
		{"insert block into missing row", document.ChangeOp{Op: document.OpInsertBlock, RowID: "nope", Block: &document.Block{ID: "b9", Kind: "text"}}},
		{"insert block after missing anchor", document.ChangeOp{Op: document.OpInsertBlock, RowID: "r1", AfterBlock: "nope", Block: &document.Block{ID: "b9", Kind: "text"}}},
		{"duplicate row id", document.ChangeOp{Op: document.OpInsertRow, Row: &document.Row{ID: "r1"}}},
		{"duplicate block id", document.ChangeOp{Op: document.OpInsertBlock, RowID: "r1", Block: &document.Block{ID: "b1", Kind: "text"}}},
		{"duplicate atom id", document.ChangeOp{Op: document.OpInsertAtom, BlockID: "b1", Atom: &document.Atom{ID: "a1", Kind: "text"}}},
		{"mark on missing block", document.ChangeOp{Op: document.OpAddMark, BlockID: "nope", Mark: bold(0, 1, "a1")}},
		{"mark over missing atom", document.ChangeOp{Op: document.OpAddMark, BlockID: "b1", Mark: bold(0, 1, "nope")}},
		{"mark offset out of range", document.ChangeOp{Op: document.OpAddMark, BlockID: "b1", Mark: bold(0, 99, "a1")}},
		{"mark empty range", document.ChangeOp{Op: document.OpAddMark, BlockID: "b1", Mark: bold(2, 2, "a1")}},
		{"duplicate mark id", document.ChangeOp{Op: document.OpAddMark, BlockID: "b1", Mark: &document.Mark{ID: "m1", Kind: document.MarkKindBold, Start: document.Anchor{AtomID: "a1", Offset: 0}, End: document.Anchor{AtomID: "a1", Offset: 1}}}},
		{"remove missing mark", document.ChangeOp{Op: document.OpRemoveMark, BlockID: "b1", MarkID: "nope"}},
	}
	for _, tc := range cases {
		if _, err := submitChanges(d, "p", doc.ID, "u", []document.ChangeOp{tc.op}); !errors.Is(err, document.ErrConflict) {
			t.Errorf("%s: got %v, want ErrConflict", tc.name, err)
		}
	}

	// Every change was rejected, so the document is unchanged.
	got, _ := d.Get("p", doc.ID)
	b := got.Base.Rows[0].Blocks[0]
	if len(got.Base.Rows[0].Blocks) != 1 || len(b.Atoms) != 1 || b.DisplayText() != "hello" || len(b.Marks) != 1 {
		t.Errorf("document changed despite rejected changes: %+v", got.Base.Rows[0].Blocks)
	}
}

func TestConcurrentExactRevisionAdmission(t *testing.T) {
	t.Run("distinct non-overlapping submissions rebase safely", func(t *testing.T) {
		store := newAppendGateStore()
		docs := document.New(store, document.Options{})
		doc, err := docs.Create("p", "Doc", oneAtomDoc("hello"))
		if err != nil {
			t.Fatal(err)
		}

		results := make(chan document.ChangeSet, 2)
		errs := make(chan error, 2)
		text := "world"
		go func() {
			cs, err := docs.SubmitChanges("p", doc.ID, "u1", document.ChangeSubmission{
				SubmissionID: "concurrent-text", ExpectedRevision: 0,
				Operations: []document.ChangeOp{{
					Op: document.OpSetAtomText, BlockID: "b1", AtomID: "a1", SetText: &text,
				}},
			})
			results <- cs
			errs <- err
		}()
		go func() {
			cs, err := docs.SubmitChanges("p", doc.ID, "u2", document.ChangeSubmission{
				SubmissionID: "concurrent-row", ExpectedRevision: 0,
				Operations: []document.ChangeOp{{
					Op: document.OpInsertRow, AfterRow: "r1",
					Row: &document.Row{ID: "r2", Blocks: []document.Block{{
						ID: "b2", Kind: document.BlockKindText,
						Atoms: []document.Atom{{ID: "a2", Kind: document.AtomKindText, Text: "second"}},
					}}},
				}},
			})
			results <- cs
			errs <- err
		}()

		<-store.arrived
		<-store.arrived
		close(store.release)
		for range 2 {
			if err := <-errs; err != nil {
				t.Fatalf("concurrent submission: %v", err)
			}
		}
		first, second := <-results, <-results
		accepted := []document.ChangeSet{first, second}
		for _, cs := range accepted {
			if cs.AuthoredRevision != 0 {
				t.Fatalf("authored revision = %+v", cs)
			}
		}
		if (first.PriorRevision != 0 || second.PriorRevision != 1) &&
			(first.PriorRevision != 1 || second.PriorRevision != 0) {
			t.Fatalf("admission revisions = %+v / %+v", first, second)
		}

		got, err := docs.Get("p", doc.ID)
		if err != nil {
			t.Fatal(err)
		}
		if got.Revision != 2 || len(got.Base.Rows) != 2 ||
			got.Base.Rows[0].Blocks[0].DisplayText() != "world" {
			t.Fatalf("resolved document = %+v", got)
		}
		sets, err := store.ChangeSetsSince(doc.ID, 0)
		if err != nil || len(sets) != 2 {
			t.Fatalf("stored revisions = %+v, %v", sets, err)
		}
	})

	t.Run("identical concurrent retry is stored once", func(t *testing.T) {
		store := newAppendGateStore()
		docs := document.New(store, document.Options{})
		doc, err := docs.Create("p", "Doc", oneAtomDoc("hello"))
		if err != nil {
			t.Fatal(err)
		}

		results := make(chan document.ChangeSet, 2)
		errs := make(chan error, 2)
		submission := document.ChangeSubmission{
			SubmissionID: "same-request", ExpectedRevision: 0,
			Operations: []document.ChangeOp{{
				Op: document.OpInsertRow,
				Row: &document.Row{Blocks: []document.Block{{
					Kind:  document.BlockKindText,
					Atoms: []document.Atom{{Kind: document.AtomKindText, Text: "second"}},
				}}},
			}},
		}
		submit := func() {
			cs, err := docs.SubmitChanges("p", doc.ID, "u1", submission)
			results <- cs
			errs <- err
		}
		go submit()
		go submit()

		<-store.arrived
		<-store.arrived
		close(store.release)
		for range 2 {
			if err := <-errs; err != nil {
				t.Fatalf("identical retry: %v", err)
			}
		}
		first, second := <-results, <-results
		if first.ID == "" || first.ID != second.ID || first.Seq != 1 || second.Seq != 1 {
			t.Fatalf("retry results = %+v / %+v", first, second)
		}

		got, err := docs.Get("p", doc.ID)
		if err != nil || got.Revision != 1 || len(got.Base.Rows) != 2 {
			t.Fatalf("resolved document = %+v, %v", got, err)
		}
		if facts := store.ActivityFacts(); len(facts) != 2 {
			t.Fatalf("activity facts = %+v; want create + one edit", facts)
		}
	})
}

func TestConcurrentSemanticRebaseProofBoundaries(t *testing.T) {
	base := func() document.Base {
		return document.Base{Rows: []document.Row{
			{ID: "r1", Blocks: []document.Block{{
				ID: "b1", Kind: document.BlockKindText,
				Atoms: []document.Atom{{ID: "a1", Kind: document.AtomKindText, Text: "abcdef"}},
				Marks: []document.Mark{{
					ID: "m1", Kind: document.MarkKindBold,
					Start: document.Anchor{AtomID: "a1", Offset: 0},
					End:   document.Anchor{AtomID: "a1", Offset: 6},
				}},
			}}},
			{ID: "r2", Blocks: []document.Block{{
				ID: "b2", Kind: document.BlockKindText,
				Atoms: []document.Atom{{ID: "a2", Kind: document.AtomKindText, Text: "second"}},
			}}},
			{ID: "r3", Blocks: []document.Block{{
				ID: "b3", Kind: document.BlockKindText,
				Atoms: []document.Atom{{ID: "a3", Kind: document.AtomKindText, Text: "third"}},
			}}},
		}}
	}
	type testCase struct {
		name      string
		left      func() []document.ChangeOp
		right     func() []document.ChangeOp
		successes int
		verify    func(*testing.T, document.Document)
	}
	cases := []testCase{
		{
			name: "disjoint text ranges converge",
			left: func() []document.ChangeOp {
				return []document.ChangeOp{{
					Op: document.OpSpliceAtomText, BlockID: "b1", AtomID: "a1",
					StartOffset: 0, EndOffset: 1, InsertText: strp("AA"),
					ExpectedTextHash: textHash("abcdef"),
				}}
			},
			right: func() []document.ChangeOp {
				return []document.ChangeOp{{
					Op: document.OpSpliceAtomText, BlockID: "b1", AtomID: "a1",
					StartOffset: 4, EndOffset: 5, InsertText: strp(""),
					ExpectedTextHash: textHash("abcdef"),
				}}
			},
			successes: 2,
			verify: func(t *testing.T, got document.Document) {
				block := got.Base.Rows[0].Blocks[0]
				if text := block.DisplayText(); text != "AAbcdf" {
					t.Fatalf("rebased text = %q, want AAbcdf", text)
				}
				if len(block.Marks) != 1 || block.Marks[0].End.Offset != 6 {
					t.Fatalf("rebased marks = %+v", block.Marks)
				}
			},
		},
		{
			name: "overlapping text ranges conflict",
			left: func() []document.ChangeOp {
				return []document.ChangeOp{{
					Op: document.OpSpliceAtomText, BlockID: "b1", AtomID: "a1",
					StartOffset: 1, EndOffset: 3, InsertText: strp("X"),
					ExpectedTextHash: textHash("abcdef"),
				}}
			},
			right: func() []document.ChangeOp {
				return []document.ChangeOp{{
					Op: document.OpSpliceAtomText, BlockID: "b1", AtomID: "a1",
					StartOffset: 2, EndOffset: 4, InsertText: strp("Y"),
					ExpectedTextHash: textHash("abcdef"),
				}}
			},
			successes: 1,
		},
		{
			name: "destructive structure conflicts with descendant text",
			left: func() []document.ChangeOp {
				return []document.ChangeOp{{Op: document.OpDeleteBlock, BlockID: "b1"}}
			},
			right: func() []document.ChangeOp {
				return []document.ChangeOp{{
					Op: document.OpSpliceAtomText, BlockID: "b1", AtomID: "a1",
					StartOffset: 0, EndOffset: 1, InsertText: strp("A"),
					ExpectedTextHash: textHash("abcdef"),
				}}
			},
			successes: 1,
		},
		{
			name: "same style property conflicts",
			left: func() []document.ChangeOp {
				height := document.LayoutUnit(10)
				return []document.ChangeOp{{
					Op: document.OpSetBlockLineHeight, BlockID: "b1", LineHeight: &height,
				}}
			},
			right: func() []document.ChangeOp {
				height := document.LayoutUnit(20)
				return []document.ChangeOp{{
					Op: document.OpSetBlockLineHeight, BlockID: "b1", LineHeight: &height,
				}}
			},
			successes: 1,
		},
		{
			name: "independent alignment axes converge",
			left: func() []document.ChangeOp {
				value := document.HorizontalAlignCenter
				return []document.ChangeOp{{
					Op: document.OpSetBlockAlignment, BlockID: "b1", HorizontalAlign: &value,
				}}
			},
			right: func() []document.ChangeOp {
				value := document.VerticalAlignBottom
				return []document.ChangeOp{{
					Op: document.OpSetBlockAlignment, BlockID: "b1", VerticalAlign: &value,
				}}
			},
			successes: 2,
			verify: func(t *testing.T, got document.Document) {
				style := got.Base.Rows[0].Blocks[0].Style
				if style.HorizontalAlign != document.HorizontalAlignCenter ||
					style.VerticalAlign != document.VerticalAlignBottom {
					t.Fatalf("rebased alignment = %+v", style)
				}
			},
		},
		{
			name: "same ordering container conflicts",
			left: func() []document.ChangeOp {
				return []document.ChangeOp{{
					Op: document.OpMoveRow, RowID: "r3", FromAfterRow: "r2", AfterRow: "",
				}}
			},
			right: func() []document.ChangeOp {
				return []document.ChangeOp{{
					Op: document.OpMoveRow, RowID: "r2", FromAfterRow: "r1", AfterRow: "",
				}}
			},
			successes: 1,
		},
	}

	for caseIndex, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			store := newAppendGateStore()
			docs := document.New(store, document.Options{})
			doc, err := docs.Create("p", "Doc", base())
			if err != nil {
				t.Fatal(err)
			}
			type result struct {
				cs  document.ChangeSet
				err error
			}
			results := make(chan result, 2)
			submit := func(author, submissionID string, ops []document.ChangeOp) {
				cs, err := docs.SubmitChanges("p", doc.ID, author, document.ChangeSubmission{
					SubmissionID: submissionID, ExpectedRevision: 0, Operations: ops,
				})
				results <- result{cs: cs, err: err}
			}
			go submit("u1", fmt.Sprintf("proof-left-%d", caseIndex), tc.left())
			go submit("u2", fmt.Sprintf("proof-right-%d", caseIndex), tc.right())

			<-store.arrived
			<-store.arrived
			close(store.release)

			successes, conflicts := 0, 0
			for range 2 {
				result := <-results
				switch {
				case result.err == nil:
					successes++
					if result.cs.AuthoredRevision != 0 {
						t.Fatalf("authored revision = %+v", result.cs)
					}
				case errors.Is(result.err, document.ErrRevisionConflict):
					conflicts++
					var admission *document.AdmissionConflict
					if !errors.As(result.err, &admission) ||
						admission.CurrentRevision != 1 ||
						admission.ResyncRevision != 1 {
						t.Fatalf("revision conflict = %#v", result.err)
					}
				default:
					t.Fatalf("submission error = %v", result.err)
				}
			}
			if successes != tc.successes || conflicts != 2-tc.successes {
				t.Fatalf("successes=%d conflicts=%d", successes, conflicts)
			}
			got, err := docs.Get("p", doc.ID)
			if err != nil || got.Revision != int64(tc.successes) {
				t.Fatalf("resolved document = %+v, %v", got, err)
			}
			if tc.verify != nil {
				tc.verify(t, got)
			}
		})
	}
}

func TestSemanticRebaseFailsClosedWithoutAuthoredBase(t *testing.T) {
	store := document.NewMemoryStore()
	docs := document.New(store, document.Options{})
	doc, err := docs.Create("p", "Doc", oneAtomDoc("hello"))
	if err != nil {
		t.Fatal(err)
	}
	if _, err := docs.SubmitChanges("p", doc.ID, "u1", document.ChangeSubmission{
		SubmissionID: "folded-row", ExpectedRevision: 0,
		Operations: []document.ChangeOp{{
			Op: document.OpInsertRow, AfterRow: "r1",
			Row: &document.Row{ID: "r2", Blocks: []document.Block{{
				ID: "b2", Kind: document.BlockKindText,
				Atoms: []document.Atom{{ID: "a2", Kind: document.AtomKindText, Text: "second"}},
			}}},
		}},
	}); err != nil {
		t.Fatal(err)
	}
	if err := docs.Rebase(context.Background(), "p", doc.ID); err != nil {
		t.Fatal(err)
	}

	text := "safe but no longer provable"
	_, err = docs.SubmitChanges("p", doc.ID, "u2", document.ChangeSubmission{
		SubmissionID: "older-than-base", ExpectedRevision: 0,
		Operations: []document.ChangeOp{{
			Op: document.OpSetAtomText, BlockID: "b1", AtomID: "a1", SetText: &text,
		}},
	})
	var admission *document.AdmissionConflict
	if !errors.Is(err, document.ErrRevisionConflict) ||
		!errors.As(err, &admission) || admission.CurrentRevision != 1 {
		t.Fatalf("folded proof err = %#v", err)
	}
	if got, _ := docs.Get("p", doc.ID); got.Revision != 1 ||
		got.Base.Rows[0].Blocks[0].DisplayText() != "hello" {
		t.Fatalf("folded conflict changed document = %+v", got)
	}
}

func TestHistoryPagesSummariesAndRetainedDetail(t *testing.T) {
	docs := newDocs()
	doc, err := docs.Create("p", "Doc", oneAtomDoc("start"))
	if err != nil {
		t.Fatal(err)
	}
	first, err := submitChanges(docs, "p", doc.ID, "u1", []document.ChangeOp{{
		Op: document.OpSetAtomText, BlockID: "b1", AtomID: "a1", SetText: strp("first"),
	}}, "Ada")
	if err != nil {
		t.Fatal(err)
	}
	second, err := submitChanges(docs, "p", doc.ID, "u2", []document.ChangeOp{{
		Op: document.OpInsertRow, AfterRow: "r1",
		Row: &document.Row{ID: "r2", Blocks: []document.Block{{
			ID: "b2", Kind: document.BlockKindText,
			Atoms: []document.Atom{{ID: "a2", Kind: document.AtomKindText, Text: "second"}},
		}}},
	}}, "Bea")
	if err != nil {
		t.Fatal(err)
	}
	third, err := submitChanges(docs, "p", doc.ID, "u1", []document.ChangeOp{{
		Op: document.OpAddMark, BlockID: "b1",
		Mark: &document.Mark{
			ID: "m1", Kind: document.MarkKindBold,
			Start: document.Anchor{AtomID: "a1", Offset: 0},
			End:   document.Anchor{AtomID: "a1", Offset: 5},
		},
	}}, "Ada")
	if err != nil {
		t.Fatal(err)
	}

	page, err := docs.History("p", doc.ID, "u1", document.HistoryRequest{Limit: 2})
	if err != nil || len(page.Entries) != 2 || page.NextCursor == "" {
		t.Fatalf("first history page = %+v, %v", page, err)
	}
	head := page.Entries[0]
	if head.ID != third.ID || head.Revision != 3 || head.AuthoredRevision != 2 ||
		head.PriorRevision != 2 ||
		head.Author != (document.Actor{ID: "u1", Name: "Ada"}) ||
		!head.DetailAvailable || !head.CanUndo || head.CanRedo ||
		head.Summary.OperationCount != 1 ||
		!reflect.DeepEqual(head.Summary.OperationTypes, []document.OpType{document.OpAddMark}) ||
		!reflect.DeepEqual(head.Summary.Affected.BlockIDs, []string{"b1"}) ||
		!reflect.DeepEqual(head.Summary.Affected.AtomIDs, []string{"a1"}) ||
		!reflect.DeepEqual(head.Summary.Affected.MarkIDs, []string{"m1"}) {
		t.Fatalf("head history entry = %+v", head)
	}
	if page.Entries[1].ID != second.ID || page.Entries[1].Author.Name != "Bea" ||
		page.Entries[1].CanUndo || page.Entries[1].CanRedo {
		t.Fatalf("second history entry = %+v", page.Entries[1])
	}
	older, err := docs.History("p", doc.ID, "u1", document.HistoryRequest{
		Limit: 2, Cursor: page.NextCursor,
	})
	if err != nil || len(older.Entries) != 1 || older.Entries[0].ID != first.ID ||
		older.NextCursor != "" {
		t.Fatalf("older history page = %+v, %v", older, err)
	}
	detail, err := docs.ChangeSet("p", doc.ID, second.ID)
	if err != nil || detail.ID != second.ID || detail.AuthorName != "Bea" ||
		detail.Summary.OperationCount != 1 || len(detail.InverseOps) == 0 {
		t.Fatalf("retained detail = %+v, %v", detail, err)
	}
	if _, err := docs.ChangeSet("other", doc.ID, second.ID); !errors.Is(err, document.ErrNotFound) {
		t.Fatalf("cross-project detail err = %v", err)
	}
	if _, err := docs.ChangeSet("p", doc.ID, "missing"); !errors.Is(err, document.ErrChangeSetNotFound) {
		t.Fatalf("missing detail err = %v", err)
	}
	if _, err := docs.History("p", doc.ID, "u1", document.HistoryRequest{Limit: document.MaxHistoryLimit + 1}); !errors.Is(err, document.ErrInvalidHistoryLimit) {
		t.Fatalf("invalid history limit err = %v", err)
	}
	if _, err := docs.History("p", doc.ID, "u1", document.HistoryRequest{Cursor: "bad"}); !errors.Is(err, document.ErrInvalidHistoryCursor) {
		t.Fatalf("invalid history cursor err = %v", err)
	}
	otherDoc, _ := docs.Create("p", "Other", oneAtomDoc("x"))
	if _, err := docs.History("p", otherDoc.ID, "u1", document.HistoryRequest{Cursor: page.NextCursor}); !errors.Is(err, document.ErrInvalidHistoryCursor) {
		t.Fatalf("cross-document history cursor err = %v", err)
	}

	var many []document.ChangeOp
	for i := 0; i < document.MaxAffectedIDsPerKind+3; i++ {
		many = append(many, document.ChangeOp{
			Op: document.OpDeleteRow, RowID: fmt.Sprintf("row-%02d", i),
		})
	}
	many = append(many, document.ChangeOp{
		Op: document.OpDeleteBlock, BlockID: strings.Repeat("x", document.MaxAffectedIDBytes+1),
	})
	summary := document.SummarizeChangeOps(many)
	if !summary.Truncated || len(summary.Affected.RowIDs) != document.MaxAffectedIDsPerKind ||
		len(summary.Affected.BlockIDs) != 0 {
		t.Fatalf("bounded summary = %+v", summary)
	}
}

func TestSpliceAtomTextPreconditionsMarksAndUndo(t *testing.T) {
	docs := newDocs()
	base := oneAtomDoc("AéBC")
	base.Rows[0].Blocks[0].Marks = []document.Mark{{
		ID: "m1", Kind: document.MarkKindBold,
		Start: document.Anchor{AtomID: "a1", Offset: 1},
		End:   document.Anchor{AtomID: "a1", Offset: 3},
	}}
	doc, err := docs.Create("p", "Doc", base)
	if err != nil {
		t.Fatal(err)
	}

	inserted := "XYZ"
	edit, err := submitChanges(docs, "p", doc.ID, "u1", []document.ChangeOp{{
		Op: document.OpSpliceAtomText, BlockID: "b1", AtomID: "a1",
		StartOffset: 1, EndOffset: 3, InsertText: &inserted,
		ExpectedTextHash: textHash("AéBC"),
	}})
	if err != nil {
		t.Fatal(err)
	}
	got, _ := docs.Get("p", doc.ID)
	block := got.Base.Rows[0].Blocks[0]
	if block.DisplayText() != "AXYZBC" ||
		block.Marks[0].Start.Offset != 1 || block.Marks[0].End.Offset != 4 {
		t.Fatalf("spliced block = %+v", block)
	}
	if edit.Summary.OperationTypes[0] != document.OpSpliceAtomText ||
		!reflect.DeepEqual(edit.Summary.Affected.AtomIDs, []string{"a1"}) {
		t.Fatalf("splice summary = %+v", edit.Summary)
	}

	badInsert := "!"
	if _, err := submitChanges(docs, "p", doc.ID, "u1", []document.ChangeOp{{
		Op: document.OpSpliceAtomText, BlockID: "b1", AtomID: "a1",
		StartOffset: 0, EndOffset: 0, InsertText: &badInsert,
		ExpectedTextHash: textHash("stale"),
	}}); !errors.Is(err, document.ErrConflict) {
		t.Fatalf("stale digest err = %v, want ErrConflict", err)
	}
	if _, err := docs.Undo("p", doc.ID, "u1", edit.ID); err != nil {
		t.Fatal(err)
	}
	restored, _ := docs.Get("p", doc.ID)
	if !reflect.DeepEqual(restored.Base, doc.Base) {
		t.Fatalf("restored base = %+v, want %+v", restored.Base, doc.Base)
	}

	if _, err := submitChanges(docs, "p", doc.ID, "u1", []document.ChangeOp{{
		Op: document.OpSpliceAtomText, BlockID: "b1", AtomID: "a1",
		StartOffset: 2, EndOffset: 3, InsertText: &badInsert,
		ExpectedTextHash: textHash("AéBC"),
	}}); !errors.Is(err, document.ErrConflict) {
		t.Fatalf("mid-rune splice err = %v, want ErrConflict", err)
	}
	if _, err := submitChanges(docs, "p", doc.ID, "u1", []document.ChangeOp{{
		Op: document.OpSpliceAtomText, BlockID: "b1", AtomID: "a1",
		StartOffset: 0, EndOffset: 0, InsertText: &badInsert,
		ExpectedTextHash: strings.ToUpper(textHash("AéBC")),
	}}); !errors.Is(err, document.ErrInvalidChangeSet) {
		t.Fatalf("invalid digest err = %v, want ErrInvalidChangeSet", err)
	}
}

func TestMoveOperationsPreserveIdentityAndUndo(t *testing.T) {
	docs := newDocs()
	doc, err := docs.Create("p", "Doc", document.Base{Rows: []document.Row{
		{ID: "r1", Blocks: []document.Block{
			{ID: "b1", Kind: document.BlockKindText, Atoms: []document.Atom{
				{ID: "a1", Kind: document.AtomKindText, Text: "one"},
				{ID: "a2", Kind: document.AtomKindText, Text: "two"},
			}},
			{ID: "b2", Kind: document.BlockKindText, Atoms: []document.Atom{
				{ID: "a3", Kind: document.AtomKindText, Text: "three"},
			}},
		}},
		{ID: "r2", Blocks: []document.Block{{
			ID: "b3", Kind: document.BlockKindText,
			Atoms: []document.Atom{{ID: "a4", Kind: document.AtomKindText, Text: "four"}},
		}}},
		{ID: "r3", Blocks: []document.Block{{
			ID: "b4", Kind: document.BlockKindText,
			Atoms: []document.Atom{{ID: "a5", Kind: document.AtomKindText, Text: "five"}},
		}}},
	}})
	if err != nil {
		t.Fatal(err)
	}
	// Undo restores to how the document *reads back* (row tracks normalized on
	// load), not to the raw Create input, so baseline against a read-back.
	originalRead, _ := docs.Get("p", doc.ID)

	edit, err := submitChanges(docs, "p", doc.ID, "u1", []document.ChangeOp{
		{
			Op: document.OpMoveRow, RowID: "r3",
			FromAfterRow: "r2", AfterRow: "",
		},
		{
			Op: document.OpMoveBlock, BlockID: "b2",
			FromRowID: "r1", FromAfterBlock: "b1",
			RowID: "r2", AfterBlock: "b3",
		},
		{
			Op: document.OpMoveAtom, AtomID: "a2",
			FromBlockID: "b1", FromAfterAtom: "a1",
			BlockID: "b3", AfterAtom: "a4",
		},
	})
	if err != nil {
		t.Fatal(err)
	}
	got, _ := docs.Get("p", doc.ID)
	if ids := []string{got.Base.Rows[0].ID, got.Base.Rows[1].ID, got.Base.Rows[2].ID}; !reflect.DeepEqual(ids, []string{"r3", "r1", "r2"}) {
		t.Fatalf("row order = %v", ids)
	}
	if got.Base.Rows[1].Blocks[0].ID != "b1" ||
		got.Base.Rows[2].Blocks[0].ID != "b3" ||
		got.Base.Rows[2].Blocks[1].ID != "b2" {
		t.Fatalf("moved blocks = %+v", got.Base.Rows)
	}
	if atoms := got.Base.Rows[2].Blocks[0].Atoms; len(atoms) != 2 ||
		atoms[0].ID != "a4" || atoms[1].ID != "a2" {
		t.Fatalf("moved atoms = %+v", atoms)
	}
	if _, err := docs.Undo("p", doc.ID, "u1", edit.ID); err != nil {
		t.Fatal(err)
	}
	restored, _ := docs.Get("p", doc.ID)
	if !reflect.DeepEqual(restored.Base, originalRead.Base) {
		t.Fatalf("restored base = %+v, want %+v", restored.Base, originalRead.Base)
	}

	if _, err := submitChanges(docs, "p", doc.ID, "u1", []document.ChangeOp{{
		Op: document.OpMoveRow, RowID: "r2", FromAfterRow: "r3", AfterRow: "",
	}}); !errors.Is(err, document.ErrConflict) {
		t.Fatalf("stale row predecessor err = %v, want ErrConflict", err)
	}

	withinDocs := newDocs()
	withinBase := document.Base{Rows: []document.Row{{
		ID: "r1",
		Blocks: []document.Block{
			{
				ID: "b1", Kind: document.BlockKindText,
				Atoms: []document.Atom{
					{ID: "a1", Kind: document.AtomKindText, Text: "one"},
					{ID: "a2", Kind: document.AtomKindText, Text: "two"},
					{ID: "a3", Kind: document.AtomKindText, Text: "three"},
				},
			},
			{ID: "b2", Kind: document.BlockKindText},
			{ID: "b3", Kind: document.BlockKindText},
		},
	}}}
	withinDoc, err := withinDocs.Create("p", "Within", withinBase)
	if err != nil {
		t.Fatal(err)
	}
	withinOriginalRead, _ := withinDocs.Get("p", withinDoc.ID)
	withinEdit, err := submitChanges(withinDocs, "p", withinDoc.ID, "u1", []document.ChangeOp{
		{
			Op: document.OpMoveBlock, BlockID: "b3",
			FromRowID: "r1", FromAfterBlock: "b2",
			RowID: "r1", AfterBlock: "",
		},
		{
			Op: document.OpMoveAtom, AtomID: "a3",
			FromBlockID: "b1", FromAfterAtom: "a2",
			BlockID: "b1", AfterAtom: "",
		},
	})
	if err != nil {
		t.Fatal(err)
	}
	within, _ := withinDocs.Get("p", withinDoc.ID)
	if blocks := within.Base.Rows[0].Blocks; len(blocks) != 3 ||
		blocks[0].ID != "b3" || blocks[1].ID != "b1" || blocks[2].ID != "b2" {
		t.Fatalf("within-row block move = %+v", blocks)
	}
	if atoms := within.Base.Rows[0].Blocks[1].Atoms; len(atoms) != 3 ||
		atoms[0].ID != "a3" || atoms[1].ID != "a1" || atoms[2].ID != "a2" {
		t.Fatalf("within-block atom move = %+v", atoms)
	}
	if _, err := withinDocs.Undo("p", withinDoc.ID, "u1", withinEdit.ID); err != nil {
		t.Fatal(err)
	}
	withinRestored, _ := withinDocs.Get("p", withinDoc.ID)
	if !reflect.DeepEqual(withinRestored.Base, withinOriginalRead.Base) {
		t.Fatalf("within-parent undo = %+v, want %+v", withinRestored.Base, withinOriginalRead.Base)
	}

	markedDocs := newDocs()
	marked := oneAtomDoc("one")
	marked.Rows[0].Blocks[0].Atoms = append(marked.Rows[0].Blocks[0].Atoms,
		document.Atom{ID: "a2", Kind: document.AtomKindText, Text: "two"})
	marked.Rows[0].Blocks[0].Marks = []document.Mark{{
		ID: "m1", Kind: document.MarkKindBold,
		Start: document.Anchor{AtomID: "a2", Offset: 0},
		End:   document.Anchor{AtomID: "a2", Offset: 3},
	}}
	marked.Rows = append(marked.Rows, document.Row{ID: "r2", Blocks: []document.Block{{
		ID: "b2", Kind: document.BlockKindText,
		Atoms: []document.Atom{{ID: "a3", Kind: document.AtomKindText, Text: "three"}},
	}}})
	markedDoc, _ := markedDocs.Create("p", "Marked", marked)
	if _, err := submitChanges(markedDocs, "p", markedDoc.ID, "u1", []document.ChangeOp{{
		Op: document.OpMoveAtom, AtomID: "a2",
		FromBlockID: "b1", FromAfterAtom: "a1", BlockID: "b2", AfterAtom: "a3",
	}}); !errors.Is(err, document.ErrConflict) {
		t.Fatalf("mark-breaking atom move err = %v, want ErrConflict", err)
	}
}

func TestUpdateMarkPreconditionAndUndo(t *testing.T) {
	docs := newDocs()
	base := oneAtomDoc("hello")
	original := document.Mark{
		ID: "m1", Kind: document.MarkKindBold,
		Start: document.Anchor{AtomID: "a1", Offset: 0},
		End:   document.Anchor{AtomID: "a1", Offset: 5},
	}
	base.Rows[0].Blocks[0].Marks = []document.Mark{original}
	doc, err := docs.Create("p", "Doc", base)
	if err != nil {
		t.Fatal(err)
	}
	replacement := document.Mark{
		ID: "m1", Kind: document.MarkKindItalic,
		Start: document.Anchor{AtomID: "a1", Offset: 1},
		End:   document.Anchor{AtomID: "a1", Offset: 4},
	}
	edit, err := submitChanges(docs, "p", doc.ID, "u1", []document.ChangeOp{{
		Op: document.OpUpdateMark, BlockID: "b1", MarkID: "m1",
		Mark: &replacement, ExpectedMarkHash: markHash(original),
	}})
	if err != nil {
		t.Fatal(err)
	}
	got, _ := docs.Get("p", doc.ID)
	if !reflect.DeepEqual(got.Base.Rows[0].Blocks[0].Marks, []document.Mark{replacement}) {
		t.Fatalf("updated marks = %+v", got.Base.Rows[0].Blocks[0].Marks)
	}
	if _, err := submitChanges(docs, "p", doc.ID, "u1", []document.ChangeOp{{
		Op: document.OpUpdateMark, BlockID: "b1", MarkID: "m1",
		Mark: &original, ExpectedMarkHash: markHash(original),
	}}); !errors.Is(err, document.ErrConflict) {
		t.Fatalf("stale mark digest err = %v, want ErrConflict", err)
	}
	if _, err := docs.Undo("p", doc.ID, "u1", edit.ID); err != nil {
		t.Fatal(err)
	}
	restored, _ := docs.Get("p", doc.ID)
	if !reflect.DeepEqual(restored.Base, doc.Base) {
		t.Fatalf("restored base = %+v, want %+v", restored.Base, doc.Base)
	}
}

func TestSplitAndJoinTextBlocksAreExactAndInvertible(t *testing.T) {
	docs := newDocs()
	doc, err := docs.Create("p", "Doc", oneAtomDoc("hello"))
	if err != nil {
		t.Fatal(err)
	}
	splitRow := func(rowID, blockID, atomID string) *document.Row {
		return &document.Row{ID: rowID, Blocks: []document.Block{{
			ID: blockID, Kind: document.BlockKindText,
			Atoms: []document.Atom{{ID: atomID, Kind: document.AtomKindText}},
		}}}
	}
	split, err := submitChanges(docs, "p", doc.ID, "u1", []document.ChangeOp{{
		Op: document.OpSplitBlock, BlockID: "b1", AtomID: "a1",
		StartOffset: 2, ExpectedTextHash: textHash("hello"),
		Row: splitRow("r2", "b2", "a2"),
	}})
	if err != nil {
		t.Fatal(err)
	}
	got, _ := docs.Get("p", doc.ID)
	if len(got.Base.Rows) != 2 ||
		got.Base.Rows[0].Blocks[0].DisplayText() != "he" ||
		got.Base.Rows[1].ID != "r2" || got.Base.Rows[1].Blocks[0].ID != "b2" ||
		got.Base.Rows[1].Blocks[0].Atoms[0].ID != "a2" ||
		got.Base.Rows[1].Blocks[0].DisplayText() != "llo" {
		t.Fatalf("split base = %+v", got.Base)
	}
	if !reflect.DeepEqual(split.Summary.Affected.RowIDs, []string{"r2"}) ||
		!reflect.DeepEqual(split.Summary.Affected.BlockIDs, []string{"b1", "b2"}) ||
		!reflect.DeepEqual(split.Summary.Affected.AtomIDs, []string{"a1", "a2"}) {
		t.Fatalf("split summary = %+v", split.Summary)
	}
	if _, err := docs.Undo("p", doc.ID, "u1", split.ID); err != nil {
		t.Fatal(err)
	}
	restored, _ := docs.Get("p", doc.ID)
	if !reflect.DeepEqual(restored.Base, doc.Base) {
		t.Fatalf("undo split base = %+v, want %+v", restored.Base, doc.Base)
	}

	secondSplit, err := submitChanges(docs, "p", doc.ID, "u1", []document.ChangeOp{{
		Op: document.OpSplitBlock, BlockID: "b1", AtomID: "a1",
		StartOffset: 2, ExpectedTextHash: textHash("hello"),
		Row: splitRow("r3", "b3", "a3"),
	}})
	if err != nil {
		t.Fatal(err)
	}
	join, err := submitChanges(docs, "p", doc.ID, "u1", []document.ChangeOp{{
		Op: document.OpJoinBlocks, BlockID: "b1", OtherBlockID: "b3",
		ExpectedTextHash: textHash("he"), ExpectedOtherTextHash: textHash("llo"),
	}})
	if err != nil {
		t.Fatal(err)
	}
	joined, _ := docs.Get("p", doc.ID)
	if len(joined.Base.Rows) != 1 || joined.Base.Rows[0].Blocks[0].DisplayText() != "hello" {
		t.Fatalf("joined base = %+v", joined.Base)
	}
	if _, err := docs.Undo("p", doc.ID, "u1", join.ID); err != nil {
		t.Fatal(err)
	}
	reSplit, _ := docs.Get("p", doc.ID)
	if len(reSplit.Base.Rows) != 2 || reSplit.Base.Rows[1].ID != "r3" ||
		reSplit.Base.Rows[1].Blocks[0].ID != "b3" ||
		reSplit.Base.Rows[1].Blocks[0].Atoms[0].ID != "a3" ||
		reSplit.Base.Rows[1].Blocks[0].DisplayText() != "llo" {
		t.Fatalf("undo join base = %+v", reSplit.Base)
	}
	if secondSplit.ID == "" {
		t.Fatal("second split was not retained")
	}

	markedDocs := newDocs()
	marked := oneAtomDoc("hello")
	marked.Rows[0].Blocks[0].Marks = []document.Mark{{
		ID: "m1", Kind: document.MarkKindBold,
		Start: document.Anchor{AtomID: "a1", Offset: 0},
		End:   document.Anchor{AtomID: "a1", Offset: 5},
	}}
	markedDoc, _ := markedDocs.Create("p", "Marked", marked)
	if _, err := submitChanges(markedDocs, "p", markedDoc.ID, "u1", []document.ChangeOp{{
		Op: document.OpSplitBlock, BlockID: "b1", AtomID: "a1",
		StartOffset: 2, ExpectedTextHash: textHash("hello"),
		Row: splitRow("r2", "b2", "a2"),
	}}); !errors.Is(err, document.ErrConflict) {
		t.Fatalf("marked split err = %v, want ErrConflict", err)
	}

	utfDocs := newDocs()
	utfDoc, _ := utfDocs.Create("p", "UTF", oneAtomDoc("aé"))
	if _, err := submitChanges(utfDocs, "p", utfDoc.ID, "u1", []document.ChangeOp{{
		Op: document.OpSplitBlock, BlockID: "b1", AtomID: "a1",
		StartOffset: 2, ExpectedTextHash: textHash("aé"),
		Row: splitRow("r2", "b2", "a2"),
	}}); !errors.Is(err, document.ErrConflict) {
		t.Fatalf("mid-rune split err = %v, want ErrConflict", err)
	}
}

func TestExplicitRedoEligibilityAndInvalidation(t *testing.T) {
	docs := newDocs()
	doc, _ := docs.Create("p", "Doc", oneAtomDoc("start"))

	edit, err := submitChanges(docs, "p", doc.ID, "u1", []document.ChangeOp{{
		Op: document.OpSetAtomText, BlockID: "b1", AtomID: "a1", SetText: strp("edited"),
	}}, "Ada")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := docs.Redo("p", doc.ID, "u1", edit.ID); !errors.Is(err, document.ErrRedoIneligible) {
		t.Fatalf("redo ordinary head err = %v, want ErrRedoIneligible", err)
	}
	undo, err := docs.Undo("p", doc.ID, "u1", edit.ID, "Ada")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := docs.Undo("p", doc.ID, "u1", undo.ID); !errors.Is(err, document.ErrUndoIneligible) {
		t.Fatalf("undo an undo err = %v, want ErrUndoIneligible", err)
	}
	if _, err := docs.Redo("p", doc.ID, "u2", undo.ID); !errors.Is(err, document.ErrRedoForbidden) {
		t.Fatalf("other-author redo err = %v, want ErrRedoForbidden", err)
	}
	page, err := docs.History("p", doc.ID, "u1", document.HistoryRequest{Limit: 1})
	if err != nil || len(page.Entries) != 1 || page.Entries[0].CanUndo || !page.Entries[0].CanRedo {
		t.Fatalf("undo eligibility = %+v, %v", page, err)
	}

	redo, err := docs.Redo("p", doc.ID, "u1", undo.ID, "Ada")
	if err != nil {
		t.Fatal(err)
	}
	if redo.RedoOf != undo.ID || redo.UndoOf != "" || redo.Seq != 3 {
		t.Fatalf("redo revision = %+v", redo)
	}
	if got, _ := docs.Get("p", doc.ID); got.Base.Rows[0].Blocks[0].DisplayText() != "edited" {
		t.Fatalf("redo content = %+v", got.Base)
	}
	if _, err := docs.Redo("p", doc.ID, "u1", undo.ID); !errors.Is(err, document.ErrRedoConflict) {
		t.Fatalf("second redo err = %v, want ErrRedoConflict", err)
	}
	secondUndo, err := docs.Undo("p", doc.ID, "u1", redo.ID, "Ada")
	if err != nil {
		t.Fatal(err)
	}
	if secondUndo.UndoOf != redo.ID {
		t.Fatalf("undo of redo = %+v", secondUndo)
	}
	if _, err := submitChanges(docs, "p", doc.ID, "u1", []document.ChangeOp{{
		Op: document.OpInsertRow, AfterRow: "r1", Row: &document.Row{ID: "r2"},
	}}, "Ada"); err != nil {
		t.Fatal(err)
	}
	if _, err := docs.Redo("p", doc.ID, "u1", secondUndo.ID); !errors.Is(err, document.ErrRedoConflict) {
		t.Fatalf("redo after new edit err = %v, want ErrRedoConflict", err)
	}
}

func TestConcurrentRedoAcceptsOneCompensation(t *testing.T) {
	store := document.NewMemoryStore()
	setup := document.New(store, document.Options{})
	doc, _ := setup.Create("p", "Doc", oneAtomDoc("start"))
	edit, err := submitChanges(setup, "p", doc.ID, "u1", []document.ChangeOp{{
		Op: document.OpSetAtomText, BlockID: "b1", AtomID: "a1", SetText: strp("edited"),
	}})
	if err != nil {
		t.Fatal(err)
	}
	undo, err := setup.Undo("p", doc.ID, "u1", edit.ID)
	if err != nil {
		t.Fatal(err)
	}

	gated := &appendGateStore{
		MemoryStore: store,
		arrived:     make(chan struct{}, 2),
		release:     make(chan struct{}),
	}
	docs := document.New(gated, document.Options{})
	errs := make(chan error, 2)
	for range 2 {
		go func() {
			_, err := docs.Redo("p", doc.ID, "u1", undo.ID)
			errs <- err
		}()
	}
	<-gated.arrived
	<-gated.arrived
	close(gated.release)

	firstErr, secondErr := <-errs, <-errs
	successes := 0
	conflicts := 0
	for _, err := range []error{firstErr, secondErr} {
		switch {
		case err == nil:
			successes++
		case errors.Is(err, document.ErrRedoConflict):
			conflicts++
		default:
			t.Fatalf("concurrent redo err = %v", err)
		}
	}
	if successes != 1 || conflicts != 1 {
		t.Fatalf("redo outcomes: successes=%d conflicts=%d", successes, conflicts)
	}
	got, err := docs.Get("p", doc.ID)
	if err != nil || got.Revision != 3 ||
		got.Base.Rows[0].Blocks[0].DisplayText() != "edited" {
		t.Fatalf("after concurrent redo = %+v, %v", got, err)
	}
}

func TestUndoHeadRevisionRestoresExactContent(t *testing.T) {
	store := document.NewMemoryStore()
	docs := document.New(store, document.Options{})
	base := oneAtomDoc("hello")
	base.Rows[0].Blocks[0].Marks = []document.Mark{
		{
			ID: "m1", Kind: document.MarkKindBold,
			Start: document.Anchor{AtomID: "a1", Offset: 0},
			End:   document.Anchor{AtomID: "a1", Offset: 5},
		},
		{
			ID: "m2", Kind: document.MarkKindItalic,
			Start: document.Anchor{AtomID: "a1", Offset: 0},
			End:   document.Anchor{AtomID: "a1", Offset: 1},
		},
	}
	doc, err := docs.Create("p", "Doc", base)
	if err != nil {
		t.Fatal(err)
	}
	base = doc.Base

	short := "hi"
	edit, err := submitChanges(docs, "p", doc.ID, "u1", []document.ChangeOp{
		{Op: document.OpSetAtomText, BlockID: "b1", AtomID: "a1", SetText: &short},
		{Op: document.OpInsertAtom, BlockID: "b1", AfterAtom: "a1",
			Atom: &document.Atom{ID: "a2", Kind: document.AtomKindText, Text: "!"}},
	}, "Ada")
	if err != nil {
		t.Fatal(err)
	}
	if edit.ID == "" || edit.AuthorID != "u1" || edit.Seq != 1 || len(edit.InverseOps) == 0 {
		t.Fatalf("edit revision = %+v", edit)
	}

	// Folding representation state does not prevent the retained head revision
	// from being compensated.
	if err := docs.Rebase(context.Background(), "p", doc.ID); err != nil {
		t.Fatal(err)
	}
	undo, err := docs.Undo("p", doc.ID, "u1", edit.ID, "Ada")
	if err != nil {
		t.Fatal(err)
	}
	if undo.ID == "" || undo.UndoOf != edit.ID || undo.AuthorID != "u1" || undo.Seq != 2 {
		t.Fatalf("undo revision = %+v", undo)
	}

	got, err := docs.Get("p", doc.ID)
	if err != nil {
		t.Fatal(err)
	}
	if got.Revision != 2 || !reflect.DeepEqual(got.Base, base) {
		t.Fatalf("after undo = %+v; want revision 2 and base %+v", got, base)
	}
	facts := store.ActivityFacts()
	if len(facts) != 3 || facts[2].Actor.ID != "u1" ||
		facts[2].SourceKind != "document.change_set" || facts[2].SourceID != undo.ID {
		t.Fatalf("undo activity = %+v", facts)
	}

	// The compensating revision has its own inverse, so explicit redo remains an
	// append-only compensation while carrying distinct lineage.
	redo, err := docs.Redo("p", doc.ID, "u1", undo.ID, "Ada")
	if err != nil {
		t.Fatal(err)
	}
	if redo.RedoOf != undo.ID || redo.UndoOf != "" || redo.Seq != 3 {
		t.Fatalf("redo revision = %+v", redo)
	}
	got, _ = docs.Get("p", doc.ID)
	if got.Revision != 3 || got.Base.Rows[0].Blocks[0].DisplayText() != "hi!" ||
		len(got.Base.Rows[0].Blocks[0].Marks) != 1 ||
		got.Base.Rows[0].Blocks[0].Marks[0].ID != "m2" {
		t.Fatalf("after redo = %+v", got)
	}
}

func TestUndoRestoresDeletedStructures(t *testing.T) {
	docs := newDocs()
	base := document.Base{Rows: []document.Row{{
		ID: "r1",
		Blocks: []document.Block{{
			ID: "b1", Kind: document.BlockKindText,
			Atoms: []document.Atom{
				{ID: "a1", Kind: document.AtomKindText, Text: "hello"},
				{ID: "a2", Kind: document.AtomKindText, Text: " world"},
			},
			Marks: []document.Mark{{
				ID: "m1", Kind: document.MarkKindItalic,
				Start: document.Anchor{AtomID: "a1", Offset: 0},
				End:   document.Anchor{AtomID: "a2", Offset: 6},
			}},
		}},
	}}}
	doc, err := docs.Create("p", "Doc", base)
	if err != nil {
		t.Fatal(err)
	}
	base = doc.Base

	for _, op := range []document.ChangeOp{
		{Op: document.OpDeleteAtom, BlockID: "b1", AtomID: "a1"},
		{Op: document.OpDeleteBlock, BlockID: "b1"},
		{Op: document.OpDeleteRow, RowID: "r1"},
	} {
		edit, err := submitChanges(docs, "p", doc.ID, "u1", []document.ChangeOp{op})
		if err != nil {
			t.Fatal(err)
		}
		if _, err := docs.Undo("p", doc.ID, "u1", edit.ID); err != nil {
			t.Fatal(err)
		}
		got, err := docs.Get("p", doc.ID)
		if err != nil {
			t.Fatal(err)
		}
		if !reflect.DeepEqual(got.Base, base) {
			t.Fatalf("undo %s restored %+v; want %+v", op.Op, got.Base, base)
		}
	}
}

func TestUndoRemoveMarkRestoresExactOrder(t *testing.T) {
	docs := newDocs()
	base := oneAtomDoc("hello")
	base.Rows[0].Blocks[0].Marks = []document.Mark{
		{
			ID: "m1", Kind: document.MarkKindBold,
			Start: document.Anchor{AtomID: "a1", Offset: 0},
			End:   document.Anchor{AtomID: "a1", Offset: 5},
		},
		{
			ID: "m2", Kind: document.MarkKindItalic,
			Start: document.Anchor{AtomID: "a1", Offset: 1},
			End:   document.Anchor{AtomID: "a1", Offset: 4},
		},
		{
			ID: "m3", Kind: document.MarkKindUnderline,
			Start: document.Anchor{AtomID: "a1", Offset: 2},
			End:   document.Anchor{AtomID: "a1", Offset: 3},
		},
	}
	doc, err := docs.Create("p", "Doc", base)
	if err != nil {
		t.Fatal(err)
	}
	base = doc.Base

	edit, err := submitChanges(docs, "p", doc.ID, "u1", []document.ChangeOp{{
		Op: document.OpRemoveMark, BlockID: "b1", MarkID: "m2",
	}})
	if err != nil {
		t.Fatal(err)
	}
	if _, err := docs.Undo("p", doc.ID, "u1", edit.ID); err != nil {
		t.Fatal(err)
	}
	got, err := docs.Get("p", doc.ID)
	if err != nil || !reflect.DeepEqual(got.Base, base) {
		t.Fatalf("after undo = %+v, %v; want %+v", got.Base, err, base)
	}
}

func TestUndoRestoresPromptState(t *testing.T) {
	docs := newDocs()
	base := document.Base{Rows: []document.Row{{
		ID: "r1",
		Blocks: []document.Block{{
			ID: "pb", Kind: document.BlockKindPrompt, Inferred: true,
			Atoms: []document.Atom{{ID: "a1", Kind: document.AtomKindText, Text: "prior output"}},
			Data: document.PromptData{
				Instruction: "prior instruction",
				Status:      document.PromptStatusOK,
				LastOutput:  "prior output",
				ResolvedAt:  time.Unix(42, 0).UTC(),
			},
		}},
	}}}
	doc, err := docs.Create("p", "Doc", base)
	if err != nil {
		t.Fatal(err)
	}
	initial, err := docs.Get("p", doc.ID)
	if err != nil {
		t.Fatal(err)
	}

	instruction := "new instruction"
	edit, err := submitChanges(docs, "p", doc.ID, "u1", []document.ChangeOp{{
		Op: document.OpSetPrompt, BlockID: "pb", SetText: &instruction,
	}})
	if err != nil {
		t.Fatal(err)
	}
	if _, err := docs.Undo("p", doc.ID, "u1", edit.ID); err != nil {
		t.Fatal(err)
	}
	got, err := docs.Get("p", doc.ID)
	// Undo of OpSetPrompt reverses via OpResolveBlock which appends an output
	// history entry; the restored instruction and text must match the initial.
	gotPD, _ := got.Base.Rows[0].Blocks[0].Data.(document.PromptData)
	initPD, _ := initial.Base.Rows[0].Blocks[0].Data.(document.PromptData)
	if gotPD.Instruction != initPD.Instruction || got.Base.Rows[0].Blocks[0].DisplayText() != "prior output" {
		t.Fatalf("set_prompt undo = %+v; want instruction=%q text=%q",
			gotPD, initPD.Instruction, "prior output")
	}

	resolved := document.Block{
		ID: "pb", Kind: document.BlockKindPrompt, Inferred: true,
		Atoms: []document.Atom{{ID: "a2", Kind: document.AtomKindText, Text: "new output"}},
		Data: document.PromptData{
			Instruction: "prior instruction",
			Status:      document.PromptStatusInsufficient,
			LastOutput:  "new output",
		},
	}
	edit, err = submitChanges(docs, "p", doc.ID, "u1", []document.ChangeOp{{
		Op: document.OpResolveBlock, BlockID: "pb", Block: &resolved,
	}})
	if err != nil {
		t.Fatal(err)
	}
	if _, err := docs.Undo("p", doc.ID, "u1", edit.ID); err != nil {
		t.Fatal(err)
	}
	got, err = docs.Get("p", doc.ID)
	if err != nil {
		t.Fatal(err)
	}
	// Undo reverses via OpResolveBlock which appends an output history entry.
	// The restored content must match the initial state.
	undoPD, _ := got.Base.Rows[0].Blocks[0].Data.(document.PromptData)
	if undoPD.Instruction != initPD.Instruction || got.Base.Rows[0].Blocks[0].DisplayText() != "prior output" {
		t.Fatalf("resolve_block undo = %+v, %v; want instruction=%q text=%q",
			got.Base, err, initPD.Instruction, "prior output")
	}
}

func TestLayoutAndStyleChangesUndoExactly(t *testing.T) {
	docs := newDocs()
	doc, err := docs.Create("p", "Doc", oneAtomDoc("hello"))
	if err != nil {
		t.Fatal(err)
	}
	initial := doc.Base

	height := document.LayoutUnit(20)
	horizontal := document.HorizontalAlignCenter
	vertical := document.VerticalAlignMiddle
	styleChange, err := submitChanges(docs, "p", doc.ID, "u1", []document.ChangeOp{
		{Op: document.OpSetBlockLineHeight, BlockID: "b1", LineHeight: &height},
		{
			Op: document.OpSetBlockAlignment, BlockID: "b1",
			HorizontalAlign: &horizontal, VerticalAlign: &vertical,
		},
	})
	if err != nil {
		t.Fatal(err)
	}
	got, err := docs.Get("p", doc.ID)
	if err != nil {
		t.Fatal(err)
	}
	if got.Base.Rows[0].Blocks[0].Style.LineHeight != height ||
		got.Base.Rows[0].Blocks[0].Style.HorizontalAlign != horizontal ||
		got.Base.Rows[0].Blocks[0].Style.VerticalAlign != vertical {
		t.Fatalf("styled base = %+v", got.Base)
	}
	styleUndo, err := docs.Undo("p", doc.ID, "u1", styleChange.ID)
	if err != nil {
		t.Fatal(err)
	}
	got, _ = docs.Get("p", doc.ID)
	if !reflect.DeepEqual(got.Base, initial) {
		t.Fatalf("style undo = %+v, want %+v", got.Base, initial)
	}
	styleRedo, err := docs.Redo("p", doc.ID, "u1", styleUndo.ID)
	if err != nil {
		t.Fatal(err)
	}
	got, _ = docs.Get("p", doc.ID)
	if got.Base.Rows[0].Blocks[0].Style.LineHeight != height ||
		got.Base.Rows[0].Blocks[0].Style.HorizontalAlign != horizontal ||
		got.Base.Rows[0].Blocks[0].Style.VerticalAlign != vertical {
		t.Fatalf("style redo = %+v", got.Base)
	}
	if _, err := docs.Undo("p", doc.ID, "u1", styleRedo.ID); err != nil {
		t.Fatal(err)
	}

	layout := initial.PageLayout
	layout.MarginTop += 10
	layout.MarginBottom -= 10
	layoutChange, err := submitChanges(docs, "p", doc.ID, "u1", []document.ChangeOp{{
		Op: document.OpSetPageLayout, PageLayout: &layout,
	}})
	if err != nil {
		t.Fatal(err)
	}
	got, _ = docs.Get("p", doc.ID)
	if got.Base.PageLayout != layout {
		t.Fatalf("page layout = %+v, want %+v", got.Base.PageLayout, layout)
	}
	if _, err := docs.Undo("p", doc.ID, "u1", layoutChange.ID); err != nil {
		t.Fatal(err)
	}
	got, _ = docs.Get("p", doc.ID)
	if !reflect.DeepEqual(got.Base, initial) {
		t.Fatalf("layout undo = %+v, want %+v", got.Base, initial)
	}
}

func TestLayoutAndStyleChangeValidation(t *testing.T) {
	docs := newDocs()
	doc, _ := docs.Create("p", "Doc", oneAtomDoc("hello"))

	tooSmall := document.LayoutUnit(7)
	if _, err := submitChanges(docs, "p", doc.ID, "u1", []document.ChangeOp{{
		Op: document.OpSetBlockLineHeight, BlockID: "b1", LineHeight: &tooSmall,
	}}); !errors.Is(err, document.ErrInvalidChangeSet) {
		t.Fatalf("too-small line height error = %v, want ErrInvalidChangeSet", err)
	}

	tooLarge := document.LayoutUnit(129)
	if _, err := submitChanges(docs, "p", doc.ID, "u1", []document.ChangeOp{{
		Op: document.OpSetBlockLineHeight, BlockID: "b1", LineHeight: &tooLarge,
	}}); !errors.Is(err, document.ErrInvalidChangeSet) {
		t.Fatalf("over-large line height error = %v, want ErrInvalidChangeSet", err)
	}

	badAlignment := document.HorizontalAlignment("justify")
	if _, err := submitChanges(docs, "p", doc.ID, "u1", []document.ChangeOp{{
		Op: document.OpSetBlockAlignment, BlockID: "b1", HorizontalAlign: &badAlignment,
	}}); !errors.Is(err, document.ErrInvalidChangeSet) {
		t.Fatalf("bad alignment error = %v, want ErrInvalidChangeSet", err)
	}

	badLayout := doc.Base.PageLayout
	badLayout.MarginTop = badLayout.Height
	if _, err := submitChanges(docs, "p", doc.ID, "u1", []document.ChangeOp{{
		Op: document.OpSetPageLayout, PageLayout: &badLayout,
	}}); !errors.Is(err, document.ErrInvalidChangeSet) {
		t.Fatalf("bad layout error = %v, want ErrInvalidChangeSet", err)
	}
}

func TestUndoEnforcesAuthorAndCurrentHead(t *testing.T) {
	docs := newDocs()
	doc, _ := docs.Create("p", "Doc", oneAtomDoc("start"))

	one := "one"
	first, err := submitChanges(docs, "p", doc.ID, "u1", []document.ChangeOp{{
		Op: document.OpSetAtomText, BlockID: "b1", AtomID: "a1", SetText: &one,
	}})
	if err != nil {
		t.Fatal(err)
	}
	if _, err := docs.Undo("p", doc.ID, "u2", first.ID); !errors.Is(err, document.ErrUndoForbidden) {
		t.Fatalf("other-author undo err = %v, want ErrUndoForbidden", err)
	}

	second, err := submitChanges(docs, "p", doc.ID, "u2", []document.ChangeOp{{
		Op: document.OpInsertRow, AfterRow: "r1", Row: &document.Row{ID: "r2"},
	}})
	if err != nil {
		t.Fatal(err)
	}
	if _, err := docs.Undo("p", doc.ID, "u1", first.ID); !errors.Is(err, document.ErrUndoConflict) {
		t.Fatalf("non-head undo err = %v, want ErrUndoConflict", err)
	}
	if _, err := docs.Undo("p", doc.ID, "u1", second.ID); !errors.Is(err, document.ErrUndoForbidden) {
		t.Fatalf("other author's head undo err = %v, want ErrUndoForbidden", err)
	}
	if _, err := docs.Undo("p", doc.ID, "u2", "missing"); !errors.Is(err, document.ErrChangeSetNotFound) {
		t.Fatalf("missing undo target err = %v, want ErrChangeSetNotFound", err)
	}

	got, err := docs.Get("p", doc.ID)
	if err != nil || got.Revision != 2 ||
		got.Base.Rows[0].Blocks[0].DisplayText() != "one" || len(got.Base.Rows) != 2 {
		t.Fatalf("failed undo changed document: %+v, %v", got, err)
	}
}

func appendN(t *testing.T, d *document.Documents, docID string, n int) {
	t.Helper()
	for i := 1; i <= n; i++ {
		if _, err := submitChanges(d, "p", docID, "u", []document.ChangeOp{
			{Op: document.OpSetAtomText, BlockID: "b1", AtomID: "a1", SetText: strp(fmt.Sprint(i))},
		}); err != nil {
			t.Fatal(err)
		}
	}
}

func TestAppendEnqueuesRebaseAtThreshold(t *testing.T) {
	mem := document.NewMemoryStore()
	spy := &spyEnqueuer{}
	d := document.New(mem, document.Options{RebaseThreshold: 3, Enqueuer: spy})
	doc, _ := d.Create("p", "Doc", oneAtomDoc("0"))

	appendN(t, d, doc.ID, 3)

	// The first two appends are below the threshold; the third (3 pending) enqueues
	// exactly one re-base job for this document.
	if len(spy.jobs) != 1 {
		t.Fatalf("enqueued jobs = %d, want 1", len(spy.jobs))
	}
	if spy.jobs[0].typ != document.JobTypeRebase {
		t.Errorf("job type = %q, want %q", spy.jobs[0].typ, document.JobTypeRebase)
	}
}

func TestStyleRegistryLifecycleUndoRedoAndHistory(t *testing.T) {
	docs := newDocs()
	doc, err := docs.Create("p", "Doc", oneAtomDoc("hello"))
	if err != nil {
		t.Fatal(err)
	}
	initial := doc.Base
	muted := document.BackgroundMuted
	styleChange, err := submitChanges(docs, "p", doc.ID, "u1", []document.ChangeOp{
		{Op: document.OpPutStyleDefinition, Style: &document.StyleDefinition{
			ID:         "body-callout",
			Name:       "Body Callout",
			AppliesTo:  []string{document.BlockKindText},
			Typography: document.TypographyBody,
			Spacing:    document.SpacingRelaxed,
			Padding:    document.PaddingNormal,
			Border:     document.BorderSubtle,
			Background: document.BackgroundSubtle,
			Tone:       document.ToneAccent,
			AllowOverrides: []document.StyleOverrideKey{
				document.OverrideBackground,
			},
		}},
		{Op: document.OpSetStyleDefault, DefaultBlockKind: document.BlockKindText, StyleID: "body-callout"},
		{Op: document.OpAssignBlockStyle, BlockID: "b1", StyleRef: &document.BlockStyleRef{StyleID: "body-callout"}},
		{Op: document.OpSetBlockStyleOverrides, BlockID: "b1", StyleOverrides: &document.StyleOverrides{Background: &muted}},
	})
	if err != nil {
		t.Fatal(err)
	}
	got, err := docs.Get("p", doc.ID)
	if err != nil {
		t.Fatal(err)
	}
	if len(got.Base.StyleRegistry.Definitions) != 1 || len(got.Base.StyleRegistry.Defaults) != 1 {
		t.Fatalf("style registry = %+v", got.Base.StyleRegistry)
	}
	if got.Base.Rows[0].Blocks[0].StyleRef == nil ||
		got.Base.Rows[0].Blocks[0].StyleRef.StyleID != "body-callout" ||
		got.Base.Rows[0].Blocks[0].StyleRef.Overrides.Background == nil ||
		*got.Base.Rows[0].Blocks[0].StyleRef.Overrides.Background != document.BackgroundMuted {
		t.Fatalf("style assignment = %+v", got.Base.Rows[0].Blocks[0].StyleRef)
	}
	history, err := docs.History("p", doc.ID, "u1", document.HistoryRequest{Limit: 1})
	if err != nil {
		t.Fatal(err)
	}
	if len(history.Entries) != 1 || len(history.Entries[0].Summary.Affected.StyleIDs) == 0 {
		t.Fatalf("history style summary = %+v", history)
	}
	undo, err := docs.Undo("p", doc.ID, "u1", styleChange.ID)
	if err != nil {
		t.Fatalf("undo err = %v, inverse ops = %+v", err, styleChange.InverseOps)
	}
	got, _ = docs.Get("p", doc.ID)
	if got.Base.PageLayout != initial.PageLayout ||
		got.Base.LayoutRules != initial.LayoutRules ||
		len(got.Base.StyleRegistry.Definitions) != 0 ||
		len(got.Base.StyleRegistry.Defaults) != 0 ||
		!reflect.DeepEqual(got.Base.Rows, initial.Rows) {
		t.Fatalf("style undo = %+v, want %+v", got.Base, initial)
	}
	if _, err := docs.Redo("p", doc.ID, "u1", undo.ID); err != nil {
		t.Fatalf("redo err = %v, inverse ops = %+v", err, undo.InverseOps)
	}
	got, _ = docs.Get("p", doc.ID)
	if got.Base.Rows[0].Blocks[0].StyleRef == nil || got.Base.Rows[0].Blocks[0].StyleRef.StyleID != "body-callout" {
		t.Fatalf("style redo = %+v", got.Base.Rows[0].Blocks[0].StyleRef)
	}

	if _, err := submitChanges(docs, "p", doc.ID, "u1", []document.ChangeOp{{
		Op: document.OpPutStyleDefinition, Style: &document.StyleDefinition{
			ID:             "body-accent",
			Name:           "Body Accent",
			AppliesTo:      []string{document.BlockKindText},
			Typography:     document.TypographyBody,
			Spacing:        document.SpacingCompact,
			Padding:        document.PaddingCompact,
			Border:         document.BorderAccent,
			Background:     document.BackgroundEmphasis,
			Tone:           document.ToneAccent,
			AllowOverrides: []document.StyleOverrideKey{document.OverrideBackground},
		},
	}}); err != nil {
		t.Fatal(err)
	}
	replacement, err := submitChanges(docs, "p", doc.ID, "u1", []document.ChangeOp{{
		Op: document.OpReplaceStyle, StyleID: "body-callout", ReplacementStyleID: "body-accent",
	}})
	if err != nil {
		t.Fatal(err)
	}
	got, _ = docs.Get("p", doc.ID)
	if _, _, ok := documentStyleByID(got.Base.StyleRegistry, "body-callout"); ok {
		t.Fatalf("replaced style still present: %+v", got.Base.StyleRegistry)
	}
	if got.Base.Rows[0].Blocks[0].StyleRef == nil || got.Base.Rows[0].Blocks[0].StyleRef.StyleID != "body-accent" {
		t.Fatalf("replacement style ref = %+v", got.Base.Rows[0].Blocks[0].StyleRef)
	}
	if _, err := docs.Undo("p", doc.ID, "u1", replacement.ID); err != nil {
		t.Fatal(err)
	}
	got, _ = docs.Get("p", doc.ID)
	if got.Base.Rows[0].Blocks[0].StyleRef == nil || got.Base.Rows[0].Blocks[0].StyleRef.StyleID != "body-callout" {
		t.Fatalf("replacement undo = %+v", got.Base.Rows[0].Blocks[0].StyleRef)
	}
}

func TestStyleRegistryValidationAndConflicts(t *testing.T) {
	docs := newDocs()
	doc, err := docs.Create("p", "Doc", oneAtomDoc("hello"))
	if err != nil {
		t.Fatal(err)
	}
	if _, err := submitChanges(docs, "p", doc.ID, "u1", []document.ChangeOp{{
		Op:    document.OpPutStyleDefinition,
		Style: &document.StyleDefinition{ID: "bad", Name: "Bad", Typography: document.TypographyBody},
	}}); !errors.Is(err, document.ErrInvalidChangeSet) {
		t.Fatalf("invalid style definition err = %v, want ErrInvalidChangeSet", err)
	}
	if _, err := submitChanges(docs, "p", doc.ID, "u1", []document.ChangeOp{{
		Op: document.OpAssignBlockStyle, BlockID: "b1", StyleRef: &document.BlockStyleRef{StyleID: "missing"},
	}}); !errors.Is(err, document.ErrConflict) {
		t.Fatalf("unknown style assign err = %v, want ErrConflict", err)
	}
	if _, err := submitChanges(docs, "p", doc.ID, "u1", []document.ChangeOp{{
		Op: document.OpPutStyleDefinition, Style: &document.StyleDefinition{
			ID:         "body-callout",
			Name:       "Body Callout",
			AppliesTo:  []string{document.BlockKindText},
			Typography: document.TypographyBody,
			Spacing:    document.SpacingNormal,
			Padding:    document.PaddingNone,
			Border:     document.BorderNone,
			Background: document.BackgroundNone,
			Tone:       document.ToneNeutral,
		},
	}}); err != nil {
		t.Fatal(err)
	}
	if _, err := submitChanges(docs, "p", doc.ID, "u1", []document.ChangeOp{{
		Op: document.OpAssignBlockStyle, BlockID: "b1", StyleRef: &document.BlockStyleRef{StyleID: "body-callout"},
	}}); err != nil {
		t.Fatal(err)
	}
	muted := document.BackgroundMuted
	if _, err := submitChanges(docs, "p", doc.ID, "u1", []document.ChangeOp{{
		Op: document.OpSetBlockStyleOverrides, BlockID: "b1", StyleOverrides: &document.StyleOverrides{Background: &muted},
	}}); !errors.Is(err, document.ErrConflict) {
		t.Fatalf("disallowed override err = %v, want ErrConflict", err)
	}
	if _, err := submitChanges(docs, "p", doc.ID, "u1", []document.ChangeOp{{
		Op: document.OpDeleteStyleDefinition, StyleID: "body-callout",
	}}); !errors.Is(err, document.ErrConflict) {
		t.Fatalf("delete in-use style err = %v, want ErrConflict", err)
	}
}

func TestStyleRegistrySemanticRebaseBoundaries(t *testing.T) {
	docs := newDocs()
	doc, err := docs.Create("p", "Doc", oneAtomDoc("hello"))
	if err != nil {
		t.Fatal(err)
	}
	if _, err := docs.SubmitChanges("p", doc.ID, "u1", document.ChangeSubmission{
		SubmissionID:     "style-seed",
		ExpectedRevision: 0,
		Operations: []document.ChangeOp{
			{Op: document.OpPutStyleDefinition, Style: &document.StyleDefinition{
				ID:             "body-callout",
				Name:           "Body Callout",
				AppliesTo:      []string{document.BlockKindText},
				Typography:     document.TypographyBody,
				Spacing:        document.SpacingNormal,
				Padding:        document.PaddingNone,
				Border:         document.BorderSubtle,
				Background:     document.BackgroundSubtle,
				Tone:           document.ToneAccent,
				AllowOverrides: []document.StyleOverrideKey{document.OverrideBackground},
			}},
			{Op: document.OpAssignBlockStyle, BlockID: "b1", StyleRef: &document.BlockStyleRef{StyleID: "body-callout"}},
		},
	}); err != nil {
		t.Fatal(err)
	}
	styled, err := docs.Get("p", doc.ID)
	if err != nil {
		t.Fatal(err)
	}

	styleUpdate := document.ChangeSubmission{
		SubmissionID:     "style-update",
		ExpectedRevision: styled.Revision,
		Operations: []document.ChangeOp{{
			Op: document.OpPutStyleDefinition,
			Style: &document.StyleDefinition{
				ID:             "body-callout",
				Name:           "Body Callout",
				AppliesTo:      []string{document.BlockKindText},
				Typography:     document.TypographyBody,
				Spacing:        document.SpacingRelaxed,
				Padding:        document.PaddingNormal,
				Border:         document.BorderAccent,
				Background:     document.BackgroundEmphasis,
				Tone:           document.ToneAccent,
				AllowOverrides: []document.StyleOverrideKey{document.OverrideBackground},
			},
		}},
	}
	if _, err := docs.SubmitChanges("p", doc.ID, "u1", styleUpdate); err != nil {
		t.Fatal(err)
	}
	rebasedText, err := docs.SubmitChanges("p", doc.ID, "u2", document.ChangeSubmission{
		SubmissionID:     "style-stale-text",
		ExpectedRevision: styled.Revision,
		Operations: []document.ChangeOp{{
			Op: document.OpSetAtomText, BlockID: "b1", AtomID: "a1", SetText: strp("world"),
		}},
	})
	if err != nil || rebasedText.AuthoredRevision != styled.Revision || rebasedText.PriorRevision <= styled.Revision {
		t.Fatalf("stale text over style change = %+v, %v", rebasedText, err)
	}
	muted := document.BackgroundMuted
	if _, err := docs.SubmitChanges("p", doc.ID, "u2", document.ChangeSubmission{
		SubmissionID:     "style-stale-override",
		ExpectedRevision: styled.Revision,
		Operations: []document.ChangeOp{{
			Op: document.OpSetBlockStyleOverrides, BlockID: "b1", StyleOverrides: &document.StyleOverrides{Background: &muted},
		}},
	}); !errors.Is(err, document.ErrRevisionConflict) {
		t.Fatalf("stale override err = %v, want ErrRevisionConflict", err)
	}
}

func documentStyleByID(registry document.StyleRegistry, id string) (document.StyleDefinition, int, bool) {
	for i, definition := range registry.Definitions {
		if definition.ID == id {
			return definition, i, true
		}
	}
	return document.StyleDefinition{}, -1, false
}

func TestRebaseFoldsAndKeepsHistory(t *testing.T) {
	mem := document.NewMemoryStore()
	d := document.New(mem, document.Options{RebaseThreshold: 3})
	doc, _ := d.Create("p", "Doc", oneAtomDoc("0"))
	appendN(t, d, doc.ID, 5)

	// Running the re-base job folds pending change sets into the base.
	if err := d.Rebase(context.Background(), "p", doc.ID); err != nil {
		t.Fatal(err)
	}
	if got, _ := d.Get("p", doc.ID); got.Base.Rows[0].Blocks[0].DisplayText() != "5" {
		t.Errorf("resolved text = %q, want 5", got.Base.Rows[0].Blocks[0].DisplayText())
	}
	if stored, _ := mem.DocumentByID("p", doc.ID); stored.BaseSeq != 5 {
		t.Errorf("base_seq = %d, want 5", stored.BaseSeq)
	}
	// With no history limit, every folded change set stays available as authored
	// history undo/redo can reference.
	if all, _ := mem.ChangeSetsSince(doc.ID, 0); len(all) != 5 {
		t.Errorf("change sets kept = %d, want 5", len(all))
	}
	// Re-basing again with nothing pending is a no-op.
	if err := d.Rebase(context.Background(), "p", doc.ID); err != nil {
		t.Fatalf("idempotent re-base: %v", err)
	}
}

func TestRebasePrunesHistoryBeyondLimit(t *testing.T) {
	mem := document.NewMemoryStore()
	d := document.New(mem, document.Options{RebaseThreshold: 3, HistoryLimit: 2})
	doc, _ := d.Create("p", "Doc", oneAtomDoc("0"))
	firstSubmission := document.ChangeSubmission{
		SubmissionID: "pruned-memory-retry", ExpectedRevision: 0,
		Operations: []document.ChangeOp{{
			Op: document.OpSetAtomText, BlockID: "b1", AtomID: "a1", SetText: strp("1"),
		}},
	}
	first, err := d.SubmitChanges("p", doc.ID, "u", firstSubmission)
	if err != nil {
		t.Fatal(err)
	}
	for i := 2; i <= 5; i++ {
		if _, err := submitChanges(d, "p", doc.ID, "u", []document.ChangeOp{{
			Op: document.OpSetAtomText, BlockID: "b1", AtomID: "a1", SetText: strp(fmt.Sprint(i)),
		}}); err != nil {
			t.Fatal(err)
		}
	}

	if err := d.Rebase(context.Background(), "p", doc.ID); err != nil {
		t.Fatal(err)
	}
	// Only the current-head detailed recipe survives after all five revisions
	// are folded; bounded summary History keeps the newest two entries.
	if all, _ := mem.ChangeSetsSince(doc.ID, 0); len(all) != 1 || all[0].Seq != 5 {
		t.Errorf("detailed change sets kept = %+v, want head revision 5", seqsForTest(all))
	}
	history, err := d.History("p", doc.ID, "u", document.HistoryRequest{})
	if err != nil || len(history.Entries) != 2 ||
		history.Entries[0].Revision != 5 || history.Entries[1].Revision != 4 ||
		!history.Entries[0].DetailAvailable || history.Entries[1].DetailAvailable {
		t.Fatalf("bounded history = %+v, %v", history, err)
	}
	// ...and pruning does not change the resolved document.
	if got, _ := d.Get("p", doc.ID); got.Base.Rows[0].Blocks[0].DisplayText() != "5" {
		t.Errorf("resolved text after prune = %q, want 5", got.Base.Rows[0].Blocks[0].DisplayText())
	}
	if retried, err := d.SubmitChanges("p", doc.ID, "u", firstSubmission); err != nil ||
		retried.ID != first.ID || retried.Seq != 1 {
		t.Fatalf("retry after memory history prune = %+v, %v", retried, err)
	}
	if _, err := d.ChangeSet("p", doc.ID, first.ID); !errors.Is(err, document.ErrChangeSetNotFound) {
		t.Fatalf("pruned detail err = %v, want ErrChangeSetNotFound", err)
	}
	head := history.Entries[0]
	if detail, err := d.ChangeSet("p", doc.ID, head.ID); err != nil || detail.Seq != 5 {
		t.Fatalf("head detail = %+v, %v", detail, err)
	}
	if _, err := d.Undo("p", doc.ID, "u", head.ID); err != nil {
		t.Fatalf("retained head undo: %v", err)
	}
}

func seqsForTest(css []document.ChangeSet) []int64 {
	out := make([]int64, len(css))
	for i, cs := range css {
		out[i] = cs.Seq
	}
	return out
}

// A prompt block can be inserted, its instruction edited with set_prompt, and a
// resolution incorporated with resolve_block — replacing its display atoms and
// setting its evidence/status while keeping it inferred.
func TestPromptBlockOps(t *testing.T) {
	d := newDocs()
	doc, err := d.Create("p", "Doc", oneAtomDoc("intro"))
	if err != nil {
		t.Fatal(err)
	}

	// Insert a prompt block after b1, then edit its instruction.
	if _, err := submitChanges(d, "p", doc.ID, "u1", []document.ChangeOp{
		{Op: document.OpInsertBlock, RowID: "r1", AfterBlock: "b1",
			Block: &document.Block{ID: "pb", Kind: document.BlockKindPrompt, Data: document.PromptData{Instruction: "draft"}}},
	}); err != nil {
		t.Fatal(err)
	}
	if _, err := submitChanges(d, "p", doc.ID, "u1", []document.ChangeOp{
		{Op: document.OpSetPrompt, BlockID: "pb", SetText: strp("summarize the solar docs")},
	}); err != nil {
		t.Fatal(err)
	}

	got, _ := d.Get("p", doc.ID)
	pb := got.Base.Rows[0].Blocks[1]
	if pb.Kind != document.BlockKindPrompt || !pb.Inferred {
		t.Fatalf("prompt block = %+v", pb)
	}
	if pd := pb.Data.(document.PromptData); pd.Instruction != "summarize the solar docs" {
		t.Errorf("instruction not set: %+v", pd)
	}

	// Incorporate a resolution: new generated atoms + evidence + status.
	resolved := &document.Block{
		ID: "pb", Kind: document.BlockKindPrompt,
		Atoms: []document.Atom{{ID: "ga", Kind: document.AtomKindText, Text: "Solar panels convert sunlight to power."}},
		Data: document.PromptData{
			Instruction: "summarize the solar docs",
			Status:      document.PromptStatusOK,
			Evidence:    []document.EvidenceSpan{{SourceType: "document", SourceID: "s1", Start: 0, End: 20, Text: "Solar panels convert"}},
			LastOutput:  "Solar panels convert sunlight to power.",
		},
	}
	if _, err := submitChanges(d, "p", doc.ID, "sys", []document.ChangeOp{
		{Op: document.OpResolveBlock, BlockID: "pb", Block: resolved},
	}); err != nil {
		t.Fatal(err)
	}

	got, _ = d.Get("p", doc.ID)
	pb = got.Base.Rows[0].Blocks[1]
	if pb.DisplayText() != "Solar panels convert sunlight to power." {
		t.Errorf("generated text not incorporated: %q", pb.DisplayText())
	}
	if !pb.Inferred {
		t.Errorf("prompt block lost inferred flag")
	}
	pd := pb.Data.(document.PromptData)
	if pd.Status != document.PromptStatusOK || len(pd.Evidence) != 1 || pd.Evidence[0].SourceID != "s1" {
		t.Errorf("resolution data not incorporated: %+v", pd)
	}

	// set_prompt / resolve_block target only prompt blocks.
	if _, err := submitChanges(d, "p", doc.ID, "u1", []document.ChangeOp{
		{Op: document.OpSetPrompt, BlockID: "b1", SetText: strp("x")},
	}); !errors.Is(err, document.ErrConflict) {
		t.Errorf("set_prompt on a paragraph = %v, want ErrConflict", err)
	}
}

// --- R6 track operations ---

func twoBlockRow() document.Base {
	return document.Base{Rows: []document.Row{
		{ID: "r1", Blocks: []document.Block{
			{ID: "b1", Kind: document.BlockKindText, Atoms: []document.Atom{{ID: "a1", Kind: document.AtomKindText, Text: "left"}}},
			{ID: "b2", Kind: document.BlockKindText, Atoms: []document.Atom{{ID: "a2", Kind: document.AtomKindText, Text: "right"}}},
		}},
	}}
}

func TestSetRowTracksAndUndo(t *testing.T) {
	docs := newDocs()
	doc, err := docs.Create("p", "Doc", twoBlockRow())
	if err != nil {
		t.Fatal(err)
	}
	got, _ := docs.Get("p", doc.ID)
	// Default equal weights are normalized to sum to NormalizedTotalWeight (100).
	if len(got.Base.Rows[0].Tracks) != 2 || got.Base.Rows[0].Tracks[0].Weight != 50 || got.Base.Rows[0].Tracks[1].Weight != 50 {
		t.Fatalf("default tracks = %+v, want equal weights summing to 100", got.Base.Rows[0].Tracks)
	}

	// Authored weights 3:1 are stored normalized to that proportion out of 100.
	tracks := []document.Track{
		{BlockID: "b1", Weight: 3, Gap: 12, MinWidth: 36},
		{BlockID: "b2", Weight: 1, Gap: 0, MinWidth: 0},
	}
	change, err := submitChanges(docs, "p", doc.ID, "u1", []document.ChangeOp{{
		Op: document.OpSetRowTracks, RowID: "r1", Tracks: tracks,
	}})
	if err != nil {
		t.Fatal(err)
	}
	got, _ = docs.Get("p", doc.ID)
	if len(got.Base.Rows[0].Tracks) != 2 || got.Base.Rows[0].Tracks[0].Weight != 75 || got.Base.Rows[0].Tracks[1].Weight != 25 {
		t.Fatalf("set tracks = %+v, want [75, 25]", got.Base.Rows[0].Tracks)
	}
	if _, err := docs.Undo("p", doc.ID, "u1", change.ID); err != nil {
		t.Fatal(err)
	}
	got, _ = docs.Get("p", doc.ID)
	if len(got.Base.Rows[0].Tracks) != 2 || got.Base.Rows[0].Tracks[0].Weight != 50 {
		t.Fatalf("undo tracks = %+v, want equal weights", got.Base.Rows[0].Tracks)
	}
}

func TestResizeAdjacentTracksAndValidation(t *testing.T) {
	docs := newDocs()
	doc, _ := docs.Create("p", "Doc", twoBlockRow())

	// Set up unequal weights first.
	if _, err := submitChanges(docs, "p", doc.ID, "u1", []document.ChangeOp{{
		Op: document.OpSetRowTracks, RowID: "r1", Tracks: []document.Track{
			{BlockID: "b1", Weight: 3, Gap: 0, MinWidth: 0},
			{BlockID: "b2", Weight: 3, Gap: 0, MinWidth: 0},
		},
	}}); err != nil {
		t.Fatal(err)
	}

	// Equal weights [3,3] are stored normalized to [50,50]. A resize shifts weight
	// between adjacent tracks in those normalized (percentage) units, preserving
	// the total: left gains 2, right loses 2 (50+2=52, 50-2=48).
	_, err := submitChanges(docs, "p", doc.ID, "u1", []document.ChangeOp{{
		Op: document.OpResizeAdjacentTracks, RowID: "r1", BlockID: "b1", OtherBlockID: "b2", DeltaWeight: 2,
	}})
	if err != nil {
		t.Fatal(err)
	}
	got, _ := docs.Get("p", doc.ID)
	if got.Base.Rows[0].Tracks[0].Weight != 52 || got.Base.Rows[0].Tracks[1].Weight != 48 {
		t.Fatalf("resized tracks = %+v, want [52, 48]", got.Base.Rows[0].Tracks)
	}

	// Invalid: not adjacent.
	_, err = submitChanges(docs, "p", doc.ID, "u1", []document.ChangeOp{{
		Op: document.OpResizeAdjacentTracks, RowID: "r1", BlockID: "b2", OtherBlockID: "b1", DeltaWeight: 1,
	}})
	if !errors.Is(err, document.ErrConflict) {
		t.Fatalf("non-adjacent resize error = %v, want ErrConflict", err)
	}

	// Invalid: delta would push the right track below MinTrackWeight (48-60 < 1).
	_, err = submitChanges(docs, "p", doc.ID, "u1", []document.ChangeOp{{
		Op: document.OpResizeAdjacentTracks, RowID: "r1", BlockID: "b1", OtherBlockID: "b2", DeltaWeight: 60,
	}})
	if !errors.Is(err, document.ErrConflict) {
		t.Fatalf("out-of-bounds resize error = %v, want ErrConflict", err)
	}
}

func TestTrackNormalizationOnBlockMove(t *testing.T) {
	docs := newDocs()
	doc, err := docs.Create("p", "Doc", twoBlockRow())
	if err != nil {
		t.Fatal(err)
	}
	// Insert a third block in a second row.
	solo := &document.Block{ID: "b3", Kind: document.BlockKindText, Atoms: []document.Atom{{ID: "a3", Kind: document.AtomKindText, Text: "solo"}}}
	if _, err := submitChanges(docs, "p", doc.ID, "u1", []document.ChangeOp{
		{Op: document.OpInsertBlock, RowID: "r1", AfterBlock: "b2", Block: solo},
		{Op: document.OpInsertRow, AfterRow: "r1", Row: &document.Row{ID: "r2"}},
	}); err != nil {
		t.Fatal(err)
	}

	// Move b3 from r1 to r2. Source r1 loses a block (3→2, tracks adjust), target r2 gains a block (0→1, no tracks needed).
	if _, err := submitChanges(docs, "p", doc.ID, "u1", []document.ChangeOp{{
		Op: document.OpMoveBlock, BlockID: "b3", FromRowID: "r1", FromAfterBlock: "b2", RowID: "r2",
	}}); err != nil {
		t.Fatal(err)
	}
	got, _ := docs.Get("p", doc.ID)
	if len(got.Base.Rows[0].Blocks) != 2 {
		t.Fatalf("source row blocks = %d, want 2", len(got.Base.Rows[0].Blocks))
	}
	if len(got.Base.Rows[0].Tracks) != 2 {
		t.Fatalf("source row tracks = %d, want 2 after normalization", len(got.Base.Rows[0].Tracks))
	}
	if len(got.Base.Rows[1].Blocks) != 1 || len(got.Base.Rows[1].Tracks) != 0 {
		t.Fatalf("target row blocks/tracks = %d/%d, want 1/0", len(got.Base.Rows[1].Blocks), len(got.Base.Rows[1].Tracks))
	}
}

// --- R6 follow-up: block line height ---

func TestSetBlockLineHeightAndUndo(t *testing.T) {
	docs := newDocs()
	doc, err := docs.Create("p", "Doc", oneAtomDoc("hello"))
	if err != nil {
		t.Fatal(err)
	}
	initial, _ := docs.Get("p", doc.ID)

	lh := document.LayoutUnit(24)
	change, err := submitChanges(docs, "p", doc.ID, "u1", []document.ChangeOp{{
		Op: document.OpSetBlockLineHeight, BlockID: "b1", LineHeight: &lh,
	}})
	if err != nil {
		t.Fatal(err)
	}
	got, _ := docs.Get("p", doc.ID)
	if got.Base.Rows[0].Blocks[0].Style.LineHeight != 24 {
		t.Fatalf("line height = %d, want 24", got.Base.Rows[0].Blocks[0].Style.LineHeight)
	}
	if _, err := docs.Undo("p", doc.ID, "u1", change.ID); err != nil {
		t.Fatal(err)
	}
	got, _ = docs.Get("p", doc.ID)
	if !reflect.DeepEqual(got.Base, initial.Base) {
		t.Fatalf("undo line height = %+v, want %+v", got.Base, initial.Base)
	}
}

func TestBlockLineHeightValidation(t *testing.T) {
	docs := newDocs()
	doc, _ := docs.Create("p", "Doc", oneAtomDoc("hello"))

	tooSmall := document.LayoutUnit(7)
	if _, err := submitChanges(docs, "p", doc.ID, "u1", []document.ChangeOp{{
		Op: document.OpSetBlockLineHeight, BlockID: "b1", LineHeight: &tooSmall,
	}}); !errors.Is(err, document.ErrInvalidChangeSet) {
		t.Fatalf("too-small line height error = %v, want ErrInvalidChangeSet", err)
	}

	tooLarge := document.LayoutUnit(129)
	if _, err := submitChanges(docs, "p", doc.ID, "u1", []document.ChangeOp{{
		Op: document.OpSetBlockLineHeight, BlockID: "b1", LineHeight: &tooLarge,
	}}); !errors.Is(err, document.ErrInvalidChangeSet) {
		t.Fatalf("too-large line height error = %v, want ErrInvalidChangeSet", err)
	}
}

// --- R7: header, footer, page flow ---

func TestSetHeaderFooterAndUndo(t *testing.T) {
	docs := newDocs()
	doc, err := docs.Create("p", "Doc", oneAtomDoc("hello"))
	if err != nil {
		t.Fatal(err)
	}
	hdr := []document.Row{{ID: "h1", Blocks: []document.Block{
		{ID: "hb1", Kind: document.BlockKindText, Atoms: []document.Atom{{ID: "ha1", Kind: document.AtomKindText, Text: "Header"}}},
	}}}
	ftr := []document.Row{{ID: "f1", Blocks: []document.Block{
		{ID: "fb1", Kind: document.BlockKindText, Atoms: []document.Atom{{ID: "fa1", Kind: document.AtomKindText, Text: "Footer"}}},
	}}}
	if _, err := submitChanges(docs, "p", doc.ID, "u1", []document.ChangeOp{
		{Op: document.OpSetHeader, Header: hdr},
		{Op: document.OpSetFooter, Footer: ftr},
	}); err != nil {
		t.Fatal(err)
	}
	got, _ := docs.Get("p", doc.ID)
	if len(got.Base.Header) != 1 || got.Base.Header[0].Blocks[0].DisplayText() != "Header" {
		t.Fatalf("header = %+v", got.Base.Header)
	}
	if len(got.Base.Footer) != 1 || got.Base.Footer[0].Blocks[0].DisplayText() != "Footer" {
		t.Fatalf("footer = %+v", got.Base.Footer)
	}
}

func TestSetRowFlowAndPageBreakPagination(t *testing.T) {
	docs := newDocs()
	doc, err := docs.Create("p", "Doc", document.Base{
		PageLayout: document.PageLayout{
			Width: 612, Height: 200,
			MarginTop: 20, MarginRight: 20, MarginBottom: 20, MarginLeft: 20,
		},
		Rows: []document.Row{
			{ID: "r1", Blocks: []document.Block{
				{ID: "b1", Kind: document.BlockKindText, Atoms: []document.Atom{{ID: "a1", Kind: document.AtomKindText, Text: "first"}}},
			}},
			{ID: "r2", Blocks: []document.Block{
				{ID: "b2", Kind: document.BlockKindText, Atoms: []document.Atom{{ID: "a2", Kind: document.AtomKindText, Text: "second"}}},
			}},
		},
	})
	if err != nil {
		t.Fatal(err)
	}
	pages, err := document.Paginate(doc.Base)
	if err != nil {
		t.Fatal(err)
	}
	if len(pages) != 1 {
		t.Fatalf("pages without break = %d, want 1", len(pages))
	}

	// Set page break on r2.
	if _, err := submitChanges(docs, "p", doc.ID, "u1", []document.ChangeOp{{
		Op: document.OpSetRowFlow, RowID: "r2", PageBreak: boolp(true),
	}}); err != nil {
		t.Fatal(err)
	}
	got, _ := docs.Get("p", doc.ID)
	pages, err = document.Paginate(got.Base)
	if err != nil {
		t.Fatal(err)
	}
	if len(pages) != 2 || pages[0].RowIDs[0] != "r1" || pages[1].RowIDs[0] != "r2" {
		t.Fatalf("pages with break = %+v, want r1 on page1, r2 on page2", pages)
	}
}

func boolp(v bool) *bool { return &v }

// fakeFormulaEvaluator evaluates simple arithmetic expressions: integers,
// addition, subtraction, multiplication, division. Unknown expressions produce an
// error result.
type fakeFormulaEvaluator struct{}

func (fakeFormulaEvaluator) Evaluate(_ context.Context, expr string, deps []document.FormulaDep) (document.FormulaResult, []document.FormulaDep, error) {
	return evalFormulaExpr(expr, deps), deps, nil
}

func evalFormulaExpr(expr string, deps []document.FormulaDep) document.FormulaResult {
	if strings.HasPrefix(expr, "=") {
		expr = expr[1:]
	}
	parts := strings.Fields(expr)
	if len(parts) == 3 {
		left, right := simpleValue(parts[0]), simpleValue(parts[2])
		op := parts[1]
		var result int
		switch op {
		case "+":
			result = left + right
		case "-":
			result = left - right
		case "*":
			result = left * right
		case "/":
			if right == 0 {
				return document.FormulaResult{Type: "number", Error: "division by zero"}
			}
			result = left / right
		default:
			return document.FormulaResult{Type: "number", Error: "unknown operator: " + op}
		}
		_ = deps
		return document.FormulaResult{Value: fmt.Sprintf("%d", result), Type: "number"}
	}
	// Single integer literal.
	if val, err := simpleInt(expr); err == nil {
		return document.FormulaResult{Value: fmt.Sprintf("%d", val), Type: "number"}
	}
	return document.FormulaResult{Type: "number", Error: "invalid expression: " + expr}
}

func simpleValue(s string) int {
	v, _ := simpleInt(s)
	return v
}

func simpleInt(s string) (int, error) {
	s = strings.TrimSpace(s)
	var n int
	for _, c := range s {
		if c < '0' || c > '9' {
			return 0, fmt.Errorf("not an integer")
		}
		n = n*10 + int(c-'0')
	}
	return n, nil
}

func newFormulaDocs() *document.Documents {
	return document.New(document.NewMemoryStore(), document.Options{
		FormulaEvaluator: fakeFormulaEvaluator{},
	})
}

// --- R9: formula atoms ---

func TestSetAtomFormulaAndHistory(t *testing.T) {
	docs := newFormulaDocs()
	doc, err := docs.Create("p", "Doc", oneAtomDoc("hello"))
	if err != nil {
		t.Fatal(err)
	}
	expr := "= 1 + 1"
	if _, err := submitChanges(docs, "p", doc.ID, "u1", []document.ChangeOp{{
		Op: document.OpSetAtomFormula, BlockID: "b1", AtomID: "a1",
		Formula: &document.FormulaData{Expression: expr},
	}}); err != nil {
		t.Fatal(err)
	}
	got, _ := docs.Get("p", doc.ID)
	atom := got.Base.Rows[0].Blocks[0].Atoms[0]
	if atom.Kind != document.AtomKindFormula {
		t.Fatalf("atom kind = %q, want formula", atom.Kind)
	}
	fd, ok := atom.Data.(document.FormulaData)
	if !ok || fd.Expression != expr {
		t.Fatalf("formula data = %+v", atom.Data)
	}
	if len(fd.History) != 1 {
		t.Fatalf("history entries = %d, want 1", len(fd.History))
	}
	if fd.History[0].State != document.FormulaStateOK || fd.History[0].Result.Value != "2" {
		t.Fatalf("history entry = %+v, want ok/2", fd.History[0])
	}

	// Refresh with new expression.
	expr2 := "= 2 + 2"
	refresh, err := submitChanges(docs, "p", doc.ID, "u1", []document.ChangeOp{{
		Op: document.OpRefreshFormula, BlockID: "b1", AtomID: "a1",
		Formula: &document.FormulaData{Expression: expr2},
	}})
	if err != nil {
		t.Fatal(err)
	}
	got, _ = docs.Get("p", doc.ID)
	fd = got.Base.Rows[0].Blocks[0].Atoms[0].Data.(document.FormulaData)
	if len(fd.History) != 2 {
		t.Fatalf("history entries after refresh = %d, want 2", len(fd.History))
	}
	if fd.History[1].Result.Value != "4" {
		t.Fatalf("refreshed result = %q, want 4", fd.History[1].Result.Value)
	}

	// Undo refreshes back to first result. Undo appends a history entry
	// (via OpSetAtomFormula inverse), so count increases but value restores.
	if _, err := docs.Undo("p", doc.ID, "u1", refresh.ID); err != nil {
		t.Fatal(err)
	}
	got, _ = docs.Get("p", doc.ID)
	fd = got.Base.Rows[0].Blocks[0].Atoms[0].Data.(document.FormulaData)
	if fd.Result.Value != "2" {
		t.Fatalf("undo refresh result = %q, want 2", fd.Result.Value)
	}
	if got.Base.Rows[0].Blocks[0].Atoms[0].Text != "2" {
		t.Fatalf("undo refresh display text = %q, want 2", got.Base.Rows[0].Blocks[0].Atoms[0].Text)
	}
}

func TestInsertFormulaAtomAutoEvaluate(t *testing.T) {
	docs := newFormulaDocs()
	doc, err := docs.Create("p", "Doc", oneAtomDoc("intro"))
	if err != nil {
		t.Fatal(err)
	}
	if _, err := submitChanges(docs, "p", doc.ID, "u1", []document.ChangeOp{{
		Op: document.OpInsertAtom, BlockID: "b1",
		Atom: &document.Atom{ID: "a2", Kind: document.AtomKindFormula, Data: document.FormulaData{Expression: "3 + 4"}},
	}}); err != nil {
		t.Fatal(err)
	}
	got, _ := docs.Get("p", doc.ID)
	atom := got.Base.Rows[0].Blocks[0].Atoms[0]
	if atom.Kind != document.AtomKindFormula || atom.Text != "7" {
		t.Fatalf("inserted formula atom = kind=%q text=%q, want formula/7", atom.Kind, atom.Text)
	}
	fd := atom.Data.(document.FormulaData)
	if len(fd.History) != 1 || fd.History[0].Result.Value != "7" {
		t.Fatalf("formula history = %+v", fd.History)
	}
}

// --- R10: prompt output history ---

func TestResolveBlockAppendsOutputHistory(t *testing.T) {
	docs := newDocs()
	doc, err := docs.Create("p", "Doc", document.Base{Rows: []document.Row{{
		ID: "r1", Blocks: []document.Block{{
			ID: "pb", Kind: document.BlockKindPrompt, Inferred: true,
			Atoms: []document.Atom{{ID: "a1", Kind: document.AtomKindText, Text: ""}},
			Data:  document.PromptData{Instruction: "test prompt"},
		}},
	}}})
	if err != nil {
		t.Fatal(err)
	}

	// First resolution.
	resolved1 := &document.Block{
		ID: "pb", Kind: document.BlockKindPrompt,
		Atoms: []document.Atom{{ID: "ga1", Kind: document.AtomKindText, Text: "first answer"}},
		Data:  document.PromptData{Instruction: "test prompt", Status: document.PromptStatusOK, LastOutput: "first answer"},
	}
	if _, err := submitChanges(docs, "p", doc.ID, "u1", []document.ChangeOp{{
		Op: document.OpResolveBlock, BlockID: "pb", Block: resolved1,
	}}); err != nil {
		t.Fatal(err)
	}
	got, _ := docs.Get("p", doc.ID)
	pd := got.Base.Rows[0].Blocks[0].Data.(document.PromptData)
	if len(pd.OutputHistory) != 1 {
		t.Fatalf("output history after first resolve = %d, want 1", len(pd.OutputHistory))
	}
	if pd.OutputHistory[0].Atoms[0].Text != "first answer" {
		t.Fatalf("first revision text = %q", pd.OutputHistory[0].Atoms[0].Text)
	}

	// Second resolution.
	resolved2 := &document.Block{
		ID: "pb", Kind: document.BlockKindPrompt,
		Atoms: []document.Atom{{ID: "ga2", Kind: document.AtomKindText, Text: "second answer"}},
		Data:  document.PromptData{Instruction: "test prompt", Status: document.PromptStatusOK, LastOutput: "second answer"},
	}
	if _, err := submitChanges(docs, "p", doc.ID, "u1", []document.ChangeOp{{
		Op: document.OpResolveBlock, BlockID: "pb", Block: resolved2,
	}}); err != nil {
		t.Fatal(err)
	}
	got, _ = docs.Get("p", doc.ID)
	pd = got.Base.Rows[0].Blocks[0].Data.(document.PromptData)
	if len(pd.OutputHistory) != 2 {
		t.Fatalf("output history after second resolve = %d, want 2", len(pd.OutputHistory))
	}
}

func TestRestorePromptOutput(t *testing.T) {
	docs := newDocs()
	revAtoms := []document.Atom{{ID: "g1", Kind: document.AtomKindText, Text: "generated"}}
	rev := document.PromptOutputRevision{
		ID: "rev1", Atoms: revAtoms, Marks: nil,
	}
	doc, err := docs.Create("p", "Doc", document.Base{Rows: []document.Row{{
		ID: "r1", Blocks: []document.Block{{
			ID: "pb", Kind: document.BlockKindPrompt, Inferred: true,
			Atoms: []document.Atom{{ID: "cur", Kind: document.AtomKindText, Text: "current"}},
			Data: document.PromptData{
				Instruction:   "test",
				OutputHistory: []document.PromptOutputRevision{rev},
			},
		}},
	}}})
	if err != nil {
		t.Fatal(err)
	}
	if _, err := submitChanges(docs, "p", doc.ID, "u1", []document.ChangeOp{{
		Op: document.OpRestorePromptOutput, BlockID: "pb", RevisionID: "rev1",
	}}); err != nil {
		t.Fatalf("restore: %v", err)
	}
	got, _ := docs.Get("p", doc.ID)
	if got.Base.Rows[0].Blocks[0].DisplayText() != "generated" {
		t.Fatalf("restored text = %q", got.Base.Rows[0].Blocks[0].DisplayText())
	}
	pd := got.Base.Rows[0].Blocks[0].Data.(document.PromptData)
	if len(pd.OutputHistory) != 2 {
		t.Fatalf("output history = %d, want 2", len(pd.OutputHistory))
	}
}

func TestRestorePromptOutputInvalidRevision(t *testing.T) {
	docs := newDocs()
	doc, _ := docs.Create("p", "Doc", document.Base{Rows: []document.Row{{
		ID: "r1", Blocks: []document.Block{{
			ID: "pb", Kind: document.BlockKindPrompt, Inferred: true,
			Atoms: []document.Atom{{ID: "a1", Kind: document.AtomKindText, Text: "original"}},
			Data:  document.PromptData{Instruction: "test"},
		}},
	}}})
	_, err := submitChanges(docs, "p", doc.ID, "u1", []document.ChangeOp{{
		Op: document.OpRestorePromptOutput, BlockID: "pb", RevisionID: "nonexistent",
	}})
	if !errors.Is(err, document.ErrConflict) {
		t.Fatalf("restore nonexistent revision error = %v, want ErrConflict", err)
	}
}

// --- R11: block catalog ---

func TestNewBlockKindsInsertAndPersist(t *testing.T) {
	docs := newDocs()
	base := document.Base{Rows: []document.Row{{ID: "r1", Blocks: []document.Block{
		{ID: "p1", Kind: document.BlockKindText, Atoms: []document.Atom{{ID: "aP", Kind: document.AtomKindText, Text: "para"}}},
	}}}}
	doc, _ := docs.Create("p", "Doc", base)

	inserts := []struct {
		after string
		block document.Block
	}{
		{"p1", document.Block{ID: "q1", Kind: document.BlockKindText, Atoms: []document.Atom{{ID: "aQ", Kind: document.AtomKindText, Text: "quoted"}}}},
		{"q1", document.Block{ID: "c1", Kind: document.BlockKindCode, Atoms: []document.Atom{{ID: "aC", Kind: document.AtomKindText, Text: "code"}}}},
		{"c1", document.Block{ID: "d1", Kind: document.BlockKindDivider}},
		{"d1", document.Block{ID: "cl1", Kind: document.BlockKindText, Atoms: []document.Atom{{ID: "aCL", Kind: document.AtomKindText, Text: "note"}}}},
		{"cl1", document.Block{ID: "im1", Kind: document.BlockKindImage, Data: document.ImageData{FileID: "f1", Alt: "pic", Width: 200, Height: 100}}},
	}
	for _, ins := range inserts {
		if _, err := submitChanges(docs, "p", doc.ID, "u1", []document.ChangeOp{
			{Op: document.OpInsertBlock, RowID: "r1", AfterBlock: ins.after, Block: &ins.block},
		}); err != nil {
			t.Fatalf("insert %s: %v", ins.block.Kind, err)
		}
	}
	got, _ := docs.Get("p", doc.ID)
	blocks := got.Base.Rows[0].Blocks
	if len(blocks) != 6 {
		t.Fatalf("block count = %d, want 6", len(blocks))
	}
	if blocks[1].Kind != document.BlockKindText || blocks[1].DisplayText() != "quoted" {
		t.Fatalf("text block = %+v", blocks[1])
	}
	if blocks[2].Kind != document.BlockKindCode || blocks[2].DisplayText() != "code" {
		t.Fatalf("code block = %+v", blocks[2])
	}
	if blocks[3].Kind != document.BlockKindDivider || len(blocks[3].Atoms) != 0 {
		t.Fatalf("divider block = %+v", blocks[3])
	}
	if blocks[4].Kind != document.BlockKindText || blocks[4].DisplayText() != "note" {
		t.Fatalf("text block = %+v", blocks[4])
	}
	imd, ok := blocks[5].Data.(document.ImageData)
	if !ok || imd.FileID != "f1" || imd.Width != 200 || imd.Height != 100 {
		t.Fatalf("image data = %+v", blocks[5].Data)
	}
}

func TestImageDataValidation(t *testing.T) {
	docs := newDocs()
	doc, _ := docs.Create("p", "Doc", oneAtomDoc("hello"))

	// Image without ImageData is rejected.
	_, err := submitChanges(docs, "p", doc.ID, "u1", []document.ChangeOp{{
		Op: document.OpInsertBlock, RowID: "r1", AfterBlock: "b1",
		Block: &document.Block{ID: "im", Kind: document.BlockKindImage},
	}})
	if !errors.Is(err, document.ErrInvalidChangeSet) {
		t.Fatalf("image without data error = %v, want ErrInvalidChangeSet", err)
	}
}

func TestImageBlockNoAtoms(t *testing.T) {
	docs := newDocs()
	doc, _ := docs.Create("p", "Doc", oneAtomDoc("hello"))
	if _, err := submitChanges(docs, "p", doc.ID, "u1", []document.ChangeOp{{
		Op: document.OpInsertBlock, RowID: "r1", AfterBlock: "b1",
		Block: &document.Block{ID: "im1", Kind: document.BlockKindImage, Data: document.ImageData{FileID: "f1", Width: 300, Height: 200}},
	}}); err != nil {
		t.Fatal(err)
	}
	got, _ := docs.Get("p", doc.ID)
	// Paginate with an image block — its row height comes from image height.
	pages, err := document.Paginate(got.Base)
	if err != nil {
		t.Fatal(err)
	}
	if len(pages) < 1 {
		t.Fatal("no pages from image doc")
	}
}
