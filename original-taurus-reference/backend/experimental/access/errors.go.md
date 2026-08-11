# errors.go

`errors.go` collects the sentinel errors that the stores and the Access service
return. They are the package's typed failure vocabulary: rather than returning ad
hoc error strings, the layer returns these named values so callers can compare
against them with `errors.Is` and react deterministically.

The intended flow is that the application handlers catch these sentinels and map
each one onto an HTTP response. Centralizing them in one file keeps that mapping
in one place and makes the full set of ways an access operation can fail visible
at a glance. One error — `ErrInvalidCredentials` — is shaped by a security
concern rather than a purely technical one.

## Code breakdown

### Package declaration and import

```go
package access

import "errors"
```

The file belongs to the `access` package and imports only the standard `errors`
package, which supplies `errors.New` for constructing the sentinel values below.

### The sentinel errors

```go
// Sentinel errors returned by the stores and the Access service. Callers (the
// application handlers) map these onto HTTP responses.
var (
	// ErrNotFound is returned by stores when a record does not exist.
	ErrNotFound = errors.New("not found")

	// ErrEmailTaken is returned by Register when the email is already registered.
	ErrEmailTaken = errors.New("email already registered")

	// ErrInvalidCredentials is returned by Login when the email or password is
	// wrong. It is deliberately vague so it never reveals whether an email exists.
	ErrInvalidCredentials = errors.New("invalid email or password")

	// ErrForbidden is returned when a user tries to act on a project they are not
	// a member of.
	ErrForbidden = errors.New("forbidden")

	// ErrInvalidEmail and ErrWeakPassword are registration validation failures.
	ErrInvalidEmail = errors.New("email is not valid")
	ErrWeakPassword = errors.New("password must be at least 8 characters")
	ErrInvalidName  = errors.New("project name must not be empty")
)
```

A single `var` block declares the whole failure vocabulary of the layer, grouped
so the complete set is visible together. `ErrNotFound` is the shared contract of
every store — the value they return when a lookup misses. The rest correspond to
service-level outcomes: `ErrEmailTaken` guards registration against duplicate
emails, `ErrForbidden` guards project access against non-members, and
`ErrInvalidEmail`, `ErrWeakPassword`, and `ErrInvalidName` are the input
validation failures for registering a user or naming a project.

`ErrInvalidCredentials` is the one shaped by security intent: it is returned for
both a wrong password and an unknown email, and is deliberately vague so the
response never discloses whether a given email is registered. Keeping the failure
modes as named sentinels lets the application handlers translate each into the
correct HTTP status without inspecting error strings.
