package knowledge_test

import (
	"context"
	"errors"
	"io"
	"strings"
	"sync"
	"testing"

	"github.com/gccurtis/taurus-omega/core/capability/knowledge"
	"github.com/gccurtis/taurus-omega/core/platform/limit"
)

func boundedContent(size int64, text string) knowledge.Content {
	return knowledge.Content{
		Size: size,
		Open: func() (io.ReadCloser, error) {
			return io.NopCloser(strings.NewReader(text)), nil
		},
	}
}

func TestActualSourceByteLimitDoesNotTrustProviderSize(t *testing.T) {
	text := strings.Repeat("a source whose actual bytes exceed every provider claim. ", 4)
	for _, claimed := range []int64{0, -1, 1} {
		t.Run("claimed-size", func(t *testing.T) {
			k := knowledge.New(knowledge.NewMemoryStore(), fakeEmbedder{dim: 16}, knowledge.Options{
				WindowTargetRunes: 20, WindowOverlapRunes: 4, MaxSourceBytes: 64,
			})
			_, err := k.AddBatch(context.Background(), "p", []knowledge.AddItem{{
				SourceType: knowledge.SourceTypeConnector, SourceID: "connector/file", Label: "file.txt",
				Content: boundedContent(claimed, text),
			}})
			if !errors.Is(err, knowledge.ErrSourceBytesLimit) {
				t.Fatalf("claimed size %d: err = %v, want source byte refusal", claimed, err)
			}
			e, ok := limit.From(err)
			if !ok || e.Code != knowledge.CodeSourceBytesLimit || e.Limit != 64 || e.Actual <= 64 {
				t.Fatalf("claimed size %d: limit = %#v, want actual typed limit", claimed, e)
			}
		})
	}
}

type endlessReader struct{ chunk string }

func (r endlessReader) Read(p []byte) (int, error) {
	return copy(p, r.chunk), nil
}

func TestActualSourceByteLimitStopsAnEndlessStream(t *testing.T) {
	k := knowledge.New(knowledge.NewMemoryStore(), fakeEmbedder{dim: 16}, knowledge.Options{
		WindowTargetRunes: 20, WindowOverlapRunes: 4, MaxSourceBytes: 48,
	})
	_, err := k.AddBatch(context.Background(), "p", []knowledge.AddItem{{
		SourceType: knowledge.SourceTypeConnector, SourceID: "connector/endless",
		Content: knowledge.Content{
			Size: 0,
			Open: func() (io.ReadCloser, error) { return io.NopCloser(endlessReader{chunk: "0123456789abcdef"}), nil },
		},
	}})
	if !errors.Is(err, knowledge.ErrSourceBytesLimit) {
		t.Fatalf("err = %v, want bounded endless stream refusal", err)
	}
}

type countedEndlessReader struct{ bytesRead int }

func (r *countedEndlessReader) Read(p []byte) (int, error) {
	n := copy(p, "0123456789abcdef")
	r.bytesRead += n
	return n, nil
}

func TestRunByteLimitStopsDuringASourceRatherThanAfterIt(t *testing.T) {
	r := &countedEndlessReader{}
	k := knowledge.New(knowledge.NewMemoryStore(), fakeEmbedder{dim: 16}, knowledge.Options{
		WindowTargetRunes: 20, WindowOverlapRunes: 4, MaxSourceBytes: 128, MaxRunBytes: 40,
	})
	_, err := k.AddBatch(context.Background(), "p", []knowledge.AddItem{{
		SourceType: knowledge.SourceTypeConnector, SourceID: "connector/endless",
		Content: knowledge.Content{Open: func() (io.ReadCloser, error) { return io.NopCloser(r), nil }},
	}})
	if !errors.Is(err, knowledge.ErrRunBytesLimit) {
		t.Fatalf("err = %v, want run byte refusal", err)
	}
	if r.bytesRead != 41 {
		t.Fatalf("reader consumed %d bytes, want only the byte that proves it exceeded the 40-byte cap", r.bytesRead)
	}
}

func TestCancelledIngestStopsRatherThanReportingAnUnreadableSource(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	k := knowledge.New(knowledge.NewMemoryStore(), fakeEmbedder{dim: 16}, knowledge.Options{})
	_, err := k.AddBatch(ctx, "p", []knowledge.AddItem{{
		SourceType: knowledge.SourceTypeConnector, SourceID: "connector/cancelled",
		Content: boundedContent(0, "content that must not be opened after cancellation"),
	}})
	if !errors.Is(err, context.Canceled) || errors.Is(err, knowledge.ErrUnreadable) {
		t.Fatalf("err = %v, want cancellation rather than a skipped unreadable source", err)
	}
}

func TestActualRunByteLimitIncludesEveryReadSource(t *testing.T) {
	k := knowledge.New(knowledge.NewMemoryStore(), fakeEmbedder{dim: 16}, knowledge.Options{
		WindowTargetRunes: 20, WindowOverlapRunes: 4, MaxSourceBytes: 128, MaxRunBytes: 40,
	})
	items := []knowledge.AddItem{
		{SourceType: knowledge.SourceTypeDocument, SourceID: "one", Content: boundedContent(0, strings.Repeat("a", 24))},
		{SourceType: knowledge.SourceTypeDocument, SourceID: "two", Content: boundedContent(0, strings.Repeat("b", 24))},
	}
	_, err := k.AddBatch(context.Background(), "p", items)
	if !errors.Is(err, knowledge.ErrRunBytesLimit) {
		t.Fatalf("err = %v, want run byte refusal", err)
	}
	e, ok := limit.From(err)
	if !ok || e.Code != knowledge.CodeRunBytesLimit || e.Limit != 40 || e.Actual != 41 {
		t.Fatalf("limit = %#v, want the first byte beyond the 40-byte run limit", e)
	}
}

func sourceTierArtifacts(t *testing.T, store *knowledge.MemoryStore, projectID string) int {
	t.Helper()
	counts, err := store.ArtifactCounts(projectID)
	if err != nil {
		t.Fatal(err)
	}
	total := 0
	for _, n := range counts {
		total += n
	}
	return total
}

func TestExactArtifactAdmissionCountsNodesNotJustProjectedWindows(t *testing.T) {
	text := strings.Repeat("alpha beta gamma delta epsilon zeta eta theta. ", 90)
	probeStore := knowledge.NewMemoryStore()
	probe := knowledge.New(probeStore, fakeEmbedder{dim: 32}, smallWindows)
	if _, err := probe.Add(context.Background(), "p", knowledge.SourceTypeDocument, "d", "", text, nil, 0); err != nil {
		t.Fatal(err)
	}
	exact := sourceTierArtifacts(t, probeStore, "p")
	if exact < 2 {
		t.Fatalf("fixture produced %d artifacts, want windows plus source nodes", exact)
	}

	store := knowledge.NewMemoryStore()
	opts := smallWindows
	opts.MaxArtifacts = exact - 1
	k := knowledge.New(store, fakeEmbedder{dim: 32}, opts)
	_, err := k.Add(context.Background(), "p", knowledge.SourceTypeDocument, "d", "", text, nil, 0)
	if !errors.Is(err, knowledge.ErrArtifactLimit) {
		t.Fatalf("err = %v, want exact artifact refusal", err)
	}
	e, ok := limit.From(err)
	if !ok || e.Actual != int64(exact) || e.Limit != int64(exact-1) {
		t.Fatalf("limit = %#v, want exact %d against %d", e, exact, exact-1)
	}
	if _, found, _ := store.SourceByOrigin("p", knowledge.SourceTypeDocument, "d"); found {
		t.Fatal("a refused candidate became current")
	}
}

func TestCorpusAdmissionRefusesNodesThatWouldExceedTheCeiling(t *testing.T) {
	store := knowledge.NewMemoryStore()
	text := strings.Repeat("shared topic words make enough source frontier entries. ", 100)
	seed := knowledge.New(store, fakeEmbedder{dim: 32}, smallWindows)
	if _, err := seed.AddBatch(context.Background(), "p", []knowledge.AddItem{
		{SourceType: knowledge.SourceTypeDocument, SourceID: "one", Content: knowledge.TextContent(text)},
		{SourceType: knowledge.SourceTypeDocument, SourceID: "two", Content: knowledge.TextContent(text + " a distinct ending.")},
	}); err != nil {
		t.Fatal(err)
	}
	sourceOnly := sourceTierArtifacts(t, store, "p")
	opts := smallWindows
	opts.MaxArtifacts = sourceOnly
	bounded := knowledge.New(store, fakeEmbedder{dim: 32}, opts)
	err := bounded.RebuildCorpus(context.Background(), "p")
	if !errors.Is(err, knowledge.ErrArtifactLimit) {
		t.Fatalf("rebuild err = %v, want corpus-node artifact refusal", err)
	}
	if current, err := bounded.CorpusCurrent("p"); err != nil || current {
		t.Fatalf("corpus current = %v, %v; refused corpus must remain pending", current, err)
	}
	if got := sourceTierArtifacts(t, store, "p"); got != sourceOnly {
		t.Fatalf("refused rebuild changed source-tier total to %d, want %d", got, sourceOnly)
	}
}

func TestConcurrentExactAdmissionsCannotOverspendProjectCapacity(t *testing.T) {
	text := strings.Repeat("same shape, independently admitted under a shared cap. ", 80)
	probeStore := knowledge.NewMemoryStore()
	probe := knowledge.New(probeStore, fakeEmbedder{dim: 32}, smallWindows)
	if _, err := probe.Add(context.Background(), "p", knowledge.SourceTypeDocument, "probe", "", text, nil, 0); err != nil {
		t.Fatal(err)
	}
	max := sourceTierArtifacts(t, probeStore, "p")

	store := knowledge.NewMemoryStore()
	opts := smallWindows
	opts.MaxArtifacts = max
	k := knowledge.New(store, fakeEmbedder{dim: 32}, opts)
	errs := make(chan error, 2)
	var wg sync.WaitGroup
	for _, id := range []string{"left", "right"} {
		wg.Add(1)
		go func(id string) {
			defer wg.Done()
			_, err := k.Add(context.Background(), "p", knowledge.SourceTypeDocument, id, "", text, nil, 0)
			errs <- err
		}(id)
	}
	wg.Wait()
	close(errs)
	successes := 0
	for err := range errs {
		if err == nil {
			successes++
			continue
		}
		if !errors.Is(err, knowledge.ErrArtifactLimit) {
			t.Fatalf("concurrent admission err = %v, want typed capacity refusal", err)
		}
	}
	if successes != 1 {
		t.Fatalf("%d concurrent admissions succeeded, want exactly one", successes)
	}
	if got := sourceTierArtifacts(t, store, "p"); got > max {
		t.Fatalf("project holds %d artifacts over ceiling %d", got, max)
	}
}

type partialUsageEmbedder struct{ inner fakeEmbedder }

func (e partialUsageEmbedder) Embed(ctx context.Context, texts []string) (knowledge.Embedded, error) {
	completed := len(texts)
	if completed > 2 {
		completed = 2
	}
	partial, err := e.inner.Embed(ctx, texts[:completed])
	if err != nil {
		return knowledge.Embedded{}, err
	}
	partial.Usage = knowledge.Usage{PromptTokens: completed * 7, TotalTokens: completed * 7}
	return partial, &knowledge.PartialEmbeddingError{
		CompletedInputs: completed, Usage: partial.Usage, Cause: errors.New("later provider micro-batch failed"),
	}
}

func TestFailedEmbeddingKeepsPaidPartialUsageInAddResults(t *testing.T) {
	store := knowledge.NewMemoryStore()
	k := knowledge.New(store, partialUsageEmbedder{inner: fakeEmbedder{dim: 16}}, knowledge.Options{
		WindowTargetRunes: 20, WindowOverlapRunes: 4,
	})
	results, err := k.AddBatch(context.Background(), "p", []knowledge.AddItem{{
		SourceType: knowledge.SourceTypeDocument, SourceID: "d",
		Content: knowledge.TextContent(strings.Repeat("a sentence with several windows. ", 20)),
	}})
	var partial *knowledge.PartialEmbeddingError
	if !errors.As(err, &partial) {
		t.Fatalf("err = %v, want partial embedding error", err)
	}
	if len(results) != 1 || results[0].Usage.TotalTokens != partial.Usage.TotalTokens || results[0].Embedded != partial.CompletedInputs {
		t.Fatalf("results = %+v, partial = %+v; paid prefix was lost", results, partial)
	}
	if _, found, _ := store.SourceByOrigin("p", knowledge.SourceTypeDocument, "d"); found {
		t.Fatal("a source with an incomplete embedding batch became current")
	}
}
