package intelligence

import (
	"context"
	"errors"
	"fmt"
	"testing"
	"time"
)

// chunkRecorder answers any batch with one vector per input, encoding the input's
// text into the vector so a caller can prove which vector came from which input.
// It records the size of every request it received.
// Each failXFor field makes the first n calls fail that way, so a test can say
// "refuse twice then answer" and assert on how the retry loop responded. They name
// four failures the loop must treat differently: wait and retry, wait and retry,
// abandon at once, and retry at once.
type chunkRecorder struct {
	sizes []int
	// failRateLimitedFor makes the first n calls fail with a rate limit, carrying
	// retryAfter when it is set (zero means the provider named no delay, which is
	// what makes the caller fall back to its own backoff).
	failRateLimitedFor int
	retryAfter         time.Duration
	// failTimeoutFor makes the first n calls fail the way a provider that did not
	// answer in time does — ErrProviderTimeout, which the adapter is responsible for
	// distinguishing from a caller who gave up.
	failTimeoutFor int
	// failCancelledFor makes the first n calls fail as a caller who has walked away.
	failCancelledFor int
	// shortVectorsFor makes the first n calls answer successfully with one vector
	// too few — a wrong answer rather than a refusal.
	shortVectorsFor int
	calls           int
}

func (c *chunkRecorder) Name() string { return "chunky" }

func (c *chunkRecorder) Inference(context.Context, InferenceRequest) (InferenceResponse, error) {
	return InferenceResponse{}, nil
}

func (c *chunkRecorder) Reasoning(context.Context, ReasoningRequest) (ReasoningResponse, error) {
	return ReasoningResponse{}, nil
}

func (c *chunkRecorder) Embed(_ context.Context, req EmbeddingRequest) (EmbeddingResponse, error) {
	c.calls++
	switch {
	case c.calls <= c.failRateLimitedFor:
		if c.retryAfter > 0 {
			return EmbeddingResponse{}, &RateLimited{
				RetryAfter: c.retryAfter, Provider: "chunky", Detail: "slow down",
			}
		}
		// The bare sentinel, wrapped the way an adapter with no delay to report does.
		return EmbeddingResponse{}, fmt.Errorf("chunky: %w: slow down", ErrRateLimited)
	case c.calls <= c.failTimeoutFor:
		// Wrapping context.DeadlineExceeded as well is the whole point: a real client
		// timeout carries it, and the loop must still tell this apart from a caller who
		// gave up.
		return EmbeddingResponse{}, fmt.Errorf("chunky: %w: %w", ErrProviderTimeout, context.DeadlineExceeded)
	case c.calls <= c.failCancelledFor:
		return EmbeddingResponse{}, fmt.Errorf("chunky: %w", context.Canceled)
	}
	c.sizes = append(c.sizes, len(req.Inputs))
	vectors := make([][]float64, len(req.Inputs))
	for i, in := range req.Inputs {
		// The vector IS the input's identity, so a misordered concatenation cannot
		// pass: every input maps to a distinct, checkable value.
		vectors[i] = []float64{float64(len(in)), float64(in[0])}
	}
	if c.calls <= c.shortVectorsFor && len(vectors) > 0 {
		vectors = vectors[:len(vectors)-1]
	}
	return EmbeddingResponse{
		Vectors: vectors,
		Usage:   Usage{PromptTokens: len(req.Inputs), TotalTokens: len(req.Inputs)},
	}, nil
}

func newChunked(t *testing.T, prov Provider, opts EmbeddingOptions) *Intelligence {
	t.Helper()
	in, err := New(Options{
		Providers: map[string]Provider{"chunky": prov},
		Routes: map[Kind][]Route{
			KindEmbedding: {{Cast: lowFastCheap, Provider: "chunky", Model: "embed/model"}},
		},
		Embedding: opts,
	})
	if err != nil {
		t.Fatal(err)
	}
	return in
}

// A batch larger than the chunk size becomes several provider requests, and the
// vectors come back in input order across the seam. Ordering is the whole risk of
// a scatter/gather: a caller pairs inputs to vectors by index.
func TestEmbedChunksAndPreservesOrder(t *testing.T) {
	prov := &chunkRecorder{}
	in := newChunked(t, prov, EmbeddingOptions{MaxBatchInputs: 4})

	inputs := []string{"aa", "bbb", "cccc", "ddddd", "eeeeee", "fffffff", "gg", "hhh", "iiii"}
	res, err := in.Embed(context.Background(), EmbedRequest{Cast: lowFastCheap, Inputs: inputs})
	if err != nil {
		t.Fatal(err)
	}

	// 9 inputs at 4 per request: 4, 4, 1.
	want := []int{4, 4, 1}
	if len(prov.sizes) != len(want) {
		t.Fatalf("provider calls = %v, want %v", prov.sizes, want)
	}
	for i, n := range want {
		if prov.sizes[i] != n {
			t.Errorf("call %d carried %d inputs, want %d", i, prov.sizes[i], n)
		}
	}
	if len(res.Vectors) != len(inputs) {
		t.Fatalf("got %d vectors for %d inputs", len(res.Vectors), len(inputs))
	}
	for i, in := range inputs {
		if res.Vectors[i][0] != float64(len(in)) || res.Vectors[i][1] != float64(in[0]) {
			t.Errorf("vector %d = %v, does not correspond to input %q", i, res.Vectors[i], in)
		}
	}
	// Usage sums across every chunk, or a large ingest would under-report its cost.
	if res.Usage.TotalTokens != len(inputs) {
		t.Errorf("usage = %d tokens, want %d summed across chunks", res.Usage.TotalTokens, len(inputs))
	}
	if res.Provider != "chunky" || res.Model != "embed/model" {
		t.Errorf("identity = %s/%s, want the resolved route", res.Provider, res.Model)
	}
}

// A batch at or under the chunk size is exactly one request — the unchunked path
// must not change behaviour, since every retrieval query takes it.
func TestEmbedSingleInputIsOneCall(t *testing.T) {
	prov := &chunkRecorder{}
	in := newChunked(t, prov, EmbeddingOptions{MaxBatchInputs: 96})

	res, err := in.Embed(context.Background(), EmbedRequest{Cast: lowFastCheap, Inputs: []string{"a query"}})
	if err != nil {
		t.Fatal(err)
	}
	if len(prov.sizes) != 1 || prov.sizes[0] != 1 {
		t.Errorf("provider calls = %v, want exactly one call of one input", prov.sizes)
	}
	if len(res.Vectors) != 1 {
		t.Errorf("got %d vectors, want 1", len(res.Vectors))
	}
}

// An empty batch never reaches the provider.
func TestEmbedEmptyBatchMakesNoCall(t *testing.T) {
	prov := &chunkRecorder{}
	in := newChunked(t, prov, EmbeddingOptions{MaxBatchInputs: 4})

	res, err := in.Embed(context.Background(), EmbedRequest{Cast: lowFastCheap, Inputs: nil})
	if err != nil {
		t.Fatal(err)
	}
	if prov.calls != 0 {
		t.Errorf("provider was called %d time(s) for an empty batch", prov.calls)
	}
	if len(res.Vectors) != 0 {
		t.Errorf("got %d vectors for an empty batch", len(res.Vectors))
	}
}

type failsAfterOneChunk struct{ calls int }

func (p *failsAfterOneChunk) Name() string { return "partial" }
func (p *failsAfterOneChunk) Inference(context.Context, InferenceRequest) (InferenceResponse, error) {
	return InferenceResponse{}, nil
}
func (p *failsAfterOneChunk) Reasoning(context.Context, ReasoningRequest) (ReasoningResponse, error) {
	return ReasoningResponse{}, nil
}
func (p *failsAfterOneChunk) Embed(_ context.Context, req EmbeddingRequest) (EmbeddingResponse, error) {
	p.calls++
	if p.calls > 1 {
		return EmbeddingResponse{}, errors.New("second chunk failed")
	}
	vectors := make([][]float64, len(req.Inputs))
	for i := range vectors {
		vectors[i] = []float64{float64(i + 1)}
	}
	return EmbeddingResponse{Vectors: vectors, Usage: Usage{PromptTokens: len(vectors), TotalTokens: len(vectors)}}, nil
}

func TestEmbedReportsUsageForCompletedChunksWhenALaterChunkFails(t *testing.T) {
	provider := &failsAfterOneChunk{}
	in := newChunked(t, provider, EmbeddingOptions{MaxBatchInputs: 2})
	res, err := in.Embed(context.Background(), EmbedRequest{Cast: lowFastCheap, Inputs: []string{"one", "two", "three"}})
	var partial *PartialEmbeddingError
	if !errors.As(err, &partial) {
		t.Fatalf("err = %v, want PartialEmbeddingError", err)
	}
	if partial.CompletedInputs != 2 || partial.Usage.TotalTokens != 2 {
		t.Fatalf("partial = %+v, want two paid inputs", partial)
	}
	if len(res.Vectors) != 2 || res.Usage.TotalTokens != 2 {
		t.Fatalf("result = %+v, want the completed prefix and its usage", res)
	}
}

// A rate limit is waited out on the same model, not failed over — an embedding
// cast has no fallback, so the only correct response is to slow down.
func TestEmbedRidesOutARateLimit(t *testing.T) {
	prov := &chunkRecorder{failRateLimitedFor: 2}
	in := newChunked(t, prov, EmbeddingOptions{
		MaxBatchInputs: 4,
		MaxWait:        time.Second,
		Backoff:        time.Millisecond, // keep the test fast; the path is what matters
	})

	res, err := in.Embed(context.Background(), EmbedRequest{Cast: lowFastCheap, Inputs: []string{"aa", "bbb"}})
	if err != nil {
		t.Fatalf("a rate limit inside the wait budget should succeed: %v", err)
	}
	if prov.calls != 3 {
		t.Errorf("provider calls = %d, want 3 (two refusals then a success)", prov.calls)
	}
	if len(res.Vectors) != 2 {
		t.Errorf("got %d vectors, want 2", len(res.Vectors))
	}
}

// Exhausting the wait budget surfaces the rate limit rather than hiding it as a
// generic failure — the caller needs to know to come back later.
func TestEmbedGivesUpAndReportsTheRateLimit(t *testing.T) {
	prov := &chunkRecorder{failRateLimitedFor: 99}
	in := newChunked(t, prov, EmbeddingOptions{
		MaxBatchInputs: 4,
		// One millisecond of patience against a doubling millisecond backoff: the
		// first wait fits, the second would not.
		MaxWait: time.Millisecond,
		Backoff: time.Millisecond,
	})

	_, err := in.Embed(context.Background(), EmbedRequest{Cast: lowFastCheap, Inputs: []string{"aa"}})
	if !errors.Is(err, ErrRateLimited) {
		t.Fatalf("err = %v, want it to wrap ErrRateLimited", err)
	}
	if prov.calls != 2 {
		t.Errorf("provider calls = %d, want 2 (one refusal, one wait inside budget, one more refusal)", prov.calls)
	}
}

// A provider's Retry-After is honoured in preference to our own backoff. The
// provider knows when its window resets and we do not, so guessing is strictly
// worse — and guessing SHORT means walking straight back into the limit.
//
// The assertion is by timing, which is the only observable difference: a tiny
// Retry-After against a backoff of ten seconds means a run that finishes quickly
// used the header, and one that hangs did not.
func TestEmbedHonoursRetryAfterOverItsOwnBackoff(t *testing.T) {
	prov := &chunkRecorder{
		failRateLimitedFor: 1,
		retryAfter:         5 * time.Millisecond,
	}
	in := newChunked(t, prov, EmbeddingOptions{
		MaxBatchInputs: 4,
		MaxWait:        time.Minute,
		Backoff:        10 * time.Second, // never used if Retry-After wins
	})

	start := time.Now()
	if _, err := in.Embed(context.Background(), EmbedRequest{Cast: lowFastCheap, Inputs: []string{"aa"}}); err != nil {
		t.Fatalf("embed: %v", err)
	}
	if elapsed := time.Since(start); elapsed > time.Second {
		t.Fatalf("waited %v; the provider's Retry-After was ignored in favour of the backoff", elapsed)
	}
	if prov.calls != 2 {
		t.Errorf("provider calls = %d, want 2", prov.calls)
	}
}

// A Retry-After longer than the whole budget gives up AT ONCE rather than
// honouring it.
//
// This is the case where honouring the provider would be wrong: it has asked for
// an hour, and sleeping an hour inside a request is exactly the unbounded wait the
// budget exists to prevent. Give up, report the rate limit, and let something above
// decide to come back later.
func TestEmbedRefusesARetryAfterBeyondTheBudget(t *testing.T) {
	prov := &chunkRecorder{failRateLimitedFor: 99, retryAfter: time.Hour}
	in := newChunked(t, prov, EmbeddingOptions{
		MaxBatchInputs: 4,
		MaxWait:        90 * time.Second,
		Backoff:        time.Millisecond,
	})

	start := time.Now()
	_, err := in.Embed(context.Background(), EmbedRequest{Cast: lowFastCheap, Inputs: []string{"aa"}})
	if !errors.Is(err, ErrRateLimited) {
		t.Fatalf("err = %v, want it to wrap ErrRateLimited", err)
	}
	if elapsed := time.Since(start); elapsed > time.Second {
		t.Fatalf("waited %v; an over-budget Retry-After must not be slept", elapsed)
	}
	if prov.calls != 1 {
		t.Errorf("provider calls = %d, want 1 — there was no budget to retry within", prov.calls)
	}
}

// A provider timeout is waited out and retried, not abandoned.
//
// This is the defect that made it worst exactly when it mattered most. An
// http.Client's own Timeout surfaces as an error satisfying
// errors.Is(err, context.DeadlineExceeded) — the same shape as the caller's context
// expiring — so shouldFallover read it as "the caller gave up" and the embed
// aborted with no retry at all, on a provider that was merely busy.
func TestEmbedRetriesAProviderTimeout(t *testing.T) {
	prov := &chunkRecorder{failTimeoutFor: 2}
	in := newChunked(t, prov, EmbeddingOptions{
		MaxBatchInputs: 4,
		MaxWait:        time.Second,
		Backoff:        time.Millisecond,
	})

	res, err := in.Embed(context.Background(), EmbedRequest{Cast: lowFastCheap, Inputs: []string{"aa"}})
	if err != nil {
		t.Fatalf("a provider timeout inside the wait budget should be retried: %v", err)
	}
	if prov.calls != 3 {
		t.Errorf("provider calls = %d, want 3 (two timeouts then a success)", prov.calls)
	}
	if len(res.Vectors) != 1 {
		t.Errorf("got %d vectors, want 1", len(res.Vectors))
	}
}

// The caller's own cancellation still ends the call at once. It is the other half
// of the timeout fix: making a provider timeout retryable must not also make a
// caller who has walked away retryable, and the two are only distinguishable
// because the adapter says which happened.
func TestEmbedStillAbandonsACancelledCaller(t *testing.T) {
	prov := &chunkRecorder{failCancelledFor: 99}
	in := newChunked(t, prov, EmbeddingOptions{
		MaxBatchInputs: 4,
		MaxWait:        time.Minute,
		Backoff:        time.Millisecond,
	})

	_, err := in.Embed(context.Background(), EmbedRequest{Cast: lowFastCheap, Inputs: []string{"aa"}})
	if !errors.Is(err, context.Canceled) {
		t.Fatalf("err = %v, want the caller's cancellation surfaced", err)
	}
	if prov.calls != 1 {
		t.Errorf("provider calls = %d, want 1 — a caller who gave up is not retried", prov.calls)
	}
}

// A wrong answer — a short vector list — is re-asked immediately and once, with no
// wait. It is a hiccup, not a refusal: waiting buys nothing, and a provider that
// answers wrongly twice in a row is not going to be fixed by a third ask.
func TestEmbedRetriesAShortVectorListOnceWithoutWaiting(t *testing.T) {
	prov := &chunkRecorder{shortVectorsFor: 1}
	in := newChunked(t, prov, EmbeddingOptions{
		MaxBatchInputs: 4,
		MaxWait:        time.Minute,
		Backoff:        10 * time.Second, // must not be waited
	})

	start := time.Now()
	if _, err := in.Embed(context.Background(), EmbedRequest{Cast: lowFastCheap, Inputs: []string{"aa"}}); err != nil {
		t.Fatalf("embed: %v", err)
	}
	if elapsed := time.Since(start); elapsed > time.Second {
		t.Fatalf("waited %v; a hiccup retry must not sleep", elapsed)
	}
	if prov.calls != 2 {
		t.Errorf("provider calls = %d, want 2", prov.calls)
	}
}

// A cancelled context during a wait returns promptly instead of holding the
// caller for the remaining delay.
func TestEmbedBackoffHonoursContextCancellation(t *testing.T) {
	prov := &chunkRecorder{failRateLimitedFor: 99}
	in := newChunked(t, prov, EmbeddingOptions{
		MaxBatchInputs: 4,
		MaxWait:        time.Minute,
		Backoff:        10 * time.Second,
	})

	ctx, cancel := context.WithCancel(context.Background())
	go func() {
		time.Sleep(20 * time.Millisecond)
		cancel()
	}()

	start := time.Now()
	_, err := in.Embed(ctx, EmbedRequest{Cast: lowFastCheap, Inputs: []string{"aa"}})
	if err == nil {
		t.Fatal("want an error when the context is cancelled mid-backoff")
	}
	if elapsed := time.Since(start); elapsed > 5*time.Second {
		t.Errorf("waited %v; the backoff ignored cancellation", elapsed)
	}
}
