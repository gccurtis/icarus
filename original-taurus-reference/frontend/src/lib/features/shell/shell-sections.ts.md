# shell-sections.ts

The shell's **section policy**, extracted from `AppShell.svelte` in workstream D (catalog A4)
so the shell component is pure composition and this policy reads in one place.

## The three rules

**The project-context fallback** (left rail): Properties, All resources, History, **Members** —
what shows when no stage claims the rail (notably Overview). A surface contribution replaces
this *entire* set (`contextSectionsFor`), so a resource editor never inherits irrelevant
project-level views.

The fourth slot held **Personas** until 2026-07-29. It was a read-only list of the project's AI
personas, and it stopped earning a rail slot when personality authoring moved to the owner-scoped
`/library/agents` console — a per-project directory of them is now a strictly worse view of the same
thing. `Members` took the slot (and the same `Users` icon), which is the question the rail was missing:
who can reach this project. The `personas` store itself is untouched — the dock's persona picker reads
it. Note that `repairSection` below is what keeps a workspace with a persisted `'personas'` section
from breaking: it no longer resolves, so the rail normalizes to its first section.

**The inspector merge** (`inspectorSectionsFor`): the right rail is
`[details, ...extras, ai]` — a contributed section with id `'details'` replaces the universal
Details fallback (first, the default); contributed extras sit in the middle; the permanent
AI Agent section (the Quarterback panel, opened by the composer bar) is always last. A
contribution cannot remove either permanent slot, only override Details' content.

**The repair rule** (`repairSection`): persisted panel state may name a section that isn't
present — an older section set, or a contribution that isn't mounted. The function returns the
rail's first section id to normalize to, or `null` when the persisted one still resolves. It
*decides*; the shell's effect performs the `setPanel` write.

## Shape notes

The functions take `SurfaceContribution | null` straight from the `activeSurface` store
(frozen contract, `features/shared/surface.ts`) so `AppShell` passes `$activeSurface` through
without interpreting it. The section sets carry Svelte components (the panels), which is why
this module has no unit tests in the node-environment vitest suite — its behavior is covered by
every e2e page load (fallback rail on Overview, replaced rail in a document, repair on stale
persisted state).
