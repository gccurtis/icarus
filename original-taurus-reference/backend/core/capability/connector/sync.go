package connector

import (
	"context"
	"errors"
	"fmt"
	"io"
	"sort"
	"strings"
	"time"
)

// LatticeWriter is the knowledge seam the connector feeds. The real adapter wraps
// knowledge.Add/Remove in core/wiring so the two capabilities stay independent.
// AddSource returns the token cost of feeding the content (embedding).
type LatticeWriter interface {
	// AddSources admits a whole sync's files at once. label is each file's path
	// relative to the connector root: the lattice stores it beside the id, which is
	// what lets the next sync find that file again by the only name its provider
	// knows it by.
	//
	// It takes the whole set rather than one file at a time because both costs
	// behind it are per-call, not per-file: the embedding provider sees one request
	// per batch instead of one per file (a folder's first sync used to be a request
	// storm, which is what a per-minute rate limit exists to stop), and the lattice
	// rebuilds its corpus tier once instead of once per file.
	AddSources(projectID string, files []LatticeFileWrite) (Usage, []SkippedFile, error)
	RemoveSource(projectID, sourceID string) error
	// SourcesUnder returns the files currently stored under a connector — every
	// source whose ID has the given prefix (built with FileSourceID's
	// connectorID+FileSeparator convention), each with the label it was stored
	// under. applySync uses it twice: to recover the id already minted for a path,
	// and to prune sources whose file has vanished.
	SourcesUnder(projectID, sourceIDPrefix string) ([]LatticeFile, error)
}

// LatticeFileWrite is one file to admit: the source id it is stored under, the
// provider's key as its label, the sync sequence as its revision, and the means
// to read its content.
//
// Hash is what lets the lattice decide not to read it. A re-sync compares it
// against the stored source's content hash, and a match is skipped without the
// file ever being opened — so an unchanged connector costs a listing, not a
// corpus.
type LatticeFileWrite struct {
	SourceID string
	Label    string
	Revision int64
	Size     int64
	Hash     string
	Open     func() (io.ReadCloser, error)
}

// LatticeFile is one stored connector file: the id the lattice addresses it by,
// and the provider's own key for it.
//
// Key is whatever the provider identifies a member by — for local-folder, the
// path relative to the connector root; for a cloud provider it will be that
// service's item id, which is not a path at all. What matters is only that it is
// stable and unique within one connector, because that is what makes it usable
// as the lookup key here.
//
// It is a PATH, not a filename, for local-folder specifically: `src/a.txt` and
// `docs/a.txt` are two different files that happen to share a base name, and
// collapsing them would merge two sources into one. Same path means same file;
// same name means nothing.
//
// The pair is the registry. The lattice already had to store both, so a
// connector recovers a file's id by looking its key up rather than keeping a
// second table in step with this one.
type LatticeFile struct {
	SourceID string
	Key      string
}

// ProviderFactory builds the Provider for a connector from its stored config.
type ProviderFactory func(c Connector) (Provider, error)

// Cascader is notified after a connector's content changes, so the composition
// layer can refresh whatever depends on the source (the reference graph drives
// which prompt blocks re-resolve). It is deliberately abstract — the connector
// depends on neither the document capability nor the job queue; the concrete
// cascader lives in core/wiring. Refresh is best-effort: RefreshDependents
// returns nothing and must never fail the sync that triggered it.
type Cascader interface {
	RefreshDependents(projectID, sourceType, sourceID string)
}

// SyncResult reports whether a sync changed the lattice, the new state, and the
// token cost it incurred. Deferred means no sync was attempted at all — the
// connector is inside its retry backoff, or has stopped retrying (see
// NeedsAttention) — which is a different answer from "the source had not
// changed", and a caller counting activity needs to tell them apart.
//
// Skipped lists the files the sync did not admit. A sync that leaves files out is
// still a success — one unusable file is a reason to leave that file out, never to
// abandon everything beside it — but it is a success the caller has to be told
// about, which is the part that was missing.
type SyncResult struct {
	Changed  bool
	Deferred bool
	// Partial says that complete earlier slices were committed before this sync
	// stopped. It is deliberately distinct from Changed: the connector has made
	// forward progress, but its fingerprint was not advanced and it is not current.
	Partial     bool
	Fingerprint string
	Seq         int64
	Usage       Usage
	Skipped     []SkippedFile
}

// CodeFileUnreadable is the stable identity of a file that could not be read.
//
// It replaces the per-file size bound, which is gone: ingest streams now, so a
// large file is slow rather than refused. What is left are the failures a reader
// cannot fix — an unreadable file, a binary with no text extractor, a file that
// vanished between the listing and the read.
const CodeFileUnreadable = "connector_file_unreadable"

// SkippedFile is one file the sync did not admit, and why.
//
// Code is machine-readable and stable, so a client branches on a value rather than
// on prose; Detail is the sentence a person reads. Size and Limit are the arithmetic
// where the reason is a bound.
//
// The fields deliberately mirror limit.Exceeded without being one. A skip is not a
// failure — the sync succeeded, and the response carrying this has a 200 — so
// modelling it as an error would misreport the outcome. What they share is the
// obligation to say what the bound was and what exceeded it.
//
// The reason set will outlive the reason that prompted it. Today the only entry is
// the size bound, which is itself scheduled to go once ingest streams; what remains
// after that are the failures a reader does not fix — an unreadable file, a binary
// with no text extractor, a file that vanished between the snapshot and the read.
// Each of those is currently a log line nobody sees.
type SkippedFile struct {
	Path   string `json:"path"`
	Code   string `json:"code"`
	Detail string `json:"detail"`
	Size   int64  `json:"size,omitempty"`
	Limit  int64  `json:"limit,omitempty"`
}

// NewWithSync builds a service wired for syncing (provider factory + lattice).
func NewWithSync(store Store, providers ProviderFactory, lattice LatticeWriter) *Connectors {
	c := New(store)
	c.providers = providers
	c.lattice = lattice
	return c
}

// ValidateBoundPorts verifies the required outbound ports for the production
// sync profile. CRUD-only focused tests may use New without calling this gate.
func (c *Connectors) ValidateBoundPorts() error {
	if c.store == nil {
		return errors.New("connector: store port is required")
	}
	if c.providers == nil {
		return errors.New("connector: provider factory port is required")
	}
	if c.lattice == nil {
		return errors.New("connector: lattice writer port is required")
	}
	return nil
}

// Sync snapshots the provider and feeds its content into the lattice, bumping the
// connector's sync sequence. It always re-syncs (used by the manual endpoint).
//
// It ignores the retry backoff and clears the needs-attention state, because an
// explicit sync is a person saying "try now" — quite possibly right after fixing
// whatever was broken, which is the one moment when waiting out a fifteen-minute
// backoff is exactly wrong. The attempt count restarts from this request: if it
// fails again, the automatic path resumes at the first backoff step rather than
// staying stopped.
func (c *Connectors) Sync(projectID, id string) (SyncResult, error) {
	defer c.syncing.Lock(projectID + "\x00" + id)()
	rec, err := c.store.ConnectorByID(projectID, id)
	if err != nil {
		return SyncResult{}, err
	}
	rec.FailedAttempts = 0
	snap, err := c.snapshot(rec)
	if err != nil {
		c.noteSyncFailure(rec, err)
		return SyncResult{}, err
	}
	res, err := c.applySync(rec, snap)
	if err != nil {
		c.noteSyncFailure(rec, err)
		return res, err
	}
	// A sync that left files out is a success the caller keeps — the files that did
	// arrive are indexed — but it is not a caught-up connector, and it goes through
	// the same failure accounting so the retry is paced and eventually surfaces.
	// applySync has already declined to advance the fingerprint, so without this the
	// detector would retry every tick at provider rates.
	if len(res.Skipped) > 0 {
		c.noteSyncFailure(rec, skippedError(res.Skipped))
	}
	return res, nil
}

// SyncIfChanged snapshots and only re-syncs when the fingerprint moved (or the
// connector has never synced). An unchanged source is a no-op.
func (c *Connectors) SyncIfChanged(projectID, id string) (SyncResult, error) {
	// Held across the fingerprint comparison as well as the write: reading the
	// stored fingerprint and then acting on it is a read-modify-write, so an
	// unguarded gap here is what let the detector and an explicit sync both decide
	// to apply the same change.
	defer c.syncing.Lock(projectID + "\x00" + id)()
	rec, err := c.store.ConnectorByID(projectID, id)
	if err != nil {
		return SyncResult{}, err
	}
	// The deferral is decided BEFORE the snapshot, because the snapshot is the
	// expensive half — it reads the whole source, and everything downstream of it
	// spends provider tokens. Backing off after paying that cost would not be
	// backing off.
	if res, deferred := c.deferSync(rec); deferred {
		return res, nil
	}
	snap, err := c.snapshot(rec)
	if err != nil {
		c.noteSyncFailure(rec, err)
		return SyncResult{}, err
	}
	if snap.Fingerprint == rec.Fingerprint && rec.SyncSeq != 0 {
		// The source is reachable and identical to what is stored, so whatever
		// failed before is no longer failing and the attempt count has nothing left
		// to count. Without this a failure late in a sync — after the snapshot,
		// inside the lattice write — would leave the counter armed even once the
		// source came back, and the next real edit would start partway to the cap.
		c.clearSyncFailure(rec)
		return SyncResult{Changed: false, Fingerprint: rec.Fingerprint, Seq: rec.SyncSeq}, nil
	}
	res, err := c.applySync(rec, snap)
	if err != nil {
		c.noteSyncFailure(rec, err)
		return res, err
	}
	// A sync that left files out is a success the caller keeps — the files that did
	// arrive are indexed — but it is not a caught-up connector, and it goes through
	// the same failure accounting so the retry is paced and eventually surfaces.
	// applySync has already declined to advance the fingerprint, so without this the
	// detector would retry every tick at provider rates.
	if len(res.Skipped) > 0 {
		c.noteSyncFailure(rec, skippedError(res.Skipped))
	}
	return res, nil
}

// deferSync reports whether the automatic path should leave this connector alone
// for now, and the result to answer with when it should.
func (c *Connectors) deferSync(rec Connector) (SyncResult, bool) {
	deferred := SyncResult{Deferred: true, Fingerprint: rec.Fingerprint, Seq: rec.SyncSeq}
	if c.NeedsAttention(rec) {
		return deferred, true
	}
	if !rec.RetryAfter.IsZero() && c.clock().Before(rec.RetryAfter) {
		return deferred, true
	}
	return SyncResult{}, false
}

// noteSyncFailure records one failed sync attempt: the cause, the consecutive
// failure count, and the earliest the automatic path may try again.
//
// At the attempt cap RetryAfter is left zero. The connector is no longer waiting
// on a clock — it is waiting on a person — and encoding that as a very distant
// timestamp would make the state a matter of arithmetic rather than something
// NeedsAttention can simply answer.
//
// A store write that fails here is logged and swallowed: the caller's error is
// the sync's own failure, and replacing it with a bookkeeping error would hide
// the thing that actually went wrong.
func (c *Connectors) noteSyncFailure(rec Connector, cause error) {
	attempts := rec.FailedAttempts + 1
	var retryAfter time.Time
	stopping := c.retry.maxAttempts > 0 && attempts >= c.retry.maxAttempts
	if !stopping {
		retryAfter = c.clock().Add(c.retry.delay(attempts))
	}
	if err := c.store.SetConnectorSyncFailure(rec.ProjectID, rec.ID, attempts, cause.Error(), retryAfter); err != nil {
		c.log.Warnf("connector: recording sync failure for %s: %v", rec.ID, err)
		return
	}
	if stopping {
		c.log.Warnf("connector: %s has failed to sync %d times and will not be retried automatically; last error: %v",
			rec.ID, attempts, cause)
		return
	}
	c.log.Warnf("connector: %s failed to sync (attempt %d of %d), retrying after %s: %v",
		rec.ID, attempts, c.retry.maxAttempts, retryAfter.Format(time.RFC3339), cause)
}

// clearSyncFailure forgets a connector's failure state. It writes nothing when
// there is nothing to forget, so the common case — a healthy connector the
// detector finds unchanged, every tick — costs no write at all.
func (c *Connectors) clearSyncFailure(rec Connector) {
	if rec.FailedAttempts == 0 && rec.LastError == "" && rec.RetryAfter.IsZero() {
		return
	}
	if err := c.store.SetConnectorSyncFailure(rec.ProjectID, rec.ID, 0, "", time.Time{}); err != nil {
		c.log.Warnf("connector: clearing sync failure for %s: %v", rec.ID, err)
	}
}

// DetectOutcome reports what one detector sweep did. The four counts are
// mutually exclusive per connector, and each names a different situation an
// operator would want told apart: work happened, work failed just now, work is
// deliberately waiting, work has stopped.
type DetectOutcome struct {
	// Changed re-synced because the source had moved.
	Changed int
	// Failed was attempted on this sweep and failed.
	Failed int
	// Deferred was not attempted: still inside its retry backoff.
	Deferred int
	// Attention has exhausted its attempts and is no longer synced automatically
	// until someone syncs it explicitly.
	Attention int
}

// DetectChanges re-syncs every connector whose source changed since its last
// sync, across all projects. It is best-effort per connector: a connector whose
// provider cannot be read (e.g. a missing folder) is counted as failed, not
// fatal, so one unreachable source cannot abandon the sweep.
//
// This is what a background detector calls on an interval. Reconciliation, not a
// queue: the decision to sync comes from comparing the source's fingerprint to
// the stored one, so an interrupted sync simply happens again on the next tick —
// which is why connector sync is deliberately not a durable job.
//
// That same property is why the retry cap has to exist. Reconciliation has no
// memory of having tried: on its own it would re-read the source and re-embed
// every window on every tick, for as long as the failure lasted, at provider
// rates. The failure state on the record is the memory.
func (c *Connectors) DetectChanges() (DetectOutcome, error) {
	all, err := c.store.AllConnectors()
	if err != nil {
		return DetectOutcome{}, err
	}
	var out DetectOutcome
	for _, rec := range all {
		// Checked here as well as inside SyncIfChanged, against the record this
		// sweep already holds: a stopped connector costs the sweep nothing at all,
		// not even a lock and a re-read, which matters when the sweep runs every
		// couple of seconds forever.
		if c.NeedsAttention(rec) {
			out.Attention++
			continue
		}
		res, err := c.SyncIfChanged(rec.ProjectID, rec.ID)
		if err != nil {
			// One unreachable source must not abandon the sweep — the other
			// connectors still need reconciling. Count it instead, so the caller can
			// report it: a connector that fails on every tick would otherwise be
			// invisible forever.
			out.Failed++
			continue
		}
		switch {
		case res.Deferred:
			out.Deferred++
		case res.Changed:
			out.Changed++
		}
	}
	return out, nil
}

// File is one of a connector's synced files as a caller sees it: the provider's
// own key for it, and the id the lattice addresses it by.
type File struct {
	Key      string `json:"key"`
	SourceID string `json:"sourceId"`
}

// Files lists the connector's currently-synced files. It is the translation
// between the two names a file has — the provider's key, which is what a person
// recognises, and the minted lattice id, which is what anything addressing the
// file must use.
//
// The translation lives here rather than in knowledge because this is the
// capability that owns the relationship: it minted the ids and it knows what the
// provider calls things. Knowledge stores the pair (it had to store both halves
// anyway, and a scope exclusion has to resolve against lattice sources), but it
// has no business knowing that a connector's key is a path for one subkind and
// an item id for another.
//
// This is what "exclude this one file from this block" needs: the caller has a
// name, and every scope selection is by source id.
func (c *Connectors) Files(projectID, id string) ([]File, error) {
	rec, err := c.store.ConnectorByID(projectID, id)
	if err != nil {
		return nil, err
	}
	if c.lattice == nil {
		return []File{}, nil
	}
	stored, err := c.lattice.SourcesUnder(rec.ProjectID, rec.ID+FileSeparator)
	if err != nil {
		return nil, err
	}
	out := make([]File, 0, len(stored))
	for _, f := range stored {
		out = append(out, File{Key: f.Key, SourceID: f.SourceID})
	}
	// SourcesUnder leaves order unspecified; sort so a listing is reproducible
	// across calls, which is what a client rendering it needs.
	sort.Slice(out, func(i, j int) bool { return out[i].Key < out[j].Key })
	return out, nil
}

// ReadFile returns the current content of one file in a connector's source, by the
// provider's own key for it (for local-folder, the path relative to the root). It
// reports false — not an error — when the connector no longer has that file, which
// is an ordinary answer: the source is external and may have changed since it was
// synced.
//
// It lists the source and opens one member. Listing is unavoidable — the
// provider's key is how a file is addressed, and only a listing resolves it —
// but a listing is now metadata, so the read costs one file rather than the
// whole folder.
func (c *Connectors) ReadFile(projectID, id, key string) (string, bool, error) {
	rec, err := c.store.ConnectorByID(projectID, id)
	if err != nil {
		return "", false, err
	}
	snap, err := c.snapshot(rec)
	if err != nil {
		return "", false, err
	}
	for _, f := range snap.Files {
		if f.Path != key {
			continue
		}
		rc, err := f.Open()
		if err != nil {
			return "", false, err
		}
		defer rc.Close()
		b, err := io.ReadAll(rc)
		if err != nil {
			return "", false, err
		}
		return string(b), true, nil
	}
	return "", false, nil
}

// OpenItem opens one provider item without taking a connector-wide snapshot.
// Resource exact reads use this path; the older ReadFile method remains for
// callers that have only a legacy path lookup.
func (c *Connectors) OpenItem(ctx context.Context, projectID, id, providerItemID, expectedVersion string) (io.ReadCloser, ItemMeta, error) {
	if err := ctx.Err(); err != nil {
		return nil, ItemMeta{}, err
	}
	rec, err := c.store.ConnectorByID(projectID, id)
	if err != nil {
		return nil, ItemMeta{}, err
	}
	if c.providers == nil {
		return nil, ItemMeta{}, ErrPointRead
	}
	p, err := c.providers(rec)
	if err != nil {
		return nil, ItemMeta{}, err
	}
	reader, ok := p.(ConnectorItemReader)
	if !ok {
		return nil, ItemMeta{}, ErrPointRead
	}
	return reader.OpenItem(ctx, AuthorizedBinding{ProjectID: projectID, ConnectorID: id}, providerItemID, expectedVersion)
}

func (c *Connectors) snapshot(rec Connector) (Snapshot, error) {
	if c.providers == nil {
		return Snapshot{}, ErrInvalidPath
	}
	p, err := c.providers(rec)
	if err != nil {
		return Snapshot{}, err
	}
	return p.Snapshot()
}

// applySync feeds the snapshot's files into the lattice one source per file
// (keyed by FileSourceID) and prunes any source still stored under the
// connector that the current file set no longer contains. The whole-connector
// Fingerprint still gates whether a sync happens at all (SyncIfChanged); once
// it does, this reconciles the lattice down to the file level.
func (c *Connectors) applySync(rec Connector, snap Snapshot) (SyncResult, error) {
	seq := rec.SyncSeq + 1
	var usage Usage
	var skipped []SkippedFile
	if c.lattice != nil {
		// Read what is already stored BEFORE writing, so a file that was synced
		// before is recognised by its provider key and keeps the id it already has.
		// Minting a fresh id for an unchanged file would make every sync look like a
		// delete and an add: the smart-update path compares against the previous
		// snapshot of the SAME source, so a new id means every window is re-embedded,
		// and anything citing the old id — a resolved prompt block — silently points
		// at a source that no longer exists.
		existing, err := c.lattice.SourcesUnder(rec.ProjectID, rec.ID+FileSeparator)
		if err != nil {
			return SyncResult{}, err
		}
		// Keyed on the provider's full key, which for local-folder is the path
		// relative to the root. Keying on a base name instead would merge
		// "src/a.txt" and "docs/a.txt" into one source: same name, different files.
		byKey := make(map[string]string, len(existing))
		for _, f := range existing {
			byKey[f.Key] = f.SourceID
		}

		want := make(map[string]bool, len(snap.Files))
		writes := make([]LatticeFileWrite, 0, len(snap.Files))
		for _, f := range snap.Files {
			sid, ok := byKey[f.Path]
			if !ok {
				sid = FileSourceID(rec.ID, FileKeyID(f.Path))
			}
			want[sid] = true
			writes = append(writes, LatticeFileWrite{
				SourceID: sid, Label: f.Path, Revision: seq,
				Size: f.Size, Hash: f.Hash, Open: f.Open,
			})
		}
		// The whole listing goes in one call. Per-file, this loop was the request
		// storm: one embedding call per file, back to back, for as many files as the
		// folder held — and one project-scale corpus rebuild after each of them.
		//
		// It is a listing rather than content now, so "the whole snapshot" costs a
		// few hundred bytes per file instead of the file. The lattice opens what it
		// decides it needs, when it needs it, and commits in slices.
		if len(writes) > 0 {
			u, unread, err := c.lattice.AddSources(rec.ProjectID, writes)
			// Accumulated BEFORE the error check, because a failed sync may still have
			// committed slices, and those slices bought embeddings. Discarding the usage
			// on the error path meant a sync that spent real money reported no cost at
			// all — invisible in precisely the case worth watching.
			usage.PromptTokens += u.PromptTokens
			usage.TotalTokens += u.TotalTokens
			skipped = append(skipped, unread...)
			if err != nil {
				if c.costs != nil && usage.TotalTokens > 0 {
					c.costs.RecordSyncCost(rec.ProjectID, rec.ID, usage)
				}
				return SyncResult{Usage: usage, Skipped: skipped, Partial: hasPartialProgress(err)}, err
			}
		}
		for _, f := range existing {
			if !want[f.SourceID] {
				if err := c.lattice.RemoveSource(rec.ProjectID, f.SourceID); err != nil {
					return SyncResult{}, err
				}
			}
		}
	}
	// A sync that left files out has NOT caught up with its source, so it must not
	// claim the source's fingerprint.
	//
	// This is the whole reason a skip could be silent. The fingerprint is the only
	// thing the detector compares, so recording the current one after skipping a
	// file meant the next tick found nothing to do — and the file that failed to
	// arrive was never looked at again, for as long as nothing else in the folder
	// changed. It was absent from retrieval, permanently, and every response was a
	// 200.
	//
	// Keeping the previous fingerprint makes the source read as changed, so the
	// next sync retries. What stops that becoming the 2-second storm record 0152
	// bounded is the caller, which routes a skip through noteSyncFailure: the retry
	// is backed off, and after max_attempts the connector reports needing
	// attention with the skipped files named. A file a reader cannot fix is exactly
	// what that state is for.
	fingerprint := snap.Fingerprint
	if len(skipped) > 0 {
		fingerprint = rec.Fingerprint
	}
	at := c.clock()
	if err := c.store.SetConnectorSyncState(rec.ProjectID, rec.ID, fingerprint, seq, at); err != nil {
		return SyncResult{}, err
	}
	if c.costs != nil {
		c.costs.RecordSyncCost(rec.ProjectID, rec.ID, usage)
	}
	// The source changed, so refresh whatever depends on it — best-effort, off the
	// sync's result. applySync is only reached on a real (re)sync, so this fires
	// exactly on change, never on a no-op.
	if c.cascader != nil {
		c.cascader.RefreshDependents(rec.ProjectID, "connector", rec.ID)
	}
	return SyncResult{Changed: true, Fingerprint: fingerprint, Seq: seq, Usage: usage, Skipped: skipped}, nil
}

// hasPartialProgress is the narrow cross-capability part of the partial-run
// contract. Knowledge keeps the receipt concrete and rich; Connector only needs
// to preserve the fact that prior complete slices landed, without importing it.
func hasPartialProgress(err error) bool {
	type partial interface{ PartialProgress() bool }
	var p partial
	return errors.As(err, &p) && p.PartialProgress()
}

// skippedError renders a sync's skips as the cause recorded on the connector, so
// the reason it needs attention is the reason itself rather than "something went
// wrong". The list is capped: a folder where everything failed would otherwise
// write its whole contents into one error column.
func skippedError(skipped []SkippedFile) error {
	paths := make([]string, 0, len(skipped))
	for _, s := range skipped {
		paths = append(paths, s.Path)
	}
	sort.Strings(paths)
	if len(paths) > 5 {
		return fmt.Errorf("%d file(s) could not be indexed, including: %s",
			len(paths), strings.Join(paths[:5], ", "))
	}
	return fmt.Errorf("could not be indexed: %s", strings.Join(paths, ", "))
}
