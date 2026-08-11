package names

import "github.com/gccurtis/taurus-omega/core/capability/formula"

// namespaceResolver resolves identifiers against an immutable snapshot of a
// project's entries, reconstructing each into a formula Value on demand. It
// implements formula.Resolver — the seam between the name manager and the pure
// evaluator.
type namespaceResolver struct {
	entries map[string]Entry
	formula *formula.Service
}

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
