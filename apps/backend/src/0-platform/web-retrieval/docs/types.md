# Web Retrieval types

## Implemented types

None. There is no `index.ts`, `types.ts`, provider port, request schema, result schema, error hierarchy, or configuration type under [`web-retrieval`](../).

No Web Retrieval type is exported through package aliases or imported by backend source/tests.

## Design-only surface

The older [design page](../../../../../../docs/platform/web-retrieval.md) sketches this interface:

```ts
interface WebRetrieval {
  search(request: WebSearchRequest, signal: AbortSignal): Promise<WebSearchResult>;
  fetch(request: WebFetchRequest, signal: AbortSignal): Promise<WebFetchResult>;
}
```

`WebSearchRequest`, `WebSearchResult`, `WebFetchRequest`, and `WebFetchResult` are not defined anywhere in current source. This snippet must not be imported or relied upon.

## Minimum type questions before implementation

Types should be added only after resolving these contracts:

| Area | Decision required |
| --- | --- |
| Search | query, locale/time range, provider paging, maximum results |
| Fetch identity | requested URL versus normalized/final URL and redirect chain |
| Body | bytes, decoded bounded text, or both; exact truncation signaling |
| Metadata | status, content type, length, timestamp, validators, hash |
| Failure | typed policy rejection, timeout, cancellation, provider, status, decode, size errors |
| Safety policy | configured protocols, forbidden networks/hosts, redirect and DNS rules |
| Usage | provider quota/cost accounting and safe telemetry |
| Provenance | which metadata a consuming Source record must retain |

## Recommended ownership

When implemented, provider-neutral request/result/error types should live in this directory; provider wire payloads should remain private to adapters. Capability-specific planning, rankings, persisted source records, and evidence types should remain in their owning capability directories.

## Validation status

No runtime validation exists because no ingress exists. A future implementation should validate at its public in-process boundary and again at untrusted provider/HTTP response boundaries; TypeScript types alone are insufficient.
