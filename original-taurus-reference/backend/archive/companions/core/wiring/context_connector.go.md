# context_connector.go

Adapts the knowledge lattice to `contexts.ConnectorFiles`. `connectorFilesCatalog`
implements `FilesUnder(projectID, connectorID) ([]contexts.Ref, error)` over
`*knowledge.Knowledge.SourcesUnder`, applying the connector capability's
`connectorID + FileSeparator` file-source-id convention (Task 4) here in
wiring so neither `contexts` nor the composition of a connector's files
requires `contexts` to import `connector` or `knowledge` directly. This is
what makes `{Kind: "connector", ID: X}` expand to `X`'s current file origins
during resolution — a connector behaves like a context (expand to leaves,
then subtract), whether bound directly to a prompt variable or nested inside
a stored context. See repo conventions (AGENTS.md).

## Code breakdown

```go
package wiring

import (
	"strings"

	"github.com/gccurtis/taurus-omega/core/capability/connector"
	"github.com/gccurtis/taurus-omega/core/capability/contexts"
	"github.com/gccurtis/taurus-omega/core/capability/knowledge"
)

// connectorFilesCatalog adapts the knowledge lattice to contexts.ConnectorFiles:
// it expands a connector member to its current file origins by listing every
// lattice source stored under that connector's file-source-id prefix (Task 4's
// connectorID+FileSeparator convention). The separator is applied here
// in wiring, not in contexts, which never imports connector or knowledge.
//
// A connector-kind leaf (one already-synced file) shares its parent connector's
// Kind ("connector"), so contexts.expand's connector case re-queries an
// Excludes entry that names a single file directly the very same way it
// queries a connector root — FilesUnder("X/a") gets called just like
// FilesUnder("X") would. When connectorID names no children, FilesUnder falls
// back to an exact match so that ref still resolves to itself, which is what
// makes leaf-level exclusion of one file inside a connector work the same way
// leaf-level exclusion already works for every other resource kind.
type connectorFilesCatalog struct{ know *knowledge.Knowledge }

func (a connectorFilesCatalog) FilesUnder(projectID, connectorID string) ([]contexts.Ref, error) {
	origins, err := a.know.SourcesUnder(projectID, knowledge.SourceTypeConnector, connectorID)
	if err != nil {
		return nil, err
	}
	prefix := connectorID + connector.FileSeparator
	var out []contexts.Ref
	for _, o := range origins {
		if o.SourceID == connectorID || strings.HasPrefix(o.SourceID, prefix) {
			out = append(out, contexts.Ref{Kind: contexts.KindConnector, ID: o.SourceID})
		}
	}
	return out, nil
}
```

`FilesUnder` makes a single `SourcesUnder` call with `connectorID` itself as
the raw prefix — broader than the `connectorID+FileSeparator` prefix Task 4's
sync uses to enumerate a connector's own files — and then filters the results
client-side into exactly two admissible shapes: an origin whose `SourceID` is
`connectorID` itself (an exact match — `connectorID` already names one synced
file directly, not a connector root), or one whose `SourceID` has
`connectorID+FileSeparator` as a proper prefix (a genuine child file under a
connector root). Anything else the raw scan incidentally turns up — e.g. a
different connector whose id happens to start with the same characters, like
`connectorID` = `"X"` matching connector `"Xexcept"`'s files — is discarded by
this filter, which is exactly why the filter checks the *separator-qualified*
prefix rather than trusting the raw scan's own prefix match: reusing the raw,
un-separated prefix as the admission test would reopen the substring-collision
bug the separator convention exists to close (the same one
`knowledge_test.go`'s `TestSourcesUnderReturnsPrefixMatches` guards against
for `SourcesUnder` itself). Doing this as one broader scan plus a client-side
filter, instead of two separate calls (one prefixed `connectorID+FileSeparator`
for children, a second exact-match probe for self), costs one `SourcesUnder`
call either way but avoids depending on any lower-level exact-lookup primitive
beyond the prefix scan `contexts` composition already needs.

The two admitted shapes exist for two different callers of `FilesUnder`.
When `connectorID` is a genuine connector root (e.g. resolving
`{Kind:"connector", ID:"X"}`, whether bound directly to a prompt variable or
found while expanding a stored context that nests it), no origin's `SourceID`
equals `"X"` exactly — connector roots are never themselves lattice sources,
only their files are — so only the prefix branch fires, returning every
currently-synced file under `X`. When `connectorID` is already one file's own
id (e.g. an `Excludes` entry naming `{Kind:"connector", ID:"X/a"}` directly,
to subtract one file out of a connector's expansion), `contexts.expand`'s
connector case queries `FilesUnder(projectID, "X/a")` the same way it
queries a genuine root — see `resolve.go.md`'s note on why a connector's
expanded leaves share their root's `Kind`. That id has no children (a synced
file is not itself a connector), so the prefix branch is empty, but the exact
branch matches — `"X/a"` is a real registered source — so `FilesUnder`
resolves it back to itself, a single-item result. Without this fallback that
`Excludes` entry would expand to nothing, `subtractRefs` would have nothing to
key against, and the exclusion would silently fail to remove anything from
the connector's included files — the file-inside-connector exclusion case
`resolve_test.go`'s `TestResolveConnectorExcludeOneFileInside` and its wired
fake `fakeConnectorFiles` exist specifically to pin down.

### The separator is printable now

`FilesUnder` composes its prefix from `connector.FileSeparator`, which changed
from `\x1f` to `/`. Nothing about the filtering logic changed with it: the
sibling-prefix trap (`X/a` must not match `X/ab`) and the cross-connector trap
(`X` must not match `Xother`) are the same two cases, and they are still handled
by requiring either a separator-qualified prefix or an exact match rather than a
bare string prefix.

What changed upstream is that the member half of a file's id is now a minted id
rather than a relative path — so an `Excludes` entry naming one file directly
carries an id the caller has to have obtained from the lattice, not one it can
compose from a filename.
