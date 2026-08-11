# 0028 Persisted Project purpose

This increment adds Project purpose as ordinary profile data while preserving
the role boundaries of existing owner-only fields.

## `core/capability/access/access.go`

### Add stable Project update errors

Adds errors for overlong purpose and empty partial updates so application
handlers can map validation outcomes without inspecting strings.

## `core/capability/access/project.go`

### Persist bounded purpose with whole-request authorization

Adds `Purpose`, its 1,000-rune bound, and the partial change pointer. Owners may
change every profile field, editors may change purpose only, and mixed
unauthorized changes fail before mutation. Normalized no-ops return the current
Project without advancing profile time. `UpdateProject` also returns the real
caller role so an editor response cannot be mislabeled as owner.

## `core/capability/access/project_test.go`

### Exercise the role matrix and no-op behavior

Tests editor purpose updates, reader denial, atomic mixed denial, Unicode
bounds, clear, empty patches, and timestamp stability.

## `core/platform/storage/sqlite/sqlite.go`

### Migrate and round-trip purpose

Adds an idempotent non-null `projects.purpose` column and threads it through
create, read, list, and update queries.

## `core/platform/storage/sqlite/sqlite_test.go`

### Prove durable profile round trips

Extends Project persistence tests so purpose survives listing and subsequent
updates with every other profile field.

## `core/handlers/project/project.go`

### Expose purpose through the existing Project API

Every Project view now contains `purpose`; PATCH binds it and maps the new
authorization/validation errors. The response carries the caller's actual role.

## `core/transport/transport_test.go`

### Verify HTTP role and validation contracts

Exercises editor success, read denial, mixed denial, empty patch, rune limits,
and the returned purpose/role shape through real routes.

## Documentation and dev tests

### Describe and exercise purpose as current behavior

The access architecture, backend guide, Project manual, and automated Project
suite now document and call the persisted purpose contract.
