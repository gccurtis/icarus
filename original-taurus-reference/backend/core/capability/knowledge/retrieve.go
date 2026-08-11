package knowledge

// retrieve.go is the read half of the lattice. Every public retrieval captures
// one active-generation token before embedding, routes the query into that
// generation's immutable space, performs every artifact read through its pinned
// view, hydrates literal evidence fail-closed, then rechecks the token. A raced
// source replacement or promotion retries the whole read once; a second race is
// reported as knowledge.evidence_changed rather than emitting a mixed citation.

import (
	"context"
	"errors"
	"fmt"
	"math"
	"sort"
	"strings"
)

// Retrieve follows the lattice best-first, with an exact fallback only when the
// descent threshold surfaces no candidates.
func (k *Knowledge) Retrieve(ctx context.Context, projectID, query string, topK int) (RetrieveResult, error) {
	if topK <= 0 {
		topK = defaultTopK
	}
	return k.stableRetrieve(ctx, projectID, func(view *Knowledge, token ReadToken, space EmbeddingSpace) (RetrieveResult, error) {
		qvecs, usage, err := view.queryVectors(ctx, space, []string{query})
		if err != nil {
			return RetrieveResult{}, err
		}
		q := qvecs[0]
		candidates, err := view.descend(projectID, q)
		if err != nil {
			return RetrieveResult{Usage: usage}, err
		}
		mode := "descent"
		if len(candidates) == 0 {
			if candidates, err = view.store.ProjectWindows(projectID); err != nil {
				return RetrieveResult{Usage: usage}, err
			}
			mode = "exact-fallback"
		}
		regions, err := view.regionsFor(rankWindows(q, candidates, topK), token, space)
		return retrievalResult(regions, mode, usage, token, space), err
	})
}

// RetrieveExact is the certification oracle: every window in the pinned
// generation is ranked, with no lattice pruning.
func (k *Knowledge) RetrieveExact(ctx context.Context, projectID, query string, topK int) (RetrieveResult, error) {
	if topK <= 0 {
		topK = defaultTopK
	}
	return k.stableRetrieve(ctx, projectID, func(view *Knowledge, token ReadToken, space EmbeddingSpace) (RetrieveResult, error) {
		qvecs, usage, err := view.queryVectors(ctx, space, []string{query})
		if err != nil {
			return RetrieveResult{}, err
		}
		windows, err := view.store.ProjectWindows(projectID)
		if err != nil {
			return RetrieveResult{Usage: usage}, err
		}
		regions, err := view.regionsFor(rankWindows(qvecs[0], windows, topK), token, space)
		return retrievalResult(regions, "exact", usage, token, space), err
	})
}

// RetrieveScopedMany ranks only the explicitly allowed origins. The lifecycle
// pin is still mandatory: an allow-list never authorizes mixing generations.
func (k *Knowledge) RetrieveScopedMany(ctx context.Context, projectID string, queries []string, topK int, allow []Origin) (RetrieveResult, error) {
	if topK <= 0 {
		topK = defaultTopK
	}
	if len(allow) == 0 {
		return RetrieveResult{Mode: "scoped"}, nil
	}
	qs := nonblankQueries(queries)
	if len(qs) == 0 {
		return RetrieveResult{}, nil
	}
	return k.stableRetrieve(ctx, projectID, func(view *Knowledge, token ReadToken, space EmbeddingSpace) (RetrieveResult, error) {
		qvecs, usage, err := view.queryVectors(ctx, space, qs)
		if err != nil {
			return RetrieveResult{}, err
		}
		windows, err := view.windowsForOrigins(projectID, allow)
		if err != nil {
			return RetrieveResult{Usage: usage}, err
		}
		regions, err := view.regionsFor(poolRankings(qvecs, windows, topK), token, space)
		return retrievalResult(regions, "scoped", usage, token, space), err
	})
}

// RetrieveMany pools per-query rankings, preserving each window's best score,
// then hydrates one consolidated evidence set.
func (k *Knowledge) RetrieveMany(ctx context.Context, projectID string, queries []string, topK int) (RetrieveResult, error) {
	if topK <= 0 {
		topK = defaultTopK
	}
	qs := nonblankQueries(queries)
	if len(qs) == 0 {
		return RetrieveResult{}, nil
	}
	return k.stableRetrieve(ctx, projectID, func(view *Knowledge, token ReadToken, space EmbeddingSpace) (RetrieveResult, error) {
		qvecs, usage, err := view.queryVectors(ctx, space, qs)
		if err != nil {
			return RetrieveResult{}, err
		}
		mode := "descent"
		seen := map[string]bool{}
		var candidates []Window
		for _, q := range qvecs {
			windows, err := view.descend(projectID, q)
			if err != nil {
				return RetrieveResult{Usage: usage}, err
			}
			for _, window := range windows {
				if !seen[window.ID] {
					seen[window.ID] = true
					candidates = append(candidates, window)
				}
			}
		}
		if len(candidates) == 0 {
			if candidates, err = view.store.ProjectWindows(projectID); err != nil {
				return RetrieveResult{Usage: usage}, err
			}
			mode = "exact-fallback"
		}
		regions, err := view.regionsFor(poolRankings(qvecs, candidates, topK), token, space)
		return retrievalResult(regions, mode, usage, token, space), err
	})
}

type retrievalAttempt func(*Knowledge, ReadToken, EmbeddingSpace) (RetrieveResult, error)

func (k *Knowledge) stableRetrieve(ctx context.Context, projectID string, attempt retrievalAttempt) (RetrieveResult, error) {
	if k.generations == nil {
		return RetrieveResult{}, ErrEmbeddingSpaceUnavailable
	}
	var spent Usage
	for try := 0; try < 2; try++ {
		token, _, space, err := k.generations.Active(projectID, LatticeText)
		if err != nil {
			if errorsIsSpaceEmpty(err) {
				return RetrieveResult{Mode: "descent", Usage: spent}, nil
			}
			return RetrieveResult{}, err
		}
		view := *k
		view.store = k.generations.ForGeneration(token.GenerationID)
		view.generationID = token.GenerationID

		result, runErr := attempt(&view, token, space)
		spent = addUsage(spent, result.Usage)
		current, currentErr := k.generations.Current(token)
		if currentErr != nil {
			return RetrieveResult{}, currentErr
		}
		if current {
			result.Usage = spent
			if runErr != nil {
				return RetrieveResult{}, runErr
			}
			return result, nil
		}
		// Only state races and their structural symptom are retryable here. A
		// provider/database error remains the real error; a generation switch does
		// not make it safe to hide.
		if runErr != nil && !errors.Is(runErr, ErrEvidenceCorrupt) {
			return RetrieveResult{}, runErr
		}
		if try == 1 {
			return RetrieveResult{}, ErrEvidenceChanged
		}
	}
	return RetrieveResult{}, ErrEvidenceChanged
}

func errorsIsSpaceEmpty(err error) bool {
	return errors.Is(err, ErrGenerationNotInitialized)
}

func (k *Knowledge) queryVectors(ctx context.Context, space EmbeddingSpace, texts []string) ([][]float64, Usage, error) {
	if err := space.Validate(); err != nil {
		return nil, Usage{}, fmt.Errorf("%w: %v", ErrEmbeddingSpaceUnavailable, err)
	}
	var (
		embedded Embedded
		err      error
	)
	if exact, ok := k.embedder.(IdentityEmbedder); ok {
		embedded, err = exact.EmbedInSpace(ctx, space, texts)
	} else {
		embedded, err = k.embedder.Embed(ctx, texts)
	}
	if err != nil {
		return nil, embedded.Usage, err
	}
	if embedded.Identity != space.VectorIdentity() {
		return nil, embedded.Usage, ErrEmbeddingSpaceUnavailable
	}
	if len(embedded.Vectors) != len(texts) {
		return nil, embedded.Usage, fmt.Errorf("%w: embedder returned %d vectors for %d inputs",
			ErrEmbeddingSpaceUnavailable, len(embedded.Vectors), len(texts))
	}
	out := make([][]float64, len(embedded.Vectors))
	for i, vector := range embedded.Vectors {
		if len(vector) != space.Dimensions {
			return nil, embedded.Usage, fmt.Errorf("%w: embedding dimension is %d, want %d",
				ErrEmbeddingSpaceUnavailable, len(vector), space.Dimensions)
		}
		for _, component := range vector {
			if math.IsNaN(component) || math.IsInf(component, 0) {
				return nil, embedded.Usage, fmt.Errorf("%w: embedding contains a non-finite component", ErrEmbeddingSpaceUnavailable)
			}
		}
		out[i] = normalize(vector)
	}
	return out, embedded.Usage, nil
}

func nonblankQueries(queries []string) []string {
	out := make([]string, 0, len(queries))
	for _, query := range queries {
		if strings.TrimSpace(query) != "" {
			out = append(out, query)
		}
	}
	return out
}

func retrievalResult(regions []Region, mode string, usage Usage, token ReadToken, space EmbeddingSpace) RetrieveResult {
	return RetrieveResult{
		Regions: regions, Mode: mode, Usage: usage,
		GenerationID: token.GenerationID, SourceCursor: token.SourceCursor,
		SpaceIdentity: space.Identity(),
	}
}

// windowsForOrigins loads exactly the allowed origins from the pinned view.
func (k *Knowledge) windowsForOrigins(projectID string, allow []Origin) ([]Window, error) {
	seen := make(map[string]bool, len(allow))
	var out []Window
	for _, origin := range allow {
		source, ok, err := k.store.SourceByOrigin(projectID, origin.SourceType, origin.SourceID)
		if err != nil {
			return nil, err
		}
		if !ok || seen[source.LocalRefID] {
			continue
		}
		seen[source.LocalRefID] = true
		windows, err := k.store.SourceWindows(source.LocalRefID)
		if err != nil {
			return nil, err
		}
		out = append(out, windows...)
	}
	return out, nil
}

func poolRankings(qvecs [][]float64, windows []Window, topK int) []scoredWindow {
	best := map[string]scoredWindow{}
	for _, q := range qvecs {
		for _, scored := range rankWindows(q, windows, topK) {
			if current, ok := best[scored.w.ID]; !ok || scored.score > current.score {
				best[scored.w.ID] = scored
			}
		}
	}
	out := make([]scoredWindow, 0, len(best))
	for _, scored := range best {
		out = append(out, scored)
	}
	return out
}

func (k *Knowledge) regionsFor(ranked []scoredWindow, token ReadToken, space EmbeddingSpace) ([]Region, error) {
	refSet := map[string]bool{}
	ids := make([]string, 0, len(ranked))
	for _, scored := range ranked {
		refSet[scored.w.LocalRefID] = true
		ids = append(ids, scored.w.ID)
	}
	refs := make([]string, 0, len(refSet))
	for ref := range refSet {
		refs = append(refs, ref)
	}
	sources, err := k.store.SourcesByRef(refs)
	if err != nil {
		return nil, err
	}
	content, err := k.store.WindowContent(ids)
	if err != nil {
		return nil, err
	}
	return buildRegionsChecked(ranked, sources, content, k.charBudget, token, space)
}

type scoredWindow struct {
	w     Window
	score float64
}

func rankWindows(q []float64, windows []Window, topK int) []scoredWindow {
	ranked := make([]scoredWindow, 0, len(windows))
	for _, window := range windows {
		ranked = append(ranked, scoredWindow{w: window, score: dot(q, window.Embedding)})
	}
	sort.Slice(ranked, func(i, j int) bool {
		if ranked[i].score != ranked[j].score {
			return ranked[i].score > ranked[j].score
		}
		return ranked[i].w.ID < ranked[j].w.ID
	})
	if len(ranked) > topK {
		ranked = ranked[:topK]
	}
	return ranked
}
