// The knowledge lattice: sources, windows, nodes, and the retrieval frontier.
//
// Part of the single SQLite Store: this file holds the knowledge persistence
// methods. Every file in this package shares one *Store and one connection, so
// the split is organizational — it mirrors the capability boundaries in
// core/capability so each domain's storage is legible on its own.
package sqlite

import (
	"database/sql"
	"encoding/binary"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"time"

	"github.com/gccurtis/taurus-omega/core/capability/knowledge"
)

// --- knowledge.Store ---

func (s *Store) SourceByOrigin(projectID, sourceType, sourceID string) (knowledge.Source, bool, error) {
	return s.sourceByOrigin(s.compatGeneration(projectID), projectID, sourceType, sourceID)
}

func (s *Store) sourceByOrigin(generationID, projectID, sourceType, sourceID string) (knowledge.Source, bool, error) {
	source, err := scanSource(s.db.QueryRow(
		`SELECT local_ref_id, project_id, source_type, source_id, label, size_bytes, line_count, content_hash,
		        blocks, identity, added_at, synced_at, revision
		 FROM knowledge_sources WHERE generation_id=? AND project_id = ? AND source_type = ? AND source_id = ?`,
		generationID, projectID, sourceType, sourceID,
	))
	switch {
	case errors.Is(err, sql.ErrNoRows):
		return knowledge.Source{}, false, nil
	case err != nil:
		return knowledge.Source{}, false, err
	}
	return source, true, nil
}

// SourcesUnder returns the origin of every source of the given type whose
// SourceID starts with sourceIDPrefix, scoped to the project — the lattice
// enumeration primitive a connector uses to list its current sub-keys. The
// prefix compare uses substr rather than LIKE: source_id carries no COLLATE
// NOCASE, so LIKE's default case-insensitive match would diverge from
// MemoryStore's case-sensitive strings.HasPrefix, and a LIKE metacharacter in
// the prefix would need escaping. substr(source_id, 1, N) = prefix is a plain
// BINARY compare of the first N characters — case-sensitive and metacharacter-
// free — matching HasPrefix exactly. N is a rune count so multi-byte prefixes
// still compare character-for-character; our prefixes are ASCII in practice
// (hex group id + "/") so rune count equals byte count here regardless.
//
// The label rides along because it is what makes a caller able to find a member
// by the name it knows — a connector matching the files its watcher reported
// against the ids it minted for them last sync.
func (s *Store) SourcesUnder(projectID, sourceType, sourceIDPrefix string) ([]knowledge.Origin, error) {
	return s.sourcesUnder(s.compatGeneration(projectID), projectID, sourceType, sourceIDPrefix)
}

func (s *Store) sourcesUnder(generationID, projectID, sourceType, sourceIDPrefix string) ([]knowledge.Origin, error) {
	rows, err := s.db.Query(
		`SELECT source_type, source_id, label FROM knowledge_sources
		 WHERE generation_id=? AND project_id=? AND source_type=? AND substr(source_id, 1, ?) = ?
		 ORDER BY source_type,source_id`,
		generationID, projectID, sourceType, len([]rune(sourceIDPrefix)), sourceIDPrefix,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []knowledge.Origin
	for rows.Next() {
		var o knowledge.Origin
		if err := rows.Scan(&o.SourceType, &o.SourceID, &o.Label); err != nil {
			return nil, err
		}
		out = append(out, o)
	}
	return out, rows.Err()
}

func (s *Store) Sources(projectID string) ([]knowledge.Source, error) {
	return s.sources(s.compatGeneration(projectID), projectID)
}

func (s *Store) sources(generationID, projectID string) ([]knowledge.Source, error) {
	rows, err := s.db.Query(
		`SELECT local_ref_id,project_id,source_type,source_id,label,size_bytes,line_count,content_hash,
		        blocks,identity,added_at,synced_at,revision
		 FROM knowledge_sources WHERE generation_id=? AND project_id=?
		 ORDER BY source_type,source_id`, generationID, projectID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []knowledge.Source
	for rows.Next() {
		source, err := scanSource(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, source)
	}
	return out, rows.Err()
}

type sourceScanner interface{ Scan(...any) error }

func scanSource(scanner sourceScanner) (knowledge.Source, error) {
	var source knowledge.Source
	var added, synced, blocks, identity string
	if err := scanner.Scan(&source.LocalRefID, &source.ProjectID, &source.SourceType, &source.SourceID,
		&source.Label, &source.SizeBytes, &source.LineCount, &source.ContentHash,
		&blocks, &identity, &added, &synced, &source.Revision); err != nil {
		return knowledge.Source{}, err
	}
	if err := json.Unmarshal([]byte(blocks), &source.Blocks); err != nil {
		return knowledge.Source{}, fmt.Errorf("%w: source blocks", knowledge.ErrEvidenceCorrupt)
	}
	if err := json.Unmarshal([]byte(identity), &source.Identity); err != nil {
		return knowledge.Source{}, fmt.Errorf("%w: source identity", knowledge.ErrEvidenceCorrupt)
	}
	var err error
	if source.AddedAt, err = time.Parse(timeLayout, added); err != nil {
		return knowledge.Source{}, fmt.Errorf("%w: source added timestamp", knowledge.ErrEvidenceCorrupt)
	}
	if source.SyncedAt, err = time.Parse(timeLayout, synced); err != nil {
		return knowledge.Source{}, fmt.Errorf("%w: source synced timestamp", knowledge.ErrEvidenceCorrupt)
	}
	return source, nil
}

// deleteSourceLatticeTx removes one source's whole lattice by local reference id:
// the membership edges whose parent is one of its nodes, then the nodes, windows
// and snapshot themselves. Both the replace and the delete paths need exactly
// this, in exactly this order, so it lives in one place rather than being written
// twice and drifting.
func deleteSourceLatticeTx(tx *sql.Tx, generationID, localRefID string) error {
	for _, command := range []struct {
		stmt string
		args []any
	}{
		{`DELETE FROM knowledge_memberships WHERE generation_id=? AND parent_id IN
		   (SELECT id FROM knowledge_nodes WHERE generation_id=? AND local_ref_id=?)`,
			[]any{generationID, generationID, localRefID}},
		{`DELETE FROM knowledge_windows WHERE generation_id=? AND local_ref_id=?`,
			[]any{generationID, localRefID}},
		{`DELETE FROM knowledge_nodes WHERE generation_id=? AND local_ref_id=?`,
			[]any{generationID, localRefID}},
		{`DELETE FROM knowledge_sources WHERE generation_id=? AND local_ref_id=?`,
			[]any{generationID, localRefID}},
	} {
		if _, err := tx.Exec(command.stmt, command.args...); err != nil {
			return err
		}
	}
	return nil
}

// writeSourceTx inserts one source's snapshot, windows and nodes. The caller has
// already removed whatever was there.
func writeSourceTx(tx *sql.Tx, generationID string, w knowledge.SourceWrite) error {
	blocks, err := json.Marshal(w.Source.Blocks)
	if err != nil {
		return err
	}
	identity, err := json.Marshal(w.Source.Identity)
	if err != nil {
		return err
	}
	src := w.Source
	// text is written empty, and stays in the schema only because this file never
	// drops a column (see sqlite_migrate.go). A source's content lives at its origin
	// and its retrievable spans live on the windows; a third copy here could only
	// drift from both, silently, since every copy looks well-formed.
	if _, err := tx.Exec(
		`INSERT INTO knowledge_sources(generation_id,local_ref_id, project_id, source_type, source_id, label, text,
		                               size_bytes, line_count, content_hash, blocks, identity, added_at, synced_at, revision)
		 VALUES(?, ?, ?, ?, ?, ?, '', ?, ?, ?, ?, ?, ?, ?, ?)`,
		generationID, src.LocalRefID, src.ProjectID, src.SourceType, src.SourceID, src.Label,
		src.SizeBytes, src.LineCount, src.ContentHash, string(blocks), string(identity),
		src.AddedAt.Format(timeLayout), src.SyncedAt.Format(timeLayout), src.Revision,
	); err != nil {
		return err
	}
	if err := insertWindows(tx, generationID, w.Windows); err != nil {
		return err
	}
	return insertNodes(tx, generationID, w.Nodes)
}

// ReplaceSources replaces every given source's snapshot, windows and nodes and
// then rebuilds the project's corpus tier ONCE, all in a single write
// transaction. The rebuildCorpus callback receives the complete post-replacement
// frontier of every source in the project (computed inside the transaction) and
// returns the new corpus nodes.
//
// One transaction is what makes concurrent adds safe: SQLite serializes writers,
// so each corpus rebuild sees every previously committed add, and no reader ever
// observes the half-updated state between the steps.
//
// Taking a slice is what makes a bulk sync affordable. The corpus rebuild is
// O(F²) in the project's whole frontier, so doing it per source meant a 200-file
// connector paid for 200 project-scale rebuilds to reach one final state. Here it
// is paid once, no matter how many sources moved.
func (s *Store) ReplaceSources(writes []knowledge.SourceWrite) error {
	if len(writes) == 0 {
		return nil
	}
	return s.replaceSources(s.compatGeneration(writes[0].Source.ProjectID), writes)
}

func (s *Store) replaceSources(generationID string, writes []knowledge.SourceWrite) error {
	tx, err := s.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()
	if err := replaceSourcesTx(tx, generationID, writes); err != nil {
		return err
	}
	return tx.Commit()
}

// AdmitAndReplaceSources makes source publication conditional on the exact
// post-replacement source-tier artifact total. Both the count and the write use
// one SQLite transaction, so concurrent writers cannot each spend the same
// apparent headroom.
func (s *Store) AdmitAndReplaceSources(maxArtifacts int, writes []knowledge.SourceWrite) (knowledge.ArtifactCounts, error) {
	if len(writes) == 0 {
		return knowledge.ArtifactCounts{}, nil
	}
	return s.admitAndReplaceSources(s.compatGeneration(writes[0].Source.ProjectID), maxArtifacts, writes)
}

func (s *Store) admitAndReplaceSources(generationID string, maxArtifacts int, writes []knowledge.SourceWrite) (knowledge.ArtifactCounts, error) {
	projectID := writes[0].Source.ProjectID
	for _, w := range writes {
		if w.Source.ProjectID != projectID {
			return knowledge.ArtifactCounts{}, errors.New("knowledge: one admission cannot span Projects")
		}
	}
	tx, err := s.db.Begin()
	if err != nil {
		return knowledge.ArtifactCounts{}, err
	}
	defer tx.Rollback()
	counts, err := sourceArtifactCountsTx(tx, generationID, projectID)
	if err != nil {
		return knowledge.ArtifactCounts{}, err
	}
	var out knowledge.ArtifactCounts
	for _, n := range counts {
		out.Current += n
	}
	replacing := map[string]bool{}
	for _, w := range writes {
		if !replacing[w.Source.LocalRefID] {
			out.Replaced += counts[w.Source.LocalRefID]
			replacing[w.Source.LocalRefID] = true
		}
		out.Candidate += int64(len(w.Windows) + len(w.Nodes))
	}
	out.Total = out.Current - out.Replaced + out.Candidate
	if maxArtifacts > 0 && out.Total > int64(maxArtifacts) {
		return out, knowledge.ArtifactLimitExceeded(projectID, int64(maxArtifacts), out.Total)
	}
	if err := replaceSourcesTx(tx, generationID, writes); err != nil {
		return out, err
	}
	if err := tx.Commit(); err != nil {
		return out, err
	}
	return out, nil
}

func replaceSourcesTx(tx *sql.Tx, generationID string, writes []knowledge.SourceWrite) error {

	for _, w := range writes {
		if err := deleteSourceLatticeTx(tx, generationID, w.Source.LocalRefID); err != nil {
			return err
		}
		if err := writeSourceTx(tx, generationID, w); err != nil {
			return err
		}
	}

	// Every write in a batch belongs to one project (AddBatch is project-scoped).
	if err := invalidateCorpusTx(tx, generationID, writes[0].Source.ProjectID); err != nil {
		return err
	}
	return nil
}

// invalidateCorpusTx drops the project's corpus tier and bumps its dirty
// sequence. It is the write path's whole interaction with the corpus tier: the
// rebuild is somebody else's problem, off this transaction.
func invalidateCorpusTx(tx *sql.Tx, generationID, projectID string) error {
	if err := deleteCorpusTx(tx, generationID, projectID); err != nil {
		return err
	}
	_, err := tx.Exec(
		`INSERT INTO knowledge_corpus_state(generation_id,project_id,dirty_seq,built_seq) VALUES(?,?,1,0)
		 ON CONFLICT(generation_id,project_id) DO UPDATE SET dirty_seq=dirty_seq+1`,
		generationID, projectID)
	return err
}

// deleteCorpusTx removes the project's corpus-tier nodes and their edges.
func deleteCorpusTx(tx *sql.Tx, generationID, projectID string) error {
	for _, command := range []struct {
		stmt string
		args []any
	}{
		{`DELETE FROM knowledge_memberships WHERE generation_id=? AND parent_id IN
		   (SELECT id FROM knowledge_nodes WHERE generation_id=? AND project_id=? AND local_ref_id='')`,
			[]any{generationID, generationID, projectID}},
		{`DELETE FROM knowledge_nodes WHERE generation_id=? AND project_id=? AND local_ref_id=''`,
			[]any{generationID, projectID}},
	} {
		if _, err := tx.Exec(command.stmt, command.args...); err != nil {
			return err
		}
	}
	return nil
}

// CorpusSeq returns the project's (dirty, built) pair; a project with no row has
// never been written and is trivially current.
func (s *Store) CorpusSeq(projectID string) (dirty, built int64, err error) {
	return s.corpusSeq(s.compatGeneration(projectID), projectID)
}

func (s *Store) corpusSeq(generationID, projectID string) (dirty, built int64, err error) {
	err = s.db.QueryRow(
		`SELECT dirty_seq,built_seq FROM knowledge_corpus_state WHERE generation_id=? AND project_id=?`,
		generationID, projectID,
	).Scan(&dirty, &built)
	if errors.Is(err, sql.ErrNoRows) {
		return 0, 0, nil
	}
	return dirty, built, err
}

// RebuildCorpus stores a freshly computed corpus tier and marks it built at seq.
// The clustering happened outside this transaction, so the write is short.
//
// built_seq is set to seq rather than to the current dirty_seq: a write that
// landed while the caller was computing has already pushed dirty_seq higher, and
// claiming it would silently drop that change. Set this way, the tier is stored
// and the project simply still reads as stale.
//
// The project's persisted level indexes are replaced WHOLESALE in the same
// transaction (nil clears them): the tier and the index were computed from one
// frontier, and splitting the writes could leave them describing different
// ones.
func (s *Store) RebuildCorpus(projectID string, corpus []knowledge.Node, seq int64, indexes []knowledge.CorpusLevelIndex) error {
	return s.rebuildCorpus(s.compatGeneration(projectID), projectID, corpus, seq, indexes)
}

func (s *Store) rebuildCorpus(generationID, projectID string, corpus []knowledge.Node, seq int64, indexes []knowledge.CorpusLevelIndex) error {
	tx, err := s.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()
	if err := rebuildCorpusTx(tx, generationID, projectID, corpus, seq, indexes); err != nil {
		return err
	}
	return tx.Commit()
}

// AdmitCorpus accounts for the exact corpus nodes produced by a deferred
// rebuild before they are published. The current source-tier count and this
// replacement happen in one transaction; an old corpus tier is removed by the
// same operation and therefore never gets subtracted speculatively.
func (s *Store) AdmitCorpus(projectID string, maxArtifacts int, corpus []knowledge.Node, seq int64, indexes []knowledge.CorpusLevelIndex) (knowledge.ArtifactCounts, error) {
	return s.admitCorpus(s.compatGeneration(projectID), projectID, maxArtifacts, corpus, seq, indexes)
}

func (s *Store) admitCorpus(generationID, projectID string, maxArtifacts int, corpus []knowledge.Node, seq int64, indexes []knowledge.CorpusLevelIndex) (knowledge.ArtifactCounts, error) {
	tx, err := s.db.Begin()
	if err != nil {
		return knowledge.ArtifactCounts{}, err
	}
	defer tx.Rollback()
	counts, err := sourceArtifactCountsTx(tx, generationID, projectID)
	if err != nil {
		return knowledge.ArtifactCounts{}, err
	}
	var out knowledge.ArtifactCounts
	for _, n := range counts {
		out.Current += n
	}
	out.Candidate = int64(len(corpus))
	out.Total = out.Current + out.Candidate
	if maxArtifacts > 0 && out.Total > int64(maxArtifacts) {
		return out, knowledge.ArtifactLimitExceeded(projectID, int64(maxArtifacts), out.Total)
	}
	if err := rebuildCorpusTx(tx, generationID, projectID, corpus, seq, indexes); err != nil {
		return out, err
	}
	if err := tx.Commit(); err != nil {
		return out, err
	}
	return out, nil
}

func rebuildCorpusTx(tx *sql.Tx, generationID, projectID string, corpus []knowledge.Node, seq int64, indexes []knowledge.CorpusLevelIndex) error {
	if err := deleteCorpusTx(tx, generationID, projectID); err != nil {
		return err
	}
	if err := insertNodes(tx, generationID, corpus); err != nil {
		return err
	}
	if _, err := tx.Exec(`DELETE FROM knowledge_corpus_index WHERE generation_id=? AND project_id=?`,
		generationID, projectID); err != nil {
		return err
	}
	if _, err := tx.Exec(`DELETE FROM knowledge_corpus_edges WHERE generation_id=? AND project_id=?`,
		generationID, projectID); err != nil {
		return err
	}
	if len(indexes) > 0 {
		edgeIns, err := tx.Prepare(
			`INSERT INTO knowledge_corpus_edges(generation_id,project_id,level,artifact_id,cell,edges)
			 VALUES(?,?,?,?,?,?)`)
		if err != nil {
			return err
		}
		defer edgeIns.Close()
		for _, ix := range indexes {
			if _, err := tx.Exec(
				`INSERT INTO knowledge_corpus_index(generation_id,project_id,level,threshold,k,basis,centroids)
				 VALUES(?,?,?,?,?,?,?)`,
				generationID, projectID, ix.Level, ix.Threshold, ix.K,
				encodeMatrix(ix.Basis), encodeMatrix(ix.Centroids)); err != nil {
				return err
			}
			for _, a := range ix.Artifacts {
				blob, err := encodeEdges(a.Edges)
				if err != nil {
					return err
				}
				if _, err := edgeIns.Exec(generationID, projectID, ix.Level, a.ID, a.Cell, blob); err != nil {
					return err
				}
			}
		}
	}
	if _, err := tx.Exec(
		`INSERT INTO knowledge_corpus_state(generation_id,project_id,dirty_seq,built_seq) VALUES(?,?,?,?)
		 ON CONFLICT(generation_id,project_id) DO UPDATE SET built_seq=?`,
		generationID, projectID, seq, seq, seq); err != nil {
		return err
	}
	return nil
}

// sourceArtifactCountsTx returns windows plus source-tier nodes grouped by
// local reference. Corpus nodes are intentionally absent: either source
// admission or corpus publication deletes that tier in the same transaction.
func sourceArtifactCountsTx(tx *sql.Tx, generationID, projectID string) (map[string]int64, error) {
	out := map[string]int64{}
	for _, query := range []string{
		`SELECT w.local_ref_id, COUNT(*) FROM knowledge_windows w
		 JOIN knowledge_sources s ON s.generation_id=w.generation_id AND s.local_ref_id=w.local_ref_id
		 WHERE w.generation_id=? AND s.project_id=? GROUP BY w.local_ref_id`,
		`SELECT local_ref_id, COUNT(*) FROM knowledge_nodes
		 WHERE generation_id=? AND project_id=? AND local_ref_id!='' GROUP BY local_ref_id`,
	} {
		rows, err := tx.Query(query, generationID, projectID)
		if err != nil {
			return nil, err
		}
		for rows.Next() {
			var ref string
			var n int64
			if err := rows.Scan(&ref, &n); err != nil {
				rows.Close()
				return nil, err
			}
			out[ref] += n
		}
		if err := rows.Err(); err != nil {
			rows.Close()
			return nil, err
		}
		rows.Close()
	}
	return out, nil
}

// CorpusIndexes returns the project's persisted level indexes, levels
// ascending, each level's artifacts ascending by id. Two plain queries and no
// transaction, like the other derived reads: the one consumer is the next
// rebuild, which diffs the result against the live frontier anyway.
func (s *Store) CorpusIndexes(projectID string) ([]knowledge.CorpusLevelIndex, error) {
	return s.corpusIndexes(s.compatGeneration(projectID), projectID)
}

func (s *Store) corpusIndexes(generationID, projectID string) ([]knowledge.CorpusLevelIndex, error) {
	rows, err := s.db.Query(
		`SELECT level,threshold,k,basis,centroids FROM knowledge_corpus_index
		 WHERE generation_id=? AND project_id=? ORDER BY level`, generationID, projectID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []knowledge.CorpusLevelIndex
	at := map[int]int{}
	for rows.Next() {
		var ix knowledge.CorpusLevelIndex
		var basis, centroids []byte
		if err := rows.Scan(&ix.Level, &ix.Threshold, &ix.K, &basis, &centroids); err != nil {
			return nil, err
		}
		ix.Basis, ix.Centroids = decodeMatrix(basis), decodeMatrix(centroids)
		at[ix.Level] = len(out)
		out = append(out, ix)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	if len(out) == 0 {
		return nil, nil
	}

	erows, err := s.db.Query(
		`SELECT level,artifact_id,cell,edges FROM knowledge_corpus_edges
		 WHERE generation_id=? AND project_id=? ORDER BY level,artifact_id`, generationID, projectID)
	if err != nil {
		return nil, err
	}
	defer erows.Close()
	for erows.Next() {
		var level, cell int
		var id string
		var blob []byte
		if err := erows.Scan(&level, &id, &cell, &blob); err != nil {
			return nil, err
		}
		edges, err := decodeEdges(blob)
		if err != nil {
			return nil, err
		}
		i, ok := at[level]
		if !ok {
			continue // an edge row without its level row describes nothing
		}
		out[i].Artifacts = append(out[i].Artifacts, knowledge.CorpusIndexArtifact{ID: id, Cell: cell, Edges: edges})
	}
	return out, erows.Err()
}

// encodeEdges packs one artifact's edges as a count header followed by, per
// edge, the neighbour's id as 16 raw bytes and the similarity as a
// little-endian float32. Lattice ids are 32 hexadecimal characters — 16 bytes
// — and an id that is not is rejected here so corruption fails loudly at
// write time rather than surfacing as a mangled read.
func encodeEdges(edges []knowledge.CorpusIndexEdge) ([]byte, error) {
	if len(edges) == 0 {
		return nil, nil
	}
	out := make([]byte, 4, 4+20*len(edges))
	binary.LittleEndian.PutUint32(out, uint32(len(edges)))
	for _, e := range edges {
		raw, err := hex.DecodeString(e.To)
		if err != nil || len(raw) != 16 {
			return nil, fmt.Errorf("sqlite: edge id %q is not a 32-hex lattice id", e.To)
		}
		out = append(out, raw...)
		var sim [4]byte
		binary.LittleEndian.PutUint32(sim[:], math.Float32bits(float32(e.Sim)))
		out = append(out, sim[:]...)
	}
	return out, nil
}

// decodeEdges unpacks what encodeEdges wrote; nil for nil.
func decodeEdges(b []byte) ([]knowledge.CorpusIndexEdge, error) {
	if len(b) == 0 {
		return nil, nil
	}
	if len(b) < 4 {
		return nil, fmt.Errorf("sqlite: edge blob of %d bytes has no header", len(b))
	}
	n := int(binary.LittleEndian.Uint32(b))
	if len(b) != 4+20*n {
		return nil, fmt.Errorf("sqlite: edge blob of %d bytes does not hold %d edges", len(b), n)
	}
	out := make([]knowledge.CorpusIndexEdge, n)
	for i := range out {
		at := 4 + 20*i
		out[i].To = hex.EncodeToString(b[at : at+16])
		out[i].Sim = float64(math.Float32frombits(binary.LittleEndian.Uint32(b[at+16:])))
	}
	return out, nil
}

// DeleteSource removes a source (snapshot, windows, nodes, membership edges) by
// origin and rebuilds the corpus tier from the remaining frontier, in one write
// transaction. It reports whether the source existed; an unknown origin is a
// no-op that commits nothing to change.
func (s *Store) DeleteSource(projectID, sourceType, sourceID string) (bool, error) {
	return s.deleteSource(s.compatGeneration(projectID), projectID, sourceType, sourceID)
}

func (s *Store) deleteSource(generationID, projectID, sourceType, sourceID string) (bool, error) {
	tx, err := s.db.Begin()
	if err != nil {
		return false, err
	}
	defer tx.Rollback()

	var ref string
	err = tx.QueryRow(
		`SELECT local_ref_id FROM knowledge_sources
		 WHERE generation_id=? AND project_id=? AND source_type=? AND source_id=?`,
		generationID, projectID, sourceType, sourceID,
	).Scan(&ref)
	if errors.Is(err, sql.ErrNoRows) {
		return false, nil
	}
	if err != nil {
		return false, err
	}

	if err := deleteSourceLatticeTx(tx, generationID, ref); err != nil {
		return false, err
	}
	if err := invalidateCorpusTx(tx, generationID, projectID); err != nil {
		return false, err
	}
	return true, tx.Commit()
}

// SourceFrontier computes every source's frontier: the source-tier nodes that
// are no source-tier node's member, then the windows that are no source-tier
// node's member. Corpus-tier membership is ignored — the frontier is intrinsic
// to the source lattices, and the corpus tier is built FROM it.
//
// It is a plain read rather than a step inside a write transaction because the
// rebuild that consumes it clusters outside one. RebuildCorpus takes the
// sequence that was current when this was read, so a write landing in between
// leaves the project stale rather than being lost.
func (s *Store) SourceFrontier(projectID string) ([]knowledge.FrontierEntry, error) {
	return s.sourceFrontier(s.compatGeneration(projectID), projectID)
}

func (s *Store) sourceFrontier(generationID, projectID string) ([]knowledge.FrontierEntry, error) {
	var out []knowledge.FrontierEntry

	nrows, err := s.db.Query(
		`SELECT n.id, n.centroid, n.centroid_v2 FROM knowledge_nodes n
		 WHERE n.generation_id=? AND n.project_id=? AND n.local_ref_id!=''
		   AND NOT EXISTS (
		     SELECT 1 FROM knowledge_memberships m
		     JOIN knowledge_nodes p ON p.generation_id=m.generation_id AND m.parent_id=p.id
		     WHERE m.generation_id=n.generation_id AND m.member_id=n.id AND p.local_ref_id!='')
		 ORDER BY n.id`, generationID, projectID)
	if err != nil {
		return nil, err
	}
	for nrows.Next() {
		var id, cen string
		var blob []byte
		if err := nrows.Scan(&id, &cen, &blob); err != nil {
			nrows.Close()
			return nil, err
		}
		v, err := decodeStoredVector(blob, cen)
		if err != nil {
			nrows.Close()
			return nil, err
		}
		out = append(out, knowledge.FrontierEntry{ID: id, Vector: v})
	}
	nrows.Close()
	if err := nrows.Err(); err != nil {
		return nil, err
	}

	wrows, err := s.db.Query(
		`SELECT w.id, w.embedding, w.embedding_v2 FROM knowledge_windows w
		 JOIN knowledge_sources s ON s.generation_id=w.generation_id AND w.local_ref_id=s.local_ref_id
		 WHERE w.generation_id=? AND s.project_id=?
		   AND NOT EXISTS (
		     SELECT 1 FROM knowledge_memberships m
		     JOIN knowledge_nodes p ON p.generation_id=m.generation_id AND m.parent_id=p.id
		     WHERE m.generation_id=w.generation_id AND m.member_id=w.id AND p.local_ref_id!='')
		 ORDER BY w.id`, generationID, projectID)
	if err != nil {
		return nil, err
	}
	for wrows.Next() {
		var id, emb string
		var blob []byte
		if err := wrows.Scan(&id, &emb, &blob); err != nil {
			wrows.Close()
			return nil, err
		}
		v, err := decodeStoredVector(blob, emb)
		if err != nil {
			wrows.Close()
			return nil, err
		}
		out = append(out, knowledge.FrontierEntry{ID: id, Vector: v, IsWindow: true})
	}
	wrows.Close()
	if err := wrows.Err(); err != nil {
		return nil, err
	}
	return out, nil
}

func insertWindows(tx *sql.Tx, generationID string, windows []knowledge.Window) error {
	for _, w := range windows {
		blocks, err := json.Marshal(w.Blocks)
		if err != nil {
			return err
		}
		// The legacy JSON column is left empty rather than dual-written. Keeping
		// both in step would double every write to save a read path that only exists
		// for rows written before the BLOB column did.
		if _, err := tx.Exec(
			`INSERT INTO knowledge_windows(generation_id,id,local_ref_id,ordinal,win_start,win_end,embedding,embedding_v2,text,blocks)
			 VALUES(?,?,?,?,?,?, '',?,?,?)`,
			generationID, w.ID, w.LocalRefID, w.Ordinal, w.Start, w.End, encodeVector(w.Embedding),
			w.Text, string(blocks),
		); err != nil {
			return err
		}
	}
	return nil
}

// insertNodes stores each node row plus one membership edge per member, in
// member order.
func insertNodes(tx *sql.Tx, generationID string, nodes []knowledge.Node) error {
	for _, n := range nodes {
		if _, err := tx.Exec(
			`INSERT INTO knowledge_nodes(generation_id,id,project_id,local_ref_id,level,member_count,cohesion,centroid,centroid_v2,created_at)
			 VALUES(?,?,?,?,?,?,?, '',?,?)`,
			generationID, n.ID, n.ProjectID, n.LocalRefID, n.Level, n.Count, n.Cohesion,
			encodeVector(n.Centroid), n.CreatedAt.Format(timeLayout),
		); err != nil {
			return err
		}
		for ord, member := range n.MemberIDs {
			if _, err := tx.Exec(
				`INSERT INTO knowledge_memberships(generation_id,parent_id,member_id,ordinal) VALUES(?,?,?,?)`,
				generationID, n.ID, member, ord,
			); err != nil {
				return err
			}
		}
	}
	return nil
}

// Identities returns each source's vector identity in the project, without text.
func (s *Store) Identities(projectID string) (map[string]knowledge.VectorIdentity, error) {
	return s.identities(s.compatGeneration(projectID), projectID)
}

func (s *Store) identities(generationID, projectID string) (map[string]knowledge.VectorIdentity, error) {
	rows, err := s.db.Query(`SELECT local_ref_id,identity FROM knowledge_sources
		WHERE generation_id=? AND project_id=?`, generationID, projectID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := map[string]knowledge.VectorIdentity{}
	for rows.Next() {
		var ref, identity string
		if err := rows.Scan(&ref, &identity); err != nil {
			return nil, err
		}
		var id knowledge.VectorIdentity
		if err := json.Unmarshal([]byte(identity), &id); err != nil {
			return nil, fmt.Errorf("%w: source identity", knowledge.ErrEvidenceCorrupt)
		}
		out[ref] = id
	}
	return out, rows.Err()
}

// EntryFrontier returns the retrieval entry points: every node and window in the
// project that is no node's member across either tier — corpus roots, source
// roots the corpus tier did not absorb, and never-clustered orphan windows.
func (s *Store) EntryFrontier(projectID string) ([]knowledge.FrontierEntry, error) {
	return s.entryFrontier(s.compatGeneration(projectID), projectID)
}

func (s *Store) entryFrontier(generationID, projectID string) ([]knowledge.FrontierEntry, error) {
	var out []knowledge.FrontierEntry
	nrows, err := s.db.Query(
		`SELECT n.id, n.centroid, n.centroid_v2 FROM knowledge_nodes n
		 WHERE n.generation_id=? AND n.project_id=?
		   AND NOT EXISTS (SELECT 1 FROM knowledge_memberships m
		                   WHERE m.generation_id=n.generation_id AND m.member_id=n.id)
		 ORDER BY n.id`, generationID, projectID)
	if err != nil {
		return nil, err
	}
	for nrows.Next() {
		var id, cen string
		var blob []byte
		if err := nrows.Scan(&id, &cen, &blob); err != nil {
			nrows.Close()
			return nil, err
		}
		v, err := decodeStoredVector(blob, cen)
		if err != nil {
			nrows.Close()
			return nil, err
		}
		out = append(out, knowledge.FrontierEntry{ID: id, Vector: v})
	}
	nrows.Close()
	if err := nrows.Err(); err != nil {
		return nil, err
	}

	wrows, err := s.db.Query(
		`SELECT w.id, w.embedding, w.embedding_v2 FROM knowledge_windows w
		 JOIN knowledge_sources s ON s.generation_id=w.generation_id AND w.local_ref_id=s.local_ref_id
		 WHERE w.generation_id=? AND s.project_id=?
		   AND NOT EXISTS (SELECT 1 FROM knowledge_memberships m
		                   WHERE m.generation_id=w.generation_id AND m.member_id=w.id)
		 ORDER BY w.id`, generationID, projectID)
	if err != nil {
		return nil, err
	}
	for wrows.Next() {
		var id, emb string
		var blob []byte
		if err := wrows.Scan(&id, &emb, &blob); err != nil {
			wrows.Close()
			return nil, err
		}
		v, err := decodeStoredVector(blob, emb)
		if err != nil {
			wrows.Close()
			return nil, err
		}
		out = append(out, knowledge.FrontierEntry{ID: id, Vector: v, IsWindow: true})
	}
	wrows.Close()
	return out, wrows.Err()
}

// CorpusIndexHeader returns one level's machinery — threshold, k, basis,
// centroids — without its artifact rows. The retrieval probe calls this per
// query, and dragging the edge set along would cost more than the scan the
// probe exists to avoid.
func (s *Store) CorpusIndexHeader(projectID string, level int) (knowledge.CorpusLevelIndex, bool, error) {
	return s.corpusIndexHeader(s.compatGeneration(projectID), projectID, level)
}

func (s *Store) corpusIndexHeader(generationID, projectID string, level int) (knowledge.CorpusLevelIndex, bool, error) {
	var ix knowledge.CorpusLevelIndex
	var basis, centroids []byte
	err := s.db.QueryRow(
		`SELECT level,threshold,k,basis,centroids FROM knowledge_corpus_index
		 WHERE generation_id=? AND project_id=? AND level=?`,
		generationID, projectID, level).Scan(&ix.Level, &ix.Threshold, &ix.K, &basis, &centroids)
	if errors.Is(err, sql.ErrNoRows) {
		return knowledge.CorpusLevelIndex{}, false, nil
	}
	if err != nil {
		return knowledge.CorpusLevelIndex{}, false, err
	}
	ix.Basis, ix.Centroids = decodeMatrix(basis), decodeMatrix(centroids)
	return ix, true, nil
}

// EntryFrontierProbed is EntryFrontier narrowed by the level index: an entry
// artifact the index covers survives only if its cell is among the probed
// ones, and an artifact the index does not cover always survives — the probe
// may narrow the indexed mass, never hide the unindexed remainder (corpus
// roots above the level, anything written since the index was stored).
func (s *Store) EntryFrontierProbed(projectID string, level int, cells []int) ([]knowledge.FrontierEntry, error) {
	return s.entryFrontierProbed(s.compatGeneration(projectID), projectID, level, cells)
}

func (s *Store) entryFrontierProbed(generationID, projectID string, level int, cells []int) ([]knowledge.FrontierEntry, error) {
	cellPH, cellArgs := intPlaceholders(cells)
	probed := `(SELECT e.artifact_id FROM knowledge_corpus_edges e
	            WHERE e.generation_id=? AND e.project_id=? AND e.level=? AND e.cell IN (` + cellPH + `))`
	covered := `(SELECT e.artifact_id FROM knowledge_corpus_edges e
	             WHERE e.generation_id=? AND e.project_id=? AND e.level=?)`
	filter := func(col string) (string, []any) {
		clause := ` AND (` + col + ` IN ` + probed + ` OR ` + col + ` NOT IN ` + covered + `)`
		args := append([]any{generationID, projectID, level}, cellArgs...)
		args = append(args, generationID, projectID, level)
		return clause, args
	}

	var out []knowledge.FrontierEntry
	nClause, nArgs := filter("n.id")
	nrows, err := s.db.Query(
		`SELECT n.id, n.centroid, n.centroid_v2 FROM knowledge_nodes n
		 WHERE n.generation_id=? AND n.project_id=?
		   AND NOT EXISTS (SELECT 1 FROM knowledge_memberships m
		                   WHERE m.generation_id=n.generation_id AND m.member_id=n.id)`+
			nClause+` ORDER BY n.id`, append([]any{generationID, projectID}, nArgs...)...)
	if err != nil {
		return nil, err
	}
	for nrows.Next() {
		var id, cen string
		var blob []byte
		if err := nrows.Scan(&id, &cen, &blob); err != nil {
			nrows.Close()
			return nil, err
		}
		v, err := decodeStoredVector(blob, cen)
		if err != nil {
			nrows.Close()
			return nil, err
		}
		out = append(out, knowledge.FrontierEntry{ID: id, Vector: v})
	}
	nrows.Close()
	if err := nrows.Err(); err != nil {
		return nil, err
	}

	wClause, wArgs := filter("w.id")
	wrows, err := s.db.Query(
		`SELECT w.id, w.embedding, w.embedding_v2 FROM knowledge_windows w
		 JOIN knowledge_sources s ON s.generation_id=w.generation_id AND w.local_ref_id=s.local_ref_id
		 WHERE w.generation_id=? AND s.project_id=?
		   AND NOT EXISTS (SELECT 1 FROM knowledge_memberships m
		                   WHERE m.generation_id=w.generation_id AND m.member_id=w.id)`+
			wClause+` ORDER BY w.id`, append([]any{generationID, projectID}, wArgs...)...)
	if err != nil {
		return nil, err
	}
	for wrows.Next() {
		var id, emb string
		var blob []byte
		if err := wrows.Scan(&id, &emb, &blob); err != nil {
			wrows.Close()
			return nil, err
		}
		v, err := decodeStoredVector(blob, emb)
		if err != nil {
			wrows.Close()
			return nil, err
		}
		out = append(out, knowledge.FrontierEntry{ID: id, Vector: v, IsWindow: true})
	}
	wrows.Close()
	return out, wrows.Err()
}

// intPlaceholders is inPlaceholders for integer keys. An empty list yields a
// single NULL placeholder, so `IN ()` never appears and the clause matches
// nothing — which is what probing zero cells means.
func intPlaceholders(vals []int) (string, []any) {
	if len(vals) == 0 {
		return "NULL", nil
	}
	ph := make([]byte, 0, len(vals)*2)
	args := make([]any, len(vals))
	for i, v := range vals {
		if i > 0 {
			ph = append(ph, ',')
		}
		ph = append(ph, '?')
		args[i] = v
	}
	return string(ph), args
}

// inPlaceholders builds "?, ?, ..." and the matching args slice for an IN clause.
func inPlaceholders(ids []string) (string, []any) {
	ph := make([]byte, 0, len(ids)*2)
	args := make([]any, len(ids))
	for i, id := range ids {
		if i > 0 {
			ph = append(ph, ',')
		}
		ph = append(ph, '?')
		args[i] = id
	}
	return string(ph), args
}

// NodesByID batch-fetches nodes (with their ordered members) by id, skipping
// unknown ids.
func (s *Store) NodesByID(ids []string) ([]knowledge.Node, error) {
	return s.nodesByID(s.compatIDGeneration("knowledge_nodes", "id", ids), ids)
}

func (s *Store) nodesByID(generationID string, ids []string) ([]knowledge.Node, error) {
	if len(ids) == 0 {
		return nil, nil
	}
	ph, args := inPlaceholders(ids)
	rows, err := s.db.Query(
		`SELECT id, project_id, local_ref_id, level, member_count, cohesion, centroid, centroid_v2, created_at
		 FROM knowledge_nodes WHERE generation_id=? AND id IN (`+ph+`)`,
		append([]any{generationID}, args...)...)
	if err != nil {
		return nil, err
	}
	var nodes []knowledge.Node
	byID := map[string]int{}
	for rows.Next() {
		var n knowledge.Node
		var cen, created string
		var blob []byte
		if err := rows.Scan(&n.ID, &n.ProjectID, &n.LocalRefID, &n.Level, &n.Count, &n.Cohesion, &cen, &blob, &created); err != nil {
			rows.Close()
			return nil, err
		}
		n.Centroid, err = decodeStoredVector(blob, cen)
		if err != nil {
			rows.Close()
			return nil, err
		}
		n.CreatedAt, err = time.Parse(timeLayout, created)
		if err != nil {
			rows.Close()
			return nil, fmt.Errorf("%w: node timestamp", knowledge.ErrEvidenceCorrupt)
		}
		byID[n.ID] = len(nodes)
		nodes = append(nodes, n)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return nil, err
	}

	mrows, err := s.db.Query(
		`SELECT parent_id, member_id FROM knowledge_memberships
		 WHERE generation_id=? AND parent_id IN (`+ph+`) ORDER BY parent_id,ordinal`,
		append([]any{generationID}, args...)...)
	if err != nil {
		return nil, err
	}
	defer mrows.Close()
	for mrows.Next() {
		var parent, member string
		if err := mrows.Scan(&parent, &member); err != nil {
			return nil, err
		}
		if i, ok := byID[parent]; ok {
			nodes[i].MemberIDs = append(nodes[i].MemberIDs, member)
		}
	}
	return nodes, mrows.Err()
}

// WindowsByID batch-fetches windows by id, skipping unknown ids.
func (s *Store) WindowsByID(ids []string) ([]knowledge.Window, error) {
	return s.windowsByID(s.compatIDGeneration("knowledge_windows", "id", ids), ids)
}

func (s *Store) windowsByID(generationID string, ids []string) ([]knowledge.Window, error) {
	if len(ids) == 0 {
		return nil, nil
	}
	ph, args := inPlaceholders(ids)
	rows, err := s.db.Query(
		`SELECT id, local_ref_id, ordinal, win_start, win_end, embedding, embedding_v2
		 FROM knowledge_windows WHERE generation_id=? AND id IN (`+ph+`)`,
		append([]any{generationID}, args...)...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanWindows(rows)
}

// ProjectWindows returns every window of the project, for the exact scan.
func (s *Store) ProjectWindows(projectID string) ([]knowledge.Window, error) {
	return s.projectWindows(s.compatGeneration(projectID), projectID)
}

func (s *Store) projectWindows(generationID, projectID string) ([]knowledge.Window, error) {
	rows, err := s.db.Query(
		`SELECT w.id, w.local_ref_id, w.ordinal, w.win_start, w.win_end, w.embedding, w.embedding_v2
		 FROM knowledge_windows w
		 JOIN knowledge_sources s ON s.generation_id=w.generation_id AND w.local_ref_id=s.local_ref_id
		 WHERE w.generation_id=? AND s.project_id=?`, generationID, projectID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanWindows(rows)
}

// ProjectChangedSince reports whether any source in the project was synced after
// t. synced_at is stored as trimmed RFC3339Nano, whose lexical order is not
// chronological, so the comparison is done in Go rather than in SQL.
func (s *Store) ProjectChangedSince(projectID string, t time.Time) (bool, error) {
	generationID := s.compatGeneration(projectID)
	rows, err := s.db.Query(`SELECT synced_at FROM knowledge_sources
		WHERE generation_id=? AND project_id=?`, generationID, projectID)
	if err != nil {
		return false, err
	}
	defer rows.Close()
	for rows.Next() {
		var synced string
		if err := rows.Scan(&synced); err != nil {
			return false, err
		}
		if ts, err := time.Parse(timeLayout, synced); err == nil && ts.After(t) {
			return true, nil
		}
	}
	return false, rows.Err()
}

// SourceWindows returns one source's current windows, for embedding reuse. It is
// the one window read that carries text, because the reuse map is keyed by it: a
// window's stored embedding is reusable exactly when its text is unchanged.
func (s *Store) SourceWindows(localRefID string) ([]knowledge.Window, error) {
	return s.sourceWindows(s.compatIDGeneration("knowledge_sources", "local_ref_id", []string{localRefID}), localRefID)
}

func (s *Store) sourceWindows(generationID, localRefID string) ([]knowledge.Window, error) {
	rows, err := s.db.Query(
		`SELECT id, local_ref_id, ordinal, win_start, win_end, embedding, embedding_v2, text
		 FROM knowledge_windows WHERE generation_id=? AND local_ref_id=?`, generationID, localRefID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var windows []knowledge.Window
	for rows.Next() {
		var w knowledge.Window
		var emb string
		var blob []byte
		if err := rows.Scan(&w.ID, &w.LocalRefID, &w.Ordinal, &w.Start, &w.End, &emb, &blob, &w.Text); err != nil {
			return nil, err
		}
		w.Embedding, err = decodeStoredVector(blob, emb)
		if err != nil {
			return nil, err
		}
		windows = append(windows, w)
	}
	return windows, rows.Err()
}

// WindowContent returns the citable content of the given windows — their own text
// and the origin components that text covers — keyed by window id.
//
// It is separate from the window reads used for ranking on purpose. Descent, the
// exact scan and the corpus rebuild all handle every window in a project or a
// candidate set, and they need only vectors; loading the corpus's text to rank
// vectors would reintroduce the cost this change exists to remove. Text is fetched
// once, for the windows that actually made it into an answer.
func (s *Store) WindowContent(ids []string) (map[string]knowledge.WindowContent, error) {
	return s.windowContent(s.compatIDGeneration("knowledge_windows", "id", ids), ids)
}

func (s *Store) windowContent(generationID string, ids []string) (map[string]knowledge.WindowContent, error) {
	out := make(map[string]knowledge.WindowContent, len(ids))
	if len(ids) == 0 {
		return out, nil
	}
	ph, args := inPlaceholders(ids)
	rows, err := s.db.Query(
		`SELECT id,text,blocks FROM knowledge_windows WHERE generation_id=? AND id IN (`+ph+`)`,
		append([]any{generationID}, args...)...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var id, text, blocks string
		if err := rows.Scan(&id, &text, &blocks); err != nil {
			return nil, err
		}
		c := knowledge.WindowContent{Text: text}
		if err := json.Unmarshal([]byte(blocks), &c.Blocks); err != nil {
			return nil, fmt.Errorf("%w: window blocks", knowledge.ErrEvidenceCorrupt)
		}
		out[id] = c
	}
	return out, rows.Err()
}

func scanWindows(rows *sql.Rows) ([]knowledge.Window, error) {
	var windows []knowledge.Window
	for rows.Next() {
		var w knowledge.Window
		var emb string
		var blob []byte
		if err := rows.Scan(&w.ID, &w.LocalRefID, &w.Ordinal, &w.Start, &w.End, &emb, &blob); err != nil {
			return nil, err
		}
		var err error
		w.Embedding, err = decodeStoredVector(blob, emb)
		if err != nil {
			return nil, err
		}
		windows = append(windows, w)
	}
	return windows, rows.Err()
}

// SourcesByRef returns the source records for the given local reference ids:
// origin identity, blocks and metadata, no content.
//
// It is on the query path — one call per retrieval, for every source the ranked
// windows touched — which is why it no longer selects text. A region has to name
// its origin to be citable, but its text comes from the windows, so loading the
// whole source made the cost of answering a query scale with the size of the
// files it happened to hit.
func (s *Store) SourcesByRef(refs []string) (map[string]knowledge.Source, error) {
	return s.sourcesByRef(s.compatIDGeneration("knowledge_sources", "local_ref_id", refs), refs)
}

func (s *Store) sourcesByRef(generationID string, refs []string) (map[string]knowledge.Source, error) {
	out := map[string]knowledge.Source{}
	if len(refs) == 0 {
		return out, nil
	}
	ph, args := inPlaceholders(refs)
	rows, err := s.db.Query(
		`SELECT local_ref_id, project_id, source_type, source_id, label, size_bytes, line_count, content_hash,
		        blocks,identity,added_at,synced_at,revision
		 FROM knowledge_sources WHERE generation_id=? AND local_ref_id IN (`+ph+`)`,
		append([]any{generationID}, args...)...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		k, err := scanSource(rows)
		if err != nil {
			return nil, err
		}
		out[k.LocalRefID] = k
	}
	return out, rows.Err()
}

// ArtifactCounts reports how many artifacts the project holds — its windows plus
// its nodes, at every tier — grouped by the local reference that owns them, with
// "" for the corpus-tier nodes no single source owns.
//
// Two grouped counts rather than one join: the tables are independent and SQLite
// answers each from an index, which is what keeps this cheap enough to run before
// every ingest. That matters more than the tidiness: the ceiling it feeds exists
// to prevent an out-of-memory kill during a corpus rebuild, so a guard that had to
// read the frontier to decide would allocate the thing it guards against.
func (s *Store) ArtifactCounts(projectID string) (map[string]int, error) {
	return s.artifactCounts(s.compatGeneration(projectID), projectID)
}

func (s *Store) artifactCounts(generationID, projectID string) (map[string]int, error) {
	out := map[string]int{}
	for _, q := range []string{
		`SELECT w.local_ref_id, COUNT(*) FROM knowledge_windows w
		 JOIN knowledge_sources s ON s.generation_id=w.generation_id AND w.local_ref_id=s.local_ref_id
		 WHERE w.generation_id=? AND s.project_id=? GROUP BY w.local_ref_id`,
		`SELECT local_ref_id, COUNT(*) FROM knowledge_nodes
		 WHERE generation_id=? AND project_id=? GROUP BY local_ref_id`,
	} {
		rows, err := s.db.Query(q, generationID, projectID)
		if err != nil {
			return nil, err
		}
		for rows.Next() {
			var ref string
			var n int
			if err := rows.Scan(&ref, &n); err != nil {
				rows.Close()
				return nil, err
			}
			out[ref] += n
		}
		rows.Close()
		if err := rows.Err(); err != nil {
			return nil, err
		}
	}
	return out, nil
}
