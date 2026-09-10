## Scope of this record

The earlier static inventory mixed historical observations with current gaps. It is not a reliable description of the integrated application: the editors persist through capabilities, the Store has a recoverable transaction boundary, and the application and live-provider workflows have executable tests. Current evidence and deliberate External product limits are recorded in [[file:app/src/lib/development-views/external-files-reference/procedures/integration.ts]] and served at `/demo/external-files/integration`.

Passing a test suite does not establish that every workflow is bug-free, or that every older module meets the desired architecture. The architecture checker's existing exceptions remain explicit in [[file:app/configuration/architecture-baseline.json]]; no new baseline debt is a separate claim from having no debt at all.

## Deliberate product boundaries

- External manages and downloads PDF, Office, archive, audio, and video files; that does not imply parsing, OCR, preview, or semantic retrieval of their contents.
- Supported prose, source, structured data, and images have distinct semantic lanes. Queue admission and completed semantic processing are different states.
- Bounded buffered uploads are not resumable uploads. File History is not a version browser and does not promise to retain unreferenced predecessor bytes.
- The development identity is not production authentication. Deployment and access-policy hardening require their own review.

## What the wiki can and cannot prove

The extractor is a navigation aid, not an executable coverage report. Import relationships identify likely test connections; they cannot prove that a test exercises a behavior. Svelte component contracts and procedure ownership still need to be read in their source, and declared design-token values do not establish their final computed appearance.

Use [[page:/tests|Tests]] to find contracts, then run the relevant application, architecture, script, or Chromium suite. Deterministic local-provider tests and explicitly authorized Jina/OpenRouter runs establish different things; skipped live tests must never be counted as passing integrations. Consult the dated integration record for the actual completed runs rather than inferring runtime verification from this wiki alone.
