# Toolchain and software supply chain

## Policy

Omega chooses supported production lines, pins exact patch versions in the
repository when code uses them, and keeps upgrades routine. “Latest” means the
newest supported production/LTS line suitable for the component—not an
unreleased build, short-lived innovation line, or stale inherited pin.

As verified on 2026-07-18 from official release sources:

| Component | Initial line | Reason |
| --- | --- | --- |
| Go | 1.26.5 | Latest patched stable Go 1.26 release; Go supports a major release until two newer majors exist |
| MySQL | 9.7.1 LTS | Current released patch of the MySQL 9.7 LTS line as of 2026-07-18; 9.7.2 is documented but not yet released |
| Node.js | 24 LTS when the web stage begins | Current LTS; Node is not required for the Go-only backend foundation |

Primary references: [Go release history](https://go.dev/doc/devel/release),
[MySQL 9.7 LTS policy](https://dev.mysql.com/doc/refman/9.7/en/mysql-releases.html),
[MySQL 9.7 release notes](https://dev.mysql.com/doc/relnotes/mysql/9.7/en/),
[MySQL 9.7.1 release record](https://dev.mysql.com/doc/relnotes/mysql/9.7/en/news-9-7-1.html),
[MySQL supported LTS platforms](https://www.mysql.com/support/supportedplatforms/database.html),
and [Node.js release schedule](https://nodejs.org/en/about/previous-releases).

Version numbers are a dated baseline, not timeless prose. Before the first code
stage and every scheduled upgrade, re-check official sources and update the
lock plus this page in one reviewed change.

## Pinning

- `go.mod` declares the language/toolchain line; the Nix development shell pins
  the exact Go patch and race-detector toolchain.
- `flake.lock` is local developer-environment reproducibility, not a runtime
  dependency or product-architecture concern.
- Direct and transitive Go modules are checksummed through `go.sum`; production
  dependencies require an explicit owner, purpose, license, update policy, and
  removal path.
- Container images, when introduced, use immutable digests with human-readable
  upstream version annotations.
- Database server and local development images use an exact patch/digest, not
  floating `latest`.
- Frontend package manager and lockfile are selected in the web stage; install
  uses the frozen lock in automated environments.

## Dependency selection

Prefer the standard library when it correctly covers the security and protocol
surface. Use mature official or widely audited libraries for cryptographic
protocols, OIDC/OAuth verification, database drivers, structured editors, and
file formats. Do not implement authentication cryptography or Office formats
from scratch merely to reduce dependency count.

Every dependency review records:

- product need and why the standard library is insufficient;
- exact package and version;
- publisher/maintainer and release activity;
- license and transitive licenses;
- known-vulnerability result and vulnerability-policy exception, if any;
- whether it handles secrets or untrusted input;
- update cadence and compatibility boundary; and
- substitute/removal plan.

## Update model

- Automated tooling may open dependency updates; it never auto-merges them.
- Patch updates run full relevant gates.
- Minor/major updates require release-note review and focused compatibility,
  security, persistence, and performance tests.
- Go and Node unsupported lines are upgraded before end of support.
- MySQL stays on an LTS track; moving to the next LTS is a planned database
  program with backup/restore and rollback evidence.
- Vulnerability exceptions have owner, scope, compensating control, and expiry.

## Required evidence when code exists

- formatting, build, unit tests, race tests, vet/static analysis;
- architecture laws with positive and negative fixtures;
- dependency, license, secret, and vulnerability scans;
- generated-contract and schema-checksum drift checks;
- reproducible local clean build;
- SBOM for release artifacts;
- provenance/signing policy before external release; and
- upgrade/rollback records for stateful dependencies.
