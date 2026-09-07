import type { Finding } from "$development-views/editor-audit/types";

export const QUALITY_FINDINGS: readonly Finding[] = [
  {
    id: "QA-01",
    area: "Quality system",
    severity: "P1",
    status: "Fixed in this audit",
    title: "Browser tests mutated the developer's persistent store",
    symptom: "Editor tests depended on prior local editing and wrote comments, revisions, and workspace state into app/data.",
    cause: "Playwright started the ordinary dev server with its ordinary store directory.",
    fix: "Start Vite through a wrapper that copies seed into a temporary store and deletes only its owned temporary directory on teardown.",
    acceptance: "Repeated browser runs are deterministic and leave app/data unchanged.",
    evidence: ["scripts/browser-server.mjs", "playwright.config.ts"]
  },
  {
    id: "QA-02",
    area: "Quality system",
    severity: "P2",
    status: "Fixed in this audit",
    title: "Seed reset left tables absent from the seed untouched",
    symptom: "Old workspace revisions and change sets could survive reset and overlap histories expected to start at zero.",
    cause: "The seeder replaced files it found but did not define the full represented table reset boundary.",
    fix: "Enumerate every represented table and write a known empty table for absent seed fixtures.",
    acceptance: "After reset every represented table has deterministic contents and no stale history survives.",
    evidence: ["scripts/seed.mjs", "scripts/test/seed.test.mjs"]
  },
  {
    id: "QA-03",
    area: "Quality system",
    severity: "P2",
    status: "Fixed in this audit",
    title: "The browser suite missed reported interaction boundaries",
    symptom: "The old green suite omitted modifier double-click, multi-range comments, repeated distribution, responsive labels, and create/reload durability.",
    cause: "Coverage concentrated on happy-path drag selection and one-pass geometry.",
    fix: "Add unit cases at pure boundaries and diagnostic-aware Chromium scenarios for every reported integrated behavior.",
    acceptance: "Each confirmed regression has a failing-before/passing-after proof and every browser test rejects console/page/HTTP errors.",
    evidence: ["document-editor.spec.ts", "slide-deck-editor.spec.ts", "resource-creation.spec.ts"]
  },
  {
    id: "QA-04",
    area: "Quality system",
    severity: "P3",
    status: "Fixed in this audit",
    title: "Slide-deck documentation no longer matched implementation",
    symptom: "The reference called implemented behavior inert and described lenses that had moved or never existed.",
    cause: "The editor evolved without updating its local source-of-truth markdown alongside view vocabulary and tests.",
    fix: "Replace stale aspirational prose with a concise inventory of current context panels, lenses, behavior contracts, and deferred boundaries.",
    acceptance: "Every documented key resolves to a registered view or is explicitly marked deferred.",
    evidence: ["slide-deck-editor/slide-deck-editor.md", "representation/data/types/workspace/views.ts"]
  },
  {
    id: "QA-05",
    area: "Quality system",
    severity: "P2",
    status: "Fixed in this audit",
    title: "An empty deck template could recreate the zero-slide defect",
    symptom: "Instantiating an intentionally blank deck template could yield a project deck with no canvas.",
    cause: "The template empty-body factory independently used slides: [], allowing creation paths to drift.",
    fix: "Normalize zero-slide bodies to one freshly identified slide at project-deck instantiation.",
    acceptance: "Every path producing a project deck opens one canvas, including blank template instantiation.",
    evidence: ["templates/api/instantiate-template/instantiate-template.ts", "slide-decks/normalize.ts"]
  },
  {
    id: "QA-06",
    area: "Quality system",
    severity: "P2",
    status: "Fixed in this audit",
    title: "The audit reference mixed a large finding database into its view",
    symptom: "The reference page grew beyond 700 lines and made copy, status, and layout changes collide in one Svelte file.",
    cause: "Findings, report matrices, derived metrics, and rendering all lived in the route component.",
    fix: "Split typed findings by domain, centralize report metadata in procedures, and leave the Svelte file responsible only for presentation.",
    acceptance: "No audit page module owns unrelated domains and its report data can be tested without rendering Svelte.",
    evidence: ["editor-audit/procedures/findings", "editor-audit/procedures/report.ts", "editor-audit/editor-audit.svelte"]
  }
];
