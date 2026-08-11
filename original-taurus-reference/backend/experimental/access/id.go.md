# id.go

`id.go` is the small utility that mints the random identifiers the access layer
hands out: the IDs on entities like users and projects, and the opaque tokens that
serve as session IDs. It exists so identifier generation is defined once, using a
cryptographically secure source, rather than being reinvented at each call site.

The file draws a deliberate distinction between an *identifier* and a *credential*.
Entity IDs are 128 bits; session tokens are 256 bits, because a session ID is a
bearer credential — whoever holds it is treated as the signed-in user — so it is
given extra length to resist guessing. All three helpers are unexported, keeping
identifier policy internal to the package.

## Code breakdown

### Package declaration and imports

```go
package access

import (
	"crypto/rand"
	"encoding/hex"
)
```

The file imports `crypto/rand` for a cryptographically secure random source — the
right choice for values that must be unguessable — and `encoding/hex` to render
the raw bytes as a hex string. Using `crypto/rand` rather than `math/rand` is the
central decision here: these values gate access, so they must not be predictable.

### Entity ID and session token generators

```go
// newID returns a random 128-bit identifier as hex, used for entity IDs.
func newID() string {
	return randomHex(16)
}

// newToken returns a random 256-bit token as hex, used for opaque session IDs.
// The extra length reflects that a session ID is a bearer credential.
func newToken() string {
	return randomHex(32)
}
```

`newID` and `newToken` are the two public-facing (within the package) minting
functions, and their difference in size encodes the identifier-versus-credential
distinction. `newID` produces 16 bytes (128 bits) for entity IDs, which only need
to be unique. `newToken` produces 32 bytes (256 bits) for session IDs, whose extra
length reflects that they are bearer credentials and must withstand guessing
attacks. Both delegate to the shared helper, differing only in length.

### The shared hex generator

```go
func randomHex(n int) string {
	b := make([]byte, n)
	// crypto/rand.Read never returns an error on the platforms we target; a
	// failure here would mean the OS entropy source is unavailable.
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}
```

`randomHex` is the common implementation: allocate `n` random bytes and hex-encode
them, yielding a `2n`-character string. The error from `rand.Read` is deliberately
ignored, and the comment explains why — on the targeted platforms it does not
fail, and a failure would mean the OS entropy source itself is unavailable, a
condition the program could not meaningfully recover from anyway.
