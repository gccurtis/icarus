package access

import (
	"crypto/rand"
	"encoding/hex"
)

// newID returns a random 128-bit identifier as hex, used for entity IDs.
func newID() string {
	return randomHex(16)
}

// newToken returns a random 256-bit token as hex, used for opaque session IDs.
// The extra length reflects that a session ID is a bearer credential.
func newToken() string {
	return randomHex(32)
}

func randomHex(n int) string {
	b := make([]byte, n)
	// crypto/rand.Read never returns an error on the platforms we target; a
	// failure here would mean the OS entropy source is unavailable.
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}
