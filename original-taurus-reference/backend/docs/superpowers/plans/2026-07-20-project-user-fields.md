# Project & User Fields Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add project rename, per-project `icon`, project `createdAt`/`updatedAt` timestamps, and a user display `name` (with a setter) to the Taurus Omega backend, closing the "quick win" backend requests (2, 4, 5, 6) from the Taurus Alpha cockpit.

**Architecture:** Additive fields on the `access` capability. Two new fields on `access.Project` (`Icon`, `UpdatedAt`) and one on `access.User` (`Name`), persisted via idempotent SQLite `ALTER TABLE`s and mirrored in the in-memory test store. One unified, owner-gated `PATCH /projects/:projectID` applies a partial `{name?, icon?}`; `PATCH /auth/me` and an optional `name` on register set the display name. Handlers stay thin; all policy (owner check, validation, `updatedAt` bump) lives in new `access.Access` methods.

**Tech Stack:** Go, Echo v4, pure-Go SQLite (`modernc.org/sqlite`), the neutral `endpoint.Request/Response` contract.

## Global Constraints

- **Companion docs are mandatory and verbatim.** Every non-test `*.go` file changed under `core/` MUST have its sibling `*.go.md` updated in the SAME commit so that concatenating its ` ```go ` blocks reproduces the source exactly (tabs preserved). See [`AGENTS.md`](../../../AGENTS.md).
- **Change record:** add one `docs/records/0014-project-and-user-fields.md` capturing what changed and why.
- **PATCH /projects is owner-only** this round (rename + icon both require `owner`).
- **Icon is an opaque string**, `≤ 64` runes, empty clears it — no server-side enum.
- **Display name** is trimmed, `≤ 80` runes, empty allowed (clears).
- **Timestamps** are stored via the existing `timeLayout` and serialized to JSON as `time.RFC3339` (UTC).
- **Tests are unit-level only** — everything here is deterministic (no model provider), so no live `dev-test` cost is incurred by the assertions; the `dev-test` suites are extended for the manual walkthrough but need no API key.
- **Optional-field binding uses pointers** (`*string`) so an omitted field is distinguishable from an empty one.
- Run the full suite with `go test ./...` from the repo root; it must stay green after every task.

---

### Task 1: Model fields, store interfaces, and both store implementations

**Files:**
- Modify: `core/capability/access/project.go` (add `Icon`, `UpdatedAt` to `Project`; add `UpdateProject` to `ProjectStore`)
- Modify: `core/capability/access/access.go` (add `Name` to `User`; add `UpdateUserName` to `UserStore`; add `ErrInvalidIcon`, `ErrInvalidDisplayName`)
- Modify: `core/capability/access/memory.go` (implement `UpdateProject`, `UpdateUserName`; write/read new fields)
- Modify: `core/platform/storage/sqlite/sqlite.go` (migrations, `CreateUser`/`scanUser`, `CreateProject`/`ProjectByID`/`ProjectsForUser`, new `UpdateProject`/`UpdateUserName`)
- Test: `core/platform/storage/sqlite/sqlite_test.go`
- Companion: update `project.go.md`, `access.go.md`, `memory.go.md`, `sqlite.go.md` verbatim (do this in the same commit as Step 8).

**Interfaces:**
- Produces:
  - `access.Project` now has `Icon string` and `UpdatedAt time.Time`.
  - `access.User` now has `Name string`.
  - `access.ProjectStore` gains `UpdateProject(p Project) error` (returns `ErrNotFound` if the id is absent).
  - `access.UserStore` gains `UpdateUserName(id, name string) error` (returns `ErrNotFound` if the id is absent).
  - Sentinels `access.ErrInvalidIcon`, `access.ErrInvalidDisplayName`.
- Consumes: nothing from later tasks.

- [ ] **Step 1: Add the model fields and interface methods**

In `core/capability/access/project.go`, extend `Project`:

```go
// Project is a workspace users are members of. Everything the user does beyond
// sign-in and project management happens within a selected project.
type Project struct {
	ID        string
	Name      string
	Icon      string
	CreatedAt time.Time
	UpdatedAt time.Time
}
```

In the same file, add to the `ProjectStore` interface (after `ProjectsForUser`):

```go
	// UpdateProject persists a project's mutable fields (name, icon, updated_at).
	// It returns ErrNotFound if the project does not exist.
	UpdateProject(p Project) error
```

In `core/capability/access/access.go`, extend `User`:

```go
// User is one account, identified by a single email. PasswordHash is empty for
// an account that has only ever used OIDC. Name is an optional display name.
type User struct {
	ID           string
	Email        string
	Name         string
	PasswordHash string
	CreatedAt    time.Time
}
```

Add to the `UserStore` interface (after `UserByEmail`):

```go
	// UpdateUserName sets a user's display name. Returns ErrNotFound if absent.
	UpdateUserName(id, name string) error
```

Add two sentinels to the `var ( ... )` error block in `access.go`:

```go
	ErrInvalidIcon        = errors.New("project icon must be at most 64 characters")
	ErrInvalidDisplayName = errors.New("display name must be at most 80 characters")
```

- [ ] **Step 2: Implement the new methods in the in-memory store**

In `core/capability/access/memory.go`, add to the `--- UserStore ---` section:

```go
func (s *MemoryStore) UpdateUserName(id, name string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	u, ok := s.users[id]
	if !ok {
		return ErrNotFound
	}
	u.Name = name
	s.users[id] = u
	return nil
}
```

Add to the `--- ProjectStore ---` section:

```go
func (s *MemoryStore) UpdateProject(p Project) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if _, ok := s.projects[p.ID]; !ok {
		return ErrNotFound
	}
	s.projects[p.ID] = p
	return nil
}
```

(The map already stores the whole `Project`/`User` value, so the existing `CreateUser`/`CreateProject`/`ProjectByID`/`ProjectsForUser` methods carry the new fields with no change.)

- [ ] **Step 3: Add the SQLite migrations**

In `core/platform/storage/sqlite/sqlite.go`, inside `migrate()`, add three entries to the `ALTER TABLE` slice (the loop already ignores "duplicate column name"):

```go
		`ALTER TABLE users ADD COLUMN name TEXT NOT NULL DEFAULT ''`,
		`ALTER TABLE projects ADD COLUMN icon TEXT NOT NULL DEFAULT ''`,
		`ALTER TABLE projects ADD COLUMN updated_at TEXT NOT NULL DEFAULT ''`,
```

Then, immediately after the alter loop (before `return nil`), backfill `updated_at` for rows that predate the column:

```go
	// Backfill updated_at for projects created before the column existed.
	if _, err := s.db.Exec(
		`UPDATE projects SET updated_at = created_at WHERE updated_at = ''`,
	); err != nil {
		return err
	}
```

- [ ] **Step 4: Wire the new columns through the user and project reads/writes**

In `core/platform/storage/sqlite/sqlite.go`, update `CreateUser` and `scanUser`:

```go
func (s *Store) CreateUser(u access.User) error {
	_, err := s.db.Exec(
		`INSERT INTO users(id, email, name, password_hash, created_at) VALUES(?, ?, ?, ?, ?)`,
		u.ID, u.Email, u.Name, u.PasswordHash, u.CreatedAt.Format(timeLayout),
	)
	return err
}

func (s *Store) UserByID(id string) (access.User, error) {
	return scanUser(s.db.QueryRow(
		`SELECT id, email, name, password_hash, created_at FROM users WHERE id = ?`, id))
}

func (s *Store) UserByEmail(email string) (access.User, error) {
	return scanUser(s.db.QueryRow(
		`SELECT id, email, name, password_hash, created_at FROM users WHERE email = ?`, email))
}

func scanUser(row *sql.Row) (access.User, error) {
	var u access.User
	var created string
	switch err := row.Scan(&u.ID, &u.Email, &u.Name, &u.PasswordHash, &created); {
	case errors.Is(err, sql.ErrNoRows):
		return access.User{}, access.ErrNotFound
	case err != nil:
		return access.User{}, err
	}
	u.CreatedAt, _ = time.Parse(timeLayout, created)
	return u, nil
}
```

Update `CreateProject`, `ProjectByID`, and `ProjectsForUser`:

```go
func (s *Store) CreateProject(p access.Project) error {
	_, err := s.db.Exec(
		`INSERT INTO projects(id, name, icon, created_at, updated_at) VALUES(?, ?, ?, ?, ?)`,
		p.ID, p.Name, p.Icon, p.CreatedAt.Format(timeLayout), p.UpdatedAt.Format(timeLayout),
	)
	return err
}

func (s *Store) ProjectByID(id string) (access.Project, error) {
	var p access.Project
	var created, updated string
	err := s.db.QueryRow(
		`SELECT id, name, icon, created_at, updated_at FROM projects WHERE id = ?`, id,
	).Scan(&p.ID, &p.Name, &p.Icon, &created, &updated)
	switch {
	case errors.Is(err, sql.ErrNoRows):
		return access.Project{}, access.ErrNotFound
	case err != nil:
		return access.Project{}, err
	}
	p.CreatedAt, _ = time.Parse(timeLayout, created)
	p.UpdatedAt, _ = time.Parse(timeLayout, updated)
	return p, nil
}

func (s *Store) ProjectsForUser(userID string) ([]access.ProjectMembership, error) {
	rows, err := s.db.Query(`
		SELECT p.id, p.name, p.icon, p.created_at, p.updated_at, m.role
		FROM projects p
		JOIN memberships m ON m.project_id = p.id
		WHERE m.user_id = ?
		ORDER BY p.created_at`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []access.ProjectMembership
	for rows.Next() {
		var p access.Project
		var created, updated, role string
		if err := rows.Scan(&p.ID, &p.Name, &p.Icon, &created, &updated, &role); err != nil {
			return nil, err
		}
		p.CreatedAt, _ = time.Parse(timeLayout, created)
		p.UpdatedAt, _ = time.Parse(timeLayout, updated)
		out = append(out, access.ProjectMembership{Project: p, Role: access.Role(role)})
	}
	return out, rows.Err()
}
```

Add the two update methods (place `UpdateProject` in the `--- ProjectStore ---` section and `UpdateUserName` in the `--- UserStore ---` section):

```go
func (s *Store) UpdateProject(p access.Project) error {
	res, err := s.db.Exec(
		`UPDATE projects SET name = ?, icon = ?, updated_at = ? WHERE id = ?`,
		p.Name, p.Icon, p.UpdatedAt.Format(timeLayout), p.ID,
	)
	if err != nil {
		return err
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return access.ErrNotFound
	}
	return nil
}
```

```go
func (s *Store) UpdateUserName(id, name string) error {
	res, err := s.db.Exec(`UPDATE users SET name = ? WHERE id = ?`, name, id)
	if err != nil {
		return err
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return access.ErrNotFound
	}
	return nil
}
```

- [ ] **Step 5: Write the failing store test**

Add to `core/platform/storage/sqlite/sqlite_test.go` (follow the existing helper that opens a temp store — reuse whatever `newTestStore(t)`/`openTemp(t)` helper the file already defines):

```go
func TestProjectAndUserFieldsRoundTrip(t *testing.T) {
	s := newTestStore(t) // reuse the file's existing temp-store helper

	now := time.Now().UTC().Truncate(time.Second)
	u := access.User{ID: "u1", Email: "a@b.com", Name: "Ada", PasswordHash: "x", CreatedAt: now}
	if err := s.CreateUser(u); err != nil {
		t.Fatalf("CreateUser: %v", err)
	}
	got, err := s.UserByID("u1")
	if err != nil || got.Name != "Ada" {
		t.Fatalf("UserByID name = %q, err %v; want \"Ada\"", got.Name, err)
	}
	if err := s.UpdateUserName("u1", "Ada L."); err != nil {
		t.Fatalf("UpdateUserName: %v", err)
	}
	if got, _ = s.UserByID("u1"); got.Name != "Ada L." {
		t.Fatalf("after UpdateUserName name = %q; want \"Ada L.\"", got.Name)
	}

	p := access.Project{ID: "p1", Name: "Cockpit", Icon: "action", CreatedAt: now, UpdatedAt: now}
	if err := s.CreateProject(p); err != nil {
		t.Fatalf("CreateProject: %v", err)
	}
	if err := s.AddMembership(access.Membership{UserID: "u1", ProjectID: "p1", Role: access.RoleOwner}); err != nil {
		t.Fatalf("AddMembership: %v", err)
	}
	pms, err := s.ProjectsForUser("u1")
	if err != nil || len(pms) != 1 || pms[0].Project.Icon != "action" {
		t.Fatalf("ProjectsForUser = %+v, err %v; want icon \"action\"", pms, err)
	}

	later := now.Add(time.Hour)
	p.Name, p.Icon, p.UpdatedAt = "Renamed", "intel", later
	if err := s.UpdateProject(p); err != nil {
		t.Fatalf("UpdateProject: %v", err)
	}
	got2, err := s.ProjectByID("p1")
	if err != nil || got2.Name != "Renamed" || got2.Icon != "intel" || !got2.UpdatedAt.Equal(later) {
		t.Fatalf("ProjectByID = %+v, err %v; want name Renamed icon intel updated %v", got2, err, later)
	}

	if err := s.UpdateProject(access.Project{ID: "missing"}); err != access.ErrNotFound {
		t.Fatalf("UpdateProject(missing) err = %v; want ErrNotFound", err)
	}
	if err := s.UpdateUserName("missing", "x"); err != access.ErrNotFound {
		t.Fatalf("UpdateUserName(missing) err = %v; want ErrNotFound", err)
	}
}
```

If the file has no reusable temp-store helper, mirror the setup of the nearest existing `Test...` function in that file instead of inventing a new pattern.

- [ ] **Step 6: Run the test to verify it fails to compile / fails**

Run: `go test ./core/platform/storage/sqlite/ -run TestProjectAndUserFieldsRoundTrip -v`
Expected: FAIL (before Steps 1–4 are in place, a compile error about missing fields/methods; if written after, it passes).

- [ ] **Step 7: Run all tests to verify green**

Run: `go test ./...`
Expected: PASS (existing `access` and `sqlite` tests still pass because the new fields default to zero values / `''`).

- [ ] **Step 8: Update companion docs and commit**

Update `core/capability/access/project.go.md`, `access.go.md`, `memory.go.md`, and `core/platform/storage/sqlite/sqlite.go.md` so each reproduces its source verbatim (tabs preserved), with prose for the new blocks.

```bash
git add core/capability/access core/platform/storage/sqlite
git commit -m "feat(access): persist project icon/updated_at and user name"
```

---

### Task 2: Access service methods (UpdateProject, SetUserName, Register name)

**Files:**
- Modify: `core/capability/access/project.go` (`ProjectChanges` type, `UpdateProject` method; set `UpdatedAt` in `CreateProject`)
- Modify: `core/capability/access/access.go` (`SetUserName`; `Register` gains a `name` param)
- Modify: `core/handlers/auth/auth.go` (update the single `Register` call site to pass `""` — real name threaded in Task 4)
- Test: `core/capability/access/project_test.go`, `core/capability/access/access_test.go`
- Companion: update `project.go.md`, `access.go.md`, `core/handlers/auth/auth.go.md` verbatim.

**Interfaces:**
- Consumes: `ProjectStore.UpdateProject`, `UserStore.UpdateUserName`, `ErrInvalidIcon`, `ErrInvalidDisplayName` (Task 1).
- Produces:
  - `access.ProjectChanges{ Name *string; Icon *string }`.
  - `(*Access) UpdateProject(userID, projectID string, ch ProjectChanges) (Project, error)` — owner-gated; non-member/non-owner → `ErrForbidden`; empty name → `ErrInvalidName`; icon > 64 runes → `ErrInvalidIcon`; unknown project → `ErrNotFound`.
  - `(*Access) SetUserName(userID, name string) (User, error)` — trims; name > 80 runes → `ErrInvalidDisplayName`; unknown user → `ErrNotFound`.
  - `(*Access) Register(email, password, name string) (User, error)` — signature change; stores the trimmed name.

- [ ] **Step 1: Change `Register` to accept and store a name**

In `core/capability/access/access.go`, update `Register`:

```go
// Register creates a password account for email — the "sign up" path. name is an
// optional display name (trimmed; may be empty).
func (a *Access) Register(email, password, name string) (User, error) {
	email = normalizeEmail(email)
	if !validEmail(email) {
		return User{}, ErrInvalidEmail
	}
	if len(password) < 8 {
		return User{}, ErrWeakPassword
	}
	name = strings.TrimSpace(name)
	if utf8.RuneCountInString(name) > 80 {
		return User{}, ErrInvalidDisplayName
	}

	if _, err := a.stores.Users.UserByEmail(email); err == nil {
		return User{}, ErrEmailTaken
	} else if !errors.Is(err, ErrNotFound) {
		return User{}, err
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return User{}, err
	}
	u := User{ID: newID(), Email: email, Name: name, PasswordHash: string(hash), CreatedAt: a.now().UTC()}
	if err := a.stores.Users.CreateUser(u); err != nil {
		return User{}, err
	}
	return u, nil
}
```

Add `"unicode/utf8"` to the imports in `access.go`. Then add `SetUserName` near the bottom of `access.go` (before the helpers):

```go
// SetUserName sets the caller's display name (trimmed; may be empty to clear).
// A name longer than 80 runes is rejected; an unknown user yields ErrNotFound.
func (a *Access) SetUserName(userID, name string) (User, error) {
	name = strings.TrimSpace(name)
	if utf8.RuneCountInString(name) > 80 {
		return User{}, ErrInvalidDisplayName
	}
	if err := a.stores.Users.UpdateUserName(userID, name); err != nil {
		return User{}, err
	}
	return a.stores.Users.UserByID(userID)
}
```

In `core/handlers/auth/auth.go`, update the one call site so the package still compiles (real name arrives in Task 4):

```go
	u, err := h.access.Register(in.Email, in.Password, "")
```

- [ ] **Step 2: Set `UpdatedAt` on create and add `UpdateProject`**

In `core/capability/access/project.go`, update `CreateProject` so a new project's `UpdatedAt` equals its `CreatedAt`:

```go
	now := a.now().UTC()
	p := Project{ID: newID(), Name: name, CreatedAt: now, UpdatedAt: now}
```

Add `"unicode/utf8"` to the imports in `project.go`, then add the changes type and method (after `CreateProject`):

```go
// ProjectChanges is a partial update to a project. A nil field is left
// unchanged; a non-nil field is applied (an empty Icon clears it).
type ProjectChanges struct {
	Name *string
	Icon *string
}

// UpdateProject applies a partial update to a project. Only an owner may do this;
// a non-member or non-owner member gets ErrForbidden. An empty name yields
// ErrInvalidName; an icon longer than 64 runes yields ErrInvalidIcon. On success
// the project's UpdatedAt is bumped and the updated Project is returned.
func (a *Access) UpdateProject(userID, projectID string, ch ProjectChanges) (Project, error) {
	m, err := a.stores.Memberships.Membership(userID, projectID)
	if errors.Is(err, ErrNotFound) {
		return Project{}, ErrForbidden
	} else if err != nil {
		return Project{}, err
	}
	if m.Role != RoleOwner {
		return Project{}, ErrForbidden
	}

	p, err := a.stores.Projects.ProjectByID(projectID)
	if err != nil {
		return Project{}, err
	}
	if ch.Name != nil {
		name := strings.TrimSpace(*ch.Name)
		if name == "" {
			return Project{}, ErrInvalidName
		}
		p.Name = name
	}
	if ch.Icon != nil {
		icon := strings.TrimSpace(*ch.Icon)
		if utf8.RuneCountInString(icon) > 64 {
			return Project{}, ErrInvalidIcon
		}
		p.Icon = icon
	}
	p.UpdatedAt = a.now().UTC()
	if err := a.stores.Projects.UpdateProject(p); err != nil {
		return Project{}, err
	}
	return p, nil
}
```

- [ ] **Step 3: Write the failing access tests**

Add to `core/capability/access/project_test.go` (reuse the file's existing setup helper that builds an `*Access` over a `MemoryStore`; the tests below assume a helper like `newTestAccess(t)` returning `(*Access, *MemoryStore)` — mirror whatever the file already uses):

```go
func TestUpdateProject(t *testing.T) {
	a, _ := newTestAccess(t) // mirror the file's existing helper
	owner, _ := a.Register("owner@x.com", "password1", "Owner")
	p, _ := a.CreateProject(owner.ID, "Cockpit")

	name := "Renamed"
	icon := "intel"
	got, err := a.UpdateProject(owner.ID, p.ID, ProjectChanges{Name: &name, Icon: &icon})
	if err != nil {
		t.Fatalf("UpdateProject: %v", err)
	}
	if got.Name != "Renamed" || got.Icon != "intel" {
		t.Fatalf("got %+v; want name Renamed icon intel", got)
	}
	if !got.UpdatedAt.After(p.UpdatedAt) && !got.UpdatedAt.Equal(p.UpdatedAt) {
		t.Fatalf("updatedAt not set: %v", got.UpdatedAt)
	}

	empty := "  "
	if _, err := a.UpdateProject(owner.ID, p.ID, ProjectChanges{Name: &empty}); err != ErrInvalidName {
		t.Fatalf("empty name err = %v; want ErrInvalidName", err)
	}
	long := strings.Repeat("x", 65)
	if _, err := a.UpdateProject(owner.ID, p.ID, ProjectChanges{Icon: &long}); err != ErrInvalidIcon {
		t.Fatalf("long icon err = %v; want ErrInvalidIcon", err)
	}

	stranger, _ := a.Register("nope@x.com", "password1", "")
	if _, err := a.UpdateProject(stranger.ID, p.ID, ProjectChanges{Name: &name}); err != ErrForbidden {
		t.Fatalf("non-member err = %v; want ErrForbidden", err)
	}
}
```

Add to `core/capability/access/access_test.go`:

```go
func TestSetUserName(t *testing.T) {
	a, _ := newTestAccess(t) // mirror the file's existing helper
	u, _ := a.Register("a@b.com", "password1", "Ada")
	if u.Name != "Ada" {
		t.Fatalf("register name = %q; want Ada", u.Name)
	}
	got, err := a.SetUserName(u.ID, "  Ada L.  ")
	if err != nil || got.Name != "Ada L." {
		t.Fatalf("SetUserName = %q, err %v; want \"Ada L.\"", got.Name, err)
	}
	long := strings.Repeat("x", 81)
	if _, err := a.SetUserName(u.ID, long); err != ErrInvalidDisplayName {
		t.Fatalf("long name err = %v; want ErrInvalidDisplayName", err)
	}
}
```

If either file lacks a `newTestAccess` helper, follow the construction the existing tests use (`New(Stores{...over a MemoryStore...}, Options{})`) and adjust the calls; every existing call to `a.Register(email, password)` in these test files MUST gain a third `""` argument to compile.

- [ ] **Step 4: Run the tests to verify they fail, then pass**

Run: `go test ./core/capability/access/ -run 'TestUpdateProject|TestSetUserName' -v`
Expected: PASS once Steps 1–2 are in. Then fix any existing `access`-package tests that call `Register` with two args.

- [ ] **Step 5: Run all tests**

Run: `go test ./...`
Expected: PASS. (The `auth` handler compiles because its `Register` call now passes `""`.)

- [ ] **Step 6: Update companion docs and commit**

Update `project.go.md`, `access.go.md`, and `auth.go.md` verbatim.

```bash
git add core/capability/access core/handlers/auth
git commit -m "feat(access): UpdateProject + SetUserName + register name"
```

---

### Task 3: `PATCH /projects/:projectID` endpoint

**Files:**
- Modify: `core/handlers/project/project.go` (add `Icon`/`CreatedAt`/`UpdatedAt` to `projectJSON` + `view`; add `Update` handler)
- Modify: `core/transport/transport.go` (register the route)
- Test: `core/transport/transport_test.go`
- Companion: update `project.go.md` (handler) and `transport.go.md` verbatim.

**Interfaces:**
- Consumes: `access.ProjectChanges`, `(*Access).UpdateProject` (Task 2).
- Produces: `PATCH /projects/:projectID` (gated tier) → `200 {id,name,role,icon,createdAt,updatedAt}`; `400` empty name / long icon; `403` non-owner; `404` unknown project.

- [ ] **Step 1: Extend the project view and add the `Update` handler**

In `core/handlers/project/project.go`, add `"time"` to the imports, then extend `projectJSON` and `view`:

```go
type projectJSON struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	Role      string `json:"role"`
	Icon      string `json:"icon"`
	CreatedAt string `json:"createdAt"`
	UpdatedAt string `json:"updatedAt"`
}

func view(p access.Project, role access.Role) projectJSON {
	return projectJSON{
		ID:        p.ID,
		Name:      p.Name,
		Role:      string(role),
		Icon:      p.Icon,
		CreatedAt: p.CreatedAt.UTC().Format(time.RFC3339),
		UpdatedAt: p.UpdatedAt.UTC().Format(time.RFC3339),
	}
}
```

Add the `Update` handler (after `Create`):

```go
// Update applies a partial change to a project (rename and/or icon). Owner only.
func (h Handlers) Update(ctx access.Context, req endpoint.Request) endpoint.Response {
	var in struct {
		Name *string `json:"name"`
		Icon *string `json:"icon"`
	}
	if err := req.Bind(&in); err != nil {
		return errResp(http.StatusBadRequest, "invalid JSON body")
	}

	p, err := h.access.UpdateProject(ctx.User.ID, req.Param("projectID"),
		access.ProjectChanges{Name: in.Name, Icon: in.Icon})
	switch {
	case errors.Is(err, access.ErrForbidden):
		return errResp(http.StatusForbidden, "only an owner can update this project")
	case errors.Is(err, access.ErrInvalidName):
		return errResp(http.StatusBadRequest, "project name must not be empty")
	case errors.Is(err, access.ErrInvalidIcon):
		return errResp(http.StatusBadRequest, "project icon is too long")
	case errors.Is(err, access.ErrNotFound):
		return errResp(http.StatusNotFound, "project not found")
	case err != nil:
		return errResp(http.StatusInternalServerError, "could not update project")
	}
	// The caller is the owner (UpdateProject enforced it), so the returned role is owner.
	return endpoint.Response{Status: http.StatusOK, Body: view(p, access.RoleOwner)}
}
```

- [ ] **Step 2: Register the route**

In `core/transport/transport.go`, in the "Project management and selection" block, add after the `DELETE /projects/:projectID` line:

```go
	gated.PATCH("/projects/:projectID", s.adaptScoped(projects.Update))
```

- [ ] **Step 3: Write the failing transport test**

Add to `core/transport/transport_test.go`, following the existing helper that boots the Echo server with a signed-in session (reuse the file's login/session helper — e.g. `login(t, e)` returning a cookie). The test creates a project, PATCHes it, and asserts the echoed fields and the owner gate:

```go
func TestPatchProject(t *testing.T) {
	e, cookie := newAuthedServer(t) // mirror the file's existing auth helper

	// Create a project.
	rec := doJSON(t, e, http.MethodPost, "/projects", cookie, `{"name":"Cockpit"}`)
	if rec.Code != http.StatusCreated {
		t.Fatalf("create status = %d", rec.Code)
	}
	var created struct{ ID string `json:"id"` }
	json.Unmarshal(rec.Body.Bytes(), &created)

	// Rename + set icon.
	rec = doJSON(t, e, http.MethodPatch, "/projects/"+created.ID, cookie,
		`{"name":"Renamed","icon":"intel"}`)
	if rec.Code != http.StatusOK {
		t.Fatalf("patch status = %d, body %s", rec.Code, rec.Body.String())
	}
	var got struct {
		Name, Icon, CreatedAt, UpdatedAt string
	}
	json.Unmarshal(rec.Body.Bytes(), &got)
	if got.Name != "Renamed" || got.Icon != "intel" || got.CreatedAt == "" || got.UpdatedAt == "" {
		t.Fatalf("patched view = %+v", got)
	}

	// Empty name is rejected.
	rec = doJSON(t, e, http.MethodPatch, "/projects/"+created.ID, cookie, `{"name":"  "}`)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("empty-name status = %d; want 400", rec.Code)
	}
}
```

Use the exact request/JSON helpers already present in `transport_test.go` (`doJSON`, `newAuthedServer`, etc. are illustrative names — match the file's real helpers, including how it constructs `httptest` requests and carries the `to_session` cookie). Add `"encoding/json"` / `"net/http"` imports only if the file doesn't already have them.

- [ ] **Step 4: Run the test**

Run: `go test ./core/transport/ -run TestPatchProject -v`
Expected: PASS.

- [ ] **Step 5: Run all tests**

Run: `go test ./...`
Expected: PASS.

- [ ] **Step 6: Update companion docs and commit**

Update `core/handlers/project/project.go.md` and `core/transport/transport.go.md` verbatim.

```bash
git add core/handlers/project core/transport
git commit -m "feat(project): PATCH /projects/:id for rename + icon; surface timestamps"
```

---

### Task 4: User display name over HTTP (`/auth/me`, register)

**Files:**
- Modify: `core/handlers/auth/auth.go` (`Name` in `userJSON`/`userView`; `Name` in `credentials` + pass to `Register`; add `UpdateName` handler)
- Modify: `core/transport/transport.go` (register `PATCH /auth/me`)
- Test: `core/transport/transport_test.go`
- Companion: update `auth.go.md` and `transport.go.md` verbatim.

**Interfaces:**
- Consumes: `(*Access).SetUserName`, `(*Access).Register(email,password,name)`, `access.ErrInvalidDisplayName` (Task 2).
- Produces: `GET /auth/me` → `{id,email,name}`; `PATCH /auth/me {name}` → `200 {id,email,name}` / `400` too long; `POST /auth/register` accepts optional `name`.

- [ ] **Step 1: Add `name` to the user view and register body**

In `core/handlers/auth/auth.go`, extend `credentials`, `userJSON`, and `userView`:

```go
type credentials struct {
	Email    string `json:"email"`
	Password string `json:"password"`
	Name     string `json:"name"`
}
```

```go
type userJSON struct {
	ID    string `json:"id"`
	Email string `json:"email"`
	Name  string `json:"name"`
}

func userView(u access.User) userJSON { return userJSON{ID: u.ID, Email: u.Email, Name: u.Name} }
```

Update the `Register` call site to thread the real name:

```go
	u, err := h.access.Register(in.Email, in.Password, in.Name)
```

- [ ] **Step 2: Add the `UpdateName` handler**

Add to `core/handlers/auth/auth.go` (after `Me`):

```go
// UpdateName sets the current user's display name. Requires a session.
func (h Handlers) UpdateName(ctx access.Context, req endpoint.Request) endpoint.Response {
	var in struct {
		Name string `json:"name"`
	}
	if err := req.Bind(&in); err != nil {
		return errResp(http.StatusBadRequest, "invalid JSON body")
	}
	u, err := h.access.SetUserName(ctx.User.ID, in.Name)
	switch {
	case errors.Is(err, access.ErrInvalidDisplayName):
		return errResp(http.StatusBadRequest, err.Error())
	case err != nil:
		return errResp(http.StatusInternalServerError, "could not update name")
	}
	return endpoint.Response{Status: http.StatusOK, Body: userView(u)}
}
```

- [ ] **Step 3: Register the route**

In `core/transport/transport.go`, in the gated block near `/auth/me`, add:

```go
	gated.PATCH("/auth/me", s.adaptScoped(auth.UpdateName))
```

- [ ] **Step 4: Write the failing transport test**

Add to `core/transport/transport_test.go`:

```go
func TestAuthDisplayName(t *testing.T) {
	e := newServer(t) // mirror the file's server constructor

	// Register with a name, then log in.
	rec := doJSON(t, e, http.MethodPost, "/auth/register", "",
		`{"email":"ada@x.com","password":"password1","name":"Ada"}`)
	if rec.Code != http.StatusCreated {
		t.Fatalf("register status = %d", rec.Code)
	}
	cookie := loginAs(t, e, "ada@x.com", "password1") // mirror the file's login helper

	// /auth/me reflects the name.
	rec = doJSON(t, e, http.MethodGet, "/auth/me", cookie, "")
	var me struct{ Name string }
	json.Unmarshal(rec.Body.Bytes(), &me)
	if me.Name != "Ada" {
		t.Fatalf("me.name = %q; want Ada", me.Name)
	}

	// PATCH updates it.
	rec = doJSON(t, e, http.MethodPatch, "/auth/me", cookie, `{"name":"Ada L."}`)
	if rec.Code != http.StatusOK {
		t.Fatalf("patch status = %d", rec.Code)
	}
	json.Unmarshal(rec.Body.Bytes(), &me)
	if me.Name != "Ada L." {
		t.Fatalf("patched name = %q; want \"Ada L.\"", me.Name)
	}
}
```

Match the file's actual server/login/request helpers (names above are illustrative).

- [ ] **Step 5: Run the test, then all tests**

Run: `go test ./core/transport/ -run TestAuthDisplayName -v` → PASS
Run: `go test ./...` → PASS

- [ ] **Step 6: Update companion docs and commit**

Update `core/handlers/auth/auth.go.md` and `core/transport/transport.go.md` verbatim.

```bash
git add core/handlers/auth core/transport
git commit -m "feat(auth): display name on /auth/me, PATCH /auth/me, register name"
```

---

### Task 5: Documentation, change record, and dev-test walkthroughs

**Files:**
- Create: `docs/records/0014-project-and-user-fields.md`
- Modify: `docs/backend-guide.md` (endpoint reference + auth/projects sections)
- Modify: `docs/architecture/capabilities/access.md` (new fields, endpoints, owner gate)
- Modify: `dev-test/projects/manual.md`, `dev-test/projects/run.sh` (add PATCH walkthrough + assertions)
- Modify: `dev-test/gateway/manual.md`, `dev-test/gateway/run.sh` (register-with-name, PATCH /auth/me)

**Interfaces:** none (documentation + shell walkthroughs).

- [ ] **Step 1: Write the change record**

Create `docs/records/0014-project-and-user-fields.md` following the shape in `docs/records/README.md`: what changed (project `icon`/`updatedAt`, user `name`, `PATCH /projects/:id`, `PATCH /auth/me`, optional register `name`), and why (closing Taurus Alpha backend requests 2/4/5/6). Note the deliberate decisions: owner-only PATCH, opaque icon `≤64`, display name `≤80` with empty allowed, `updatedAt` backfilled from `created_at`. Reference the requests at `taurus-alpha/docs/backend-requests/`.

- [ ] **Step 2: Update the backend guide**

In `docs/backend-guide.md`:
- §5 Session table: add `PATCH /auth/me` (set display name) and note `GET /auth/me` now returns `name`.
- §5 Session table: add `PATCH /projects/:projectID` (owner; rename/icon) and note the projects list now carries `icon`, `createdAt`, `updatedAt`.
- §4 golden path (register): show the optional `"name"` field.

- [ ] **Step 3: Update the access capability doc**

In `docs/architecture/capabilities/access.md`: document the `Icon`/`UpdatedAt` project fields and `Name` user field, the owner-gated `UpdateProject` and `SetUserName` service methods, and the two new routes. Keep it grounded in the code.

- [ ] **Step 4: Extend the dev-test walkthroughs**

- `dev-test/projects/manual.md` + `run.sh`: after creating a project, `PATCH` it with a new name and icon and assert the response carries `name`, `icon`, `createdAt`, `updatedAt`; assert a non-owner (or empty name) is rejected. Follow the existing assertion style in the suite's `lib.sh` helpers.
- `dev-test/gateway/manual.md` + `run.sh`: register with `"name"`, assert `GET /auth/me` returns it, then `PATCH /auth/me` and assert the change.

Example curl for the manuals (`$B` and `-b cookies.txt` as elsewhere):

```bash
curl -k -b cookies.txt -X PATCH $B/projects/<PROJECT_ID> \
  -H 'Content-Type: application/json' -d '{"name":"Renamed","icon":"intel"}'
# 200 {"id":"...","name":"Renamed","role":"owner","icon":"intel","createdAt":"...","updatedAt":"..."}

curl -k -b cookies.txt -X PATCH $B/auth/me \
  -H 'Content-Type: application/json' -d '{"name":"Ada L."}'
# 200 {"id":"...","email":"...","name":"Ada L."}
```

- [ ] **Step 5: Run the suite for a sanity check**

Run: `go test ./...` → PASS
Run (optional, no key needed for these suites): `./dev-test/run.sh` and confirm the projects + gateway suites pass. If the suite requires the server built, follow `dev-test/README.md`.

- [ ] **Step 6: Commit**

```bash
git add docs dev-test
git commit -m "docs: record 0014; document project/user fields in guide, access, dev-test"
```

---

## Self-Review

**Spec coverage:**
- Request 2 (rename) → Task 2 `UpdateProject` + Task 3 `PATCH`. ✔
- Request 4 (timestamps) → Task 1 fields/migration/backfill + Task 3 view. ✔
- Request 5 (icon) → Tasks 1–3. ✔
- Request 6 (display name + setter) → Task 2 `SetUserName`/`Register` + Task 4 routes. ✔
- Owner-only PATCH, opaque icon ≤64, name ≤80, RFC3339, companion docs, record 0014 → covered in Global Constraints + Tasks. ✔

**Type consistency:** `ProjectChanges{Name,Icon *string}`, `UpdateProject(userID, projectID, ProjectChanges) (Project, error)`, `SetUserName(userID, name) (User, error)`, `Register(email,password,name)`, `UpdateProject(p) error`/`UpdateUserName(id,name) error` stores — names identical across Tasks 1–4. `view` gains `Icon/CreatedAt/UpdatedAt`; `userView` gains `Name`. ✔

**Placeholder scan:** Test helper names (`newTestStore`, `newTestAccess`, `doJSON`, `newAuthedServer`, `loginAs`, `newServer`) are explicitly flagged as "mirror the file's existing helper" because the exact helper names in each `_test.go` must be confirmed at implementation time — the surrounding test bodies are complete. No `TBD`/`TODO` in shipping code. ✔

**Note for the implementer:** before writing each test, open the target `_test.go` file and use its real setup/request helpers; the plan's helper names are illustrative stand-ins, but the assertions and expected values are exact.
