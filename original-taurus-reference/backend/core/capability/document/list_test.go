package document_test

import (
	"errors"
	"testing"

	"github.com/gccurtis/taurus-omega/core/capability/document"
)

func iptr(i int) *int { return &i }

func ltptr(t document.ListType) *document.ListType { return &t }

// listItem builds a one-atom list item at a level.
func listItem(level int, text string) document.ListItem {
	return document.ListItem{Level: level, Atoms: []document.Atom{{Kind: document.AtomKindText, Text: text}}}
}

// listDoc creates a document whose single row holds one list block.
func listDoc(t *testing.T, d *document.Documents, data document.ListBlockData) document.Document {
	t.Helper()
	base := document.Base{Rows: []document.Row{{ID: "r1", Blocks: []document.Block{
		{ID: "l1", Kind: document.BlockKindList, Data: data},
	}}}}
	doc, err := d.Create("p", "Doc", base)
	if err != nil {
		t.Fatalf("create list doc: %v", err)
	}
	return doc
}

func listData(t *testing.T, d *document.Documents, docID string) document.ListBlockData {
	t.Helper()
	got, err := d.Get("p", docID)
	if err != nil {
		t.Fatal(err)
	}
	data, ok := got.Base.Rows[0].Blocks[0].Data.(document.ListBlockData)
	if !ok {
		t.Fatalf("block data is not a list: %T", got.Base.Rows[0].Blocks[0].Data)
	}
	return data
}

// A list block is created, persisted, and round-trips its typed data.
func TestListBlockCreateAndPersist(t *testing.T) {
	d := newDocs()
	doc := listDoc(t, d, document.ListBlockData{
		Type:  document.ListBullet,
		Items: []document.ListItem{listItem(0, "one"), listItem(1, "two")},
	})
	data := listData(t, d, doc.ID)
	if data.Type != document.ListBullet || len(data.Items) != 2 {
		t.Fatalf("list data = %+v", data)
	}
	if data.Items[1].Level != 1 || data.Items[1].Atoms[0].Text != "two" {
		t.Fatalf("item 1 = %+v", data.Items[1])
	}
}

// set_block_data replaces a list's whole payload; set_list_type changes the
// marker and ordered start.
func TestSetBlockDataAndListType(t *testing.T) {
	d := newDocs()
	doc := listDoc(t, d, document.ListBlockData{Type: document.ListBullet, Items: []document.ListItem{listItem(0, "a")}})

	if _, err := submitChanges(d, "p", doc.ID, "u", []document.ChangeOp{
		{Op: document.OpSetBlockData, BlockID: "l1", ListData: &document.ListBlockData{
			Type:  document.ListCheck,
			Items: []document.ListItem{listItem(0, "x"), listItem(0, "y")},
		}},
	}); err != nil {
		t.Fatalf("set_block_data: %v", err)
	}
	if data := listData(t, d, doc.ID); data.Type != document.ListCheck || len(data.Items) != 2 {
		t.Fatalf("after set_block_data: %+v", data)
	}

	if _, err := submitChanges(d, "p", doc.ID, "u", []document.ChangeOp{
		{Op: document.OpSetListType, BlockID: "l1", SetListType: ltptr(document.ListOrdered), ListStart: iptr(3)},
	}); err != nil {
		t.Fatalf("set_list_type: %v", err)
	}
	if data := listData(t, d, doc.ID); data.Type != document.ListOrdered || data.Start != 3 {
		t.Fatalf("after set_list_type: %+v", data)
	}
}

// set_list_item appends (index == len), replaces, and removes (nil item).
func TestSetListItemInsertReplaceRemove(t *testing.T) {
	d := newDocs()
	doc := listDoc(t, d, document.ListBlockData{Type: document.ListBullet, Items: []document.ListItem{listItem(0, "a")}})

	// Append at index == len.
	if _, err := submitChanges(d, "p", doc.ID, "u", []document.ChangeOp{
		{Op: document.OpSetListItem, BlockID: "l1", ListIndex: 1, Item: itemPtr(listItem(1, "b"))},
	}); err != nil {
		t.Fatalf("append item: %v", err)
	}
	if data := listData(t, d, doc.ID); len(data.Items) != 2 || data.Items[1].Level != 1 {
		t.Fatalf("after append: %+v", data.Items)
	}

	// Replace index 0.
	if _, err := submitChanges(d, "p", doc.ID, "u", []document.ChangeOp{
		{Op: document.OpSetListItem, BlockID: "l1", ListIndex: 0, Item: itemPtr(listItem(0, "A"))},
	}); err != nil {
		t.Fatalf("replace item: %v", err)
	}
	if data := listData(t, d, doc.ID); data.Items[0].Atoms[0].Text != "A" {
		t.Fatalf("after replace: %+v", data.Items[0])
	}

	// Remove index 0 (nil item).
	if _, err := submitChanges(d, "p", doc.ID, "u", []document.ChangeOp{
		{Op: document.OpSetListItem, BlockID: "l1", ListIndex: 0, Item: nil},
	}); err != nil {
		t.Fatalf("remove item: %v", err)
	}
	if data := listData(t, d, doc.ID); len(data.Items) != 1 || data.Items[0].Atoms[0].Text != "b" {
		t.Fatalf("after remove: %+v", data.Items)
	}
}

// A list-item edit is reversible: undo restores the whole prior payload.
func TestListItemUndo(t *testing.T) {
	d := newDocs()
	doc := listDoc(t, d, document.ListBlockData{Type: document.ListBullet, Items: []document.ListItem{listItem(0, "a")}})
	cs, err := submitChanges(d, "p", doc.ID, "u", []document.ChangeOp{
		{Op: document.OpSetListItem, BlockID: "l1", ListIndex: 1, Item: itemPtr(listItem(0, "b"))},
	})
	if err != nil {
		t.Fatalf("append: %v", err)
	}
	if _, err := d.Undo("p", doc.ID, "u", cs.ID); err != nil {
		t.Fatalf("undo: %v", err)
	}
	if data := listData(t, d, doc.ID); len(data.Items) != 1 || data.Items[0].Atoms[0].Text != "a" {
		t.Fatalf("after undo: %+v", data.Items)
	}
}

// List payloads are bounded: too many items and an over-deep level are rejected.
func TestListBounds(t *testing.T) {
	d := newDocs()
	doc := listDoc(t, d, document.ListBlockData{Type: document.ListBullet, Items: []document.ListItem{listItem(0, "a")}})

	// Level beyond MaxListItemLevel.
	_, err := submitChanges(d, "p", doc.ID, "u", []document.ChangeOp{
		{Op: document.OpSetListItem, BlockID: "l1", ListIndex: 1, Item: itemPtr(listItem(99, "deep"))},
	})
	if !errors.Is(err, document.ErrInvalidChangeSet) {
		t.Fatalf("over-deep level = %v, want ErrInvalidChangeSet", err)
	}

	// Too many items via set_block_data.
	big := document.ListBlockData{Type: document.ListBullet}
	for i := 0; i < document.MaxListItems+1; i++ {
		big.Items = append(big.Items, listItem(0, "x"))
	}
	_, err = submitChanges(d, "p", doc.ID, "u", []document.ChangeOp{
		{Op: document.OpSetBlockData, BlockID: "l1", ListData: &big},
	})
	if !errors.Is(err, document.ErrInvalidChangeSet) {
		t.Fatalf("too many items = %v, want ErrInvalidChangeSet", err)
	}
}

// List ops are rejected on a non-list block.
func TestListOpsOnlyListBlocks(t *testing.T) {
	d := newDocs()
	doc, _ := d.Create("p", "Doc", oneAtomDoc("hello"))
	_, err := submitChanges(d, "p", doc.ID, "u", []document.ChangeOp{
		{Op: document.OpSetListType, BlockID: "b1", SetListType: ltptr(document.ListOrdered)},
	})
	if !errors.Is(err, document.ErrConflict) {
		t.Fatalf("set_list_type on text block = %v, want ErrConflict", err)
	}
}

// Bullet, ordered, and check lists round-trip through Markdown.
func TestListMarkdownRoundTrip(t *testing.T) {
	docs := document.New(document.NewMemoryStore(), document.Options{})
	md := "- alpha\n- beta\n\n1. one\n2. two\n\n- [ ] todo\n- [x] done\n"
	created, err := docs.ImportMarkdown("p", "Lists", md)
	if err != nil {
		t.Fatalf("import: %v", err)
	}
	got, _ := docs.Get("p", created.ID)
	if len(got.Base.Rows) != 3 {
		t.Fatalf("want 3 list rows, got %d", len(got.Base.Rows))
	}
	kinds := []document.ListType{document.ListBullet, document.ListOrdered, document.ListCheck}
	for i, want := range kinds {
		data, ok := got.Base.Rows[i].Blocks[0].Data.(document.ListBlockData)
		if !ok || data.Type != want || len(data.Items) != 2 {
			t.Fatalf("row %d list = %+v (ok=%v)", i, got.Base.Rows[i].Blocks[0].Data, ok)
		}
	}
	// The check list preserves checked state.
	check := got.Base.Rows[2].Blocks[0].Data.(document.ListBlockData)
	if check.Items[0].Checked || !check.Items[1].Checked {
		t.Fatalf("check states = %+v", check.Items)
	}
	_, out, err := docs.ExportMarkdown("p", created.ID)
	if err != nil {
		t.Fatalf("export: %v", err)
	}
	want := "- alpha\n- beta\n\n1. one\n2. two\n\n- [ ] todo\n- [x] done\n"
	if out != want {
		t.Fatalf("export mismatch:\n got %q\nwant %q", out, want)
	}
}

func itemPtr(it document.ListItem) *document.ListItem { return &it }
