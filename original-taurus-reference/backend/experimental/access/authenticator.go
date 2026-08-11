package access

import "golang.org/x/crypto/bcrypt"

// Credentials is the input a client presents to register or sign in. Different
// authenticators read different fields; the password authenticator uses Email
// and Password, while a future OIDC authenticator would carry a provider token.
type Credentials struct {
	Email    string
	Password string
}

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

// Verify compares the password against the stored bcrypt hash.
func (PasswordAuthenticator) Verify(secret string, creds Credentials) error {
	if err := bcrypt.CompareHashAndPassword([]byte(secret), []byte(creds.Password)); err != nil {
		return ErrInvalidCredentials
	}
	return nil
}
