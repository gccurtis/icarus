---
title: "Work Packet — Ω-007 — Harden connector source admission, filesystem, and SSRF boundaries"
notion_page_id: "3acb6410e5028134b55bcbcdc6aeefe6"
notion_url: "https://app.notion.com/3acb6410e5028134b55bcbcdc6aeefe6"
project: "Taurus Yesod"
role: "Supporting"
format: "Spec"
created: "2026-07-29 23:54:56Z"
mirrored_at: "2026-07-30"
mirrored_from_notion: true
---

# Work Packet — Ω-007 — Harden connector source admission, filesystem, and SSRF boundaries

> Source mirror. Preserve this page as planning evidence; use the agent-facing execution packet when one exists.

<callout icon="🔒" color="red_bg">
	**Frozen-baseline addendum.** Preserve every exploit-closure test already shipped, pass request/job `context.Context` through provider opens and sync, and move concrete HTTP-watcher/local-filesystem providers out of `core/capability/connector` into outbound integration adapters. The Connector capability owns provider ports and policy only. No raw path/URL behavior may return during migration.
</callout>
## Outcome
Make Connector an intentionally bounded Project capability instead of a
server-side file and network primitive exposed to every Project member. A
read-only member cannot create, reconfigure, or synchronize a source. An
ordinary member cannot name an arbitrary server path. HTTP ingestion cannot
reach the host, private networks, cloud metadata services, or an unbounded
response through a direct URL, redirect, alternate address family, DNS
rebinding, decompression bomb, or slow stream.
The secure result must preserve the useful V1 behavior: an authorized editor
can synchronize an approved local source in a controlled deployment and can
ingest a bounded public HTTP(S) object. All rejection paths are typed,
non-enumerating where appropriate, and observable without recording credentials
or source contents.
## As-built evidence
Connector creation and synchronization are currently admitted after Project
membership, but the handlers do not require `CanWrite`. That lets a selected
Project's read-only member initiate server-side reads and durable mutations.
The local provider accepts a caller-supplied path and traverses it with
`filepath.WalkDir`, then reads files with `os.ReadFile`. There is no
operator-owned allowlist boundary, canonical-path containment check, symlink
escape policy, regular-file restriction, or streaming byte budget. In a hosted
deployment, that is an arbitrary server-filesystem read surface.
The HTTP provider accepts unrestricted URLs through the default client. Default
redirect behavior, DNS resolution, and dialing provide no policy against
loopback, RFC1918, link-local, multicast, unspecified, or cloud metadata
addresses. The response body is not constrained by a hard decoded-byte budget.
This creates SSRF, redirect-pivot, DNS-rebinding, memory/disk exhaustion, and
credential-leak risks before Connector can be considered production-ready.
## Scope
- Require Project edit authority for connector create, update, delete,
	credential change, and synchronization commands.
- Separate operator-owned connector policy from user-owned connector records.
- Disable local-filesystem sources in production by default.
- When local sources are enabled, accept only operator-configured aliases rooted
	in canonical allowlisted directories; never accept an arbitrary absolute or
	relative server path from a normal Project API caller.
- Enforce containment after symlink evaluation, regular-file-only reads,
	extension/type admission, entry count, per-file bytes, aggregate bytes, depth,
	traversal duration, and cancellation.
- Validate HTTP URLs before resolution, validate every resolved address, pin the
	dial to an approved address while retaining the original hostname for TLS
	verification, and repeat the complete policy for each redirect.
- Bound redirect count, connect/TLS/header/body time, encoded and decoded bytes,
	decompression expansion, content type, and total synchronization duration.
- Return stable public rejection codes and structured safe diagnostics.
- Apply the same policy to immediate sync, background retry, resume, and
	operator-triggered replay.
## Non-goals
- No Google Drive, SharePoint, Dropbox, or other cloud connector in this packet.
- No end-user browsing of the server filesystem.
- No general-purpose outbound proxy, webhook client, or URL fetch service.
- No audio/video ingestion.
- No promise that every public Internet URL is fetchable; safety wins over
	permissiveness.
- No storage of credentials inside connector URLs, logs, Activity payloads, or
	ordinary connector JSON.
## Invariants
1. Project membership permits a read only when the caller has read authority;
	every connector mutation requires edit authority.
2. Local source roots are deployment policy, not Project content. A Project
	record stores an opaque root alias plus a relative path.
3. Canonical containment is checked at admission and again immediately before
	every open; a symlink or mount change cannot create a time-of-check escape.
4. Only regular files are read. Devices, sockets, FIFOs, procfs/sysfs-style
	pseudo-files, and directories as content are rejected.
5. Every network hop is validated. A safe initial URL does not bless redirects,
	DNS answers, or later retries.
6. Hostname validation and connection destination cannot diverge: the transport
	dials an already-approved IP and uses the original host for `Host` and TLS
	SNI/certificate checks.
7. A content-length header is advisory. Actual streamed encoded and decoded
	bytes enforce the limit.
8. Credentials are resolved from an operator secret reference at execution
	time and never appear in a URL or persisted public model.
9. Rejection precedes Resource, job, Activity, Knowledge, and usage writes,
	except for a content-free security metric or audit event.
## Likely paths
- `core/capability/connector/`
- `core/capability/connector/provider_local.go`
- `core/capability/connector/provider_http.go`
- `core/handlers/connector/`
- `core/capability/access/`
- `core/platform/config/`
- `core/platform/storage/sqlite/`
- `core/wiring/wiring.go`
- `core/transport/routes.go`
- `dev-test/connectors/`
Verify exact provider filenames against Ω-001 before editing. Keep source-policy
types in Connector or a platform networking package; do not create a capability
import cycle.
## Representative contracts
```go
type Caller struct {
    UserID    string
    ProjectID string
}

type SourcePolicy struct {
    LocalRoots       map[string]string // operator alias -> absolute root
    AllowPlainHTTP   bool              // false outside explicit development
    MaxRedirects     int
    MaxEntries       int
    MaxFileBytes     int64
    MaxEncodedBytes  int64
    MaxDecodedBytes  int64
    MaxTotalBytes    int64
    MaxDepth         int
    RequestTimeout   time.Duration
    SyncTimeout      time.Duration
}

type LocalSource struct {
    RootAlias    string `json:"rootAlias"`
    RelativePath string `json:"relativePath"`
}

type HTTPSource struct {
    URL       string `json:"url"`
    SecretRef string `json:"secretRef,omitempty"`
}
```
The URL admission and dial contract should be explicit:
```go
type ApprovedTarget struct {
    URL      *url.URL
    Hostname string
    IPs      []netip.Addr
}

func ValidateTarget(ctx context.Context, raw string, p SourcePolicy) (ApprovedTarget, error)
func NewBoundedTransport(p SourcePolicy, resolver Resolver) *http.Transport
func CheckRedirect(p SourcePolicy, resolver Resolver) func(*http.Request, []*http.Request) error
```
Public failures expose policy categories, not infrastructure:
```json
{
  "code": "connector.source_not_allowed",
  "error": "The configured source is not permitted by this deployment."
}
```
Recommended internal subcodes include `connector.write_required`,
`connector.local_disabled`, `connector.path_outside_root`,
`connector.non_regular_file`, `connector.address_not_public`,
`connector.redirect_not_allowed`, `connector.response_too_large`, and
`connector.sync_timeout`.
## Ordered implementation
1. Add failing authorization tests for a Project viewer attempting create,
	update, delete, sync, retry, and credential mutation. Require write authority
	in the capability as well as the handler.
2. Introduce immutable operator source policy in configuration. Validate it at
	startup: roots must be absolute, canonical, non-overlapping where ambiguity
	matters, readable, and never `/` or another unrestricted host root.
3. Replace public local paths with `rootAlias + relativePath`. Canonicalize the
	joined path, reject traversal and absolute relative paths, evaluate links,
	assert containment, then open with a no-follow/descriptor-based strategy
	available on the target platform. Re-check file metadata after open.
4. Convert local ingestion from `os.ReadFile` to bounded streaming. Enforce
	regular files, admitted types, count/depth/byte/time budgets, cancellation,
	deterministic ordering, and partial-run diagnostics.
5. Parse HTTP URLs strictly. Permit `https` by default; allow `http` only through
	an explicit development policy. Reject userinfo, opaque URLs, invalid ports,
	malformed hosts, and unnecessary fragments.
6. Resolve all A/AAAA answers and reject the target if any candidate is
	loopback, private, link-local, multicast, unspecified, documentation-only,
	or otherwise non-global according to the documented policy. Include explicit
	metadata-service deny rules as defense in depth.
7. Install a custom `DialContext` that connects only to a validated address.
	Preserve hostname and TLS verification. Re-resolve and revalidate on retry;
	do not silently fall back to an unapproved answer.
8. Install `CheckRedirect` that repeats parse, scheme, resolution, address,
	credential-stripping, and limit checks for every hop. Cap hop count and reject
	cross-origin credential forwarding.
9. Stream the response through encoded and decoded hard limits. Restrict
	decompression to supported encodings, cap expansion ratio, validate sniffed
	content type, close bodies on every branch, and classify timeout/cancellation.
10. Ensure background jobs persist only the safe connector id and policy version;
	they reload current policy and authorization-safe source configuration at
	execution. A retry cannot reuse a previously approved raw socket target.
11. Add counters for denial category, provider latency, bytes, files, redirects,
	and terminal status. Log normalized host and policy code only—never query,
	userinfo, authorization headers, local absolute paths, or content.
12. Document secure deployment defaults, upgrade/migration behavior for existing
	connector rows, companion files, completion matrix, and change record.
## Security, concurrency, persistence, and observability
Use capability-level authorization so internal callers cannot bypass the
handler check. Treat an access lookup error as denial. Persist a policy version
with each sync attempt for diagnosis, but never copy operator root paths or
secrets into Project-visible state. Existing arbitrary local-path records are
disabled on migration and require explicit operator remapping; do not silently
grandfather them.
Local traversal must tolerate concurrent file changes by either reading the
opened regular-file descriptor within the budget or reporting a typed per-source
failure. It must not follow a replacement symlink. HTTP fetches use request
context and a total deadline; abandoned clients and canceled jobs stop reads.
Operational logs may include connector id, Project id, provider kind, normalized
host, policy version, byte/file counts, latency, and failure code. User-facing
Activity may say that a sync was rejected or failed but must not reveal an
absolute path, resolved IP, secret reference, full URL query, or response body.
## Tests and gates
- Viewer-versus-editor matrix for every connector command and internal service
	call.
- Local traversal tests for `..`, absolute paths, symlink files, symlink
	directories, link swaps, nested mount/escape where supported, devices, FIFO,
	socket, oversized file, aggregate overflow, excessive depth/count, and
	cancellation.
- Startup tests rejecting `/`, missing roots, noncanonical roots, and duplicate
	aliases.
- HTTP negatives for `127.0.0.1`, IPv4 integer/hex forms, `::1`, IPv4-mapped
	IPv6, RFC1918, carrier-grade NAT, link-local, multicast, unspecified, and
	`169.254.169.254`.
- Redirect from a public fixture to a denied address, redirect loop, too many
	hops, and cross-origin credential stripping.
- Deterministic DNS-rebinding fixture proving the dial uses only the validated
	address and a later retry revalidates.
- Missing/false `Content-Length`, chunked over-limit, slow headers/body, gzip
	bomb, unsupported encoding, MIME mismatch, and client cancellation.
- Log/Activity snapshots proving secrets, paths, denied IPs, query strings, and
	body snippets are absent.
- Migration fixture for legacy arbitrary-path connector rows.
- `go test -race`, fuzz tests for URL/path parsing, and standard repository
	gates.
## Completion evidence
- No ordinary Project API can name an arbitrary server path.
- No read-only member can mutate or execute a connector.
- The SSRF negative suite covers direct, redirect, DNS, alternate-IP, and
	decompression pivots and produces zero outbound connections to denied targets.
- All provider reads are streaming, cancelable, and bounded.
- Existing insecure connector rows are explicitly disabled or remapped.
- The deployment guide states the exact safe defaults and operator escape hatch.
## Dependencies
Depends on Ω-001. It can proceed in parallel with Ω-006 and Ω-008. It blocks
automatic ingestion in Ω-016 and production deployment packets. Ω-011 later
makes the Project id explicit on the same routes but does not replace these
capability-level checks.
## Sources
- [Omega Connector capability](https://github.com/gccurtis/taurus-omega/tree/b8ba4aa05974ff21746f14b71acaf09117d38dcf/core/capability/connector)
- [Omega transport middleware](https://github.com/gccurtis/taurus-omega/blob/b8ba4aa05974ff21746f14b71acaf09117d38dcf/core/transport/middleware.go)
- [Architecture — Enterprise Control Plane](https://app.notion.com/p/3acb6410e50281988386c4559a26cd22)
- [Deployment — Managed Cloud, On-Premises, and Scale](https://app.notion.com/p/3acb6410e502816585d9e96ff02921d8)
---

