# authenticator.go

`authenticator.go` defines the authentication seam of the access layer: the
`Authenticator` interface that abstracts *how* a user proves who they are, and
`PasswordAuthenticator`, the first concrete implementation, built on bcrypt. The
Access service holds an `Authenticator` rather than any specific mechanism, so a
new scheme can be introduced without the service changing.

The interface reduces authentication to two symmetric jobs: at registration,
`Prepare` turns the credentials a user supplies into the secret to persist on
their `User` record; at sign-in, `Verify` checks presented credentials against
that stored secret. Modeling it this way keeps the sensitive detail — how a
password is hashed and compared — entirely inside the authenticator, out of the
service. The password implementation is deliberately positioned as the first of
several; an OIDC authenticator that reads a provider token instead of a password
is the intended second, and would slot in behind the same interface.

## Code breakdown

### Package declaration and import

```go
package access

import "golang.org/x/crypto/bcrypt"
```

The file imports `golang.org/x/crypto/bcrypt`, the adaptive password-hashing
function used by the concrete authenticator below. That this dependency lives here,
behind the interface, rather than in the service is the point of the seam: the
choice of hashing algorithm is an implementation detail confined to this file.

### The Credentials type

```go
// Credentials is the input a client presents to register or sign in. Different
// authenticators read different fields; the password authenticator uses Email
// and Password, while a future OIDC authenticator would carry a provider token.
type Credentials struct {
	Email    string
	Password string
}
```

`Credentials` is the raw input a client presents at registration or sign-in. It is
a shared carrier across authenticators: each implementation reads only the fields
it cares about. The password authenticator uses `Email` and `Password`; the
comment records that a future OIDC authenticator would instead carry a provider
token, which is why the type is defined once at the seam rather than being specific
to passwords.

### The Authenticator interface

```go
// Authenticator is the pluggable authentication mechanism. It has two jobs:
// prepare the secret stored at registration, and verify a presented secret at
// sign-in. The password implementation below is the first; an OIDC
// implementation can be added as a second without touching the Access service.
type Authenticator interface {
	// Prepare turns registration credentials into the secret to store on the
	// user (for passwords, a bcrypt hash).
	Prepare(creds Credentials) (secret string, err error)
	// Verify checks sign-in credentials against the stored secret, returning
	// ErrInvalidCredentials on mismatch.
	Verify(secret string, creds Credentials) error
}
```

`Authenticator` is the extension point. Its two methods are the mirror image of
each other across the account lifecycle: `Prepare` runs once at registration to
convert credentials into the secret string that gets stored on the `User` (for
passwords, a bcrypt hash), and `Verify` runs at each sign-in to check presented
credentials against that stored secret. `Verify`'s contract names the sentinel it
returns on mismatch — `ErrInvalidCredentials` — tying it back to the error
vocabulary in `errors.go`. Because the service depends only on this interface,
adding an OIDC implementation requires no change to the service.

### PasswordAuthenticator and Prepare

```go
// PasswordAuthenticator authenticates with an email and a bcrypt-hashed
// password.
type PasswordAuthenticator struct{}

// Prepare hashes the password for storage.
func (PasswordAuthenticator) Prepare(creds Credentials) (string, error) {
	hash, err := bcrypt.GenerateFromPassword([]byte(creds.Password), bcrypt.DefaultCost)
	if err != nil {
		return "", err
	}
	return string(hash), nil
}
```

`PasswordAuthenticator` is the first implementation, and it is an empty struct: it
holds no state, its behavior lives entirely in bcrypt, so the methods take a value
receiver. `Prepare` implements the registration half by hashing the supplied
password with `bcrypt.GenerateFromPassword` at the library's default cost and
returning the hash string to be stored on the user. The plaintext password never
leaves this call — only its hash is persisted.

### Verify

```go
// Verify compares the password against the stored bcrypt hash.
func (PasswordAuthenticator) Verify(secret string, creds Credentials) error {
	if err := bcrypt.CompareHashAndPassword([]byte(secret), []byte(creds.Password)); err != nil {
		return ErrInvalidCredentials
	}
	return nil
}
```

`Verify` implements the sign-in half. It hands the stored hash and the presented
password to `bcrypt.CompareHashAndPassword`, which performs the constant-time
comparison bcrypt requires. Crucially, it collapses *any* comparison failure into
the single `ErrInvalidCredentials` sentinel rather than surfacing bcrypt's specific
error — honoring the interface contract and feeding the deliberately vague,
non-disclosing failure the layer presents to unauthenticated callers.
