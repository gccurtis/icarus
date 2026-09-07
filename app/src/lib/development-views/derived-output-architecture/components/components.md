# Derived Output architecture components

`src/lib/components/development/mermaid-diagram.svelte` renders constant,
trusted Mermaid definitions on the client. The dependency is dynamically
imported so Mermaid is not part of the normal editor bundle; these development
routes receive their own lazy chunk. Its default adaptive palette observes the
Demo Shell's Helios/Selene attribute and rerenders embedded SVG colors when
appearance changes.

The renderer lives in the development-component layer because more than one
development view now uses it. It remains a diagram tool for architecture
communication, not an authored-content primitive or a promise that product
documents support Mermaid.

`live-proof.svelte` is project-scoped through the normal `/app/[project]`
layout. The memorable `/demo/semantic-overlay/derived-output-live` route only
redirects to that scope; it does not weaken `requireScope`. A run deliberately
uses the configured embedding and intelligence providers and creates persistent
development rows.

The decisions behind these components are recorded in the project-level
[`development-reference-surfaces.md`](../../../../../../docs/development-reference-surfaces.md);
this directory's notes only describe local ownership.
