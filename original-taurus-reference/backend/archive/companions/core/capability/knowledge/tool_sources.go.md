# tool_sources.go

`tool_sources.go` adds the two Knowledge tools that search cannot stand in for:
`knowledge.list`, which reports what exists, and `knowledge.read`, which returns
one source exactly.

## Why search was not enough

`knowledge.search` answers one question well — *what text is relevant to this
query* — and it is the right entry point whenever the answer's location is
unknown. It is the wrong instrument for two other questions that come up
constantly.

The first is **"what do I have access to?"** There is no query for this. A model
that wants to know whether the user's uploaded spec is reachable at all has
nothing to search *for*; it can only guess at phrases and read failure as
absence. That is how a present source gets reported as missing.

The second is **"give me this file exactly."** Search returns the fragments that
scored best against a query, which is precisely the wrong behavior when the task
is "summarize the attached notes" — the whole point is that nothing should be
filtered out. Before these tools, a model asked to summarize a named file could
only phrase increasingly specific searches and hope the union of their fragments
covered it.

Both tools are read-only and both close over the Project, so neither widens what
a model can reach — only how precisely it can reach it.

## The citation contract is what shapes `read`

The design decision worth stating plainly: **`knowledge.read` returns its text
inside the same `regions` shape `knowledge.search` returns.**

This is not code reuse for its own sake. Ask validates every citation against the
evidence set, and the evidence set is built from tool results that carry regions.
A read tool that returned a bare `{"text": "..."}` would put content in front of
the model that no citation could refer to — and a grounded answer resting on it
would be rejected for having no citation. That is exactly the failure that made
chat attachments unusable when they were inlined into the prompt instead of
admitted to Knowledge.

Framed correctly, a read *is* a retrieval: it selects a span of a source and
returns it with its provenance. The only difference from search is how the span
is chosen — by address rather than by similarity. Sharing `searchToolRegion`
makes that equivalence structural instead of a convention someone must maintain.

The one field where the two genuinely differ is `relevance`. Search reports a
similarity score it computed. A read has no such score, and inventing one would
be a lie; it reports `1` because the span is exactly what was asked for, not
because it won a ranking.

## Code breakdown

### Names and bounds

```go
const (
	listToolName    = "knowledge.list"
	listToolVersion = "v1"
	readToolName    = "knowledge.read"
	readToolVersion = "v1"

	maxListedSources = 200
	maxReadBytes     = 64 * 1024
)
```

Both bounds exist for the same reason: a tool result is fed straight back into
the model's context, so an unbounded one lets a large Project evict everything
else in the loop. `maxListedSources` caps a listing at 200 entries and
`maxReadBytes` caps a read at 64 KiB.

Each bound is paired with a `truncated` flag in its output. A truncated result
that did not say so would be indistinguishable from a complete one, and the model
would confidently reason about a Project it had only partly seen — the silent
version of this bound is worse than no bound at all.

### The source types a listing walks

```go
var listedSourceTypes = []string{SourceTypeDocument, SourceTypeConnector, SourceTypeAttachment}
```

The lattice's enumeration primitive is `SourcesUnder(projectID, sourceType,
prefix)` — it is scoped to one type by construction. Rather than add an
"every source" query to the store, a listing walks the known types and
concatenates. This keeps the store interface unchanged and makes the set of types
a model can see explicit in one place; a new source type joins listings by being
added here.

The same slice backs `isListedSourceType`, so the enum in the input schemas, the
types a listing walks, and the types a read accepts cannot drift apart.

### `ListTool` and `ReadTool`

```go
func (k *Knowledge) ListTool(projectID string) intelligence.ToolBinding {
```

Both follow `SearchTool`'s shape exactly: the Project is closed over by the
handler rather than accepted as a tool argument, so a model cannot name another
Project. This is the same containment `SearchTool` relies on, and it is why
neither tool needs to re-check access — there is no widening to check.

The descriptions do real work here. A model chooses between three overlapping
tools from their descriptions alone, so each says *when to use it* rather than
only what it does, and `knowledge.read`'s description points back at
`knowledge.list` as the way to obtain a `sourceId`.

### Listing

```go
	for _, sourceType := range types {
		origins, err := k.store.SourcesUnder(projectID, sourceType, "")
```

An empty prefix matches every source of a type. For each origin the listing loads
the source to report its size — `bytes` and `lines` — because those are what let
a model decide whether to read a source whole or by range, and `lines` is the
unit `knowledge.read` accepts.

```go
	sort.Slice(out.Sources, func(i, j int) bool { ... })
```

`SourcesUnder` leaves order unspecified. Sorting by (type, id) makes a listing
reproducible: a model that lists sources in one round and refers back to "the
third one" in a later round would otherwise be reasoning about a different
ordering each time.

The truncation happens *after* the total is recorded, so `total` always reports
the true count even when `sources` is cut short.

### Reading

```go
	source, ok, err := k.store.SourceByOrigin(projectID, input.SourceType, input.SourceID)
	if !ok {
		return nil, &intelligence.ToolError{Code: "not_found", ...}
	}
```

The Project-scoped lookup is the whole access check: a source id belonging to
another Project simply is not found. There is no separate authorization step to
forget, and no way for a model that has learned an id from elsewhere to read
across the boundary.

```go
	first, last := 1, len(lines)
	if input.StartLine != 0 { first = input.StartLine }
	if input.EndLine != 0 { last = input.EndLine }
```

Omitting the range reads the whole source, which is the common case — "read the
attached file" should not require the model to know how long it is. An `endLine`
past the end clamps to the end rather than erroring, because asking for more than
exists is a reasonable way to say "to the end". A `startLine` past the end *is* an
error, since there is no text to return and silently succeeding with nothing would
read as an empty file.

```go
	if end-start > maxReadBytes {
		for last > first && lines[last-1].end-start > maxReadBytes {
			last--
		}
		end = lines[last-1].end
		out.Truncated = true
	}
```

Truncation walks back to a line boundary rather than cutting mid-line, so the
returned text is always whole lines and the reported `endLine` is a line the model
can resume from. Cutting at an arbitrary byte would produce a fragment whose last
line is half a sentence and whose line numbering no longer means anything.

### `lineSpans` — the byte offsets are the point

```go
func lineSpans(text string) []lineSpan {
```

Each span includes its trailing newline, so concatenating a contiguous run of
spans reproduces the original bytes exactly. That property is what makes
`text[start:end]` equal the returned text, which in turn is what makes the region
citable — a citation whose offsets did not address its own text would be worse
than no citation, because it would look valid.

A trailing newline does not create a final empty line: a file of three lines
reports three, which is what a person and a model both expect.

### `decodeToolInput`

```go
func decodeToolInput[T any](raw json.RawMessage, message string) (T, error) {
```

Strict decoding with `DisallowUnknownFields`, shared by both tools. Rejecting
unknown fields matters more here than it looks: a model that invents a
`projectId` argument must be told its call was malformed rather than have the
field silently ignored, which would leave it believing it had scoped the call.

### A listing shows the name, not just the id

`listedSource` carries a `Name` — the source's stored label — beside its
`sourceId`, and the tool description tells the model to match on the name and
pass the id.

This is the direct consequence of composing source ids out of minted ids. It is
the right trade for addressing (nothing in an id can be corrupted in transit),
but it leaves a bare listing unreadable: a model choosing which source to read
would be picking from a column of hex. The label restores the only part a person
or a model recognises, while the id stays the thing that is actually passed back.

### `readTool` reads the origin, not the lattice

`knowledge.read` now fetches content through the `SourceReader` port instead of
slicing the source's stored copy. A whole-source read is the origin's data; the
lattice's business is windows.

**The store lookup stays** even though the content no longer comes from it, and that
is a security property rather than a leftover. The origin reader dispatches on source
type and knows nothing about which project admitted what, so dropping the lookup as
"redundant" would let a caller name another project's source id and read its content.
`TestReadToolChecksScopeBeforeReachingTheOrigin` pins the ordering, and fails
specifically if the refusal comes back as `origin_gone` — which would mean the origin
was consulted first.

**Blocks come from the same read as the text.** Pairing current text with the stored
block table would put byte offsets from one revision against components from another.

`readOrigin` turns the two failures a caller can act on into tool errors:
`unavailable` when no reader is configured, and `origin_gone` when the origin no
longer has the content. The second says search still works, because it does — the
windows were indexed and remain citable. What is gone is reading the whole thing back.

**The accepted behaviour change:** a read returns what the origin has *now*, not what
was indexed. A file edited after indexing used to read back as though nothing had
happened, which was the copy being quietly wrong; a vanished origin used to serve a
stale copy. Both are now visible.
