# Web Retrieval invariants and implementation gates

## Guarantees today

Only these statements are true of current source:

- the `apps/backend/src/capabilities/web-retrieval` boundary is reserved;
- it contains no executable code;
- it registers no endpoint or job;
- it makes no outbound requests;
- it stores no data and emits no logs;
- no caller can obtain web search/fetch results through it.

The absence of outbound behavior means the directory currently creates no SSRF exposure, but it also provides no functionality or safety controls to code added elsewhere.

## Not currently guaranteed

None of the following design claims is implemented:

- provider-neutral search or fetch;
- URL normalization or redirect recording;
- protocol, hostname, DNS, private/link-local/loopback address restrictions;
- request/header/body/redirect/total time bounds;
- maximum decoded bytes or allowed content types;
- cancellation/retry behavior;
- normalized metadata, content hash, validators, or retrieval timestamp;
- provider credential isolation;
- body/prompt redaction in logs;
- typed errors, test fakes, or provenance integration.

## Minimum safety invariants for future implementation

Before production composition, tests should demonstrate:

1. only configured protocols are admitted;
2. resolved addresses and every redirect target are checked against forbidden networks;
3. DNS rebinding and redirect policy have an explicit, tested strategy;
4. connect/header/body/redirect/total work is bounded and cancellable;
5. decoded bytes and content types are bounded before untrusted material is returned;
6. credentials/internal headers are never forwarded to arbitrary targets;
7. errors/logs exclude fetched bodies, credentials, and arbitrary response headers;
8. normalized results distinguish requested/final URL, truncation, status, hash, and time;
9. provider behavior is testable through a fake;
10. consumers admit durable material explicitly rather than treating transient results as evidence.

## Architectural invariants for future work

- Web Retrieval should remain an in-process dependency of other capabilities.
- Product endpoints, jobs, search policy, ranking, and persistence belong to capabilities.
- Provider payloads and outbound-client details remain inside adapters.
- A fetch success is not a truth or relevance guarantee.
- Raw model-generated URLs must pass the same policy as user-supplied URLs.
- The local development Connector must not be relabeled as web retrieval.

## Acceptance evidence

Implementation should not be described as complete until source, factory/config wiring, one adapter, a fake, deterministic safety tests, Logger coverage, at least one real capability consumer, and documentation links all exist. Until then, the status in [README](README.md) remains “scaffold only.”
