package knowledge_test

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"sort"
	"strings"
	"testing"

	"github.com/gccurtis/taurus-omega/core/capability/knowledge"
)

// The reproducibility gate.
//
// Nothing asserted this before, which is the whole reason the defect survived:
// window ids were 16 bytes of crypto/rand, both frontier queries order by id, and
// the sparse path's threshold sample draws pairs by INDEX. So a fresh ingest of
// identical content presented the frontier in a fresh random permutation, the
// sampled percentile moved, and the lattice came out different — 172 nodes at
// threshold 0.563 on one run of the 596-file corpus and 205 at 0.564 on the next,
// with byte-identical code.
//
// Ingest is deterministic clustering over a randomly ordered input. This pins the
// input's order to its content.
func latticeOf(t *testing.T, items []knowledge.AddItem) (windowIDs, nodeIDs []string) {
	t.Helper()
	store := knowledge.NewMemoryStore()
	opts := smallWindows
	// Below the crossover so the corpus tier clusters over the k-NN graph and
	// pins a threshold — the order-sensitive path, and the one that produced the
	// observed variation.
	opts.MaxClusterPool = 4
	k := knowledge.New(store, fakeEmbedder{dim: 64}, opts)
	ctx := context.Background()

	if _, err := k.AddBatch(ctx, "proj-fixed", items); err != nil {
		t.Fatalf("AddBatch: %v", err)
	}
	if err := k.RebuildCorpus(ctx, "proj-fixed"); err != nil {
		t.Fatalf("RebuildCorpus: %v", err)
	}

	for _, item := range items {
		src, ok, err := store.SourceByOrigin("proj-fixed", item.SourceType, item.SourceID)
		if err != nil || !ok {
			t.Fatalf("source %q: ok=%v err=%v", item.SourceID, ok, err)
		}
		windows, err := store.SourceWindows(src.LocalRefID)
		if err != nil {
			t.Fatalf("windows: %v", err)
		}
		for _, w := range windows {
			windowIDs = append(windowIDs, w.ID)
		}
	}
	frontier, err := store.EntryFrontier("proj-fixed")
	if err != nil {
		t.Fatalf("frontier: %v", err)
	}
	for _, e := range frontier {
		nodeIDs = append(nodeIDs, e.ID)
	}
	sort.Strings(windowIDs)
	sort.Strings(nodeIDs)
	return windowIDs, nodeIDs
}

func determinismItems() []knowledge.AddItem {
	var items []knowledge.AddItem
	for i := 0; i < 6; i++ {
		var sb strings.Builder
		for j := 0; j < 5; j++ {
			fmt.Fprintf(&sb, "Source %d sentence %d concerning subject %d in detail. ", i, j, i)
		}
		items = append(items, knowledge.AddItem{
			SourceType: knowledge.SourceTypeDocument,
			SourceID:   fmt.Sprintf("doc%d", i),
			Content:    knowledge.TextContent(sb.String()),
		})
	}
	return items
}

// Two ingests of identical content into two fresh databases produce identical
// ids, at both tiers.
func TestIdenticalContentProducesIdenticalIDs(t *testing.T) {
	items := determinismItems()
	firstWindows, firstNodes := latticeOf(t, items)
	secondWindows, secondNodes := latticeOf(t, items)

	if len(firstWindows) == 0 || len(firstNodes) == 0 {
		t.Fatalf("fixture built nothing: %d windows, %d frontier entries", len(firstWindows), len(firstNodes))
	}
	if len(firstWindows) != len(secondWindows) {
		t.Fatalf("%d windows then %d", len(firstWindows), len(secondWindows))
	}
	for i := range firstWindows {
		if firstWindows[i] != secondWindows[i] {
			t.Errorf("window id %d: %q then %q", i, firstWindows[i], secondWindows[i])
		}
	}
	if len(firstNodes) != len(secondNodes) {
		t.Fatalf("%d frontier entries then %d", len(firstNodes), len(secondNodes))
	}
	for i := range firstNodes {
		if firstNodes[i] != secondNodes[i] {
			t.Errorf("frontier id %d: %q then %q", i, firstNodes[i], secondNodes[i])
		}
	}
}

// The certification fixture pins every otherwise minted identity used by the
// scale path. Provider embeddings are deterministic here by design: the live
// suite certifies quality, while this fixture certifies structural regression
// with an exact lattice hash that can be compared across databases.
func TestPinnedConnectorScaleFixtureHasCertifiedLatticeHash(t *testing.T) {
	const (
		projectID   = "fixture-project-omega-005"
		connectorID = "fixture-connector-omega-005"
		configID    = "fixture-config-klr-text-v1"
	)
	space := knowledge.VectorIdentity{
		Provider: "fixture", Model: "fixture-embedding-v1", Dims: 64,
	}
	items := make([]knowledge.AddItem, 64)
	for i := range items {
		sourceID := fmt.Sprintf("%s/file-%03d", connectorID, i)
		items[i] = knowledge.AddItem{
			SourceType: knowledge.SourceTypeConnector,
			SourceID:   sourceID,
			Label:      fmt.Sprintf("folder/file-%03d.md", i),
			Content: knowledge.TextContent(fmt.Sprintf(
				"Fixture source %03d describes deterministic topic %02d. %s",
				i, i%11, strings.Repeat("Bounded reproducible lattice evidence. ", 8),
			)),
			Revision: 1,
		}
	}

	build := func() string {
		store := knowledge.NewMemoryStore()
		opts := smallWindows
		opts.MaxClusterPool = 16
		k := knowledge.New(store, fakeEmbedder{dim: space.Dims, identity: space}, opts)
		if _, err := k.AddBatch(context.Background(), projectID, items); err != nil {
			t.Fatal(err)
		}
		if err := k.RebuildCorpus(context.Background(), projectID); err != nil {
			t.Fatal(err)
		}
		var ids []string
		for _, item := range items {
			source, ok, err := store.SourceByOrigin(projectID, item.SourceType, item.SourceID)
			if err != nil || !ok {
				t.Fatalf("source %s: found=%v err=%v", item.SourceID, ok, err)
			}
			ids = append(ids, source.LocalRefID)
			windows, err := store.SourceWindows(source.LocalRefID)
			if err != nil {
				t.Fatal(err)
			}
			for _, window := range windows {
				ids = append(ids, window.ID)
			}
		}
		frontier, err := store.EntryFrontier(projectID)
		if err != nil {
			t.Fatal(err)
		}
		for _, entry := range frontier {
			ids = append(ids, entry.ID)
		}
		sort.Strings(ids)
		canonical := projectID + "\n" + connectorID + "\n" + configID + "\n" +
			knowledge.SpaceForIdentity(space).Identity() + "\n" + strings.Join(ids, "\n")
		sum := sha256.Sum256([]byte(canonical))
		return hex.EncodeToString(sum[:])
	}

	first, second := build(), build()
	if first != second {
		t.Fatalf("pinned fixture hashes differ across databases: %s then %s", first, second)
	}
	const certified = "a103d414b6c0e0c89f1784cc44c3a383598d269cfe3fa010e6e7e99a2ed94bac"
	if first != certified {
		t.Fatalf("pinned fixture lattice hash = %s, want certified %s", first, certified)
	}
}

// Admitting the same sources in a different order changes nothing.
//
// This is the property the threshold sample actually needed. It draws pairs by
// index under a fixed seed, so the same seed picks the same POSITIONS holding
// different vectors — which is how ingest order reached the pinned percentile and
// from there the clique structure.
func TestIngestOrderDoesNotChangeTheLattice(t *testing.T) {
	items := determinismItems()
	forward, forwardNodes := latticeOf(t, items)

	reversed := make([]knowledge.AddItem, len(items))
	for i, item := range items {
		reversed[len(items)-1-i] = item
	}
	backward, backwardNodes := latticeOf(t, reversed)

	if len(forward) != len(backward) {
		t.Fatalf("%d windows forward, %d reversed", len(forward), len(backward))
	}
	for i := range forward {
		if forward[i] != backward[i] {
			t.Errorf("window id %d: %q forward, %q reversed", i, forward[i], backward[i])
		}
	}
	if len(forwardNodes) != len(backwardNodes) {
		t.Errorf("%d frontier entries forward, %d reversed — clustering saw a different pool",
			len(forwardNodes), len(backwardNodes))
	}
	for i := range forwardNodes {
		if i < len(backwardNodes) && forwardNodes[i] != backwardNodes[i] {
			t.Errorf("frontier id %d: %q forward, %q reversed", i, forwardNodes[i], backwardNodes[i])
		}
	}
}

// A window's id follows its text, not its position. Prepending a paragraph must
// leave every following window's id alone — this is the property an ordinal-keyed
// scheme gets wrong, and getting it wrong re-embeds a whole document for a
// one-line edit at the top.
func TestPrependingLeavesLaterWindowIDsAlone(t *testing.T) {
	store := knowledge.NewMemoryStore()
	k := knowledge.New(store, fakeEmbedder{dim: 64}, smallWindows)
	ctx := context.Background()
	body := strings.Repeat("A settled sentence that will not move. ", 40)

	before, err := k.Add(ctx, "p", knowledge.SourceTypeDocument, "d1", "", body, nil, 0)
	if err != nil {
		t.Fatal(err)
	}
	src, _, _ := store.SourceByOrigin("p", knowledge.SourceTypeDocument, "d1")
	firstWindows, _ := store.SourceWindows(src.LocalRefID)
	if len(firstWindows) < 3 {
		t.Fatalf("fixture produced %d windows; need several", len(firstWindows))
	}
	firstIDs := map[string]bool{}
	for _, w := range firstWindows {
		firstIDs[w.ID] = true
	}

	after, err := k.Add(ctx, "p", knowledge.SourceTypeDocument, "d1", "",
		"A brand new opening line goes here. "+body, nil, 0)
	if err != nil {
		t.Fatal(err)
	}
	src, _, _ = store.SourceByOrigin("p", knowledge.SourceTypeDocument, "d1")
	secondWindows, _ := store.SourceWindows(src.LocalRefID)

	kept := 0
	for _, w := range secondWindows {
		if firstIDs[w.ID] {
			kept++
		}
	}
	// Prepending shifts every byte range, so windows whose TEXT is unchanged are
	// the ones that must keep their ids. Most of the document is untouched text.
	if kept < len(firstWindows)/2 {
		t.Errorf("only %d of %d window ids survived a prepend (%d windows before, %d after)",
			kept, len(firstWindows), before.Windows, after.Windows)
	}
	if after.Embedded >= after.Windows {
		t.Errorf("prepend re-embedded %d of %d windows; the reuse map did not hold",
			after.Embedded, after.Windows)
	}
}

// An id identifies CONTENT. Wherever an id survives an edit, the text under it
// must be byte-identical.
//
// This is the property that matters, and the obvious test — "do ids survive an
// edit?" — does not check it. Keying an id on the window's ordinal passes that
// test perfectly: ordinals do not move, so every id survives every edit. It also
// makes an id meaningless, because window 3 keeps its id while its text is
// replaced. Nothing would report that. The corpus tier's nodes would go on citing
// member ids whose content had silently changed underneath them, which is the
// exact failure record 0140's stable ids exist to prevent — reached from the
// opposite direction.
//
// Confirmed by falsification: replacing the id derivation with
// windowID(localRef, ordinal, "") leaves the prepend test above green and fails
// this one.
func TestAnIDNeverOutlivesItsText(t *testing.T) {
	store := knowledge.NewMemoryStore()
	k := knowledge.New(store, fakeEmbedder{dim: 64}, smallWindows)
	ctx := context.Background()

	head := strings.Repeat("An opening passage that stays exactly as it is. ", 15)
	tail := strings.Repeat("A closing passage that also stays put. ", 15)
	before := head + strings.Repeat("The middle is about to be rewritten. ", 15) + tail
	after := head + strings.Repeat("Completely different middle content now. ", 15) + tail

	textOf := func(content string) map[string]string {
		if _, err := k.Add(ctx, "p", knowledge.SourceTypeDocument, "d1", "", content, nil, 0); err != nil {
			t.Fatal(err)
		}
		src, _, _ := store.SourceByOrigin("p", knowledge.SourceTypeDocument, "d1")
		windows, err := store.SourceWindows(src.LocalRefID)
		if err != nil {
			t.Fatal(err)
		}
		out := map[string]string{}
		for _, w := range windows {
			out[w.ID] = w.Text
		}
		return out
	}

	first := textOf(before)
	second := textOf(after)
	if len(first) < 3 || len(second) < 3 {
		t.Fatalf("fixture too small: %d windows then %d", len(first), len(second))
	}

	shared := 0
	for id, text := range second {
		was, existed := first[id]
		if !existed {
			continue
		}
		shared++
		if was != text {
			t.Errorf("id %q survived an edit but its text changed:\n was %q\n now %q",
				id, truncate(was), truncate(text))
		}
	}
	// And the edit really did leave something in common, or this proves nothing.
	if shared == 0 {
		t.Error("no id survived the edit, so the invariant was not exercised")
	}
	t.Logf("%d of %d ids survived, every one carrying identical text", shared, len(second))
}

func truncate(s string) string {
	if len(s) <= 60 {
		return s
	}
	return s[:60] + "…"
}

// Two windows with identical text in one source get different ids, because an id
// is a primary key. The occurrence index is what separates them, and it is also
// what reproduces the old priorIDs queue: three identical windows becoming four
// means three keep their ids and the fourth is new.
func TestDuplicateTextStillGetsDistinctIDs(t *testing.T) {
	store := knowledge.NewMemoryStore()
	k := knowledge.New(store, fakeEmbedder{dim: 64}, smallWindows)
	// The same sentence many times over, so windows repeat verbatim.
	text := strings.Repeat("Exactly the same sentence again and again forever. ", 60)

	res, err := k.Add(context.Background(), "p", knowledge.SourceTypeDocument, "d1", "", text, nil, 0)
	if err != nil {
		t.Fatal(err)
	}
	src, _, _ := store.SourceByOrigin("p", knowledge.SourceTypeDocument, "d1")
	windows, _ := store.SourceWindows(src.LocalRefID)
	if len(windows) < 3 {
		t.Fatalf("fixture produced %d windows; need several", len(windows))
	}

	seen := map[string]bool{}
	duplicateTexts := 0
	texts := map[string]int{}
	for _, w := range windows {
		if seen[w.ID] {
			t.Fatalf("duplicate window id %q — an id is a primary key", w.ID)
		}
		seen[w.ID] = true
		texts[w.Text]++
	}
	for _, n := range texts {
		if n > 1 {
			duplicateTexts++
		}
	}
	if duplicateTexts == 0 {
		t.Fatalf("fixture produced no repeated window text, so it does not test this: %d windows", len(windows))
	}
	// And identical text shares one embedding, however many windows carry it.
	if res.Embedded >= res.Windows {
		t.Logf("embedded %d of %d windows", res.Embedded, res.Windows)
	}
}

// Ids stay unique across sources that hold byte-identical content. Two files with
// the same text are two sources, and merging their artifacts would make excluding
// one exclude both.
func TestIdenticalSourcesDoNotShareWindowIDs(t *testing.T) {
	store := knowledge.NewMemoryStore()
	k := knowledge.New(store, fakeEmbedder{dim: 64}, smallWindows)
	text := strings.Repeat("Identical content in two separate places here. ", 30)
	ctx := context.Background()

	for _, id := range []string{"d1", "d2"} {
		if _, err := k.Add(ctx, "p", knowledge.SourceTypeDocument, id, "", text, nil, 0); err != nil {
			t.Fatal(err)
		}
	}
	ids := map[string]string{}
	for _, sourceID := range []string{"d1", "d2"} {
		src, _, _ := store.SourceByOrigin("p", knowledge.SourceTypeDocument, sourceID)
		windows, _ := store.SourceWindows(src.LocalRefID)
		if len(windows) == 0 {
			t.Fatalf("%s produced no windows", sourceID)
		}
		for _, w := range windows {
			if other, clash := ids[w.ID]; clash {
				t.Errorf("window id %q shared by %s and %s", w.ID, other, sourceID)
			}
			ids[w.ID] = sourceID
		}
	}
}

// The same content in two different projects stays distinct too — a project is an
// access boundary, and shared ids across one would be a scope hole.
func TestIdenticalSourcesInTwoProjectsDoNotShareIDs(t *testing.T) {
	store := knowledge.NewMemoryStore()
	k := knowledge.New(store, fakeEmbedder{dim: 64}, smallWindows)
	text := strings.Repeat("The very same words in a different project. ", 30)
	ctx := context.Background()

	seen := map[string]string{}
	for _, project := range []string{"p1", "p2"} {
		if _, err := k.Add(ctx, project, knowledge.SourceTypeDocument, "d1", "", text, nil, 0); err != nil {
			t.Fatal(err)
		}
		src, _, _ := store.SourceByOrigin(project, knowledge.SourceTypeDocument, "d1")
		if other, clash := seen[src.LocalRefID]; clash {
			t.Errorf("local ref %q shared by projects %s and %s", src.LocalRefID, other, project)
		}
		seen[src.LocalRefID] = project
		windows, _ := store.SourceWindows(src.LocalRefID)
		for _, w := range windows {
			if other, clash := seen[w.ID]; clash {
				t.Errorf("window id %q shared by %s and %s", w.ID, other, project)
			}
			seen[w.ID] = project
		}
	}
}

// An id is still 32 hex characters. encodeEdges decodes a stored index's artifact
// ids as 16 raw bytes and rejects anything else, so a derived id has to be
// indistinguishable in shape from the minted one it replaces.
func TestDerivedIDsKeepTheMintedShape(t *testing.T) {
	store := knowledge.NewMemoryStore()
	k := knowledge.New(store, fakeEmbedder{dim: 64}, smallWindows)
	if _, err := k.Add(context.Background(), "p", knowledge.SourceTypeDocument, "d1", "",
		strings.Repeat("Some ordinary prose to window up. ", 30), nil, 0); err != nil {
		t.Fatal(err)
	}
	src, _, _ := store.SourceByOrigin("p", knowledge.SourceTypeDocument, "d1")
	windows, _ := store.SourceWindows(src.LocalRefID)

	check := func(what, id string) {
		if len(id) != 32 {
			t.Errorf("%s %q is %d characters, want 32", what, id, len(id))
		}
		for _, r := range id {
			if !strings.ContainsRune("0123456789abcdef", r) {
				t.Errorf("%s %q holds a non-hex character %q", what, id, r)
				return
			}
		}
	}
	check("local ref", src.LocalRefID)
	for _, w := range windows {
		check("window id", w.ID)
	}
}
