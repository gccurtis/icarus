---
title: "Implementation — User Template Library"
notion_page_id: "3acb6410e50281d4a4d8ee542f91d595"
notion_url: "https://app.notion.com/3acb6410e50281d4a4d8ee542f91d595"
project: "Taurus Yesod"
role: "Primary"
format: "Spec"
created: "2026-07-29 19:53:49Z"
mirrored_at: "2026-07-30"
mirrored_from_notion: true
---

# Implementation — User Template Library

> Source mirror. Preserve this page as planning evidence; use the agent-facing execution packet when one exists.

> **Status:** Implementation-ready Taurus Yesod plan. This page defines the user-level Template Library capability and the `/library/templates` route. It preserves the useful Taurus Alpha screen contract, reuses Taurus Omega's existing Document template semantics, and replaces every mocked or project-bound seam with a production, privacy-safe implementation.
## 1. Outcome
The Template Library is a durable library of reusable resource structures owned by a user and available before that user selects a project.
When this work is complete, a user can:
- open `/library/templates` directly after sign-in;
- browse, search, filter, deep-link, preview, create, edit, version, duplicate, share, and delete templates;
- share a template with another user or an organization at either **Can use** or **Can edit**;
- declare the context slots a template needs without permanently binding the library original to project content;
- view an unbound **Prompt** preview or an ephemeral, context-filled **Content** preview;
- choose a target project even when the library was opened from a cold route with no active project;
- materialize a published template as a new resource or insert its compatible content into an existing resource;
- retry a materialization safely without creating duplicate resources or duplicate ChangeSets;
- edit the resulting resource normally, with ordinary resource history, collaboration, undo, and persistence.
V1 fully supports **Document templates**. The aggregate, storage, API, and adapter contracts are resource-kind neutral so Spreadsheet, Slides, and other template families can be added without redesigning ownership, sharing, publishing, or materialization.
The central rule is:
> A library template is an independent, user-owned, versioned copy. It never retains a live link to a project resource, never carries source-project bindings into the library, and never changes an already materialized project resource.
## 2. Outcome checklist
- [ ] Template Library endpoints work with an authenticated user and **no selected project**.
- [ ] Every canonical template has exactly one user owner; organizations are share recipients, not owners.
- [ ] `use` and `edit` grants work for both user and organization subjects.
- [ ] The capability returns server-derived effective permissions and enforces the same permissions on every read and write.
- [ ] Draft editing uses the shared Library Asset envelope plus a Template Draft, immutable ChangeSets, and revision compare-and-swap.
- [ ] Published versions are immutable, numbered, content-addressed snapshots.
- [ ] Document template semantics preserve `TemplateInfo`, `ContextVariable`, and `BlockContext`.
- [ ] Library snapshots contain no project IDs, project access rules, comments, presence, history, or inherited context bindings.
- [ ] Context slots have stable IDs, bounded names and descriptions, and explicit binding rules.
- [ ] Prompt preview shows unbound slots; Content preview uses ephemeral bindings without changing the template.
- [ ] `/library/templates` remains the collection route and `/library/templates/:templateID` is the stable asset URL; `[id]` is only the frontend route-file segment.
- [ ] `Bring into project` always resolves an explicit target project; it never silently relies on stale workspace state.
- [ ] Materialization supports a new resource and kind-compatible insertion into an existing resource.
- [ ] Every copied resource object receives a fresh ID.
- [ ] New-resource materialization creates an ordinary resource; insertion produces ordinary resource ChangeSets.
- [ ] `ClientRequestID` makes create, change, publish, duplicate, share, and materialize commands idempotent.
- [ ] Source deletion, unsharing, or later template edits do not change an existing materialized copy.
- [ ] The existing Omega project-template list/create paths are caller-authorized and clear both context and resource bindings before any Library adapter uses them.
- [ ] Project capture passes explicit personal-library export governance; an unknown governing organization or policy decision fails closed.
- [ ] Template ownership, grants, lineage, usage, and effective permissions come from the same shared Library kernel used by Context and Personality.
- [ ] The Assistant reads only a caller-authorized, exact Template draft revision or published version through the typed Template reader.
- [ ] List, preview, and materialization paths have explicit limits, pagination, observability, and failure behavior.
- [ ] Alpha removes the library fixtures and Mock badge only as each real slice becomes available.
## 3. Evidence from Taurus Alpha and Taurus Omega
### Taurus Alpha: the intended screen already exists
The current Alpha route is a two-line wrapper over `LibraryConsole`:
```javascript
<LibraryConsole space="templates" />
```
The implemented screen contract is useful and should remain recognizable:
- `LibraryShell` makes Agents, Context, and Templates user-level routes reachable from both project selection and the project shell.
- `LibraryRail` provides **Template library**, New, Search, owner filtering, and a names-only asset list.
- `LibraryConsole` provides the title, owner, asset menu, and **Bring into project**.
- `TemplateSpace` provides Preview, Prompt/Content modes, kind-aware rendering, Edit, and authored Context slots.
- `LibraryDetails` provides name, description, owner, sharing, provenance, and usage.
- `LibraryPanel` provides Details and Assistant lenses.
- `LibraryQuarterback` provides the familiar bottom composer.
The data is currently static in `library-mock.ts`. Selection, search, owner filtering, context choices, and preview mode are component-local. The top bar correctly carries a Mock badge.
### Alpha gaps this plan closes
1. Templates have no stable asset subroute; selection disappears on reload and cannot be shared as a URL.
2. `Bring into project` assumes an active project even though the route is intentionally available before project selection.
3. New, Edit, Add slot, rename, description, share, duplicate, delete, and bring-in are mocked or inert.
4. Slot bindings alter only an in-memory preview.
5. The separate editor-side Templates rail still uses a different mock catalog.
6. Slides declare a kind but correctly have no fake renderer.
7. Permissions are not represented, so the current mock renders edit and destructive controls for every asset.
8. Provenance and “Used in” currently expose names without an access-aware projection.
### Taurus Omega: Document template mechanics already exist
Omega's Document model already provides the correct project-resource semantics:
```go
type TemplateInfo struct {
    IsTemplate bool
    Variables  []ContextVariable
}

type ContextVariable struct {
    Name          string
    Description   string
    BoundContext  string
    BoundResource *ResourceRef
}

type BlockContext struct {
    Include []string
    Exclude []string
}
```
The useful existing behavior is:
- template metadata is part of the Document base and therefore versioned with Document ChangeSets;
- context variables are named, bounded requirements for background material;
- prompt blocks select variable names through `BlockContext`; variables are not string interpolation tokens;
- project templates can be listed;
- creating a Document from a project template duplicates the Document structure with fresh row, block, and atom IDs.
That behavior should be reused, not rebuilt. The gap is scope and composition: Omega templates are project Documents behind the selected-project gate, while the library must be user-owned, shareable, versioned independently, and reachable without a project.
### Correctness and security blockers in the current Omega template path
The existing mechanics are a starting point, not yet a safe library adapter. Three current facts must be corrected **before** the Template Library captures from or delegates materialization to the project-template path:
1. **`GET /documents/templates`**** is unfiltered.** `Handlers.Templates` calls `Documents.Templates(projectID)` and serializes every matching Document. Unlike `Handlers.List`, it does not invoke the injected `canAccess` filter. A project member can therefore receive a restricted template that the normal Document list would hide.
2. **`POST /documents {fromTemplateId}`**** bypasses the path guard.** The request URL contains no `:documentID`, so `documentAccessGuard` cannot authorize the source template. `Handlers.Create` calls `CreateFromTemplate(projectID, templateID)` without a caller-aware source-resource check.
3. **`clearBindings`**** does not clear every binding.** The current function empties `BoundContext` and sets `IsTemplate=false`, but leaves `BoundResource` intact even though the surrounding comment says both forms clear. A copied Document can therefore retain a source-project Resource reference.
The prerequisite repair is explicit:
```go
type ProjectTemplateScope struct {
    CallerID  string
    ProjectID string
}

func (d *Documents) Templates(scope ProjectTemplateScope) ([]Document, error)

func (d *Documents) CreateFromTemplate(
    scope ProjectTemplateScope,
    templateID string,
    actors ...Actor,
) (Document, error)

func clearBindings(t *TemplateInfo) *TemplateInfo {
    if t == nil {
        return nil
    }
    out := cloneTemplateInfo(t)
    out.IsTemplate = false
    for i := range out.Variables {
        out.Variables[i].BoundContext = ""
        out.Variables[i].BoundResource = nil
    }
    return out
}
```
The caller-aware methods must enforce the same Resource access resolver used by the catalog. Handler-only filtering is insufficient because background capture, materialization, and future agent callers also need a safe API. Add adversarial tests for:
- a restricted template omitted from `GET /documents/templates`;
- a restricted `fromTemplateId` returning not found/forbidden without creating a copy;
- both binding forms absent from the duplicated Document;
- a source-access resolver failure failing closed.
The Template Library adapter must not call the old caller-blind methods. This repair is Phase B0 and a release blocker, not optional cleanup.
### Capturing into a personal library is governed data export
Saving a project Document into a user-owned library moves data out of project governance. Being able to read or edit the Document does not necessarily grant the right to export it into a personal reusable asset and then share it with another user or organization.
Omega's current Project model does not carry an organization ID, so the platform cannot safely infer:
- which organization governs the source project;
- whether personal-library export is allowed;
- whether approval or a data classification exception is required;
- whether a later user or organization share is permitted.
Until that relationship and policy exist, unknown governance fails closed. Do not infer permission from the resource creator, the caller's currently selected organization, or project ownership alone.
```go
type ExportDecision string

const (
    ExportAllow            ExportDecision = "allow"
    ExportDeny             ExportDecision = "deny"
    ExportApprovalRequired ExportDecision = "approval_required"
    ExportUnknown          ExportDecision = "unknown"
)

type PersonalLibraryExportPolicyPort interface {
    EvaluateTemplateCapture(
        ctx context.Context,
        actor Actor,
        projectID string,
        resource ResourceRef,
        classification string,
    ) (ExportDecision, error)
}
```
Rules:
- blank user-created library templates and duplication of an already authorized library asset do not cross a project boundary;
- project capture requires an explicit `allow` or a valid recorded approval;
- `deny`, `unknown`, policy-store errors, and an unresolvable governing organization all fail closed;
- the source Resource is reauthorized at the start and immediately before committing the library asset;
- asynchronous capture jobs reauthorize before every protected phase;
- the export decision, policy revision, approver where applicable, source revision, and content classification are written to a safe audit record;
- later sharing and materialization re-evaluate any classification rule that restricts recipients or destination organizations;
- no audit event or error body includes source content or a hidden Resource name.
## 4. Governing decisions
1. **Canonical ownership is user ownership.** `OwnerUserID` is required. An organization can receive a grant but cannot own a canonical template in V1.
2. **One shared library envelope.** Templates, Contexts, and Personalities use the same `library_assets`, `library_asset_grants`, lineage, usage, permission vocabulary, and project-independent access gate. Template adds only Template-specific draft, ChangeSet, version, preview, and materialization state.
3. **Shares are grants, not copies.** A grant changes who can reach the same library original. Materialization creates a copy.
4. **Two access levels only.** `use` can read published content, preview it, and materialize it. `edit` includes use and can edit the draft and publish. Only the owner can reshare or manage lifecycle. Ownership transfer is not supported in V1.
5. **No project is required to manage the library.** The authenticated caller and their active organization memberships are the authorization scope.
6. **Project capture is a governed export.** It requires an explicit allow/approval decision; absent project-to-organization governance fails closed.
7. **One mutable draft, immutable published versions.** Draft changes use a Template Draft + ChangeSets + CAS. Publish freezes a complete version.
8. **Published materialization is version-pinned.** A request names a published version. “Latest” may be resolved once by the server, but the receipt records the exact version.
9. **Content is an opaque, typed snapshot.** The Template capability owns lifecycle and policy; kind adapters own validation, preview, ID remapping, and conversion into ordinary resource operations.
10. **Document first.** V1 accepts `kind=document`. Spreadsheet and Slides adapters are registered later behind the same port.
11. **Bindings never travel upward.** Promote, duplicate, and publish sanitize both `BoundContext` and `BoundResource`. Preview bindings are ephemeral. Materialization bindings apply only to the new or target resource.
12. **Stable slot identity is separate from display name.** Library slots have server-issued IDs. The Document adapter maps them to Omega's name-based `ContextVariable` and rewrites `BlockContext` references atomically when a slot is renamed.
13. **Copies receive fresh IDs.** Row, block, atom, variable, slide, sheet, cell-overlay, and other resource-local identifiers are never reused in a materialized resource.
14. **Project results use project history.** Insertion produces ordinary resource ChangeSets. A newly materialized resource becomes an ordinary resource immediately after creation.
15. **No live links.** Published versions, project instances, and duplicates remain independent forever.
16. **No implicit project target.** The last active project may be preselected as a convenience, but the user confirms the target.
17. **Accepted history is immutable.** A ChangeSet is never rewritten to collapse edits. Folding updates the base and `BaseSeq`, not accepted history.
18. **Assistant access is typed and authorized.** Agent/Chat orchestration remains outside Template, but the screen's Assistant receives a caller-authorized Template read/preview scope rather than fixtures or raw Store access.
## 5. Boundary and ownership
### Shared Library kernel owns
- asset identity, kind, and canonical user owner;
- current name, description, lifecycle, head version, and metadata version;
- user and organization grants;
- effective-permission evaluation;
- sanitized origin/lineage and caller-visible usage;
- the common project-independent access scope and not-found/redaction contract.
This is the same envelope used by Context Library and Personality Library. Template must not introduce a second ownership, grant, or lineage subsystem.
### Template capability owns
- the current Template draft, context slots, and kind snapshot;
- draft revision and ChangeSets;
- immutable published versions;
- materialization request/receipt identity;
- Template-specific preview projections and audit details.
### Kind adapter owns
- snapshot schema validation and migration;
- snapshot sanitization;
- context-slot reference validation;
- prompt and content preview projection;
- fresh-ID remapping;
- creation of a new-resource plan;
- creation of insertion operations for an existing compatible resource;
- kind-specific limits and unsupported-feature warnings.
### Resource capability owns
- the created Document, Spreadsheet, Slides deck, or other resource;
- its project ownership and access policy;
- its current revision and ChangeSets;
- editor collaboration, comments, activity, undo, and export;
- every mutation after materialization.
### Context capability owns
- accessible project contexts and user-library contexts;
- copying a user-library context into a target project when requested;
- validation that a binding is usable by the caller in the target project;
- the target context/resource IDs applied to a materialized resource.
### Identity and organization capabilities own
- caller identity;
- active organization membership and role;
- subject existence;
- membership removal and share reachability.
The Template package does not import Document, Context, Organization, or Project packages. Wiring supplies narrow ports and adapters.
### Agent and Chat capabilities own
- Assistant conversations, mode semantics, task orchestration, and model calls;
- composition of the authorized Template source with authorized Context Library sources;
- user confirmation and application of any proposed Template ChangeSet;
- conversation retention, quotas, safety policy, and model-provider failure behavior.
Template exposes only a typed, caller-authorized read/preview port and its normal CAS mutation API. Agent code never opens Template storage directly and Template never starts an agent.
## 6. Domain model
```go
package templatelibrary

import lib "github.com/gccurtis/taurus-omega/core/kernel/library"

type TemplateKind string

const (
    KindDocument    TemplateKind = "document"
    KindSpreadsheet TemplateKind = "spreadsheet"
    KindSlides      TemplateKind = "slides"
)

type Template struct {
    Asset           lib.Asset      `json:"asset"`
    Draft           Draft          `json:"draft"`
    LatestPublished *PublishedRef  `json:"latestPublished,omitempty"`
}

type Draft struct {
    SchemaVersion int             `json:"schemaVersion"`
    Slots         []ContextSlot   `json:"slots"`
    Content       ContentEnvelope `json:"content"`
    Revision      int64           `json:"revision"`
    BaseSeq       int64           `json:"baseSeq"`
}

type ContextSlot struct {
    ID          string `json:"id"`
    Name        string `json:"name"`
    Description string `json:"description"`
}

type ContentEnvelope struct {
    Kind          TemplateKind    `json:"kind"`
    SchemaVersion int             `json:"schemaVersion"`
    Data          json.RawMessage `json:"data"`
}

type PublishedRef struct {
    Version     int64     `json:"version"`
    PublishedAt time.Time `json:"publishedAt"`
}
```
The shared envelope is authoritative for identity and metadata:
```go
package library

type Asset struct {
    ID              string           `json:"id"`
    Kind            AssetKind        `json:"kind"` // template
    OwnerUserID     string           `json:"-"`
    Name            string           `json:"name"`
    Description     string           `json:"description"`
    HeadVersion     int64            `json:"headVersion"` // 0 until first publish
    MetadataVersion int64            `json:"metadataVersion"`
    Lifecycle       string           `json:"lifecycle"` // active | trashed
    Origin          *Origin          `json:"origin,omitempty"`
    CreatedAt       time.Time        `json:"createdAt"`
    UpdatedAt       time.Time        `json:"updatedAt"`
    TrashedAt       *time.Time       `json:"-"`
}
```
`Template.Asset.Kind` must be `template`. The template's resource kind remains inside the Template draft/version and is exposed as `TemplateKind`; the shared envelope does not need one top-level asset kind per resource family.
Name and description changes may arrive in the same Template ChangeSet as content changes, but persistence updates the common `library_assets` row and Template draft row atomically. `ExpectedRevision` protects the draft. A ChangeSet containing metadata operations also carries `ExpectedMetadataVersion`; successful application increments both revisions. Content-only edits leave `MetadataVersion` unchanged.
Recommended V1 bounds preserve Omega's current variable limits:
```go
const (
    MaxNameRunes          = 160
    MaxDescriptionRunes   = 2_000
    MaxContextSlots       = 64
    MaxSlotNameRunes      = 64
    MaxSlotDescription    = 512
    MaxContentBytes       = 8 << 20  // attachments remain out-of-line
    MaxOperationBytes     = 256 << 10
    MaxOperationsPerSet   = 100
    DefaultPageSize       = 50
    MaxPageSize           = 200
)
```
### Stable slots over name-based Document variables
The library uses stable slot IDs because a display-name rename must not break every prompt block:
```json
{
  "id": "slot_evidence",
  "name": "Evidence",
  "description": "The material this brief reasons over"
}
```
The Document adapter maintains a mapping inside its snapshot envelope:
```go
type DocumentTemplateSnapshot struct {
    Base          document.Base       `json:"base"`
    SlotNameByID  map[string]string   `json:"slotNameById"`
    AdapterSchema int                 `json:"adapterSchema"`
}
```
On `rename_slot`, the generic reducer changes the slot display name and calls the adapter to rewrite:
- the corresponding `ContextVariable.Name`;
- every `BlockContext.Include` entry;
- every `BlockContext.Exclude` entry.
The operation is atomic. A name collision, missing slot, or dangling block reference rejects the whole ChangeSet.
## 7. Draft ChangeSets and concurrency
```go
type ChangeSet struct {
    ID                      string      `json:"id"`
    AssetID                 string      `json:"assetId"`
    Seq                     int64       `json:"seq"`
    ClientRequestID         string      `json:"clientRequestId"`
    AuthorUserID            string      `json:"authorUserId"`
    ExpectedRevision        int64       `json:"expectedRevision"`
    ExpectedMetadataVersion *int64      `json:"expectedMetadataVersion,omitempty"`
    Operations              []Operation `json:"operations"`
    Inverse                 []Operation `json:"inverse"`
    CreatedAt               time.Time   `json:"createdAt"`
}

type Operation struct {
    Type string          `json:"type"`
    Data json.RawMessage `json:"data"`
}
```
Closed generic operation vocabulary:
```go
const (
    OpSetName         = "set_name"
    OpSetDescription  = "set_description"
    OpAddSlot         = "add_slot"
    OpUpdateSlot      = "update_slot"
    OpRemoveSlot      = "remove_slot"
    OpMoveSlot        = "move_slot"
    OpApplyContent    = "apply_content"
)
```
`apply_content` carries a kind-specific, schema-versioned operation envelope:
```json
{
  "type": "apply_content",
  "data": {
    "kind": "document",
    "schemaVersion": 1,
    "operation": {
      "type": "insert_rows",
      "data": {}
    }
  }
}
```
The service accepts a draft ChangeSet only when:
1. the caller has effective `edit`;
2. `ClientRequestID` has not already been accepted for this template and caller;
3. `ExpectedRevision` equals the current revision;
4. a ChangeSet containing `set_name` or `set_description` also matches `ExpectedMetadataVersion`;
5. all generic operations validate;
6. the registered adapter validates and reduces all content operations;
7. the resulting shared Asset envelope and Template draft satisfy every invariant.
Success appends one immutable ChangeSet and increments `Revision`. A conflict returns the authoritative revision and enough metadata for Alpha to refetch deliberately:
```json
{
  "code": "revision_conflict",
  "expected": 17,
  "actual": 19,
  "refetch": "/me/templates/tpl_123"
}
```
Draft undo and redo are compensating ChangeSets, not row deletion. Published versions are never undone.
## 8. Published versions
```go
type PublishedVersion struct {
    ID             string          `json:"id"`
    AssetID        string          `json:"assetId"`
    Version        int64           `json:"version"`
    SourceRevision int64           `json:"sourceRevision"`
    Name           string          `json:"name"`
    Description    string          `json:"description"`
    Kind           TemplateKind    `json:"kind"`
    Slots          []ContextSlot   `json:"slots"`
    Content         ContentEnvelope `json:"content"`
    ContentSHA256   string          `json:"contentSha256"`
    PublishedBy     string          `json:"publishedBy"`
    PublishedAt     time.Time       `json:"publishedAt"`
}
```
Publishing:
1. requires effective `edit`;
2. carries `ExpectedRevision` and `ClientRequestID`;
3. validates and sanitizes the complete draft through the adapter;
4. rejects any retained project binding or inaccessible external reference;
5. computes a canonical content hash;
6. inserts the next immutable version;
7. advances the aggregate revision and `LatestPublished`;
8. emits a private library audit event.
The same content may be republished deliberately. The server can return `sameContentAsVersion` as a warning, but it must not silently change the requested action.
Recipients with `use` see only published versions. Owners and editors may additionally see the draft and its revision status.
## 9. Sharing and effective access
Template reuses the common Library permission vocabulary and evaluator:
```go
type TemplatePermissions struct {
    library.EffectivePermissions
    CanPublish bool   `json:"canPublish"` // exactly CanEdit in V1
    Via        string `json:"via"`        // owner, user_grant, organization_grant
}
```
`library.Grant` carries `AssetID`, user/organization subject, `use | edit`, grantor, and timestamps. The Template service asks the shared Library policy service for permissions; it does not read or interpret grants independently.
Rules:
- the owner always has every permission;
- `use` reads published versions, previews, and materializes;
- `edit` includes use, reads and changes the draft, and publishes;
- edit does **not** grant permission to reshare or manage lifecycle; ownership transfer is not supported in V1;
- when several grants apply, the highest level wins;
- organization grants apply only while the caller is an active organization member;
- removing a grant prevents future access but does not revoke already materialized project copies;
- no public links or anonymous access exist in V1.
The API never trusts `ownerUserId`, effective permissions, or caller organization IDs supplied in a body. They come from the authenticated access context and shared Library/identity ports.
## 10. Adapter contracts
```go
type KindAdapter interface {
    Kind() TemplateKind

    NewBlank(ctx context.Context, req NewBlankRequest) (ContentEnvelope, []ContextSlot, error)

    Capture(
        ctx context.Context,
        source ResourceSnapshot,
    ) (ContentEnvelope, []ContextSlot, []Warning, error)

    ValidateAndSanitize(
        ctx context.Context,
        content ContentEnvelope,
        slots []ContextSlot,
    ) (ContentEnvelope, []Warning, error)

    Apply(
        ctx context.Context,
        content ContentEnvelope,
        slots []ContextSlot,
        op ContentOperation,
    ) (ContentEnvelope, []Operation, error)

    RewriteSlot(
        ctx context.Context,
        content ContentEnvelope,
        oldSlot ContextSlot,
        newSlot ContextSlot,
    ) (ContentEnvelope, error)

    Preview(
        ctx context.Context,
        content ContentEnvelope,
        slots []ContextSlot,
        bindings []ResolvedBinding,
        mode PreviewMode,
    ) (PreviewProjection, error)

    PlanNew(
        ctx context.Context,
        published PublishedVersion,
        target TargetProject,
        bindings []ResolvedBinding,
    ) (NewResourcePlan, error)

    PlanInsert(
        ctx context.Context,
        published PublishedVersion,
        target ExistingResource,
        bindings []ResolvedBinding,
    ) (ResourceChangePlan, error)
}
```
Wiring owns the registry:
```go
type AdapterRegistry interface {
    ForKind(kind TemplateKind) (KindAdapter, bool)
}
```
The Template service must return a typed `kind_not_enabled` response when a persisted kind has no active adapter. It must never decode another capability's snapshot itself.
### Document adapter
Document V1:
- captures Document structure, marks, styles, prompt blocks, and declared context variables;
- removes project identity, access scope, creator-only fields, comments, collaboration presence, activity, history, current bindings, generated citations tied to source IDs, and transient editor state;
- rejects or copies external assets according to an explicit allowlist;
- validates `TemplateInfo`, variable bounds, `BlockContext`, and the normal Document invariants;
- previews through the real Document renderer/projection rather than a second simplified outline;
- maps library slot IDs to unique Document variable names;
- assigns fresh row, block, atom, variable, comment-anchor, and embedded-object IDs;
- sets `TemplateInfo.IsTemplate = false` on a materialized project Document unless the user is explicitly promoting into the project template catalog;
- emits ordinary Document operations for insertion.
No Document Store is imported into the Template package. A wiring adapter may import both packages and translate the plans.
## 11. Context slots and binding resolution
Library originals store declarations, not project bindings:
```go
type BindingInput struct {
    SlotID string           `json:"slotId"`
    Source BindingSourceRef `json:"source"`
}

type BindingSourceRef struct {
    Kind string `json:"kind"` // project_context, library_context, project_resource
    ID   string `json:"id"`
}

type ResolvedBinding struct {
    SlotID          string       `json:"slotId"`
    ProjectContext  *ResourceRef `json:"projectContext,omitempty"`
    ProjectResource *ResourceRef `json:"projectResource,omitempty"`
}
```
Binding resolution is target-project aware:
- a `project_context` or `project_resource` must belong to the target project and be accessible to the caller;
- a `library_context` is copied into the target project through a Context materializer port, then the fresh project context ID is bound;
- omitted slots remain unbound;
- bindings are applied only to the new or target resource;
- the library template, published version, and source library context remain unchanged.
Duplicate slot inputs, unknown slots, inaccessible sources, incompatible resource kinds, or an unresolvable library context reject the request before any resource mutation.
## 12. Preview contract
```go
type PreviewMode string

const (
    PreviewPrompt  PreviewMode = "prompt"
    PreviewContent PreviewMode = "content"
)

type PreviewRequest struct {
    Version  *int64         `json:"version,omitempty"` // nil means editable draft
    Mode     PreviewMode    `json:"mode"`
    Bindings []BindingInput `json:"bindings,omitempty"`
}

type PreviewProjection struct {
    Kind          TemplateKind    `json:"kind"`
    Renderer      string          `json:"renderer"`
    SchemaVersion int             `json:"schemaVersion"`
    Data          json.RawMessage `json:"data"`
    Warnings      []Warning       `json:"warnings,omitempty"`
}
```
- Prompt mode renders the authored template and its empty slot labels.
- Content mode resolves the provided contexts and renders what each prompt block would read.
- Preview never persists bindings or runs prompt blocks.
- A recipient with `use` can preview only a published version.
- An owner/editor can preview the current draft.
- Preview output is a projection, not editable source JSON.
- Cache keys include template ID, version or revision, mode, binding hash, caller access scope, and renderer version.
## 13. Assistant integration
The Alpha screen's Assistant is part of V1 integration. It does not belong inside the Template capability, but it must have a real, typed, authorized source rather than a fixture or an unscoped snapshot read.
Template exposes a narrow port:
```go
type AssistantTemplateRef struct {
    AssetID         string `json:"assetId"`
    PublishedVersion *int64 `json:"publishedVersion,omitempty"`
    DraftRevision    *int64 `json:"draftRevision,omitempty"`
    PreviewMode      PreviewMode `json:"previewMode"`
}

type AssistantTemplateSource struct {
    AssetID          string               `json:"assetId"`
    Version          string               `json:"version"` // published:4 or draft:23
    Name             string               `json:"name"`
    Description      string               `json:"description"`
    Kind             TemplateKind         `json:"kind"`
    Slots            []ContextSlot        `json:"slots"`
    Content          AssistantProjection  `json:"content"`
    Warnings         []Warning            `json:"warnings,omitempty"`
    AccessEpoch      string               `json:"accessEpoch"`
}

type AssistantProjection struct {
    SchemaVersion int             `json:"schemaVersion"`
    Data          json.RawMessage `json:"data"` // adapter-owned, bounded, non-executable
}

type AssistantTemplateReader interface {
    ReadForAssistant(
        ctx context.Context,
        actor Actor,
        ref AssistantTemplateRef,
    ) (AssistantTemplateSource, error)
}
```
Authorization rules:
- a `use` recipient may read an exact published version only;
- the owner or an `edit` recipient may opt into the current draft at an exact revision;
- the reader reauthorizes on every turn, not only when the chat is created;
- inaccessible assets are indistinguishable from absent assets;
- draft and published caches include the Library access epoch and adapter renderer/schema version;
- the projection includes only sanitized Template content and slot declarations, never grants, hidden usage, project IDs, raw Store rows, or source bindings.
The kind adapter produces `AssistantProjection` from the same validated snapshot used by Preview. For a Document, it may contain a bounded structural outline, authored text, prompt-block text, and slot references. It is context supplied to a model, not executable instructions; descriptions and template text remain untrusted material.
Agent/Chat wiring composes:
```go
type TemplateAssistantScope struct {
    Template AssistantTemplateSource
    Contexts []contextlibrary.AuthorizedAssistantSource
}
```
The Template Library does not call a model and does not own conversation state. The user-level Agent/Chat boundary:
1. authenticates the caller;
2. asks Template for the exact authorized source;
3. asks Context Library for each separately authorized Context source;
4. applies model quotas and safety policy;
5. records the conversation outside Template;
6. returns a typed answer or a proposed Template ChangeSet.
Ask is read-only. Plan may return a structured proposal. Action may submit that proposal only through the normal Template ChangeSet API with `ExpectedRevision`, `ExpectedMetadataVersion` when relevant, idempotency, adapter validation, and the UI's confirmation policy. No agent receives a mutation bypass.
The Assistant source selector preserves Alpha's current semantics:
- **This template:** exact draft or published version, structure, prompt blocks, and context slots;
- **Your contexts:** explicitly selected, caller-authorized Context Library versions;
- no implicit current project, open Document, project Knowledge lattice, or private source project.
## 14. Materialization
```go
type Destination struct {
    Mode       string       `json:"mode"` // new_resource, insert_existing
    Resource   *ResourceRef `json:"resource,omitempty"`
    Anchor     *TargetRef   `json:"anchor,omitempty"`
}

type MaterializeRequest struct {
    ClientRequestID       string         `json:"clientRequestId"`
    PublishedVersion      int64          `json:"publishedVersion"`
    TargetProjectID       string         `json:"targetProjectId"`
    Destination           Destination    `json:"destination"`
    NewResourceName       string         `json:"newResourceName,omitempty"`
    ExpectedTargetRevision *int64        `json:"expectedTargetRevision,omitempty"`
    Bindings              []BindingInput `json:"bindings,omitempty"`
}

type MaterializeReceipt struct {
    ID               string       `json:"id"`
    TemplateID       string       `json:"templateId"`
    PublishedVersion int64        `json:"publishedVersion"`
    TargetProjectID  string       `json:"targetProjectId"`
    Resource         ResourceRef  `json:"resource"`
    ResourceRevision int64        `json:"resourceRevision"`
    ChangeSetID      string       `json:"changeSetId,omitempty"`
    Warnings         []Warning    `json:"warnings,omitempty"`
    CreatedAt        time.Time    `json:"createdAt"`
}
```
### New resource
1. Validate caller `use`, template version, target-project membership, kind enablement, name, and bindings.
2. Resolve/copy context bindings.
3. Ask the adapter for a new-resource plan with fresh IDs.
4. Create the resource through the resource writer port.
5. Persist the materialization receipt.
6. Return the resource ID so Alpha can enter the target project and open it.
### Insert into existing
1. Validate caller `use`, target-project membership, target-resource access, kind compatibility, anchor, target revision, and bindings.
2. Ask the adapter for kind-native operations with fresh IDs and conflict-safe anchors.
3. Submit one ordinary resource ChangeSet using the caller and `ExpectedTargetRevision`.
4. Persist the materialization receipt with the resulting ChangeSet ID.
5. Return a reveal target so Alpha can open the resource and focus the inserted content.
Insertion is atomic at the resource ChangeSet boundary. A revision conflict returns `409`; it does not partially insert, consume the idempotency key, or mutate the template.
### Idempotency
`ClientRequestID` is unique for `(caller, template, operation kind)`. A retry:
- returns the original success receipt if the first request succeeded;
- reports the same terminal failure for a completed failed job;
- reports in-progress status when an async materialization is still running;
- never creates a second resource or second insertion ChangeSet.
## 15. HTTP API
The browser routes remain `/library/templates` and `/library/templates/:templateID`; `[id]` is only the frontend route-file segment. The signed-in, project-independent backend API lives under `/me/templates`; the examples below omit the deployment's common API/version prefix. Every `/me/templates` route requires an authenticated user but not a selected project.
### List and read
```javascript
GET /me/templates?query=research&kind=document&owner=user_123&access=all&limit=50&cursor=...
GET /me/templates/:templateID
GET /me/templates/:templateID/versions
GET /me/templates/:templateID/versions/:version
```
Representative summary:
```json
{
  "id": "tpl_123",
  "name": "Research brief",
  "description": "Question, sources, findings, and summary.",
  "kind": "document",
  "owner": {"id": "usr_1", "name": "Kyr'Qota"},
  "effectivePermissions": {
    "level": "edit",
    "canUse": true,
    "canEdit": true,
    "canPublish": true,
    "canShare": false,
    "canDelete": false,
    "via": "organization_grant"
  },
  "latestPublished": {"version": 4, "publishedAt": "2026-07-29T16:00:00Z"},
  "draftRevision": 23,
  "updatedAt": "2026-07-29T16:03:00Z"
}
```
`draftRevision` is omitted from a use-only response.
### Create, capture, edit, and publish
```javascript
POST /me/templates
POST /me/templates/captures
POST /me/templates/:templateID/changes
POST /me/templates/:templateID/undo
POST /me/templates/:templateID/redo
POST /me/templates/:templateID/publish
POST /me/templates/:templateID/duplicate
DELETE /me/templates/:templateID
POST /me/templates/:templateID/restore
```
`DELETE` is recoverable trash, never hard deletion. Trash and restore are owner-only, require `expectedMetadataVersion` and `clientRequestId` (or equivalent concurrency/idempotency headers), preserve published versions and protected lineage, and increment `metadataVersion`.
Create blank:
```json
{
  "clientRequestId": "req_01",
  "kind": "document",
  "name": "Research brief",
  "description": ""
}
```
Capture an accessible project resource:
```json
{
  "clientRequestId": "req_02",
  "source": {
    "projectId": "prj_7",
    "resource": {"kind": "document", "id": "doc_42"},
    "revision": 19
  },
  "name": "Research brief",
  "description": "Reusable evidence brief."
}
```
`OwnerUserID` is always the authenticated caller. Capture creates a sanitized independent draft; it does not convert or relabel the source resource.
### Preview
```javascript
POST /me/templates/:templateID/preview
```
POST is intentional because ephemeral binding inputs may be large or sensitive and should not enter URLs or intermediary logs.
The Agent/Chat composition root calls the same capability through `AssistantTemplateReader`. If an HTTP boundary is needed for a separately deployed user-level orchestrator, expose an internal authenticated endpoint rather than returning raw snapshots:
```javascript
POST /internal/library/templates/:templateID/assistant-source
```
The request pins a published version or authorized draft revision and Preview mode. The endpoint requires service identity plus end-user delegation and repeats normal Library authorization.
### Shares
```javascript
GET    /me/templates/:templateID/shares
PUT    /me/templates/:templateID/shares/:subjectKind/:subjectID
DELETE /me/templates/:templateID/shares/:subjectKind/:subjectID
```
```json
{
  "clientRequestId": "req_share_1",
  "expectedMetadataVersion": 7,
  "permission": "use"
}
```
These routes are Template-shaped facades over the shared `library_asset_grants` service and table. They do not create `library_template_shares` or a Template-specific ACL evaluator.
The public grant identity is `(subjectKind, subjectID)`. `PUT` creates or replaces `permission`; `DELETE` removes it and carries `expectedMetadataVersion` plus `clientRequestId` in the body or the equivalent `If-Metadata-Version` and `Idempotency-Key` headers.
### Materialize
```javascript
POST /me/templates/:templateID/materializations
GET  /me/library-materializations/:materializationID
GET  /me/library-jobs/:jobID
```
The POST may return:
- `201` with a synchronous receipt;
- `202` with a status URL for a large copy;
- `409 revision_conflict`;
- `422 incompatible_destination`;
- `403` for inaccessible template, target project, target resource, or binding source.
Externally, inaccessible template IDs return the same not-found projection as nonexistent IDs unless the caller already possesses a valid grant and loses it mid-operation.
## 16. Persistence
SQLite remains the single-cell persistence target. The common Library migration is created once and reused by Context, Template, and Personality. Template does **not** create `library_templates` as a second asset envelope and does **not** create `library_template_shares`.
The common envelope owns user ownership, metadata, lifecycle, grants, origin/lineage, usage, and generic idempotency receipts:
```sql
CREATE TABLE library_assets (
    id                    TEXT PRIMARY KEY,
    kind                  TEXT NOT NULL
        CHECK (kind IN ('personality', 'context', 'template')),
    owner_user_id         TEXT NOT NULL,
    name                  TEXT NOT NULL,
    description           TEXT NOT NULL DEFAULT '',
    head_version          INTEGER NOT NULL DEFAULT 0,
    metadata_version      INTEGER NOT NULL DEFAULT 1,
    lifecycle             TEXT NOT NULL DEFAULT 'active'
        CHECK (lifecycle IN ('active', 'trashed')),
    origin_json           BLOB,
    created_at            TEXT NOT NULL,
    updated_at            TEXT NOT NULL,
    trashed_at            TEXT,
    FOREIGN KEY (owner_user_id) REFERENCES users(id)
);

CREATE INDEX library_assets_owner_kind_updated
    ON library_assets(owner_user_id, kind, updated_at DESC, id DESC);

CREATE INDEX library_assets_kind_name
    ON library_assets(kind, name COLLATE NOCASE, id);

CREATE TABLE library_asset_grants (
    id                    TEXT PRIMARY KEY,
    asset_id              TEXT NOT NULL,
    subject_kind          TEXT NOT NULL
        CHECK (subject_kind IN ('user', 'organization')),
    subject_id            TEXT NOT NULL,
    permission            TEXT NOT NULL
        CHECK (permission IN ('use', 'edit')),
    granted_by            TEXT NOT NULL,
    created_at            TEXT NOT NULL,
    updated_at            TEXT NOT NULL,
    UNIQUE (asset_id, subject_kind, subject_id),
    FOREIGN KEY (asset_id) REFERENCES library_assets(id) ON DELETE CASCADE,
    FOREIGN KEY (granted_by) REFERENCES users(id)
);

CREATE INDEX library_grants_subject
    ON library_asset_grants(subject_kind, subject_id, asset_id);

CREATE TABLE library_asset_lineage (
    id                    TEXT PRIMARY KEY,
    asset_id              TEXT NOT NULL,
    relation              TEXT NOT NULL
        CHECK (relation IN ('captured_from_project', 'duplicated_from_library')),
    source_kind           TEXT NOT NULL,
    source_id             TEXT NOT NULL,
    source_version        TEXT NOT NULL,
    governance_decision_id TEXT,
    created_by            TEXT NOT NULL,
    created_at            TEXT NOT NULL,
    FOREIGN KEY (asset_id) REFERENCES library_assets(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE TABLE library_asset_usage (
    id                    TEXT PRIMARY KEY,
    materialization_id    TEXT NOT NULL UNIQUE,
    asset_id              TEXT NOT NULL,
    source_version        INTEGER NOT NULL,
    target_project_id     TEXT NOT NULL,
    target_kind           TEXT NOT NULL,
    target_id             TEXT NOT NULL,
    created_by            TEXT NOT NULL,
    created_at            TEXT NOT NULL,
    FOREIGN KEY (materialization_id) REFERENCES library_materializations(id),
    FOREIGN KEY (asset_id) REFERENCES library_assets(id),
    FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE TABLE library_mutation_receipts (
    actor_user_id         TEXT NOT NULL,
    client_request_id     TEXT NOT NULL,
    operation_kind        TEXT NOT NULL,
    target_id             TEXT NOT NULL,
    request_hash          TEXT NOT NULL,
    result_json           BLOB NOT NULL,
    created_at            TEXT NOT NULL,
    PRIMARY KEY (actor_user_id, client_request_id)
);

CREATE TABLE library_jobs (
    id                 TEXT PRIMARY KEY,
    actor_user_id      TEXT NOT NULL,
    asset_kind         TEXT NOT NULL
        CHECK (asset_kind IN ('personality','context','template')),
    operation_kind     TEXT NOT NULL
        CHECK (operation_kind IN ('capture','materialize','duplicate')),
    source_scope_kind  TEXT NOT NULL
        CHECK (source_scope_kind IN ('project','library')),
    source_scope_id    TEXT NOT NULL,
    source_id          TEXT NOT NULL,
    source_version     TEXT NOT NULL,
    target_scope_kind  TEXT NOT NULL
        CHECK (target_scope_kind IN ('user_library','project')),
    target_scope_id    TEXT NOT NULL,
    client_request_id  TEXT NOT NULL,
    request_hash       TEXT NOT NULL,
    state              TEXT NOT NULL
        CHECK (state IN ('queued','running','validating','succeeded','failed','canceled')),
    progress_json      BLOB NOT NULL,
    result_json        BLOB,
    error_code         TEXT,
    created_at         TEXT NOT NULL,
    updated_at         TEXT NOT NULL,
    UNIQUE (actor_user_id, client_request_id),
    FOREIGN KEY (actor_user_id) REFERENCES users(id)
);

CREATE TABLE library_template_drafts (
    asset_id              TEXT PRIMARY KEY,
    template_kind         TEXT NOT NULL
        CHECK (template_kind IN ('document', 'spreadsheet', 'slides')),
    slots_json            BLOB NOT NULL,
    content_schema        INTEGER NOT NULL,
    content_json          BLOB NOT NULL,
    revision              INTEGER NOT NULL,
    base_seq              INTEGER NOT NULL,
    FOREIGN KEY (asset_id) REFERENCES library_assets(id) ON DELETE CASCADE
);

CREATE TABLE library_template_changesets (
    id                    TEXT PRIMARY KEY,
    asset_id              TEXT NOT NULL,
    seq                   INTEGER NOT NULL,
    client_request_id     TEXT NOT NULL,
    author_user_id        TEXT NOT NULL,
    expected_revision     INTEGER NOT NULL,
    expected_metadata_version INTEGER,
    operations_json       BLOB NOT NULL,
    inverse_json          BLOB NOT NULL,
    created_at            TEXT NOT NULL,
    UNIQUE (asset_id, seq),
    UNIQUE (asset_id, author_user_id, client_request_id),
    FOREIGN KEY (asset_id) REFERENCES library_assets(id) ON DELETE CASCADE,
    FOREIGN KEY (author_user_id) REFERENCES users(id)
);

CREATE INDEX library_template_changesets_tail
    ON library_template_changesets(asset_id, seq DESC);

CREATE TABLE library_template_versions (
    id                    TEXT PRIMARY KEY,
    asset_id              TEXT NOT NULL,
    version               INTEGER NOT NULL,
    source_revision       INTEGER NOT NULL,
    source_metadata_version INTEGER NOT NULL,
    name                  TEXT NOT NULL,
    description           TEXT NOT NULL,
    template_kind         TEXT NOT NULL,
    slots_json            BLOB NOT NULL,
    content_schema        INTEGER NOT NULL,
    content_json          BLOB NOT NULL,
    content_sha256        TEXT NOT NULL,
    published_by          TEXT NOT NULL,
    published_at          TEXT NOT NULL,
    UNIQUE (asset_id, version),
    FOREIGN KEY (asset_id) REFERENCES library_assets(id) ON DELETE CASCADE,
    FOREIGN KEY (published_by) REFERENCES users(id)
);

CREATE TABLE library_materializations (
    id                 TEXT PRIMARY KEY,
    job_id             TEXT UNIQUE,
    actor_user_id      TEXT NOT NULL,
    asset_id           TEXT NOT NULL,
    source_version     INTEGER NOT NULL,
    target_project_id  TEXT NOT NULL,
    destination_mode   TEXT NOT NULL
        CHECK (destination_mode IN ('new_resource','insert_existing','project_copy')),
    target_kind        TEXT,
    target_id          TEXT,
    client_request_id  TEXT NOT NULL,
    request_hash       TEXT NOT NULL,
    state              TEXT NOT NULL
        CHECK (state IN ('queued','running','validating','succeeded','failed','canceled')),
    result_json        BLOB,
    warnings_json      BLOB,
    error_code         TEXT,
    created_at         TEXT NOT NULL,
    completed_at       TEXT,
    UNIQUE (actor_user_id, client_request_id),
    FOREIGN KEY (job_id) REFERENCES library_jobs(id),
    FOREIGN KEY (actor_user_id) REFERENCES users(id),
    FOREIGN KEY (asset_id) REFERENCES library_assets(id)
);
```
In the shared envelope, `head_version = 0` means that an owner/editor draft exists but no version has been published. `use` recipients cannot discover or read such an asset; publishing version 1 advances the head in the same transaction that commits the immutable version.
`library_assets.origin_json` is the sanitized head projection used by the Details panel. `library_asset_lineage` is the durable source record. Both are authorization-filtered at read time. `library_materializations` is the canonical cross-capability operation/receipt record. `library_asset_usage` is an append-only successful-materialization event keyed to it; repeated insertion of the same Template or a later version into the same target is valid and creates another event. It supplies caller-visible “Used in” but never grants access to a target project. `library_jobs` is the common durable record for asynchronous work. Status is exposed through `/me/library-materializations/:materializationID` and, when a job exists, `/me/library-jobs/:jobID`. Fast operations may complete inline with a materialization and mutation receipt but no job row.
`slots_json` and `content_json` are the folded Template draft projection. Metadata and draft ChangeSet acceptance occur in one transaction:
```sql
BEGIN IMMEDIATE;
SELECT a.metadata_version, d.revision
FROM library_assets a
JOIN library_template_drafts d ON d.asset_id = a.id
WHERE a.id = ? AND a.kind = 'template' AND a.lifecycle = 'active';
-- reject unless d.revision == ExpectedRevision
-- metadata operations also require a.metadata_version == ExpectedMetadataVersion
INSERT INTO library_template_changesets (...);
UPDATE library_template_drafts
SET revision = revision + 1,
    slots_json = ?,
    content_schema = ?,
    content_json = ?
WHERE asset_id = ? AND revision = ?;
-- only when the ChangeSet contains metadata operations:
UPDATE library_assets
SET name = ?,
    description = ?,
    metadata_version = metadata_version + 1,
    updated_at = ?
WHERE id = ? AND metadata_version = ?;
COMMIT;
```
The store checks every applicable final `UPDATE` row count. Zero rows is a conflict, never success. A transaction that updates Template metadata writes the common envelope and Template draft/ChangeSet together; no observer sees half of the mutation.
## 17. Invariants
The service and store enforce:
1. template ID, owner user ID, kind, and slot IDs are non-empty and stable;
2. exactly one user owns a template;
3. `Template.Asset.Kind == library.KindTemplate` and `Template.Draft.Content.Kind` is a registered `TemplateKind`;
4. every slot ID is unique;
5. every normalized slot name is unique;
6. every content slot reference resolves to one declared slot;
7. no published snapshot contains a bound source-project context or resource;
8. no snapshot contains credentials, session state, comments, activity, access grants, or source history;
9. a version number is unique and monotonically increasing per template;
10. a published row is immutable;
11. only a registered adapter may accept or produce a kind snapshot;
12. list and read results contain only templates the caller can reach;
13. use-only callers never receive draft snapshot data;
14. the owner cannot grant or revoke ownership through the share API;
15. deletion is soft and immediately removes list/read reach while retaining audit and idempotency receipts;
16. materialization always names a published version and a target project;
17. insert destination kind matches the template kind;
18. every copied resource-local ID is freshly generated;
19. successful insertion records an ordinary resource ChangeSet ID;
20. repeated `ClientRequestID` with a different request hash returns `409 idempotency_mismatch`.
## 18. Backend implementation plan
### Phase B0 — Repair the existing Omega project-template boundary
- Replace caller-blind `Templates(projectID)` and `CreateFromTemplate(projectID, templateID)` entry points with a caller-aware `ProjectTemplateScope`.
- Apply the normal Resource access resolver inside both service methods. Filter `GET /documents/templates`; authorize the source named by `POST /documents {fromTemplateId}` even though the source ID is in the body rather than the route.
- Correct Document duplication so `clearBindings` clears both `BoundContext` and `BoundResource`.
- Add the four adversarial tests named in the Omega evidence section. Do not connect capture or materialization to the old methods.
- Freeze Template Draft, ChangeSet, published-version, preview, materialization, typed Assistant-read, and export-policy contracts.
- Define error codes: `not_found`, `forbidden`, `revision_conflict`, `metadata_conflict`, `idempotency_mismatch`, `kind_not_enabled`, `invalid_snapshot`, `invalid_slot`, `unpublished`, `incompatible_destination`, `target_conflict`, `copy_too_large`, `export_denied`, `export_approval_required`, and `governance_unknown`.
- Add request-size, snapshot-size, operation-count, and slot-count limits.
### Phase B1 — Shared Library kernel and Template reducers
- Establish the common `library.Asset`, `library.Grant`, `library.EffectivePermissions`, access-scope, redaction, lineage, usage, lifecycle, and idempotency services once for Context, Template, and Personality.
- Add `core/capability/templatelibrary` for Template Draft, slots, ChangeSets, immutable versions, previews, and materialization state only.
- Implement Template Draft validation, pure operation reduction, inverse generation, and compensating undo/redo.
- Add idempotent create, duplicate, change, and publish service methods. Delegate list/read reachability, metadata lifecycle, grants, and effective-permission evaluation to the shared Library kernel.
- Keep every cross-capability dependency behind a port.
### Phase B2 — SQLite storage and folding
- Apply the common Library migration once—including `library_materializations`—then add the three Template-specific tables: `library_template_drafts`, `library_template_changesets`, and `library_template_versions`.
- Implement draft-revision CAS, shared metadata-version CAS, idempotency lookup, draft folding, immutable version insert, keyset list projection, soft delete, and receipt persistence.
- Route share mutations through the common `library_asset_grants` store and permission evaluator; do not add a Template ACL table or evaluator.
- Use one transaction per aggregate mutation. Metadata-bearing Template changes update the common Asset row and Template rows atomically.
- Preserve ChangeSets after folding; folding changes `BaseSeq`, not history identity.
- Add integrity checks for version hashes and duplicate submissions.
### Phase B3 — Document adapter
- Expose or wrap the existing Document snapshot validation and pure reducer behind a wiring adapter.
- Implement capture sanitization with an explicit assertion that both `BoundContext` and `BoundResource` are absent.
- Implement slot-ID/name mapping and atomic rename rewriting.
- Implement the real Document preview and Assistant projections.
- Implement deterministic fresh-ID remapping.
- Implement `PlanNew` and `PlanInsert` against the repaired, caller-aware Document boundary.
- Verify that insertion operations satisfy ordinary Document validation.
### Phase B4 — Export governance, Context, and Resource composition
- Add `PersonalLibraryExportPolicyPort` and a source-project governance resolver before exposing capture.
- Add the Project-to-organization relationship or another authoritative governing-scope lookup. Because Omega's current Project has no organization ID, an unresolved organization or policy decision must return `governance_unknown` and fail closed.
- Reauthorize the source Resource and the export decision before commit; persist a safe policy decision/approval audit record.
- Add target-project access, Resource metadata/read/create/change, context-binding resolution, and library-Context copy ports.
- Compose these in wiring; do not import Project, Resource, or Context capabilities into Template.
- Persist materialization receipts only around an idempotent orchestration boundary.
- Add synchronous limits and a durable async status path for large copies.
### Phase B5 — Project-independent transport
- Add the `/me/templates` endpoints behind authenticated, non-project middleware.
- Resolve source-project access and export governance separately for capture; resolve target-project access separately for materialization.
- Return shared effective permissions and redacted lineage/usage projections.
- Add request IDs, audit fields, structured errors, ETags/revisions, and pagination cursors.
### Phase B6 — Assistant composition
- Implement `AssistantTemplateReader` as an authorized service adapter over Template read/preview, never raw Store access.
- Require an exact published version for `use`, or an exact draft revision for `edit`/owner, and reauthorize on every turn.
- Wire Agent/Chat to combine that typed Template source with separately authorized Context sources.
- Submit any accepted Assistant edit through the normal Template ChangeSet endpoint with CAS, idempotency, validation, and confirmation.
### Phase B7 — Observability and operations
- Metrics: list latency, preview latency, Assistant-source latency, CAS conflicts, publish count, materialization duration, copy size, adapter failures, permission denials, governance denials, and idempotent replay count.
- Structured logs: template ID, kind, operation, caller ID hash, target project ID hash, version, policy-decision ID, result, and duration; never snapshot bodies or binding content.
- Traces across Library → Template → export policy → Context → Resource adapter calls.
- Alerts for repeated adapter corruption, receipt/result mismatches, authorization-filter failures, governance resolver failures, and failed async jobs.
## 19. Frontend implementation plan
### Phase F0 — Route and client foundation
- Keep `/library/templates` as the collection route.
- Add `/library/templates/[id]` as the frontend route file for the stable `/library/templates/:templateID` asset URL.
- Make the collection route select or redirect to the first accessible template, or render a real empty state.
- Replace `TEMPLATES`, `CONTEXTS`, `OWNERS`, and `PROJECTS` fixtures with typed clients.
- Model loading, empty, forbidden, deleted, stale-version, offline, and retry states.
- Remove the Templates Mock badge only after the real list and read endpoints are active.
### Phase F1 — List, permissions, and Details
- Add debounced server search, owner-user filtering, shared-with-me filtering, kind filtering, and cursor pagination.
- Keep the rail's names-only row grammar.
- Show organization participation as sharing provenance, not ownership; the canonical owner is always a user.
- Drive Edit, Share, Duplicate, Delete, and Publish visibility from server `effectivePermissions`.
- Bind name and description to a local draft and submit CAS ChangeSets.
- Add dirty state, save status, validation messages, and conflict recovery.
- Show only caller-visible provenance and Used-in projects.
### Phase F2 — Editor and slots
- Open Edit in the real kind editor, mounted against a Template draft runtime rather than a project Resource runtime.
- Reuse the same editor renderer and kind adapter.
- Wire add, rename, describe, reorder, and remove slot operations.
- Preserve Prompt/Content modes.
- Keep chosen preview bindings local until the user materializes.
- Reset preview and Assistant state when the selected template ID changes.
### Phase F3 — Publish and version history
- Add Save draft and Publish affordances with clear distinction.
- Show current draft revision, latest published version, publish warnings, and version history.
- Allow use recipients to choose among published versions when materializing.
- Never expose unpublished content to use-only recipients.
### Phase F4 — Bring into project
`Bring into project` opens a focused flow rather than immediately mutating:
1. select or confirm target project;
2. select published version;
3. choose New resource or Insert into existing;
4. select a compatible target resource and anchor when inserting;
5. fill optional context slots;
6. review warnings and destination name;
7. submit once with a generated `ClientRequestID`;
8. follow a `202` status when necessary;
9. enter the target project, open the resulting resource tab, and reveal the inserted target.
The last active project may be preselected but is never hidden from the confirmation.
### Phase F5 — Real Assistant lens
- Replace the Assistant fixture with the normal Agent/Chat client.
- Pin each conversation turn to the exact selected Template asset and published version or draft revision.
- Let the caller explicitly add authorized user-library Contexts; do not infer project Context from stale workspace state.
- Reset or branch the conversation when the Template, version/revision, or selected Context scope changes.
- Render Ask answers and Plan proposals without mutation. Require an explicit confirmation before Action submits a normal Template ChangeSet.
- Handle lost access, deleted assets, revision conflicts, quota failures, and unsupported kind projections without revealing hidden metadata.
### Phase F6 — Retire duplicate surfaces
- Replace the document editor's separate mock Template catalog with the same library client.
- “Add template” in an editor invokes `insert_existing`.
- “Make a template” invokes capture from the current resource revision.
- Keep project-scoped Omega templates working during migration, but label the two sources honestly until the library cutover finishes.
- Remove `mock-templates.ts` after all project/editor paths use the canonical library.
## 20. Security and privacy
### Authorization
- Every service read signature includes caller identity and active organization memberships.
- Shared Library owner and grant evaluation occurs in the reusable Library access service, not optionally in handlers or independently inside Template.
- The repaired Omega `GET /documents/templates` filters each result through the normal Resource resolver, and body-supplied `fromTemplateId` receives the same source check before copy.
- Target project and target resource checks are repeated inside materialization.
- A share to an organization does not reveal the template to former or suspended members.
- Server-side checks remain authoritative even when Alpha hides a control.
### Project capture and export governance
- Reading or editing a project Resource is not, by itself, permission to copy it into a user-owned library.
- Capture requires a separately evaluated personal-library export decision for the exact project, Resource, revision, destination owner, current grantee audience, and classification.
- Omega's current Project does not identify a governing organization. Until an authoritative relationship is available, an organization-governed or otherwise policy-relevant capture returns `governance_unknown`; the system does not guess from active organization, creator, or project owner.
- `deny`, `approval_required` without a valid approval, `unknown`, and policy-store failure all fail closed before any snapshot is persisted.
- Source Resource access and policy are checked once before extraction and again immediately before commit. Async work repeats both checks before every protected phase.
- Sharing an exported Template or materializing it into another organization re-evaluates any recipient/destination restriction recorded with its classification.
- Audit records contain IDs, revisions, decision metadata, and hashes—not source content, denied names, secrets, or binding values.
### Snapshot sanitization
The Document adapter strips or rejects:
- source project and organization IDs;
- access-control lists and project sharing state;
- comments, mentions, notifications, and collaborator identity;
- activity, ChangeSets, undo lineage, sessions, caret, and selections;
- bound context and resource IDs;
- source-generated citations or anchors that cannot survive copying;
- secret values, connector tokens, signed URLs, and transient upload paths;
- unsupported embedded objects that cannot be safely copied.
The Document adapter must clear both concrete binding representations: `ContextVariable.BoundContext` is set to `""` and `ContextVariable.BoundResource` is set to `nil`. Tests inspect both fields after capture, duplicate, publish, and materialization.
Out-of-line assets are copied into user-owned library storage or rejected with a visible warning. A library snapshot never depends on continued access to the source project.
### Projection privacy
- `Used in` is computed only from materializations into projects the caller can currently access.
- Source project name is shown only when the caller can access it; otherwise the UI says “Copied from a project.”
- A use-only recipient need not receive the complete share-recipient list; the owner receives the management view.
- Search never exposes names or snippets of inaccessible templates.
- Preview cache entries are access-scoped and cannot be shared across callers merely because a content hash matches.
### Content safety
- Snapshot and operation JSON use strict decoders with unknown-field rejection where practical.
- Rich-text marks, links, fonts, colors, and embedded URLs reuse the resource capability's validation.
- Preview HTML is escaped/sanitized and rendered under the same content-security policy as the editor.
- Assistant prompts and context bindings are untrusted user data and never become system instructions.
## 21. Performance and scaling
Initial service objectives:
- list p95 below 200 ms for 50 summaries;
- single-template metadata p95 below 150 ms;
- cached Document preview p95 below 300 ms and uncached below 750 ms for a normal template;
- synchronous new-Document materialization p95 below 2 seconds within configured size limits;
- cursor pages capped at 200;
- no unbounded JSON aggregation or N+1 permission lookup.
Implementation rules:
- keyset paginate by `(updated_at, id)`;
- batch-resolve direct and organization grants;
- keep snapshot bodies out of list projections;
- hash canonical published snapshots once at publish;
- cache immutable published previews by version and renderer;
- use a short-lived draft preview cache by revision;
- move copies above the synchronous size/object threshold to a durable job;
- keep attachments out-of-line;
- virtualize long library lists and context pickers in Alpha.
## 22. Migration and cutover
There is no destructive conversion of existing project templates.
1. Repair Omega's project-template list and create-from-template authorization and clear both binding forms. Ship the adversarial regression tests before any Library adapter can call those paths.
2. Establish the common `library_assets`, `library_asset_grants`, lineage, usage, lifecycle, idempotency, and effective-permission kernel shared with Context and Personality.
3. Add the Template-specific Draft, ChangeSet, published-version, preview, Assistant-read, and materialization capability with an initially empty user library.
4. Establish an authoritative Project governing-organization relationship and personal-library export policy. Until both resolve, keep project capture disabled or fail it closed; do not hide a permissive fallback behind a feature flag.
5. Expose blank Template creation, direct user/organization sharing, editing, publishing, typed Assistant access, and materialization.
6. Add **Save to library** / capture from an accessible project template or ordinary Document only after the export-governance gate is active.
7. Capture creates a new user-owned independent draft with cleared bindings, fresh library identity, sanitized lineage, and a recorded policy decision.
8. The user reviews and publishes it explicitly.
9. Alpha replaces library fixtures with real list/read data and adopts real edit, publish, share, Assistant, and materialization in slices.
10. The editor Templates panel switches to the canonical library client.
11. Remove library fixture code and mock badges.
12. Retain project templates as ordinary project resources unless a later product decision removes that feature.
Do not bulk-promote every project template automatically. That would make ownership, privacy, provenance, duplication, and stale-template decisions on the user's behalf.
## 23. Testing strategy
### Domain tests
- operation validation, inverse generation, and deterministic reduction;
- slot uniqueness and rename rewrite;
- dangling slot reference rejection;
- bounds and malformed opaque envelopes;
- publish immutability and version numbering;
- the shared Library evaluator's effective access across owner, direct user grant, organization grant, removal, and conflicting grants;
- use-only draft denial;
- idempotency mismatch detection.
### Adapter tests
- capture removes every forbidden Document field and binding;
- all copied IDs are fresh and references remain internally consistent;
- Document invariants survive capture, publish, new materialization, and insertion;
- prompt preview shows empty slots;
- content preview maps ephemeral bindings without mutating the snapshot;
- unsupported embedded content yields deterministic warnings or rejection;
- slot rename rewrites all `BlockContext` references.
### Store tests
- revision CAS under concurrent writers;
- exact-once submission behavior;
- fold and replay equivalence;
- immutable published rows;
- shared Asset metadata-version CAS and grant-service idempotency;
- soft deletion and share cleanup behavior;
- keyset pagination with access filtering;
- transaction rollback after adapter or writer failure;
- materialization receipt/result consistency.
### Security tests
- unauthenticated library access is rejected;
- user A cannot enumerate user B's unshared templates;
- restricted project templates are omitted from `GET /documents/templates`;
- a restricted body-supplied `fromTemplateId` cannot create a Document;
- a source-access resolver failure on either project-template path fails closed;
- organization grants disappear when membership ends;
- use cannot edit, publish, share, or delete;
- edit cannot share or manage lifecycle; ownership transfer is not supported in V1;
- inaccessible source resources cannot be captured;
- capture returns no new Asset for export `deny`, unapproved `approval_required`, `unknown`, unresolvable governing organization, or policy-store error;
- an allowed/approved capture records the policy revision, decision/approval ID, source revision, and classification without source content;
- both `BoundContext` and `BoundResource` are absent after Document duplicate, capture, publish, and materialization;
- inaccessible target projects/resources/bindings cannot be materialized;
- search, preview, provenance, Used-in, and error messages reveal no denied identity;
- malicious links/marks and oversized snapshots are rejected;
- signed URLs, connector secrets, and source access controls never enter a published snapshot.
### Concurrency and idempotency tests
- two editors submitting at the same revision produce one success and one conflict;
- retrying a successful create returns the original template;
- retrying materialization returns the original resource/ChangeSet;
- the same `ClientRequestID` with different input returns `idempotency_mismatch`;
- target-resource revision drift creates no partial insertion;
- publish concurrent with a draft change either publishes the named revision or conflicts.
### Assistant integration tests
- `use` can request only an exact published version; `edit`/owner can request an exact draft revision;
- every turn reauthorizes and a revoked grant invalidates the next read;
- Assistant caches are partitioned by access epoch, version/revision, and adapter schema;
- Template and each selected Context are authorized independently;
- switching asset or revision resets/branches Alpha's conversation scope;
- Ask and Plan cannot mutate;
- Action can mutate only through the normal CAS/idempotency path and conflicts normally;
- Assistant projections omit grants, hidden usage, source project IDs, bindings, secrets, and raw Store rows.
### End-to-end Alpha/Omega tests
1. Sign in, open `/library/templates` without selecting a project, and load real templates.
2. Create a blank Document template, add two slots, edit content, and publish v1.
3. Deep-link the template in a fresh session.
4. Share it to a user at use; verify read/preview/materialize and no edit controls.
5. Upgrade to edit; modify and publish v2.
6. Share it to an organization; verify active members and exclude a nonmember.
7. Open Prompt and Content previews; verify chosen contexts are not persisted.
8. From a cold route, Bring into project; select a project and create a new Document.
9. Verify all IDs differ, bindings are only those chosen, and source/published template remain unchanged.
10. Insert into an existing Document and undo through ordinary Document history.
11. Retry both materializations and verify no duplicate.
12. Edit/delete/unshare the library template and verify existing project copies remain unchanged.
13. Ask the Assistant about an exact published version, add an authorized Context explicitly, then revoke Template access and verify the next turn fails without leaking metadata.
14. Capture from an export-allowed project and verify the policy audit; attempt capture with unknown governance and verify no Asset, lineage row, or snapshot is committed.
## 24. Acceptance criteria
- [ ] An authenticated user can use the entire library route without a selected project.
- [ ] A template owner is always a user.
- [ ] Template metadata, ownership, grants, lineage, usage, lifecycle, and effective permissions use the common Library kernel; Template has no parallel ACL or asset envelope.
- [ ] Direct-user and organization `use`/`edit` grants are enforced end to end.
- [ ] Use-only callers cannot read drafts or infer unpublished metadata.
- [ ] Omega's project-template catalog and body-supplied create-from-template path authorize the source Resource inside their service boundary.
- [ ] Document duplication and every Library conversion clear both `BoundContext` and `BoundResource`.
- [ ] Project capture requires an explicit export allow/recorded approval; unknown organization governance and policy failures create no library data.
- [ ] Document templates can be captured, edited, published, previewed, duplicated, shared, and deleted.
- [ ] The current Document context-variable semantics remain valid.
- [ ] Library originals and published snapshots contain no inherited bindings.
- [ ] Every published version is immutable and materialization receipts pin one version.
- [ ] Alpha exposes stable URLs for individual templates.
- [ ] Cold-route Bring into project requires an explicit target project.
- [ ] New-resource materialization assigns fresh IDs and creates an ordinary project Document.
- [ ] Insert materialization emits an ordinary Document ChangeSet and can be undone normally.
- [ ] Duplicate submissions do not duplicate effects.
- [ ] The Template Assistant reads exact, caller-authorized versions/revisions and can apply changes only through the ordinary confirmed CAS path.
- [ ] Permission failures and access-filtered list/search responses leak no template, project, resource, or collaborator identity.
- [ ] Existing project-template behavior continues to work during and after cutover.
- [ ] Spreadsheet and Slides can be added by registering adapters rather than changing ownership, sharing, version, or materialization schemas.
## 25. Non-goals for V1
- Organization-owned canonical templates.
- Public links, public marketplace publishing, discovery feeds, ratings, or monetization.
- Live-linked project instances that update when a library version changes.
- Automatic propagation or revocation of already materialized copies.
- Spreadsheet or Slides editing/materialization before their resource adapters are production-ready.
- A fake Slides preview.
- Carrying source-project context bindings into the library.
- Cross-project resource references inside a published snapshot.
- Simultaneous character-level coauthoring of one Template draft; CAS and deliberate refetch are sufficient for V1.
- Running prompt blocks or generating final AI content during preview.
- Model orchestration, conversation persistence, and provider execution inside the Template capability. The real Assistant integration is in scope, but Agent/Chat owns it and consumes only Template's authorized typed read/preview port.
- Automatically promoting all existing project templates.
## 26. Sources
- [Taurus Alpha — latest audited library implementation](https://github.com/gccurtis/taurus-alpha/commit/d00b20450f6c0cbc8be82cf7d4fde942ebadda86)
- [Taurus Omega — latest audited runtime](https://github.com/gccurtis/taurus-omega/commit/d1d4c2fd5343daee9faf39c1a6896a922c417bd9)
- [Taurus Alpha — LibraryConsole](https://github.com/gccurtis/taurus-alpha/blob/main/src/lib/features/library/LibraryConsole.svelte)
- [Taurus Alpha — TemplateSpace](https://github.com/gccurtis/taurus-alpha/blob/main/src/lib/features/library/TemplateSpace.svelte)
- [Taurus Alpha — LibraryDetails](https://github.com/gccurtis/taurus-alpha/blob/main/src/lib/features/library/LibraryDetails.svelte)
- [Taurus Alpha — LibraryShell](https://github.com/gccurtis/taurus-alpha/blob/main/src/lib/features/library/LibraryShell.svelte)
- [Taurus Alpha — library fixtures](https://github.com/gccurtis/taurus-alpha/blob/main/src/lib/features/library/library-mock.ts)
- [Taurus Alpha — owner-scoped contexts and templates request](https://github.com/gccurtis/taurus-alpha/blob/main/docs/backend-requests/asset-library-owner-scope.md)
- [Taurus Alpha — library end-to-end contract](https://github.com/gccurtis/taurus-alpha/blob/main/e2e/library-and-theme.spec.ts)
- [Taurus Omega — Document template model](https://github.com/gccurtis/taurus-omega/blob/main/core/capability/document/template.go)
- [Taurus Omega — Document HTTP handlers](https://github.com/gccurtis/taurus-omega/blob/main/core/handlers/document/document.go)
- [Taurus Omega — runtime model](https://github.com/gccurtis/taurus-omega/blob/main/docs/architecture/runtime-model.md)

