// TLS certificate resolution for the selected mode.
//
// The core always serves HTTPS. Dev generates a self-signed pair on demand so a
// fresh checkout starts without setup; prod insists on a real certificate.
package wiring

import (
	"log"

	"github.com/gccurtis/taurus-omega/core/platform/config"
	"github.com/gccurtis/taurus-omega/core/platform/devcert"
)

// resolveTLS returns the certificate and key paths to serve with. In dev, a
// self-signed pair is generated when none is configured (or the configured files
// are missing); in prod, a certificate must be supplied.
func resolveTLS(cfg config.Config) (certPath, keyPath string) {
	certPath, keyPath = cfg.Server.TLS.Cert, cfg.Server.TLS.Key

	switch cfg.Mode {
	case config.ModeProd:
		if certPath == "" || keyPath == "" {
			log.Fatalf("config: prod mode requires server.tls.cert and server.tls.key")
		}
	case config.ModeDev:
		if certPath == "" || keyPath == "" {
			certPath, keyPath = defaultDevCert, defaultDevKey
		}
		if err := devcert.EnsureSelfSigned(certPath, keyPath); err != nil {
			log.Fatalf("tls: generate dev certificate: %v", err)
		}
		log.Printf("tls: using self-signed dev certificate at %s", certPath)
	}
	return certPath, keyPath
}
