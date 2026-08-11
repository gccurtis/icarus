package sqlite

import (
	"encoding/json"
	"math"
	"testing"
	"time"

	"github.com/gccurtis/taurus-omega/core/capability/knowledge"
)

// Vectors are stored as JSON text today. This measures what that costs against
// the fixed-width alternative, because "JSON is slow" is an assertion until
// there is a number, and a storage migration is too expensive to do on a hunch.
//
// The dimension is text-embedding-3-small's, and the values are deliberately
// awkward — full float64 precision, not round numbers — since short decimals
// would flatter the JSON path in a way real embeddings never do.

const benchDims = 1536

func benchVector() []float64 {
	v := make([]float64, benchDims)
	for i := range v {
		v[i] = math.Sin(float64(i)) * 0.0271828182845904
	}
	return v
}

func benchJSON(t testing.TB) []byte {
	t.Helper()
	b, err := json.Marshal(benchVector())
	if err != nil {
		t.Fatal(err)
	}
	return b
}

func BenchmarkVectorDecodeJSON(b *testing.B) {
	raw := benchJSON(b)
	b.ReportMetric(float64(len(raw)), "stored-bytes")
	b.ResetTimer()
	for b.Loop() {
		var v []float64
		if err := json.Unmarshal(raw, &v); err != nil {
			b.Fatal(err)
		}
	}
}

func BenchmarkVectorDecodeBlob(b *testing.B) {
	raw := encodeVector(benchVector())
	b.ReportMetric(float64(len(raw)), "stored-bytes")
	b.ResetTimer()
	for b.Loop() {
		_ = decodeVector(raw)
	}
}

func BenchmarkVectorEncodeJSON(b *testing.B) {
	v := benchVector()
	for b.Loop() {
		if _, err := json.Marshal(v); err != nil {
			b.Fatal(err)
		}
	}
}

func BenchmarkVectorEncodeBlob(b *testing.B) {
	v := benchVector()
	for b.Loop() {
		_ = encodeVector(v)
	}
}

// float32 is only viable if it does not move a cosine similarity enough to
// matter. This bounds the error empirically rather than assuming it.
func TestFloat32RoundTripPreservesCosine(t *testing.T) {
	a := benchVector()
	c := make([]float64, benchDims)
	for i := range c {
		c[i] = math.Cos(float64(i)) * 0.031415926535
	}
	exact := dotf(a, c)
	approx := dotf(decodeVector(encodeVector(a)), decodeVector(encodeVector(c)))
	if d := math.Abs(exact - approx); d > 1e-7 {
		t.Errorf("float32 round trip moved the dot product by %g (exact %g, approx %g)", d, exact, approx)
	}
}

func dotf(a, b []float64) float64 {
	var s float64
	for i := range a {
		s += a[i] * b[i]
	}
	return s
}

// A database written before the BLOB column existed must keep working, and must
// stop paying the JSON cost after one startup. Embeddings are the one part of
// the lattice that cannot be recomputed for free — they cost provider tokens —
// so this is migrated in place rather than dropped and rebuilt.
func TestBackfillConvertsLegacyJSONVectors(t *testing.T) {
	s := openTemp(t)
	now := time.Now().UTC().Truncate(time.Second)

	// Seed a row the way the old code did: JSON in, BLOB absent.
	src := knowledge.Source{
		LocalRefID: "ref1", SourceType: "document", SourceID: "doc1",
		ProjectID: "p1", SizeBytes: 5, LineCount: 1, ContentHash: knowledge.ContentHash("hello"), AddedAt: now, SyncedAt: now,
	}
	if err := s.ReplaceSources([]knowledge.SourceWrite{{Source: src}}); err != nil {
		t.Fatal(err)
	}
	want := []float64{0.125, -0.25, 0.5}
	legacy, _ := json.Marshal(want)
	if _, err := s.db.Exec(
		`INSERT INTO knowledge_windows(id, local_ref_id, ordinal, win_start, win_end, embedding, embedding_v2)
		 VALUES('w-legacy', 'ref1', 0, 0, 5, ?, NULL)`, string(legacy)); err != nil {
		t.Fatal(err)
	}

	// Readable before the backfill: decodeStoredVector falls back to the JSON, so
	// a half-migrated database is never unreadable.
	got, err := s.SourceWindows("ref1")
	if err != nil {
		t.Fatal(err)
	}
	if len(got) != 1 || len(got[0].Embedding) != 3 || got[0].Embedding[1] != -0.25 {
		t.Fatalf("legacy row not readable before backfill: %+v", got)
	}

	if err := s.backfillVectorBlobs(); err != nil {
		t.Fatal(err)
	}

	// The BLOB is now populated, so the JSON is never parsed again.
	var blob []byte
	if err := s.db.QueryRow(`SELECT embedding_v2 FROM knowledge_windows WHERE id='w-legacy'`).Scan(&blob); err != nil {
		t.Fatal(err)
	}
	if len(blob) != 4*len(want) {
		t.Fatalf("blob is %d bytes, want %d", len(blob), 4*len(want))
	}
	for i, x := range decodeVector(blob) {
		if x != want[i] {
			t.Errorf("backfilled vector[%d] = %v, want %v", i, x, want[i])
		}
	}

	// And it is idempotent — startup runs it every time.
	if err := s.backfillVectorBlobs(); err != nil {
		t.Fatalf("second run failed: %v", err)
	}
}

// One unparseable legacy row must not take the server down on startup.
func TestBackfillSkipsCorruptLegacyVectors(t *testing.T) {
	s := openTemp(t)
	now := time.Now().UTC().Truncate(time.Second)
	src := knowledge.Source{
		LocalRefID: "ref1", SourceType: "document", SourceID: "doc1",
		ProjectID: "p1", SizeBytes: 5, LineCount: 1, ContentHash: knowledge.ContentHash("hello"), AddedAt: now, SyncedAt: now,
	}
	if err := s.ReplaceSources([]knowledge.SourceWrite{{Source: src}}); err != nil {
		t.Fatal(err)
	}
	if _, err := s.db.Exec(
		`INSERT INTO knowledge_windows(id, local_ref_id, ordinal, win_start, win_end, embedding, embedding_v2)
		 VALUES('w-bad', 'ref1', 0, 0, 5, 'not json at all', NULL)`); err != nil {
		t.Fatal(err)
	}
	if err := s.backfillVectorBlobs(); err != nil {
		t.Errorf("one corrupt vector failed the whole migration: %v", err)
	}
}
