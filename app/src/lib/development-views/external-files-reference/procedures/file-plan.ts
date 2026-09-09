import type { ImplementationFile } from "$development-views/external-files-reference/types";

const created = (
  path: string,
  layer: ImplementationFile["layer"],
  owner: string,
  reason: string
): ImplementationFile => ({ path, action: "created", layer, owner, reason });

const modified = (
  path: string,
  layer: ImplementationFile["layer"],
  owner: string,
  reason: string
): ImplementationFile => ({ path, action: "modified", layer, owner, reason });

const generated = (
  path: string,
  layer: ImplementationFile["layer"],
  owner: string,
  reason: string
): ImplementationFile => ({ path, action: "generated", layer, owner, reason });

/**
 * Exact implementation footprint relative to work/derived-output-architecture.
 * Entries are explicit so this page doubles as a review checklist.
 */
export const IMPLEMENTATION_FILES: readonly ImplementationFile[] = [
  created("app/configuration/external-files.yaml", "configuration", "External capability", "Runtime limits for file count, individual bytes, batch bytes, path bytes, and authorized response bytes."),
  modified("app/scripts/browser-server.mjs", "verification", "Browser harness", "Give represented rows and native material bytes independent disposable directories and clean both on exit."),

  modified("app/src/lib/model/server/material-content/types.ts", "model", "Material content model", "Add a process mutation lease, bounded put receipts, and idempotent remove to the native-byte interface."),
  modified("app/src/lib/model/server/material-content/definition.ts", "model", "Material content model", "Implement the mutation lease, SHA-256 put/dedupe, sibling temporary publication, verified read, and removal."),
  modified("app/src/lib/model/server/material-content/constructor.ts", "model", "Runtime composition", "Accept a directory override so browser tests never write production/development material data."),
  modified("app/src/lib/model/server/material-content/index.server.ts", "model", "Material content model", "Export the new input, receipt, and reference contracts."),
  modified("app/src/lib/model/server/material-content/test/unit/material-content.test.ts", "verification", "Material content model", "Prove put/read reuse, byte bounds, integrity verification, lease ordering, and removal."),
  modified("app/src/lib/runtime/server/start.server.ts", "model", "Runtime composition", "Wire ICARUS_MATERIAL_DIRECTORY beside the existing represented-store override."),

  modified("app/src/lib/representation/store/tables.ts", "representation", "Representation", "Extend externalFiles with backward-compatible originalName, relativePath, size, updater, and revision fields."),
  modified("app/src/lib/representation/data/behavior/external/file.ts", "representation", "External representation", "Normalize safe relative paths, derive a leaf name, sniff selected signatures, and reconcile MIME/extension classification."),
  created("app/src/lib/representation/data/behavior/external/test/unit/file.test.ts", "verification", "External representation", "Lock traversal/absolute/path rejection and byte-based media classification behavior."),

  created("app/src/lib/capabilities/external-files/external-files.md", "capability", "External capability", "Document ownership, ordering, compatibility, failure, and non-transactional recovery contracts."),
  created("app/src/lib/capabilities/external-files/types/external-files.ts", "capability", "External capability", "Define safe library/detail/usage/native-state and mutation outcome DTOs."),
  created("app/src/lib/capabilities/external-files/index.ts", "capability", "External capability", "Expose server-only authorized native-byte resolution without a remote round trip."),
  created("app/src/lib/capabilities/external-files/index.remote.ts", "capability", "External capability", "Publish list/detail queries, multipart upload form, rename/delete commands, and dependent cache refreshes."),
  created("app/src/lib/capabilities/external-files/api/shared/configuration.ts", "capability", "External capability", "Strictly read all five configured positive integer limits."),
  created("app/src/lib/capabilities/external-files/api/shared/rows.ts", "capability", "External capability", "Project-scope and strictly admit rows; quarantine bad metadata and project safe provenance labels."),
  created("app/src/lib/capabilities/external-files/api/shared/usage.ts", "capability", "External capability", "Scan represented document/deck/template/set/finding references and hide foreign template names."),
  created("app/src/lib/capabilities/external-files/api/shared/validation.ts", "capability", "External capability", "Validate opaque ids, revisions, bounded local display names, and multipart form shape."),
  created("app/src/lib/capabilities/external-files/api/upload-external-files/validate-upload-external-files.ts", "capability", "External ingestion", "Admit only the two known form instances, real File arrays, and aligned path hints."),
  created("app/src/lib/capabilities/external-files/api/upload-external-files/upload-external-files.ts", "capability", "External ingestion", "Coordinate mixed-result admission, byte publication, retry/path policy, row creation, compensation, and semantic enqueue."),
  created("app/src/lib/capabilities/external-files/api/read-external-file-library/read-external-file-library.ts", "capability", "External reads", "Return the scoped admitted inventory, quarantined rows, and actual upload/download limits."),
  created("app/src/lib/capabilities/external-files/api/read-external-file/validate-read-external-file.ts", "capability", "External reads", "Validate one opaque externalFileId."),
  created("app/src/lib/capabilities/external-files/api/read-external-file/read-external-file.ts", "capability", "External reads", "Add native integrity and represented usage to one admitted library row for the Inspector."),
  created("app/src/lib/capabilities/external-files/api/read-external-file-content/validate-read-external-file-content.ts", "capability", "Native content", "Validate the file id before native content resolution."),
  created("app/src/lib/capabilities/external-files/api/read-external-file-content/read-external-file-content.ts", "capability", "Native content", "Authorize, verify, and bound bytes for the response route without exposing storage paths."),
  created("app/src/lib/capabilities/external-files/api/rename-external-file/validate-rename-external-file.ts", "capability", "File management", "Validate compare-and-swap revision and local display name."),
  created("app/src/lib/capabilities/external-files/api/rename-external-file/rename-external-file.ts", "capability", "File management", "Rename only project-local metadata, preserve provenance/bytes, increment revision, and requeue meaning."),
  created("app/src/lib/capabilities/external-files/api/remove-external-file/validate-remove-external-file.ts", "capability", "File management", "Validate compare-and-swap deletion input."),
  created("app/src/lib/capabilities/external-files/api/remove-external-file/remove-external-file.ts", "capability", "File management", "Refuse in-use/stale deletion, retire semantic state, recheck, hard-delete the row, and safely reclaim unshared bytes."),
  created("app/src/lib/capabilities/external-files/test/unit/external-files.test.ts", "verification", "External capability", "Exercise upload/retry/conflict, scoped projection, rename invariants, in-use refusal, semantic retirement, and byte reclamation."),

  modified("app/src/lib/capabilities/semantic-overlay/types/enqueue-semantic-sync.ts", "semantic", "Semantic overlay", "Allow exact-only enqueue results by making the material job id optional."),
  modified("app/src/lib/capabilities/semantic-overlay/api/enqueue-semantic-sync/enqueue-semantic-sync.ts", "semantic", "Semantic overlay", "Resolve exact and material eligibility independently and avoid unsupported failure jobs."),
  modified("app/src/lib/capabilities/semantic-overlay/api/shared/material-resource.ts", "semantic", "Semantic overlay", "Limit external material targets to images, real CSV/TSV, and recognized source code."),
  created("app/src/lib/capabilities/semantic-overlay/types/read-semantic-status.ts", "semantic", "Semantic overlay", "Define lane states, current profile/descriptor data, errors, and overlay generation."),
  created("app/src/lib/capabilities/semantic-overlay/api/shared/status.ts", "semantic", "Semantic overlay", "Project exact/material job and publication state without exposing semantic tables to External."),
  created("app/src/lib/capabilities/semantic-overlay/api/read-semantic-status/validate-read-semantic-status.ts", "semantic", "Semantic overlay", "Validate resource references for the public status query."),
  created("app/src/lib/capabilities/semantic-overlay/api/read-semantic-status/read-semantic-status.ts", "semantic", "Semantic overlay", "Scope and serve the semantic status projection."),
  created("app/src/lib/capabilities/semantic-overlay/types/retire-semantic-resource.ts", "semantic", "Semantic overlay", "Define semantic retirement input and removal counts."),
  created("app/src/lib/capabilities/semantic-overlay/api/retire-semantic-resource/validate-retire-semantic-resource.ts", "semantic", "Semantic overlay", "Validate the resource reference to retire."),
  created("app/src/lib/capabilities/semantic-overlay/api/retire-semantic-resource/retire-semantic-resource.ts", "semantic", "Semantic overlay", "Stage replacement indexes, archive products, remove placements/sources/materials/jobs, and advance generation idempotently."),
  modified("app/src/lib/capabilities/semantic-overlay/index.remote.ts", "semantic", "Semantic overlay", "Expose scoped remote status and retirement entry points."),
  modified("app/src/lib/capabilities/semantic-overlay/index.ts", "semantic", "Semantic overlay", "Expose server-to-server status and retirement for External without remote wrappers."),
  modified("app/src/lib/capabilities/semantic-overlay/test/unit/semantic-overlay.test.ts", "verification", "Semantic overlay", "Prove exact-only Markdown, status/profile projection, and full idempotent retirement."),

  modified("app/src/lib/capabilities/project-resources/types/project-resources.ts", "workspace", "Project resource index", "Add the file resource kind."),
  modified("app/src/lib/capabilities/project-resources/api/read-project-resource-index/read-project-resource-index.ts", "workspace", "Project resource index", "Collect project-scoped externalFiles using safe actor fallback."),
  modified("app/src/lib/capabilities/project-resources/project-resources.md", "workspace", "Project resource index", "Record file membership in the actual index contract."),
  modified("app/src/lib/app-views/categories/project-overview/procedures/opening.ts", "workspace", "Project Overview", "Route file launchers to category-only External focus rather than an identified editor target."),
  modified("app/src/lib/app-views/categories/project-overview/content/overview.svelte", "workspace", "Project Overview", "Inspect external.file after opening a file result."),

  created("app/src/lib/app-views/categories/external/external.md", "workspace", "External view", "Record the stable library and manager ownership contract, including deferred Findings."),
  created("app/src/lib/app-views/categories/external/procedures/library.svelte.ts", "workspace", "External view", "Project remote answers into display state and coordinate focus, Inspector, rename/delete, download, and manual semantic processing."),
  created("app/src/lib/app-views/categories/external/content/library.svelte", "workspace", "External content", "Render multipart file/folder ingestion, latest receipt, search/filter/sort inventory, and selection without editors."),
  created("app/src/lib/app-views/categories/external/context/overview.svelte", "workspace", "External context", "Summarize project-wide file, byte, quarantine, and semantic counts."),
  created("app/src/lib/app-views/categories/external/context/activity.svelte", "workspace", "External context", "Project a recent-change view from current rows while stating the absence of a durable event journal."),
  created("app/src/lib/app-views/categories/external/context/policy.svelte", "workspace", "External context", "Expose actual limits, management policy, semantic type support, safe serving, and deferred Findings."),
  created("app/src/lib/app-views/categories/external/inspector/file.svelte", "workspace", "File Inspector", "Implement the non-editor manager: rename, download, delete, provenance, integrity, semantics, summary review, refresh, and usage."),
  generated("app/src/lib/representation/data/types/workspace/categories.ts", "workspace", "category-keys", "Register external and external.library in generated workspace vocabulary."),
  generated("app/src/lib/representation/data/behavior/workspace/categories.ts", "workspace", "category-keys", "Register External category and Content implementations."),
  modified("app/src/lib/representation/data/types/workspace/views.ts", "workspace", "Workspace vocabulary", "Add external overview/activity/policy Context keys and external.file Inspector key."),
  modified("app/src/lib/representation/data/behavior/workspace/views.ts", "workspace", "Workspace vocabulary", "Bind External Context and Inspector keys to their Svelte implementations."),
  modified("app/src/lib/representation/data/behavior/workspace/opening.ts", "workspace", "Workspace opening", "Give External its category-only opening and default overview rail."),
  modified("app/src/lib/representation/data/behavior/workspace/starting.ts", "workspace", "Workspace defaults", "Add External to the permanent singleton set."),
  modified("app/src/lib/model/client/workspace-state/methods/shared/adopt.ts", "workspace", "Workspace restore", "Adopt missing permanent singleton landings into older persisted workspaces without replacing user state."),
  modified("app/src/lib/model/client/workspace-state/test/unit/persistence.test.ts", "verification", "Workspace restore", "Verify older persisted rows retain their landings and gain every missing permanent singleton, including External."),
  modified("app/src/lib/capabilities/workspace/test/unit/workspace.test.ts", "verification", "Workspace capability", "Update the empty-workspace contract to include External in the permanent singleton set."),
  modified("app/src/lib/surfaces/tab-bar/tab-bar.svelte", "workspace", "Tab bar", "Render the permanent External tab beside Overview, Agents, and Templates."),
  modified("app/src/lib/surfaces/context/procedures/rail-entries.ts", "workspace", "Context rail", "Expose External Overview, Activity, and Policy views."),
  modified("app/src/lib/surfaces/status-bar/procedures/resource-name.ts", "workspace", "Status bar", "Name selected external files through their subject capability instead of the forbidden generic store reader."),

  created("app/src/routes/app/[project]/external-files/[externalFile]/+server.ts", "transport", "Native response", "Serve authorized verified bytes as attachments with ranges, ETag, no-cache, nosniff, CSP sandbox, and correct 416 handling."),

  modified("app/src/lib/development-views/demo-shell/demo-shell.svelte", "reference", "Demo index", "Link the External implementation reference suite."),
  created("app/src/lib/development-views/external-files-reference/types.ts", "reference", "Reference suite", "Define reference navigation, file-ledger, and format contracts."),
  created("app/src/lib/development-views/external-files-reference/procedures/navigation.ts", "reference", "Reference suite", "Define the five-page implementation reference route."),
  created("app/src/lib/development-views/external-files-reference/procedures/contracts.ts", "reference", "Reference suite", "Project actual ingestion steps, format coverage, and verified current truths."),
  created("app/src/lib/development-views/external-files-reference/procedures/file-plan.ts", "reference", "Reference suite", "Maintain this exact production/reference footprint with ownership and rationale."),
  created("app/src/lib/development-views/external-files-reference/components/reference-header.svelte", "reference", "Reference suite", "Provide persistent branch-aware navigation."),
  created("app/src/lib/development-views/external-files-reference/components/reference.css", "reference", "Reference suite", "Share responsive visual language across the reference pages."),
  created("app/src/lib/development-views/external-files-reference/components/overview.svelte", "reference", "Reference suite", "Explain the implemented architecture and invariants."),
  created("app/src/lib/development-views/external-files-reference/components/ingestion.svelte", "reference", "Reference suite", "Explain actual upload ordering, classification, recovery, limits, and semantic routing."),
  created("app/src/lib/development-views/external-files-reference/components/stable-tab-mock.svelte", "reference", "Reference suite", "Provide an interactive manager specimen; production behavior is separately live under /app/dev-project."),
  created("app/src/lib/development-views/external-files-reference/components/stable-tab.svelte", "reference", "Reference suite", "Explain actual stable-tab, context, selection, and Inspector behavior."),
  created("app/src/lib/development-views/external-files-reference/components/file-plan.svelte", "reference", "Reference suite", "Render the actual reviewable file map and verification matrix."),
  created("app/src/lib/development-views/external-files-reference/components/implementation.svelte", "reference", "Reference suite", "Collect implementation learnings, concessions, recovery boundaries, and live-test discoveries."),
  created("app/src/lib/development-views/external-files-reference/external-files-reference.svelte", "reference", "Reference suite", "Compose the overview route."),
  created("app/src/lib/development-views/external-files-reference/external-files-reference.md", "reference", "Reference suite", "Preserve the same implementation truth as durable textual architecture documentation."),
  created("app/src/routes/demo/external-files/+page.svelte", "reference", "Reference routes", "Serve the system overview."),
  created("app/src/routes/demo/external-files/ingestion/+page.svelte", "reference", "Reference routes", "Serve ingestion."),
  created("app/src/routes/demo/external-files/stable-tab/+page.svelte", "reference", "Reference routes", "Serve the stable library reference."),
  created("app/src/routes/demo/external-files/file-plan/+page.svelte", "reference", "Reference routes", "Serve the exact file map."),
  created("app/src/routes/demo/external-files/implementation/+page.svelte", "reference", "Reference routes", "Serve implementation learnings."),
  created("app/test/browser/external-files-reference.spec.ts", "verification", "Reference suite", "Verify all diagrams, interactive manager specimen, file map, implementation page, and compact responsiveness."),
  created("app/test/browser/external-files.spec.ts", "verification", "External system", "Prove real upload, verified attachment response, rename provenance, deletion, and no editor tab in Chromium.")
] as const;

export const IMPLEMENTATION_LAYERS = [
  "configuration",
  "model",
  "representation",
  "capability",
  "semantic",
  "workspace",
  "transport",
  "reference",
  "verification"
] as const satisfies readonly ImplementationFile["layer"][];
