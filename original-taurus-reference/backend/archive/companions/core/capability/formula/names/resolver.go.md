# resolver.go

`resolver.go` closes the loop between the name manager and the pure `formula`
evaluator: it turns a stored `Entry` back into a `formula.Value` (`reconstruct`),
adapts a project's whole namespace into a `formula.Resolver` (`namespaceResolver`),
and exposes `Manager.Evaluate`, the one method that runs an expression against a
project's stored names.

The design keeps a hard boundary: the `names` package never touches evaluator
internals, and `formula` never knows `names` exists — `namespaceResolver` is the
only object that crosses between them, and it does so purely through the
`formula.Resolver` port added in Increment 1. Evaluation snapshots the namespace
once, at the start of `Evaluate`, so a run is deterministic even if the store is
mutated concurrently — no entry can appear or vanish mid-evaluation.

## Code breakdown

### Package declaration and import

```go
package names

import "github.com/gccurtis/taurus-omega/core/capability/formula"

```

The file needs only `formula`, for `Value`, `Resolver`, and `Service`.

### namespaceResolver

```go
// namespaceResolver resolves identifiers against an immutable snapshot of a
// project's entries, reconstructing each into a formula Value on demand. It
// implements formula.Resolver — the seam between the name manager and the pure
// evaluator.
type namespaceResolver struct {
	entries map[string]Entry
	formula *formula.Service
}

```

`namespaceResolver` is a thin, unexported adapter: it holds a fixed `map[string]Entry`
— the snapshot taken once per `Evaluate` call — and the `formula.Service` needed to
reconstruct a function entry (which requires evaluating its source). Nothing about
it is mutable after construction, which is what makes one evaluation run
deterministic regardless of what happens to the store afterward.

### Resolve

```go
// Resolve reconstructs the named entry into a value, or reports it absent.
func (r *namespaceResolver) Resolve(name string) (formula.Value, bool, error) {
	entry, ok := r.entries[name]
	if !ok {
		return formula.Value{}, false, nil
	}
	value, err := reconstruct(r.formula, entry)
	if err != nil {
		return formula.Value{}, false, err
	}
	return value, true, nil
}

```

`Resolve` is the single method the `formula.Resolver` interface requires. A miss
in the snapshot map reports `false` with no error — the evaluator turns that into
an `unknown_identifier` error at the point the name is used, not here. A hit is
reconstructed on demand via `reconstruct`; a reconstruction failure (only possible
today if a stored function's source somehow fails to evaluate) is surfaced as the
third return value rather than silently treated as a miss.

### reconstruct

```go
// reconstruct turns a stored entry into a formula Value: a scalar is its value;
// a table is a table value built from its schema and rows; a function is
// produced by evaluating its source. A function definition resolves no free
// names, so it needs no bindings here — its free names resolve later, when it is
// applied against the namespace.
func reconstruct(service *formula.Service, entry Entry) (formula.Value, error) {
	switch entry.Type {
	case TypeNull, TypeNumber, TypeText, TypeLogic:
		return entry.Value, nil
	case TypeTable:
		fields := make([]string, len(entry.Schema))
		for i, column := range entry.Schema {
			fields[i] = column.Name
		}
		return formula.TableValue(fields, entry.Rows)
	case TypeFunction:
		return service.Evaluate(entry.Source, nil)
	default:
		return formula.Value{}, ErrNotFound
	}
}

```

`reconstruct` is the one place a stored `Entry` becomes a live `formula.Value`,
dispatching on `entry.Type`. A scalar entry already holds its `Value`, so it is
returned unchanged. A table entry rebuilds a `formula.TableValue` from its column
names (`entry.Schema`) and its rows (`entry.Rows`) — the schema's declared column
*types* are not needed here, only their names, because the value model itself
carries each cell's runtime kind. A function entry is reconstructed by evaluating
its `Source` with no bindings (`nil`): parsing `FUNCTION(...)`/`LAMBDA(...)`
produces a function value directly, with its free identifiers left unresolved
until the function is later applied — at which point `evalCall`'s resolver lookup
runs `Resolve` again, against the (possibly updated) namespace, which is exactly
what lets `scale` reference `factor`, or `twice` call `scale` twice.

### Manager.Evaluate

```go
// Evaluate evaluates source against the project's namespace and returns the
// resulting value. The namespace is snapshotted once, so evaluation is
// deterministic even as the underlying store changes.
func (m *Manager) Evaluate(project, source string) (formula.Value, error) {
	entries, err := m.store.Names(project)
	if err != nil {
		return formula.Value{}, err
	}
	index := make(map[string]Entry, len(entries))
	for _, entry := range entries {
		index[entry.Name] = entry
	}
	return m.formula.EvaluateWith(source, &namespaceResolver{entries: index, formula: m.formula})
}
```

`Evaluate` is the method the rest of the system calls to run a formula against a
project: it lists every entry in the project's namespace exactly once, indexes
them by name into the snapshot map a `namespaceResolver` wraps, and delegates to
`formula.Service.EvaluateWith` — the Increment 1 entry point that parses `source`
and evaluates it against a supplied `Resolver`. Taking the snapshot before parsing
or evaluating begins is what gives the "no clock, deterministic" guarantee this
increment requires: nothing observed during the call can change once it has
started.
