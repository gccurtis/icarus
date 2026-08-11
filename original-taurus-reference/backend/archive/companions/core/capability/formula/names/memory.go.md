# memory.go

`memory.go` provides `MemoryStore`, the in-memory `NameStore` implementation that
backs the package's tests until a durable store is wired in. It holds every
project's entries in nested maps guarded by a single mutex — the same shape as
`core/capability/access/memory.go`'s store, applied to name-manager entries
instead of users and sessions.

## Code breakdown

### Package declaration and import

```go
package names

import "sync"

```

`memory.go` lives in the same `names` package as the `NameStore` interface it
implements, so it needs no import of the entry types. Its one dependency is
`sync`, for the mutex that makes the maps safe under concurrent use.

### The MemoryStore type

```go
// MemoryStore is an in-memory NameStore, safe for concurrent use. It backs tests
// and the package until a durable store is wired.
type MemoryStore struct {
	mu       sync.Mutex
	projects map[string]map[string]Entry // project -> name -> entry
}

```

`MemoryStore` holds one nested map behind a mutex: the outer key is the project,
the inner key is the entry name. Nesting the maps this way is what gives each
project its own isolated namespace — a name in one project's map has no effect on
the same name in another project's map — without any composite-key encoding.

### The constructor

```go
// NewMemoryStore returns an empty in-memory store.
func NewMemoryStore() *MemoryStore {
	return &MemoryStore{projects: make(map[string]map[string]Entry)}
}

```

`NewMemoryStore` initializes the outer map so every method can assume it is
non-nil; the inner per-project map is created lazily, on first write, by
`PutName`.

### PutName

```go
func (s *MemoryStore) PutName(project string, entry Entry) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	names, ok := s.projects[project]
	if !ok {
		names = make(map[string]Entry)
		s.projects[project] = names
	}
	names[entry.Name] = entry
	return nil
}

```

`PutName` stores or overwrites one entry under its `Name`, within the given
project. If the project has no map yet, it creates one on the spot — this is the
lazy initialization the outer map's `nil` values allow, so a project need never be
created explicitly before its first name is stored.

### Name

```go
func (s *MemoryStore) Name(project, name string) (Entry, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	entry, ok := s.projects[project][name]
	if !ok {
		return Entry{}, ErrNotFound
	}
	return cloneEntry(entry), nil
}

```

`Name` looks up one entry by project and name, returning `ErrNotFound` when either
the project or the name within it is absent — a nested map read on a missing outer
key simply yields the zero value, so no separate check for an unknown project is
needed. The entry is run through `cloneEntry` before it is returned, so the caller
gets its own copy of `Schema`/`Rows` rather than the store's backing slices.

### Names

```go
func (s *MemoryStore) Names(project string) ([]Entry, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	var out []Entry
	for _, entry := range s.projects[project] {
		out = append(out, cloneEntry(entry))
	}
	return out, nil
}

```

`Names` lists every entry in a project's namespace by ranging over its inner map;
a project with no entries yet (or no map at all) simply produces an empty slice.
This is the read `Manager.List` and `Manager.Evaluate`'s namespace snapshot both
build on. Each entry is cloned on the way out for the same reason as `Name`.

### cloneEntry

```go
// cloneEntry returns a copy of entry whose Schema and Rows do not share
// backing storage with the original, so a caller may freely mutate the
// returned Entry without corrupting the store. Value is immutable and needs
// no copy.
func cloneEntry(entry Entry) Entry {
	entry.Schema = cloneColumns(entry.Schema)
	entry.Rows = cloneRows(entry.Rows)
	return entry
}

```

`cloneEntry` is the read-side counterpart to `SetTable`'s write-side cloning in
`manager.go`: it reuses that same file's `cloneColumns` and `cloneRows` helpers
(in scope as this is the same package) so a table's mutable fields are never
aliased in either direction between the store and its callers. `Value` is left
untouched — `formula.Value` is immutable, so sharing it is safe. `Name` and
`Names` both call this before returning an entry.

### DeleteName

```go
func (s *MemoryStore) DeleteName(project, name string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if _, ok := s.projects[project][name]; !ok {
		return ErrNotFound
	}
	delete(s.projects[project], name)
	return nil
}

```

`DeleteName` removes one entry, first checking it exists so that, unlike a plain
map delete, removing an absent name reports `ErrNotFound` rather than succeeding
silently — the behavior the package's tests rely on to make a second delete of the
same name observably fail.

### UpdateName

```go
// UpdateName runs the read, mutate, and write under a single lock, so
// concurrent callers mutating the same name are serialized and cannot lose an
// update. mutate sees a copy and the stored result is a copy, so neither aliases
// the store's data.
func (s *MemoryStore) UpdateName(project, name string, mutate func(Entry) (Entry, error)) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	entry, ok := s.projects[project][name]
	if !ok {
		return ErrNotFound
	}
	updated, err := mutate(cloneEntry(entry))
	if err != nil {
		return err
	}
	s.projects[project][name] = cloneEntry(updated)
	return nil
}
```

`UpdateName` is `MemoryStore`'s implementation of the atomic read-modify-write
port added to `NameStore` (`names.go`). Because `PutName`, `Name`, and
`DeleteName` all take the same `s.mu` lock, holding it across the read, the
`mutate` call, and the write closes the gap a separate `Name` followed by a
later `PutName` would leave open: no other goroutine can observe or replace the
entry in between. The entry passed to `mutate` is a `cloneEntry` copy (so
`mutate` cannot alias the store's slices), and the result is cloned again before
it is stored (so a caller holding onto the returned `Entry` cannot later mutate
the stored copy through it) — the same non-aliasing discipline as `Name` and
`Names`. A missing name reports `ErrNotFound` without calling `mutate`; an error
from `mutate` is returned unchanged and the store is left untouched, since the
write only happens after `mutate` succeeds.
