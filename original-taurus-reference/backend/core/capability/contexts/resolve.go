package contexts

import "errors"

// Catalog is the port contexts uses to enumerate a project's leaf resources for
// whole-project expansion, and to check a member resource exists. It is
// satisfied over the resource catalog at composition; a nil catalog means
// whole-project resolves to nothing and non-context member existence is not
// enforced. It must NOT return context resources from AllResources.
type Catalog interface {
	AllResources(projectID string) ([]Ref, error)
	Exists(projectID, kind, id string) (bool, error)
}

// UseCatalog sets the whole-project source. A nil catalog (the default) makes
// whole-project resolve to nothing.
func (c *Contexts) UseCatalog(cat Catalog) { c.catalog = cat }

// ConnectorFiles is the port contexts uses to expand a connector member to
// the file origins it currently syncs — so a connector behaves like a
// context (expand to leaves, then subtract), whether bound directly to a
// prompt variable or nested in a context. It is satisfied over the
// knowledge lattice at composition; a nil ConnectorFiles leaves a connector
// member unexpanded (a single origin), which keeps resolution working
// before the port is wired.
type ConnectorFiles interface {
	FilesUnder(projectID, connectorID string) ([]Ref, error)
}

// UseConnectorFiles sets the connector-file expander. A nil ConnectorFiles
// (the default) leaves connector members unexpanded.
func (c *Contexts) UseConnectorFiles(cf ConnectorFiles) { c.connectorFiles = cf }

// ValidateBoundPorts closes Context's production composition after the Resource
// catalog and connector-file adapters have been constructed.
func (c *Contexts) ValidateBoundPorts() error {
	if c.catalog == nil {
		return errors.New("contexts: resource catalog port is required")
	}
	if c.connectorFiles == nil {
		return errors.New("contexts: connector files port is required")
	}
	return nil
}

// originKey identifies a leaf by kind+id for dedup/subtraction (Name is ignored).
type originKey struct{ kind, id string }

func keyOf(r Ref) originKey { return originKey{kind: r.Kind, id: r.ID} }

// Resolve flattens a definition to its leaf refs: expand Includes to a leaf set,
// expand Excludes to a leaf set, return Includes − Excludes deduped in include
// order (exclude wins). Nested contexts recurse (cycles cut by a visited-set),
// and whole-project expands via the Catalog. Always computed live.
func (c *Contexts) Resolve(projectID string, def Definition) ([]Ref, error) {
	memo := map[string][]Ref{}
	inc, err := c.expand(projectID, def.Includes, map[string]bool{}, memo)
	if err != nil {
		return nil, err
	}
	exc, err := c.expand(projectID, def.Excludes, map[string]bool{}, memo)
	if err != nil {
		return nil, err
	}
	return subtractRefs(inc, exc), nil
}

// ResolveID resolves a stored context by id — equivalent to resolving an
// anonymous definition that includes just that context.
func (c *Contexts) ResolveID(projectID, id string) ([]Ref, error) {
	return c.Resolve(projectID, Definition{Includes: []Ref{{Kind: KindContext, ID: id}}})
}

// expand flattens a ref list to leaf refs. A context member recurses into its
// stored definition (whole-project via the Catalog); a connector member
// expands to its current file origins via ConnectorFiles (or, with no
// ConnectorFiles wired, stays a single origin); any other kind is a leaf.
// visited holds the ancestor path of context ids above this call — never
// mutated, only copied on recursion — so cycles are cut when a context appears
// on its own ancestor path, while a nested definition's Includes and Excludes
// still expand independently of each other. memo caches a context id's fully
// resolved leaf set for the lifetime of one top-level Resolve call — shared
// across both the Includes and Excludes expansions and across every recursive
// call, so a context referenced from multiple places in the lattice is read
// from the store and expanded at most once. This is only sound because the
// stored context→context graph is write-time guaranteed acyclic (Task 2): a
// context's resolved value can never depend on itself, so caching it by id is
// always correct, not merely a same-path shortcut.
func (c *Contexts) expand(projectID string, refs []Ref, visited map[string]bool, memo map[string][]Ref) ([]Ref, error) {
	var out []Ref
	for _, r := range refs {
		switch {
		case r.Kind == KindContext && r.ID == WholeProjectID:
			if c.catalog == nil {
				continue
			}
			all, err := c.catalog.AllResources(projectID)
			if err != nil {
				return nil, err
			}
			out = append(out, all...)
		case r.Kind == KindContext:
			if visited[r.ID] {
				continue // defensive cycle cut (graph is kept acyclic on write)
			}
			if cached, ok := memo[r.ID]; ok {
				out = append(out, cached...)
				continue
			}
			row, err := c.store.ContextByID(projectID, r.ID)
			if errors.Is(err, ErrNotFound) {
				memo[r.ID] = nil // dangling ref resolves to nothing; cache it
				continue
			}
			if err != nil {
				return nil, err
			}
			// Copy the visited path and add this context, so the two sides of the
			// nested definition (row.Includes / row.Excludes) expand independently
			// — a context visited on one side must not suppress the other side, or
			// leaf-level exclusion silently fails at depth >= 2. Cycles are still
			// cut: a context on its own ancestor path is skipped.
			child := make(map[string]bool, len(visited)+1)
			for k := range visited {
				child[k] = true
			}
			child[r.ID] = true
			inc, err := c.expand(projectID, row.Includes, child, memo)
			if err != nil {
				return nil, err
			}
			exc, err := c.expand(projectID, row.Excludes, child, memo)
			if err != nil {
				return nil, err
			}
			resolved := subtractRefs(inc, exc)
			memo[r.ID] = resolved
			out = append(out, resolved...)
		case r.Kind == KindConnector:
			if c.connectorFiles == nil {
				out = append(out, r) // no expander wired: connector stays a single origin
				continue
			}
			files, err := c.connectorFiles.FilesUnder(projectID, r.ID)
			if err != nil {
				return nil, err
			}
			out = append(out, files...)
		default:
			out = append(out, r)
		}
	}
	return out, nil
}

// References reports whether context contextID has (kind,id) as a member,
// directly or transitively through nested contexts (over both Includes and
// Excludes — a prompt that excludes a context still depends on that context's
// membership). whole-project is NOT treated as referencing a specific origin
// (it would make every prompt depend on every change). Cycle/visited-guarded;
// a missing context contributes nothing.
func (c *Contexts) References(projectID, contextID, kind, id string) (bool, error) {
	visited := map[string]bool{}
	var walk func(ctxID string) (bool, error)
	walk = func(ctxID string) (bool, error) {
		if visited[ctxID] {
			return false, nil
		}
		visited[ctxID] = true
		row, err := c.store.ContextByID(projectID, ctxID)
		if err != nil {
			if errors.Is(err, ErrNotFound) {
				return false, nil
			}
			return false, err
		}
		for _, list := range [][]Ref{row.Includes, row.Excludes} {
			for _, r := range list {
				if r.Kind == kind && r.ID == id {
					return true, nil
				}
				if r.Kind == KindContext && r.ID != WholeProjectID {
					ok, err := walk(r.ID)
					if err != nil {
						return false, err
					}
					if ok {
						return true, nil
					}
				}
			}
		}
		return false, nil
	}
	return walk(contextID)
}

// subtractRefs returns inc − exc, deduped, in inc order (exclude wins).
func subtractRefs(inc, exc []Ref) []Ref {
	excluded := make(map[originKey]bool, len(exc))
	for _, r := range exc {
		excluded[keyOf(r)] = true
	}
	seen := make(map[originKey]bool, len(inc))
	var out []Ref
	for _, r := range inc {
		k := keyOf(r)
		if excluded[k] || seen[k] {
			continue
		}
		seen[k] = true
		out = append(out, r)
	}
	return out
}
