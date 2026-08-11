# Dependency and license inventory

The reproducible machine inventory is
[`dependency-license-inventory.tsv`](dependency-license-inventory.tsv). It
contains every non-root module returned by `go list -m all`, including modules
present only in the graph. The acceptance gate compares module/version pairs
exactly and rejects a missing row, an extra row, or a non-classified license.

At this baseline:

- All 40 external Go modules are free/open-source and version-pinned by
  `go.mod`/`go.sum`.
- 19 modules are linked into production packages; the rest are graph-only
  generator, tool, or test dependencies.
- The only reciprocal license is MPL-2.0 on
  `github.com/hashicorp/golang-lru/v2`; it is graph-only and is not linked into
  either shipped binary. Re-evaluate distribution obligations if that changes.
- The repository has no container image or production deployment manifest.
  `core` and `cmd/connector-watcher` are the two current main packages.
- SQLite is embedded through the pure-Go `modernc.org/sqlite` graph; it is not
  an invoked system database.

## External runtimes and tools

| Dependency | Relationship | Purpose / distribution | License or service status | Owner |
|---|---|---|---|---|
| Go 1.26.4 toolchain | invoked for build/test | Build input; not bundled by the repository | BSD-3-Clause toolchain | Backend maintainers |
| POSIX shell / Bash | invoked by repository scripts | Development and acceptance scripts; not bundled | Environment-provided FOSS runtime | Backend maintainers |
| `curl` and `jq` | invoked by `dev-test/` | Local black-box test clients; not production runtime dependencies | Environment-provided FOSS tools | Backend maintainers |
| OpenRouter HTTP API | optional external service | Live intelligence/embedding certification only; no SDK or server binary distributed | Costed service, not a software distribution dependency | Operator supplies credentials and reviews model/cost |
| Connector source endpoints | optional external data sources | Runtime HTTP/filesystem connector inputs | User/operator-configured endpoints, not bundled software | Connector owner; admission hardening is Ω-007 |

No dependency was added by Ω-001. Future dependency changes must update the TSV
and pass the FOSS classification gate.
