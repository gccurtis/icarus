import type { ImplementationFile } from "$development-views/external-files-reference/types";

const files = (
  paths: readonly string[],
  action: ImplementationFile["action"],
  layer: ImplementationFile["layer"],
  owner: string,
  reason: string
): ImplementationFile[] => paths.map((path) => ({ path, action, layer, owner, reason }));

/**
 * Complete final footprint relative to current origin/main. Paths are explicit
 * so the rendered page is both an architecture map and a review checklist.
 */
export const IMPLEMENTATION_FILES: readonly ImplementationFile[] = [
  ...files([
    "app/configuration/category-readiness.yaml",
    "app/configuration/representation.yaml",
    "app/configuration/semantic-overlay.yaml"
  ], "modified", "configuration", "Current architecture", "Declare External live, register its current representation, and configure semantic adapter bounds."),
  ...files([
    "app/configuration/external-files.yaml"
  ], "created", "configuration", "External capability", "Define the one native repository and upload, batch, path, and response limits."),
  ...files([
    "app/seed/presentationSnapshots.json"
  ], "modified", "representation", "Current development fixtures", "Replace the remaining pre-current slide element records with the one current content-based schema so typed reference traversal needs no compatibility reader."),
  ...files([
    "app/scripts/browser-server.mjs"
  ], "modified", "verification", "Browser harness", "Provision isolated represented and native stores and reset both through the current harness."),

  ...files([
    "app/src/lib/app-views/categories/external/content/library.svelte",
    "app/src/lib/app-views/categories/external/content/library.state.svelte.ts",
    "app/src/lib/app-views/categories/external/context/history.svelte",
    "app/src/lib/app-views/categories/external/context/overview.svelte",
    "app/src/lib/app-views/categories/external/external.md",
    "app/src/lib/app-views/categories/external/inspector/directory.svelte",
    "app/src/lib/app-views/categories/external/inspector/directory.state.svelte.ts",
    "app/src/lib/app-views/categories/external/inspector/file.svelte",
    "app/src/lib/app-views/categories/external/inspector/file.state.svelte.ts"
  ], "created", "workspace", "External stable tab", "Implement the singleton library, Overview/History Context, and instance-owned file/directory manager state."),
  ...files([
    "app/src/lib/app-views/categories/external/procedures/detail-query.ts",
    "app/src/lib/app-views/categories/external/procedures/download.ts",
    "app/src/lib/app-views/categories/external/procedures/effects/clock.svelte.ts",
    "app/src/lib/app-views/categories/external/procedures/effects/directory-inspector.svelte.ts",
    "app/src/lib/app-views/categories/external/procedures/effects/file-inspector.svelte.ts",
    "app/src/lib/app-views/categories/external/procedures/effects/library.svelte.ts",
    "app/src/lib/app-views/categories/external/procedures/index.ts",
    "app/src/lib/app-views/categories/external/procedures/inspect-directory.ts",
    "app/src/lib/app-views/categories/external/procedures/inspect-file.ts",
    "app/src/lib/app-views/categories/external/procedures/library-query.ts",
    "app/src/lib/app-views/categories/external/procedures/move-directory.ts",
    "app/src/lib/app-views/categories/external/procedures/move-file.ts",
    "app/src/lib/app-views/categories/external/procedures/read-detail.ts",
    "app/src/lib/app-views/categories/external/procedures/read-history.ts",
    "app/src/lib/app-views/categories/external/procedures/read-library.ts",
    "app/src/lib/app-views/categories/external/procedures/remove-file.ts",
    "app/src/lib/app-views/categories/external/procedures/rename-file.ts",
    "app/src/lib/app-views/categories/external/procedures/reupload.ts",
    "app/src/lib/app-views/categories/external/procedures/update-context.ts",
    "app/src/lib/app-views/categories/external/procedures/upload.ts"
  ], "created", "workspace", "External view procedures", "Split pure projections, named commands, and lifecycle effects into cohesive entry chains instead of inline async handlers."),
  ...files([
    "app/src/lib/app-views/categories/new-tab/procedures/opening.ts",
    "app/src/lib/app-views/categories/new-tab/procedures/resources.ts",
    "app/src/lib/app-views/categories/new-tab/procedures/test/unit/resources.test.ts",
    "app/src/lib/app-views/categories/project-overview/content/overview.svelte",
    "app/src/lib/app-views/categories/project-overview/procedures/opening.ts"
  ], "modified", "workspace", "External discovery", "Discover files while preserving all current resource kinds; focus the selected file inside the External singleton."),

  ...files([
    "app/src/lib/capabilities/capabilities.md"
  ], "modified", "capability", "Capability architecture", "Declare External's current authority and cross-capability seams."),
  ...files([
    "app/src/lib/capabilities/derived-output/api/shared/resource-reading-media-tools.ts",
    "app/src/lib/capabilities/derived-output/api/shared/resource-reading-structured-tools.ts",
    "app/src/lib/capabilities/derived-output/test/unit/resource-reading.test.ts"
  ], "modified", "semantic", "Derived Output readers", "Preserve the current split readers while resolving authorized External bytes through externalFileStorage."),

  ...files([
    "app/src/lib/capabilities/external-files/api/read-external-file-content/read-external-file-content.ts",
    "app/src/lib/capabilities/external-files/api/read-external-file-content/validate-read-external-file-content.ts",
    "app/src/lib/capabilities/external-files/api/read-external-file-history/read-external-file-history.ts",
    "app/src/lib/capabilities/external-files/api/read-external-file-library/read-external-file-library.ts",
    "app/src/lib/capabilities/external-files/api/read-external-file/read-external-file.ts",
    "app/src/lib/capabilities/external-files/api/read-external-file/validate-read-external-file.ts"
  ], "created", "capability", "External reads", "Provide scoped strict library/detail/history and verified native-content read boundaries."),
  ...files([
    "app/src/lib/capabilities/external-files/api/relocate-external-directory/relocate-external-directory.ts",
    "app/src/lib/capabilities/external-files/api/relocate-external-directory/validate-relocate-external-directory.ts",
    "app/src/lib/capabilities/external-files/api/relocate-external-file/relocate-external-file.ts",
    "app/src/lib/capabilities/external-files/api/relocate-external-file/validate-relocate-external-file.ts",
    "app/src/lib/capabilities/external-files/api/remove-external-file/remove-external-file.ts",
    "app/src/lib/capabilities/external-files/api/remove-external-file/validate-remove-external-file.ts",
    "app/src/lib/capabilities/external-files/api/rename-external-file/rename-external-file.ts",
    "app/src/lib/capabilities/external-files/api/rename-external-file/validate-rename-external-file.ts",
    "app/src/lib/capabilities/external-files/api/reupload-external-file/reupload-external-file.ts",
    "app/src/lib/capabilities/external-files/api/reupload-external-file/validate-reupload-external-file.ts",
    "app/src/lib/capabilities/external-files/api/update-external-file-context/update-external-file-context.ts",
    "app/src/lib/capabilities/external-files/api/update-external-file-context/validate-update-external-file-context.ts",
    "app/src/lib/capabilities/external-files/api/upload-external-files/upload-external-files.ts",
    "app/src/lib/capabilities/external-files/api/upload-external-files/validate-upload-external-files.ts"
  ], "created", "capability", "External mutations", "Implement scoped validation, CAS, path policy, atomic row/History/forget/outbox decisions, and post-commit native cleanup."),
  ...files([
    "app/src/lib/capabilities/external-files/api/shared/configuration.ts",
    "app/src/lib/capabilities/external-files/api/shared/directories.ts",
    "app/src/lib/capabilities/external-files/api/shared/history.ts",
    "app/src/lib/capabilities/external-files/api/shared/mutations.ts",
    "app/src/lib/capabilities/external-files/api/shared/native-file.ts",
    "app/src/lib/capabilities/external-files/api/shared/resource-references.ts",
    "app/src/lib/capabilities/external-files/api/shared/rows.ts",
    "app/src/lib/capabilities/external-files/api/shared/usage.ts",
    "app/src/lib/capabilities/external-files/api/shared/validation.ts",
    "app/src/lib/capabilities/external-files/external-files.md",
    "app/src/lib/capabilities/external-files/index.remote.ts",
    "app/src/lib/capabilities/external-files/index.ts",
    "app/src/lib/capabilities/external-files/types/external-files.ts"
  ], "created", "capability", "External capability", "Define current configuration, admission, projections, transaction helpers, reference traversal, public APIs, DTOs, and implemented documentation."),
  ...files([
    "app/src/lib/capabilities/external-files/test/unit/external-files.test.ts"
  ], "created", "verification", "External behavior", "Exercise ingestion, reuse/conflict, mutation, directory, scope, History, reference refusal, and blob lifecycle behavior."),
  ...files([
    "app/src/lib/capabilities/external-files/test/non-functional/atomicity-fixture.ts",
    "app/src/lib/capabilities/external-files/test/non-functional/concurrent-mutations.test.ts",
    "app/src/lib/capabilities/external-files/test/non-functional/ownership.test.ts",
    "app/src/lib/capabilities/external-files/test/non-functional/relocate-external-directory-atomicity.test.ts",
    "app/src/lib/capabilities/external-files/test/non-functional/relocate-external-file-atomicity.test.ts",
    "app/src/lib/capabilities/external-files/test/non-functional/remove-external-file-atomicity.test.ts",
    "app/src/lib/capabilities/external-files/test/non-functional/rename-external-file-atomicity.test.ts",
    "app/src/lib/capabilities/external-files/test/non-functional/resource-reference-safety.test.ts",
    "app/src/lib/capabilities/external-files/test/non-functional/reupload-external-file-atomicity.test.ts",
    "app/src/lib/capabilities/external-files/test/non-functional/update-external-file-context-atomicity.test.ts",
    "app/src/lib/capabilities/external-files/test/non-functional/upload-external-files-atomicity.test.ts"
  ], "created", "verification", "External executable contracts", "Prove ownership, concurrency, rollback/restart failpoints, revision/History/outbox atomicity, directory atomicity, and complete typed reference safety."),

  ...files([
    "app/src/lib/capabilities/project-resources/api/read-project-resource-index/read-project-resource-index.ts",
    "app/src/lib/capabilities/project-resources/project-resources.md",
    "app/src/lib/capabilities/project-resources/types/project-resources.ts"
  ], "modified", "workspace", "Project resource index", "Index External files for discovery without changing other resource identities or openings."),
  ...files([
    "app/src/lib/capabilities/semantic-overlay/api/backfill-semantic-overlay/backfill-semantic-overlay.ts",
    "app/src/lib/capabilities/semantic-overlay/api/enqueue-semantic-sync/enqueue-semantic-sync.ts",
    "app/src/lib/capabilities/semantic-overlay/api/shared/freshness.ts",
    "app/src/lib/capabilities/semantic-overlay/api/shared/material-description.ts",
    "app/src/lib/capabilities/semantic-overlay/api/shared/material-facets.ts",
    "app/src/lib/capabilities/semantic-overlay/api/shared/material-preparation.ts",
    "app/src/lib/capabilities/semantic-overlay/api/shared/material-resource.ts",
    "app/src/lib/capabilities/semantic-overlay/api/shared/outbox.ts",
    "app/src/lib/capabilities/semantic-overlay/api/shared/resource-ref.ts",
    "app/src/lib/capabilities/semantic-overlay/api/shared/resource.ts",
    "app/src/lib/capabilities/semantic-overlay/index.remote.ts",
    "app/src/lib/capabilities/semantic-overlay/index.ts",
    "app/src/lib/capabilities/semantic-overlay/types/enqueue-semantic-sync.ts"
  ], "modified", "semantic", "Current semantic architecture", "Route text/code/data/image separately and integrate External mutations with the current atomic outbox and queue/lease system."),
  ...files([
    "app/src/lib/capabilities/semantic-overlay/api/read-semantic-status/read-semantic-status.ts",
    "app/src/lib/capabilities/semantic-overlay/api/read-semantic-status/validate-read-semantic-status.ts",
    "app/src/lib/capabilities/semantic-overlay/api/shared/status.ts",
    "app/src/lib/capabilities/semantic-overlay/types/read-semantic-status.ts"
  ], "created", "semantic", "Semantic status", "Expose scoped exact/material job and publication status without leaking semantic tables into External views."),
  ...files([
    "app/src/lib/capabilities/semantic-overlay/test/unit/semantic-external-text.test.ts",
    "app/src/lib/capabilities/semantic-overlay/test/unit/semantic-material-query.test.ts",
    "app/src/lib/capabilities/semantic-overlay/test/unit/semantic-material-sync.test.ts",
    "app/src/lib/capabilities/semantic-overlay/test/unit/semantic-overlay.test.ts",
    "app/test/unit/semantic-derived-output-flow.test.ts"
  ], "modified", "verification", "Semantic integration", "Prove current External exact text, code/data/image material behavior, status, outbox, native reads, and Derived Output flow."),

  ...files([
    "app/src/lib/capabilities/workspace/test/unit/workspace.test.ts",
    "app/src/lib/model/client/workspace-state/test/unit/persistence.test.ts"
  ], "modified", "verification", "Workspace", "Lock the current External permanent singleton and workspace persistence behavior."),

  ...files([
    "app/src/lib/model/server/external-file-storage/constructor.ts",
    "app/src/lib/model/server/external-file-storage/definition.ts",
    "app/src/lib/model/server/external-file-storage/external-file-storage.md",
    "app/src/lib/model/server/external-file-storage/index.server.ts",
    "app/src/lib/model/server/external-file-storage/test/unit/external-file-storage.test.ts",
    "app/src/lib/model/server/external-file-storage/types.ts"
  ], "created", "model", "External file storage", "Own all native I/O, verified content addresses, durable publication/row claims, quarantine GC, restart reconciliation, failpoints, and shared-hash proof."),
  ...files([
    "app/src/lib/model/server/material-content/constructor.ts",
    "app/src/lib/model/server/material-content/definition.ts",
    "app/src/lib/model/server/material-content/index.server.ts",
    "app/src/lib/model/server/material-content/material-content.md",
    "app/src/lib/model/server/material-content/test/unit/material-content.test.ts",
    "app/src/lib/model/server/material-content/types.ts"
  ], "removed", "model", "Retired material-content model", "Remove the obsolete general byte owner after porting every current consumer to External storage."),
  ...files([
    "app/src/lib/model/server/store/test/unit/store.test.ts"
  ], "modified", "verification", "Current Store", "Exercise the existing durable transaction, journal, recovery, and failpoint boundary used by External."),

  ...files([
    "app/src/lib/representation/data/behavior/external/file.ts",
    "app/src/lib/representation/data/behavior/external/reference-policy.ts",
    "app/src/lib/representation/data/behavior/external/row.ts",
    "app/src/lib/representation/data/behavior/external/test/unit/file.test.ts",
    "app/src/lib/representation/data/behavior/external/test/unit/row.test.ts"
  ], "created", "representation", "External representation", "Define signature-first classification, path helpers, strict current row admission, exhaustive table policy, and unit contracts."),
  ...files([
    "app/src/lib/representation/data/behavior/semantic/materials/code.ts",
    "app/src/lib/representation/data/behavior/semantic/materials/external-file.ts",
    "app/src/lib/representation/data/behavior/semantic/projection/contract.ts",
    "app/src/lib/representation/data/behavior/semantic/test/unit/material-profile.test.ts",
    "app/src/lib/representation/data/types/external/file.ts",
    "app/src/lib/representation/data/types/semantic/material.ts",
    "app/src/lib/representation/store/tables.ts"
  ], "modified", "representation", "External and semantic schemas", "Add one strict file row and distinct text/code/data/image material projection contracts."),
  ...files([
    "app/src/lib/representation/data/behavior/workspace/categories.ts",
    "app/src/lib/representation/data/types/workspace/categories.ts"
  ], "generated", "workspace", "category-keys", "Register the External category and external.library content key in generated vocabulary."),
  ...files([
    "app/src/lib/representation/data/behavior/workspace/opening.ts",
    "app/src/lib/representation/data/behavior/workspace/starting.ts",
    "app/src/lib/representation/data/behavior/workspace/views.ts",
    "app/src/lib/representation/data/types/workspace/views.ts"
  ], "modified", "workspace", "Workspace vocabulary", "Bind External singleton opening, permanent start state, Context views, and file/directory Inspector keys."),

  ...files([
    "app/src/lib/runtime/server/server.md",
    "app/src/lib/runtime/server/start.server.ts",
    "app/src/lib/runtime/server/test/construction.test.ts",
    "app/src/lib/runtime/server/test/lifetime.test.ts",
    "app/src/lib/runtime/server/types.ts"
  ], "modified", "model", "Runtime composition", "Compose one External storage instance and reconcile strict row claims only after Store journal recovery."),
  ...files([
    "app/src/lib/surfaces/context/procedures/rail-entries.ts",
    "app/src/lib/surfaces/status-bar/procedures/resource-name.ts",
    "app/src/lib/surfaces/tab-bar/tab-bar.svelte"
  ], "modified", "workspace", "Shared surfaces", "Expose External Overview/History, resolve file names through their owning capability, and render the permanent tab."),

  ...files([
    "app/src/routes/app/[project]/external-files/[externalFile]/+server.ts"
  ], "created", "transport", "Native response", "Serve project-authorized verified attachments with safe filenames, ranges, ETag, response bounds, nosniff, and sandbox CSP."),

  ...files([
    "app/src/lib/development-views/demo-shell/demo-shell.svelte"
  ], "modified", "reference", "Demo index", "Link the served External reference suite."),
  ...files([
    "app/src/lib/development-views/external-files-reference/components/file-plan.svelte",
    "app/src/lib/development-views/external-files-reference/components/implementation.svelte",
    "app/src/lib/development-views/external-files-reference/components/ingestion.svelte",
    "app/src/lib/development-views/external-files-reference/components/overview.svelte",
    "app/src/lib/development-views/external-files-reference/components/reference-header.svelte",
    "app/src/lib/development-views/external-files-reference/components/reference.css",
    "app/src/lib/development-views/external-files-reference/components/stable-tab-mock.svelte",
    "app/src/lib/development-views/external-files-reference/components/stable-tab.svelte",
    "app/src/lib/development-views/external-files-reference/external-files-reference.md",
    "app/src/lib/development-views/external-files-reference/external-files-reference.svelte",
    "app/src/lib/development-views/external-files-reference/procedures/contracts.ts",
    "app/src/lib/development-views/external-files-reference/procedures/file-plan.ts",
    "app/src/lib/development-views/external-files-reference/procedures/navigation.ts",
    "app/src/lib/development-views/external-files-reference/types.ts",
    "app/src/routes/demo/external-files/+page.svelte",
    "app/src/routes/demo/external-files/file-plan/+page.svelte",
    "app/src/routes/demo/external-files/implementation/+page.svelte",
    "app/src/routes/demo/external-files/ingestion/+page.svelte",
    "app/src/routes/demo/external-files/stable-tab/+page.svelte"
  ], "created", "reference", "Served implementation reference", "Provide detailed responsive architecture, ingestion, manager, file-ledger, and implementation-learning pages with Mermaid diagrams."),
  ...files([
    "app/test/browser/external-files-reference.spec.ts",
    "app/test/browser/external-files.spec.ts"
  ], "created", "verification", "Chromium", "Drive the served references and real External lifecycle, directory, persistence, attachment, and failure flows."),
  ...files([
    "docs/semantic-material-layer.md",
    "docs/semantic-overlay.md"
  ], "modified", "semantic", "Semantic architecture", "Document current External exact/material freshness and the External-owned native storage model.")
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
