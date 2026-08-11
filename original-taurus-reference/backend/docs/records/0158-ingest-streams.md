# 0158 — Ingest streams, and the byte cap is gone

A connector snapshot was every byte of every file, held at once — and held
several times over: the provider retained it, `applySync` built a parallel slice
of writes from it, the wiring adapter built a third copy of `AddItem`s, and over
HTTP the watcher buffered the whole thing to encode and Omega buffered it again to
decode. On every detector tick, whether anything had changed or not.

That is what `connectors.max_file_bytes` was really protecting, and why it was the
wrong shape: its bound was per file while the exposure was the whole snapshot. 596
files of 1 MiB passed; one 2 MiB file was refused. It is deleted, not raised.

## A snapshot is a listing

`FileEntry` carries `Path`, `Size`, `Hash` and an `Open` func. `Snapshot` is that
listing plus a fingerprint.

`Hash` is the load-bearing addition. A re-sync compares it against the stored
source's `content_hash` and skips a match **without opening the file** — so an
unchanged connector costs a listing, where before it cost a corpus. `localFolder`
still reads every file once, because hashing is the only honest way to know
whether a file changed, but it streams each through a fixed buffer and keeps
nothing.

The fingerprint is derived from the listing by `FingerprintOf`, one definition on
both sides of the wire. Its value differs from the old one, so every existing
connector sees one changed fingerprint after upgrading — costing a single
reconciling sync in which every hash matches and every file is skipped.

## The wire protocol

    GET /snapshot          NDJSON: one {"path","size","hash"} per line
    GET /file?path=<rel>   the raw bytes of one file

NDJSON rather than one document so neither side holds the folder. The watcher
confines the path to the folder it was pointed at before opening anything —
without that, a query parameter reads whatever the process can, and the process is
pointed at a user's own machine.

## The windower became a state machine

`windowSpans` needs the whole document: it indexes into it to slice each sentence,
to hard-split an oversized one, and to test each window for blankness. A 5MB file
cost 5MB of text plus, for a single-sentence file, a 40MB table of per-rune byte
offsets.

`streamWindower` (record: `cc5badc`) runs the same three passes as one machine over
arriving bytes, holding a window and its overlap tail. `windowSpans` remains the
definition, and the gate is a differential oracle over 13 fixtures × 6 geometries
× 9 chunkings requiring **byte-identical** spans — byte identity because that is
what the reuse map keys on.

`windowContent` is where it meets ingest: one read per source, from which the
windows, the size, the line count and the content hash all fall out. Nothing holds
the source.

## What a failure looks like now

A file that cannot be read is reported, not fatal. `AddResult.Unreadable` carries
it, the wiring adapter turns it into a `SkippedFile`, and the sync succeeds without
that file. `CodeFileTooLarge` became `CodeFileUnreadable`: the size reason is gone,
and what remains are the failures a reader cannot fix — an unreadable file, a
binary with no text extractor, a file that vanished between the listing and the
read.

`AddSources` returns skips as well as usage for this reason. A log line is where a
skip goes to be forgotten.

## The ceiling that replaces the byte cap

`knowledge.ingest.max_artifacts`, derived from `limits.memory_budget` (25% of
system RAM, read from `/proc/meminfo` on Linux, logged with its derivation). A
corpus rebuild holds every frontier vector at once — ~12KB each at 1536 dims — so
this is a real allocation bound, and unlike the commit budget it **is** an
admission limit: crossing it is refused, because the alternative is an OOM kill.

It is checked **pre-flight**, from the sizes the listing already carries plus one
`CountArtifacts`. Mid-sync would be worse than useless now that ingest commits in
slices: it would leave an arbitrary prefix of a folder indexed, indistinguishable
from a complete sync, with retrieval quietly answering from part of a corpus.

The refusal is a typed `limit.Exceeded` under `project_artifact_limit`, carrying
the bound and the actual, and naming the setting to raise. Record 0154's trap
applies — embedding `*limit.Exceeded` promotes `Error()` while `errors.As` still
fails without an explicit `Unwrap` — and the test asserts both identities. Deleting
the `Unwrap` was confirmed to make it fail.

## Deliberately not done

`ReadFile` still lists the source to resolve one provider key to one path. Listing
is unavoidable — the key is how a file is addressed — but it is metadata now, so
the read costs one file rather than the folder.
