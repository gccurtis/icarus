# Derived Output architecture components

`mermaid-diagram.svelte` renders constant, trusted Mermaid definitions on the
client. The dependency is dynamically imported so Mermaid is not part of the
normal editor bundle; these development routes receive their own lazy chunk.

The renderer is deliberately local to this development view. It is a diagram
tool for architecture communication, not an authored-content primitive or a
promise that product documents support Mermaid.

`live-proof.svelte` is project-scoped through the normal `/app/[project]`
layout. The memorable `/demo/semantic-overlay/derived-output-live` route only
redirects to that scope; it does not weaken `requireScope`. A run deliberately
uses the configured embedding and intelligence providers and creates persistent
development rows.
