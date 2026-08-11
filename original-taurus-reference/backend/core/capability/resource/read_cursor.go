package resource

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
)

// readCursor is encrypted rather than merely encoded. Besides preventing a
// caller from changing a line number or version, this keeps resource names and
// identifiers out of URLs, logs, and model-visible diagnostics.
type readCursor struct {
	CursorVersion int    `json:"v"`
	ProjectID     string `json:"p"`
	CallerID      string `json:"u"`
	ResourceID    string `json:"r"`
	Kind          Kind   `json:"k"`
	Subpath       string `json:"s,omitempty"`
	Projection    string `json:"q"`
	Version       string `json:"x"`
	NextLine      int    `json:"n"`
	ByteLimit     int    `json:"b"`
	LineLimit     int    `json:"l"`
}

func (r *Resources) encodeReadCursor(scope ProjectScope, locator ResourceLocator, version string, nextLine int, slicer LineSlicer) (string, error) {
	payload, err := json.Marshal(readCursor{
		CursorVersion: 1,
		ProjectID:     scope.ProjectID,
		CallerID:      scope.CallerID,
		ResourceID:    locator.ResourceID,
		Kind:          locator.Kind,
		Subpath:       locator.Subpath,
		Projection:    locator.Projection,
		Version:       version,
		NextLine:      nextLine,
		ByteLimit:     slicer.MaxTotalBytes,
		LineLimit:     slicer.MaxLines,
	})
	if err != nil {
		return "", err
	}
	gcm, err := r.readCursorGCM()
	if err != nil {
		return "", err
	}
	nonce := make([]byte, gcm.NonceSize())
	if _, err := rand.Read(nonce); err != nil {
		return "", err
	}
	sealed := gcm.Seal(nonce, nonce, payload, nil)
	return base64.RawURLEncoding.EncodeToString(sealed), nil
}

func (r *Resources) decodeReadCursor(encoded string, scope ProjectScope, locator ResourceLocator) (readCursor, error) {
	sealed, err := base64.RawURLEncoding.DecodeString(encoded)
	if err != nil {
		return readCursor{}, ErrReadCursorInvalid
	}
	gcm, err := r.readCursorGCM()
	if err != nil || len(sealed) < gcm.NonceSize() {
		return readCursor{}, ErrReadCursorInvalid
	}
	payload, err := gcm.Open(nil, sealed[:gcm.NonceSize()], sealed[gcm.NonceSize():], nil)
	if err != nil {
		return readCursor{}, ErrReadCursorInvalid
	}
	var decoded readCursor
	if err := json.Unmarshal(payload, &decoded); err != nil {
		return readCursor{}, ErrReadCursorInvalid
	}
	if decoded.CursorVersion != 1 || decoded.ProjectID != scope.ProjectID || decoded.CallerID != scope.CallerID ||
		decoded.ResourceID != locator.ResourceID || decoded.Kind != locator.Kind || decoded.Subpath != locator.Subpath ||
		decoded.Projection != locator.Projection || decoded.Version == "" || decoded.NextLine < 1 ||
		decoded.ByteLimit != MaxExactReadBytes || decoded.LineLimit != maxReadLines {
		return readCursor{}, ErrReadCursorInvalid
	}
	return decoded, nil
}

func (r *Resources) readCursorGCM() (cipher.AEAD, error) {
	block, err := aes.NewCipher(r.readCursorKey[:])
	if err != nil {
		return nil, err
	}
	return cipher.NewGCM(block)
}
