# Web Retrieval runtime

## Implemented runtime objects

None. There is no `WebRetrieval` class/interface in source, provider adapter, HTTP client wrapper, factory under `initialization/create`, config loader support, logger integration, test fake, or shutdown lifecycle.

## Current function inventory

| Category | Implemented count |
| --- | ---: |
| Public methods | 0 |
| Auxiliary functions | 0 |
| Provider adapters | 0 |
| Factories | 0 |
| Consumers | 0 |
| Logs | 0 |
| Tests | 0 |

## Smallest coherent future runtime

The design suggests a single injected provider-neutral object with `search` and `fetch`. A minimal implementation would still need all of the following to be safe and usable:

1. validated configuration and one explicit adapter;
2. request/result/error definitions;
3. one outbound policy applied to initial URLs and every redirect;
4. linked caller cancellation and bounded DNS/connect/header/body/total time;
5. decoded-byte and content-type limits;
6. normalized metadata/content hash;
7. Logger records containing safe counts/durations, never bodies or credentials;
8. a fake adapter and focused policy tests;
9. production construction in `initialization` and explicit capability injection.

This list is an implementation gate, not current behavior.

## Avoiding misplaced behavior

A future runtime should not create public endpoints or jobs. It should execute inside a capability-owned concurrent job and return transient normalized results. Admission, persistence, versioning, retries across jobs, and evidence creation should remain with the consuming capability.

## No hidden fallback

There is no general web fetch elsewhere in backend source and no installed adapter concealed behind configuration. OpenRouter network access belongs to Intelligence and is not a Web Retrieval implementation. The filesystem Connector is local development ingestion and is also not a web fetcher.
