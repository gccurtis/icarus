package access

import "errors"

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
