# `tls.go`

Resolving the certificate and key the server listens with, for the mode the
manifest selects.

The core always serves HTTPS — there is no plaintext listener to fall back to,
in either mode. That single rule has two very different consequences depending
on where the process is running, and this file is where the difference lives:

- **Dev** must start on a fresh checkout with no setup. So when the manifest
  names no certificate, dev picks a default pair under `var/` and generates a
  self-signed certificate into it.
- **Prod** must never quietly serve a certificate nobody trusts. So a missing
  `server.tls.cert` / `server.tls.key` is fatal at boot rather than silently
  substituted.

Keeping this out of `Run` matters because it is a *decision*, not a step: it
branches on mode and can terminate the process. `Run` calls it once, near the
top, and thereafter only carries two paths.

## Code breakdown

### `resolveTLS` — the mode switch

Takes the whole `config.Config` (it needs both `Mode` and `Server.TLS`) and
returns the two paths to hand to `StartTLS`. It starts from whatever the
manifest configured and then adjusts per mode:

```go
certPath, keyPath = cfg.Server.TLS.Cert, cfg.Server.TLS.Key
```

**Prod branch.** If either path is empty, `log.Fatalf`. This is deliberately
unrecoverable: a production cell without a real certificate has no correct
behaviour available to it — serving plaintext would silently downgrade every
client, and generating a self-signed pair would make every client either fail or
learn to ignore certificate errors. Refusing to start is the only honest option.

**Dev branch.** Empty paths fall back to `defaultDevCert` / `defaultDevKey`
(declared in `wiring.go` alongside the other boot defaults, under `var/`), and
then `devcert.EnsureSelfSigned` runs *unconditionally* — including when the
manifest did name a pair. That is the subtle part: `EnsureSelfSigned` is
idempotent and only writes when the files are missing or unusable, so a dev
whose `var/` was wiped, or who cloned fresh, gets a working certificate without
noticing there was ever a step. A generation failure is fatal, because dev has
the same "no plaintext fallback" rule as prod.

The dev path logs the certificate it settled on, so the first browser trust
warning is easy to connect to a file on disk.

### Modes other than prod and dev

There is no `default` case. `Run` validates the mode against
`config.ModeProd` / `config.ModeDev` *before* calling `resolveTLS`, so an
unrecognized mode has already killed the process by the time this runs; the
switch does not need to defend against it again.
