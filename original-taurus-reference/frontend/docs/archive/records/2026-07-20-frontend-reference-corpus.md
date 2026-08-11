# Change record — 2026-07-20 — Frontend reference corpus

Covers the docs-only branch that assembles prior Taurus frontend and styling thought for incremental use in Taurus Alpha.

## Added the non-authoritative frontend reference corpus

```text
docs/reference/README.md
docs/reference/application-shell.md
docs/reference/document-editor.md
docs/reference/notion-reference-index.md
```

**Why:** prior Taurus and Taurus Nova work contains useful product models, screen behavior, editor expectations, and historical architecture, but Alpha should not mistake that material for current implementation authority. **Purpose:** keep the earlier thought available while making the authority boundary explicit. **Why this way:** a dedicated `docs/reference/` directory separates historical synthesis from active implementation records and from the stronger styling baseline.

## Added the Taurus styling baseline

```text
docs/style/README.md
docs/style/aesthetic-mandate.md
docs/style/color-system.md
docs/style/typography-system.md
docs/style/interaction-disclosure.md
docs/style/surfaces-components-motion.md
docs/style/ai-quarterback-surface.md
docs/style/accessibility-usability.md
```

**Why:** the aesthetic, color, typography, disclosure, surface, motion, Quarterback, and accessibility work is the most stable prior frontend direction. **Purpose:** give incremental UI work a coherent default instead of forcing each new surface to rediscover the product language. **Why this way:** styling has its own directory and is labelled the current design baseline—closer to authoritative than historical reference, but deliberately revisable when a working Alpha vertical provides better evidence.

## Aligned the corpus to the current Alpha and Omega split

```text
Alpha: presentation, editor mechanics, transient interaction, synchronization,
       retry, and accessible conflict presentation.
Omega: canonical Projects, Resources, Documents, authorization, versions,
       validation, provenance, and authoritative conflict decisions.
```

**Why:** the original frontend corpus includes implementation models that Taurus Omega has superseded. **Purpose:** preserve useful product behavior without importing obsolete event runtimes, translator graphs, framework seams, or backend authority into Alpha. **Why this way:** every reference document frames itself as conceptual, and the Notion index explicitly distinguishes current boundary sources from historical evidence.

## Reconciled historical design choices with the current scaffold

```text
Typography: IBM Plex Sans + IBM Plex Mono are the current Alpha baseline.
Theme: Celestial Light and Eclipse are both preserved; the runtime default remains
provisional until the first real shell/editor vertical is evaluated.
```

**Why:** earlier Taurus pages proposed Inter and a light default, while the current Alpha scaffold already self-hosts IBM Plex Sans/Mono and boots a dark proof-of-life screen. **Purpose:** prevent reference documentation from contradicting what is actually built while avoiding the opposite error of treating a temporary smoke-test page as final product authority. **Why this way:** the docs name the current baseline, preserve the alternatives as historical context, and defer the final theme decision to working product evidence.
