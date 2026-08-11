// Vector storage format.
//
// Part of the single SQLite Store: embeddings and centroids are stored as
// fixed-width little-endian float32 rather than as JSON text.
//
// The reason is measured, not assumed (BenchmarkVectorDecodeJSON /
// BenchmarkVectorDecodeBlob, 1536 dimensions):
//
//	decode   JSON 252µs   BLOB 4.3µs    58x
//	encode   JSON 108µs   BLOB 2.8µs    39x
//	stored   JSON ~32KB   BLOB 6.1KB    5.3x
//
// That gap matters because vectors are not read occasionally. The frontier is
// decoded on every corpus rebuild AND on every retrieval query, so at a 200,000
// entry frontier the JSON path spends roughly 50 seconds parsing decimal strings
// before a single similarity is computed.
//
// # The format is deliberately language-agnostic
//
// Raw IEEE 754 binary32, explicitly little-endian, with no header and no
// framing. That is the same layout numpy calls "<f4", so the bytes are readable
// without a Go runtime and without a schema:
//
//	Python      np.frombuffer(blob, dtype='<f4')
//	JavaScript  new Float32Array(buf)  /  DataView.getFloat32(i, true)
//	Rust        f32::from_le_bytes
//	Java        ByteBuffer.order(LITTLE_ENDIAN).asFloatBuffer()
//
// The endianness is pinned rather than native for exactly that reason — native
// order would make the stored bytes correct only on the machine that wrote them,
// which is not a property a durable format may have. It also rules out the
// obvious Go-native encodings (gob) on the same grounds: leaving embeddings
// readable by ordinary vector tooling is worth more than any convenience.
//
// There is no version header. The dimension is recoverable as len(blob)/4, and
// Source.Identity already records it independently, so a header would carry
// nothing that is not already knowable. A future format that needs one gets a
// new column instead.
package sqlite

import (
	"encoding/binary"
	"encoding/json"
	"math"
)

// encodeVector packs a vector as little-endian float32.
//
// float32 rather than float64 because these are unit vectors compared by cosine
// similarity, which needs nowhere near 15 significant digits — a round trip
// moves a dot product by less than 1e-7 (TestFloat32RoundTripPreservesCosine),
// far below any threshold the lattice compares against. Halving the width halves
// the read.
func encodeVector(v []float64) []byte {
	out := make([]byte, 4*len(v))
	for i, x := range v {
		binary.LittleEndian.PutUint32(out[4*i:], math.Float32bits(float32(x)))
	}
	return out
}

// decodeVector unpacks what encodeVector wrote.
func decodeVector(b []byte) []float64 {
	out := make([]float64, len(b)/4)
	for i := range out {
		out[i] = float64(math.Float32frombits(binary.LittleEndian.Uint32(b[4*i:])))
	}
	return out
}

// encodeMatrix packs a row-major float32 matrix as a [rows u32][cols u32]
// header followed by rows·cols little-endian float32 — encodeVector's format
// with a shape prefix, so a projection basis or a centroid set travels as one
// BLOB. nil and empty matrices encode as nil.
func encodeMatrix(m [][]float64) []byte {
	if len(m) == 0 {
		return nil
	}
	cols := len(m[0])
	out := make([]byte, 8, 8+4*len(m)*cols)
	binary.LittleEndian.PutUint32(out[0:], uint32(len(m)))
	binary.LittleEndian.PutUint32(out[4:], uint32(cols))
	for _, row := range m {
		out = append(out, encodeVector(row)...)
	}
	return out
}

// decodeMatrix unpacks what encodeMatrix wrote; nil for nil.
func decodeMatrix(b []byte) [][]float64 {
	if len(b) < 8 {
		return nil
	}
	rows := int(binary.LittleEndian.Uint32(b[0:]))
	cols := int(binary.LittleEndian.Uint32(b[4:]))
	if rows <= 0 || cols <= 0 || len(b) < 8+4*rows*cols {
		return nil
	}
	out := make([][]float64, rows)
	for r := range out {
		at := 8 + 4*r*cols
		out[r] = decodeVector(b[at : at+4*cols])
	}
	return out
}

// decodeStoredVector reads a vector from a row that may predate the BLOB column.
//
// It exists for the window between a database being opened and its backfill
// completing, and for the rows a failed backfill left behind: a BLOB is used
// when present, and the legacy JSON is parsed otherwise. Preferring the BLOB
// means a backfilled row never pays the JSON cost again.
func decodeStoredVector(blob []byte, legacy string) ([]float64, error) {
	if len(blob) > 0 {
		return decodeVector(blob), nil
	}
	if legacy == "" {
		return nil, nil
	}
	var v []float64
	if err := json.Unmarshal([]byte(legacy), &v); err != nil {
		return nil, err
	}
	return v, nil
}
