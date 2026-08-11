---
title: "Implementation — User Context Library"
notion_page_id: "3acb6410e502814e928ae1f10eac6f75"
notion_url: "https://app.notion.com/3acb6410e502814e928ae1f10eac6f75"
project: "Taurus Yesod"
role: "Primary"
format: "Spec"
created: "2026-07-29 19:53:17Z"
mirrored_at: "2026-07-30"
mirrored_from_notion: true
---

# Implementation — User Context Library

> Source mirror. Preserve this page as planning evidence; use the agent-facing execution packet when one exists.

> **Authoritative Taurus Yesod implementation contract.** This page turns the existing project-scoped Context capability into a user-level Context Library without replacing its working set algebra. The route is available immediately after sign-in, before a project is selected. Library assets are independent copies, are private by default, and may be shared with users or organizations.
# Decision
Build `/library/context` as the user’s cross-project Context Library. Preserve Omega’s existing project Context model and resolver—named `Includes` and `Excludes`, nested contexts, leaf expansion, exclusion precedence, memoized resolution, write-time cycle prevention, and the reserved `whole-project` context—but add a separate user-owned library aggregate, caller-aware authorization, durable revisions, sharing, provenance, and copy-based project interchange.
The central rule is:
> **Project Context → user library → another project is a sequence of copies, never a live cross-scope link.**
Editing any copy changes only that copy. A library asset must remain useful after its origin project is deleted or becomes inaccessible. A project must never resolve through another project’s catalog.
This page deliberately supersedes older assumptions that reusable Context must remain project-only or be owned primarily by an organization. In the first production increment, the canonical library master is owned by one user. Direct user grants and organization grants provide `use` or `edit` access. The schema keeps grant subjects typed so organization-owned masters can be added later without changing the sharing contract.
# Outcome
After this work:
- a signed-in user can list, search, open, create, edit, duplicate, share, and delete their Context assets without selecting a project;
- users can see Contexts directly shared with them or shared to organizations of which they are current members;
- a Context remains a comprehensible set expression with Included and Excluded members and a flattened Resources projection with provenance;
- a user can copy a project Context into their library and later copy it into any project in which they can create resources;
- large copies run as durable, idempotent jobs and do not expose half-built Contexts;
- every read and resolution is caller-aware, so restricted resource names, origin projects, and nested Contexts cannot leak;
- agents and template materialization can consume a version-pinned Context through a typed port without treating its description or source content as authority.
# Terminology
<table header-row="true">
<tr>
<td>Product term</td>
<td>Internal term</td>
<td>Meaning</td>
</tr>
<tr>
<td>Context Library</td>
<td>`contextlibrary` package / library Context aggregate</td>
<td>User-level reusable Context assets</td>
</tr>
<tr>
<td>Context</td>
<td>existing `contexts.Context`</td>
<td>Project-local named set expression</td>
</tr>
<tr>
<td>Included</td>
<td>`Definition.Includes`</td>
<td>Members added before exclusion is applied</td>
</tr>
<tr>
<td>Excluded</td>
<td>`Definition.Excludes`</td>
<td>Members subtracted at the resolved leaf level</td>
</tr>
<tr>
<td>Resource snapshot</td>
<td>library-owned copied source</td>
<td>Independent material copied from a project resource; never a pointer into its origin project</td>
</tr>
<tr>
<td>Bring into project</td>
<td>materialize / copy down</td>
<td>Create ordinary project resources plus an ordinary project Context</td>
</tr>
<tr>
<td>Save to library</td>
<td>promote / copy up</td>
<td>Resolve and copy a project Context into a new user-owned library master</td>
</tr>
<tr>
<td>Can use</td>
<td>`use` grant</td>
<td>Read the published asset and copy/use it in an authorized project</td>
</tr>
<tr>
<td>Can edit</td>
<td>`edit` grant</td>
<td>Everything in `use`, plus create new library revisions</td>
</tr>
</table>
The user said “contacts” once in the surrounding discussion; the implemented screen, Omega capability, and intended model are all **Context**.
# Current repository reality
## Taurus Alpha
Alpha `main` already ships the intended route and screen:
- `/library/context` is reachable from both project selection and the project shell;
- the left rail provides search, owner filtering, shared-state marks, and Context selection;
- the center displays parallel **Included** and **Excluded** sets plus a flattened **Resources** list;
- nested Contexts are visible, and each resolved Resource row shows whether it was included directly or through another Context;
- the right panel provides Details and Assistant lenses, editable name/description, owner, sharing, origin, last edit, and caller-visible project usage;
- the route is explicitly marked **Mock** and reads `library-mock.ts`.
The screen is the interaction contract. The mocks are not domain truth.
## Taurus Omega
Omega already has the hard part of the Context domain:
```go
type Definition struct {
    Includes []Ref `json:"includes"`
    Excludes []Ref `json:"excludes"`
}

type Ref struct {
    Kind string `json:"kind"`
    ID   string `json:"id"`
    Name string `json:"name"`
}
```
The project-scoped capability already supports create, list, get, resolve, replace, and delete. Nested Contexts expand recursively, exclusions win at the leaf, a resolve call memoizes nested results, cycles are rejected at write time, connector members expand to file origins, and `whole-project` is a reserved virtual Context.
That logic should be reused, not rewritten.
The material gaps are scope and safety:
- every route requires the selected project;
- `Context` has no description;
- `Context` has no revision/CAS field, and SQLite updates are blind last-write-wins;
- there is no owner, sharing, immutable revision history, lineage, usage projection, library resource copy, or library-to-project materialization;
- Context mutation does not consistently require `Role.CanWrite`;
- current Catalog and Resolve ports do not carry caller identity;
- `GET /contexts/:contextID/resolved` can return names of Resources outside the caller’s Resource access scope;
- `whole-project` expansion can therefore copy or disclose Resources the caller cannot use;
- asynchronous Document prompt resolution does not carry the requester through its Context scope resolver;
- the Agent Knowledge port is likewise project-scoped without a requester-aware Resource authorization boundary;
- Context summaries are unpaginated and unordered, which is unsuitable for the library screen.
The access defects are prerequisites, not follow-up polish.
# Screen and route contract
## Route
Use the existing Alpha route:
```plain text
/library/context
/library/context/:contextID   # add a durable deep-link route
```
The current route keeps selection only in component state. A Context is durable and shareable, so its URL must be stable. `/library/context` may redirect to the most recently selected accessible Context or render an honest empty state. An unknown, deleted, or inaccessible ID returns to the collection with a non-disclosing message.
The route requires an authenticated user but never a selected project.
## Left rail
The rail displays:
- search over name and description;
- owner filter: Me, directly shared owners, and organization-shared assets;
- active/shared markers;
- stable selection driven by the URL;
- create Context.
Use server-provided effective permissions. Do not infer editability from owner labels or organization membership in the client.
Search is debounced and cursor-paginated. The server searches metadata only in the first increment; sensitive Resource bodies are not placed in a cross-asset full-text index.
## Main Context surface
The main surface preserves the mock’s three conceptual regions:
```plain text
Included                            Excluded
  direct Resource                     direct Resource
  nested Context                      nested Context
  copied connector origin             copied connector origin

Resources
  flattened authorized leaf · provenance path · health
```
Actions:
- add a Resource snapshot or nested accessible library Context;
- remove a member;
- move a member between Included and Excluded;
- open a nested Context;
- select or open a copied Resource;
- resolve again after a revision conflict;
- duplicate;
- save a project Context to the library;
- use the Context from a project picker.
The flattened Resources list is a projection, not editable truth. It must virtualize because `whole-project` and connector-backed Contexts can resolve to thousands of leaves.
## Details and Assistant
Details shows:
- name and description;
- owner;
- effective permissions;
- sharing grants;
- origin, when the caller may see it;
- last editor and timestamp;
- current published revision;
- caller-visible “Used in” projects;
- copy semantics.
The description intentionally does two jobs: it labels the Context in pickers and gives an agent a concise explanation of what the material represents. It is still untrusted user-authored guidance. Context assembly must label it as guidance and must not merge it into a system instruction or let it widen tools, scope, or grants.
When the selected Context changes, reset or explicitly branch the Assistant conversation. Alpha currently preserves a conversation while selection changes; that can attach answers to the wrong asset.
# Non-negotiable domain invariants
1. Every library Context has exactly one user owner.
2. An asset is private unless an active direct or organization grant applies.
3. `edit` implies `use`; `use` never implies edit, sharing, or lifecycle management.
4. Only the owner manages grants or trashes/restores the asset. Ownership transfer is not supported in V1.
5. Organization grants resolve against current membership on every authorization boundary or a membership-epoch-correct cache.
6. Library and project Contexts are different aggregates with different IDs and histories.
7. Promote and bring-in always pin an exact source revision.
8. No library definition stores a project Resource ID as a resolvable member.
9. No project definition stores a library Resource ID as a resolvable member.
10. `whole-project` may be selected in a project Context, but promotion expands it to authorized concrete leaves; it is never persisted as a library dependency.
11. Resolution remains deterministic: expand Includes, expand Excludes, subtract by canonical leaf identity, and retain stable provenance.
12. A nested graph is acyclic at the revision being published.
13. A failed or incomplete copy is not visible as an active Context.
14. By-ID reads return not-found semantics for inaccessible assets to resist enumeration.
15. Origin and usage metadata never reveal a project, Resource, organization, or user the caller cannot currently see.
# Shared library envelope
Use one small neutral library kernel for ownership, grants, lifecycle, lineage, and permission evaluation. Do not create a “Library” capability that imports and orchestrates every capability store. Context remains owner of Context definitions and resolution.
```go
package library

type AssetKind string

const (
    AssetPersonality AssetKind = "personality"
    AssetContext     AssetKind = "context"
    AssetTemplate    AssetKind = "template"
)

type Permission string

const (
    PermissionUse  Permission = "use"
    PermissionEdit Permission = "edit"
)

type SubjectKind string

const (
    SubjectUser         SubjectKind = "user"
    SubjectOrganization SubjectKind = "organization"
)

type Asset struct {
    ID              string
    Kind            AssetKind
    OwnerUserID     string
    Name            string
    Description     string
    HeadVersion     int64
    MetadataVersion int64
    Lifecycle       string // active | trashed
    Origin          *Origin
    CreatedAt       time.Time
    UpdatedAt       time.Time
    TrashedAt       *time.Time
}

type Grant struct {
    ID          string
    AssetID     string
    SubjectKind SubjectKind
    SubjectID   string
    Permission  Permission
    GrantedBy   string
    CreatedAt   time.Time
    UpdatedAt   time.Time
}

type EffectivePermissions struct {
    CanUse    bool `json:"canUse"`
    CanEdit   bool `json:"canEdit"`
    CanShare  bool `json:"canShare"`
    CanDelete bool `json:"canDelete"`
}
```
The platform storage adapter may use common `library_assets`, `library_asset_grants`, and lineage tables. Context-specific revision payloads remain owned by the Context Library service. Creation and revision publication write the common envelope and Context rows in one SQLite transaction.
# Context Library aggregate
## Versioned definition
```go
package contextlibrary

type MemberKind string

const (
    MemberResourceSnapshot MemberKind = "resource_snapshot"
    MemberContextSnapshot  MemberKind = "context_snapshot"
    MemberBindingSlot      MemberKind = "binding_slot"
)

type MemberRef struct {
    Kind MemberKind `json:"kind"`
    ID   string     `json:"id"`
    Name string     `json:"name"` // display snapshot; identity is ID
}

type Definition struct {
    Includes []MemberRef `json:"includes"`
    Excludes []MemberRef `json:"excludes"`
}

type Version struct {
    AssetID          string
    Version          int64
    Definition       Definition
    BindingSlots     []BindingSlot
    NestedContexts   []NestedContextSnapshot
    DefinitionHash   string
    CreatedBy        string
    CreatedAt        time.Time
}

type BindingSlot struct {
    ID            string   `json:"id"`
    Name          string   `json:"name"`
    Description   string   `json:"description"`
    AcceptedKinds []string `json:"acceptedKinds"`
    Required      bool     `json:"required"`
}

type NestedContextSnapshot struct {
    ID             string                  `json:"id"` // package-local stable ID
    Name           string                  `json:"name"`
    Definition     Definition              `json:"definition"`
    BindingSlots   []BindingSlot           `json:"bindingSlots"`
    NestedContexts []NestedContextSnapshot `json:"nestedContexts"`
}

type ResourceSnapshot struct {
    ID                 string
    OwnerUserID        string
    Kind               string
    Name               string
    MIMEType           string
    BlobRef            string
    ExtractedTextRef   string
    ContentHash        string
    SourceVersion      string
    Classification     string
    Origin             SnapshotOrigin
    Lifecycle          string
    CreatedAt          time.Time
}

type SnapshotOrigin struct {
    ProjectID  string
    ResourceID string
    Revision   string
    Connector  string
}
```
`ResourceSnapshot` is library-owned data. It contains no connector credential, refresh token, live provider URL requiring origin-project authority, project-only key, or project Resource ACL. A connector-backed Resource is copied as an authorized content snapshot with provenance. A future explicit reconnect flow may create a new library source; promotion must not silently transfer a credential.
Not every project member is portable. Capture embeds a supported, authorized content snapshot when the resource family provides a safe exporter—beginning with Documents and ordinary files. A connector that cannot be snapshotted without transferring authority, an unsupported native resource, or a deliberately external dependency becomes a typed `BindingSlot`. Materialization asks the user to bind every required slot to an authorized target-project Resource. This is an explicit dependency, not a silently dropped member.
Adding another library Context snapshots its exact published version into `NestedContexts` and rewrites the member to a package-local `context_snapshot` reference. It does **not** leave a live reference to the other top-level library asset. Consequently, sharing or materializing the parent requires only `use` on the parent: a recipient never needs an undisclosed transitive grant, and later edits, revocation, or deletion of the source Context cannot change an already-published parent revision. Source asset/version lineage is stored separately from the package payload and returned only after reauthorizing that provenance. The UI may open the embedded nested snapshot read-only; editing it independently requires opening an accessible top-level asset or creating a new copy.
## Revision behavior
Each accepted metadata or membership edit uses optimistic concurrency:
```go
type ReviseRequest struct {
    ExpectedHeadVersion     int64
    ExpectedMetadataVersion int64
    ClientRequestID         string
    Name                    string
    Description             string
    Definition              Definition
}

func (s *Service) Revise(
    ctx context.Context,
    actor Actor,
    assetID string,
    req ReviseRequest,
) (AssetView, error)
```
The service:
1. authorizes `edit`;
2. validates bounds and member access;
3. validates the proposed Context graph for cycles;
4. canonicalizes member order and hashes the definition;
5. returns the prior result for an identical idempotent retry;
6. rejects a stale head with `409 revision_conflict` and stale metadata with `409 metadata_conflict`;
7. inserts an immutable version and advances the head when the definition changes, increments `metadataVersion` when metadata changes, and commits both atomically when a request changes both;
8. emits a safe audit/activity record.
The UI may present direct editing rather than a “revision” workflow, but persistence is still revisioned. Name, description, lifecycle, and grants are shared-envelope metadata and always use `ExpectedMetadataVersion`; grant and lifecycle mutations increment only `metadataVersion`, not the Context head.
# Caller-aware resolution
## Scope must contain the actor
No project- or library-scoped read should be expressible without the caller:
```go
type ResolveScope struct {
    CallerUserID    string
    OrganizationIDs []string
    AssetID         string
    Version         int64
}

type ResolvedLeaf struct {
    SnapshotID     string
    Kind           string
    Name           string
    ContentHash    string
    ProvenancePath []ProvenanceStep
    Redacted       bool
}

type ResolvedBindingSlot struct {
    SlotID         string
    Name           string
    AcceptedKinds  []string
    Required       bool
    ProvenancePath []ProvenanceStep
}

type ResolveResult struct {
    AssetID        string
    Version        int64
    DefinitionHash string
    Leaves         []ResolvedLeaf
    BindingSlots   []ResolvedBindingSlot
}
```
`ResolveScope` is an internal trusted value. `CallerUserID` comes from the authenticated principal and `OrganizationIDs` come from the current Organization membership resolver; neither may be accepted from request JSON.
Resolution authorizes the root asset on every entry and then reads only snapshots embedded in that exact immutable package version. A parent grant permits consuming the copied Resource and nested Context snapshots contained in the parent, but grants no access to origin projects, source top-level assets, or unrelated library assets. Creating a new parent revision from another top-level Context requires `use` on that source at publication time; publication snapshots the dependency and then stands alone.
A binding slot is not a hidden dependency. It is visible schema without source content and remains unresolved until explicitly bound during materialization. Missing required slots fail closed with their own declared names; inaccessible candidate Resources remain non-disclosing.
## Deterministic algorithm
```go
func Resolve(
    scope ResolveScope,
    root ContextVersion,
    read PackageReadPort,
    authorize AssetAuthorizePort,
) (ResolveResult, error) {
    if err := authorize.RequireUse(scope.CallerUserID, scope.OrganizationIDs, root.AssetID); err != nil {
        return ResolveResult{}, err
    }

    memo := map[string]Expansion{} // package-local nested snapshot ID
    visiting := map[string]bool{}

    includes, err := expandPackageMembers(root, root.Definition.Includes, memo, visiting, read)
    if err != nil {
        return ResolveResult{}, err
    }
    excludes, err := expandPackageMembers(root, root.Definition.Excludes, memo, visiting, read)
    if err != nil {
        return ResolveResult{}, err
    }

    deniedLeaves := canonicalLeafSet(excludes.Leaves)
    deniedSlots := canonicalSlotSet(excludes.BindingSlots)
    leaves := stableUnique(includes.Leaves, func(v ResolvedLeaf) string {
        return v.SnapshotID
    })
    leaves = stableFilter(leaves, func(v ResolvedLeaf) bool {
        return !deniedLeaves[v.SnapshotID]
    })
    slots := stableUnique(includes.BindingSlots, func(v ResolvedBindingSlot) string {
        return v.SlotID
    })
    slots = stableFilter(slots, func(v ResolvedBindingSlot) bool {
        return !deniedSlots[v.SlotID]
    })
    return resultWithStableProvenance(root, leaves, slots), nil
}
```
The read port can address only members stored inside `root`’s immutable package. It cannot follow protected lineage to another live asset. Write-time cycle prevention remains primary; `visiting` is a fail-closed defense against corrupted package data. Caps on depth, nodes, resolved leaves, and slots produce a typed, user-visible error—never silent truncation.
# Copy-up: project Context to user library
```json
POST /me/contexts/captures
{
  "clientRequestId": "01J...",
  "sourceProjectId": "project_123",
  "sourceContextId": "context_123",
  "expectedContextRevision": 17,
  "name": "Q3 research inputs",
  "description": "Primary interview material from the Q3 push."
}
```
The owner is the authenticated user; the client cannot choose another user.
The operation:
1. reauthorizes project membership, source Context and Resource access, the governing export policy, and the exact Context revision;
2. resolves the source with the caller-aware project resolver;
3. rejects any inaccessible leaf rather than copying a hidden name or partial set;
4. expands `whole-project` to the authorized concrete leaf set;
5. copies each Resource’s permitted content and safe metadata into independent library snapshots;
6. converts a non-portable dependency into a declared binding slot or rejects capture according to policy;
7. strips credentials, project ACLs, live bindings, and provider-specific secrets;
8. converts project member refs to library snapshot or slot refs;
9. preserves a safe provenance path and content hashes;
10. validates the new library graph;
11. publishes the asset only when every required snapshot is committed;
12. records lineage and an idempotency receipt.
Omega must first add a monotonic revision and expected-revision CAS to project Contexts. Until that exists, copy-up must acquire a consistent source snapshot and verify an equivalent immutable source fingerprint before publication; `updated_at` alone is not a safe concurrency token.
Large copies use a durable job:
```go
type CopyJobState string

const (
    CopyQueued     CopyJobState = "queued"
    CopyCopying    CopyJobState = "copying"
    CopyValidating CopyJobState = "validating"
    CopyPublished  CopyJobState = "published"
    CopyFailed     CopyJobState = "failed"
    CopyCanceled   CopyJobState = "canceled"
)
```
The visible asset is either the prior complete version or the new complete version. There is no partially resolved active state.
# Copy-down: user library to project
The project picker initiates the normal product flow. The library route may also expose a future “Bring into project” action, but it must ask for a target project when the route was opened cold.
```json
POST /me/contexts/{contextId}/materializations
{
  "clientRequestId": "01J...",
  "version": 8,
  "targetProjectId": "project_123",
  "name": "Q3 research inputs",
  "bindings": [
    {
      "slotId": "slot_current_sharepoint_pack",
      "projectResourceId": "resource_456"
    }
  ]
}
```
The coordinator:
1. authorizes `use` on the exact library version;
2. authorizes current membership and Resource creation in the target project;
3. resolves the exact library version and dependency closure;
4. validates every required binding against the target project and accepted kind;
5. allocates new project Resource IDs and copies the library snapshots;
6. submits them through the existing Resource/ingestion boundary;
7. creates an ordinary project Context referencing the new and explicitly bound project Resources;
8. records source asset/version lineage;
9. publishes only after all project Resources are ready enough for the existing Context contract;
10. leaves the library original untouched.
Because Resource copy, ingestion, and Context creation cross capability boundaries, use a durable coordinator with an outbox and explicit phases. Do not hold one database transaction around blob copying or embedding. Idempotency is keyed by authenticated user, asset ID, version, target project, and client request ID.
# Sharing and privacy contract
```plain text
owner  = use + edit + manage grants + trash/restore
edit   = use + create new revisions
use    = read published metadata/definition/resources + materialize in an authorized project
none   = indistinguishable from not found on by-ID routes
```
Grant rules:
- a user grant names one user;
- an organization grant names one organization and applies only to current members;
- `edit` does not allow resharing or lifecycle management; ownership transfer is not supported in V1;
- grant changes do not mutate copies already created in projects;
- revocation invalidates new reads and materializations immediately;
- revocation does not retroactively delete a legitimate project copy;
- a share confirmation states that users with `use` can inspect and copy the Context’s contained Resource snapshots;
- grant, copy, trash, restore, and failed authorization events are audited without logging Resource bodies.
The server returns `EffectivePermissions`; Alpha does not reconstruct ACL logic.
Share-recipient lookup uses an exact normalized email or an organization the owner is authorized to inspect. Do not expose a fuzzy global user directory, distinguish “account absent” from “not shareable,” or allow the client to manufacture organization membership claims.
An editor adding material from a project is exporting that material into an asset owned by someone else and potentially visible to its existing grantees. The server must run the source project’s export/classification policy for that destination owner and audience, and the UI must state the destination before capture. An `edit` grant alone never overrides source governance.
Saving a project Context to a personal library is a data-export event. Before enabling it for company deployments, add a project/organization governance policy that can allow, require approval for, or deny personal-library export. Omega’s current Project model does not carry an organization ID, so the system cannot yet infer the governing organization safely. Until that relationship and policy exist, sensitive or organization-governed projects must fail closed rather than assuming export is allowed.
# Persistence
Representative SQLite shape:
```sql
CREATE TABLE library_assets (
    id                TEXT PRIMARY KEY,
    kind              TEXT NOT NULL CHECK (kind IN ('personality','context','template')),
    owner_user_id     TEXT NOT NULL,
    name              TEXT NOT NULL,
    description       TEXT NOT NULL DEFAULT '',
    head_version      INTEGER NOT NULL DEFAULT 0,
    metadata_version  INTEGER NOT NULL DEFAULT 1,
    lifecycle         TEXT NOT NULL DEFAULT 'active'
        CHECK (lifecycle IN ('active','trashed')),
    origin_json       BLOB,
    created_at        TEXT NOT NULL,
    updated_at        TEXT NOT NULL,
    trashed_at        TEXT,
    FOREIGN KEY (owner_user_id) REFERENCES users(id)
);
CREATE INDEX library_assets_owner_kind_updated
    ON library_assets(owner_user_id, kind, updated_at DESC, id DESC);
CREATE INDEX library_assets_kind_name
    ON library_assets(kind, name COLLATE NOCASE, id);

CREATE TABLE library_asset_grants (
    id             TEXT PRIMARY KEY,
    asset_id       TEXT NOT NULL,
    subject_kind   TEXT NOT NULL CHECK (subject_kind IN ('user','organization')),
    subject_id     TEXT NOT NULL,
    permission     TEXT NOT NULL CHECK (permission IN ('use','edit')),
    granted_by     TEXT NOT NULL,
    created_at     TEXT NOT NULL,
    updated_at     TEXT NOT NULL,
    UNIQUE (asset_id, subject_kind, subject_id),
    FOREIGN KEY (asset_id) REFERENCES library_assets(id) ON DELETE CASCADE,
    FOREIGN KEY (granted_by) REFERENCES users(id)
);
CREATE INDEX library_grants_subject
    ON library_asset_grants(subject_kind, subject_id, asset_id);

CREATE TABLE library_asset_lineage (
    id                     TEXT PRIMARY KEY,
    asset_id               TEXT NOT NULL,
    relation               TEXT NOT NULL
        CHECK (relation IN ('captured_from_project', 'duplicated_from_library')),
    source_kind            TEXT NOT NULL,
    source_id              TEXT NOT NULL,
    source_version         TEXT NOT NULL,
    governance_decision_id TEXT,
    created_by             TEXT NOT NULL,
    created_at             TEXT NOT NULL,
    FOREIGN KEY (asset_id) REFERENCES library_assets(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE TABLE library_context_versions (
    asset_id          TEXT NOT NULL,
    version           INTEGER NOT NULL,
    definition_json   BLOB NOT NULL,
    binding_slots_json BLOB NOT NULL,
    nested_contexts_json BLOB NOT NULL,
    definition_hash   TEXT NOT NULL,
    created_by        TEXT NOT NULL,
    created_at        TEXT NOT NULL,
    PRIMARY KEY (asset_id, version),
    FOREIGN KEY (asset_id) REFERENCES library_assets(id) ON DELETE CASCADE
);

CREATE TABLE library_context_resource_snapshots (
    id                  TEXT PRIMARY KEY,
    owner_user_id       TEXT NOT NULL,
    kind                TEXT NOT NULL,
    name                TEXT NOT NULL,
    mime_type           TEXT NOT NULL,
    blob_ref            TEXT,
    extracted_text_ref  TEXT,
    content_hash        TEXT NOT NULL,
    source_version      TEXT NOT NULL,
    classification      TEXT NOT NULL,
    origin_json         BLOB NOT NULL,
    lifecycle           TEXT NOT NULL DEFAULT 'active',
    created_at          TEXT NOT NULL
);

CREATE TABLE library_context_version_resources (
    asset_id       TEXT NOT NULL,
    version        INTEGER NOT NULL,
    snapshot_id    TEXT NOT NULL,
    PRIMARY KEY (asset_id, version, snapshot_id),
    FOREIGN KEY (asset_id, version)
        REFERENCES library_context_versions(asset_id, version) ON DELETE CASCADE,
    FOREIGN KEY (snapshot_id)
        REFERENCES library_context_resource_snapshots(id)
);

CREATE TABLE library_context_member_lineage (
    asset_id          TEXT NOT NULL,
    version           INTEGER NOT NULL,
    member_local_id   TEXT NOT NULL,
    source_kind       TEXT NOT NULL,
    protected_origin_json BLOB NOT NULL,
    created_at        TEXT NOT NULL,
    PRIMARY KEY (asset_id, version, member_local_id),
    FOREIGN KEY (asset_id, version)
        REFERENCES library_context_versions(asset_id, version) ON DELETE CASCADE
);

CREATE TABLE library_asset_usage (
    id                 TEXT PRIMARY KEY,
    materialization_id TEXT NOT NULL UNIQUE,
    asset_id           TEXT NOT NULL,
    source_version     INTEGER NOT NULL,
    target_project_id  TEXT NOT NULL,
    target_kind        TEXT NOT NULL,
    target_id          TEXT NOT NULL,
    created_by         TEXT NOT NULL,
    created_at         TEXT NOT NULL,
    FOREIGN KEY (materialization_id) REFERENCES library_materializations(id),
    FOREIGN KEY (asset_id) REFERENCES library_assets(id),
    FOREIGN KEY (created_by) REFERENCES users(id)
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

CREATE TABLE library_mutation_receipts (
    actor_user_id     TEXT NOT NULL,
    client_request_id TEXT NOT NULL,
    operation_kind    TEXT NOT NULL,
    target_id         TEXT NOT NULL,
    request_hash      TEXT NOT NULL,
    result_json       BLOB NOT NULL,
    created_at        TEXT NOT NULL,
    PRIMARY KEY (actor_user_id, client_request_id)
);
```
In the shared envelope, `head_version = 0` means “no published version yet.” Context creation or capture commits the complete self-contained version 1 package and advances the head to 1 in the same transaction before the asset becomes listable.
`library_materializations` is the canonical cross-capability operation/receipt record. `library_asset_usage` is an append-only successful-materialization event keyed to it; repeated use of the same Context or a later version in the same target is valid and produces another event. `library_jobs` is the common durable record for asynchronous work. Status is exposed through `/me/library-materializations/:materializationID` and, when a job exists, `/me/library-jobs/:jobID`. Fast operations may complete inline with a materialization and mutation receipt but no job row.
Content-addressed blob deduplication may avoid copying identical bytes physically, but every logical snapshot receives independent metadata, ownership, lifecycle, and authorization. Deduplication must never become an ACL shortcut.
# User-level API
All routes live under authenticated, project-independent middleware. Paths below omit the deployment API prefix: `/library/context` is the browser route, while `/me/contexts` is the signed-in, project-independent API namespace.
```plain text
GET    /me/contexts
POST   /me/contexts
GET    /me/contexts/:contextID
PATCH  /me/contexts/:contextID
DELETE /me/contexts/:contextID
POST   /me/contexts/:contextID/restore

GET    /me/contexts/:contextID/versions
GET    /me/contexts/:contextID/versions/:version
GET    /me/contexts/:contextID/resolved

GET    /me/contexts/:contextID/shares
PUT    /me/contexts/:contextID/shares/:subjectKind/:subjectID
DELETE /me/contexts/:contextID/shares/:subjectKind/:subjectID

POST   /me/contexts/:contextID/materializations
GET    /me/library-materializations/:materializationID
GET    /me/library-jobs/:jobID

POST   /me/contexts/captures
```
The public grant identity is `(subjectKind, subjectID)`. `PUT` accepts `permission: "use" | "edit"`, `expectedMetadataVersion`, and `clientRequestId`; `DELETE` carries the concurrency and idempotency values in the request body or the equivalent `If-Metadata-Version` and `Idempotency-Key` headers. `DELETE /me/contexts/:contextID` is recoverable trash, and `/restore` reverses it. Both lifecycle operations are owner-only, require metadata-version CAS and a client request ID, and preserve every immutable version and protected lineage record.
Representative list response:
```json
{
  "items": [
    {
      "id": "context_01J",
      "name": "Q3 research inputs",
      "description": "Primary interview material from the Q3 push.",
      "owner": {"id": "user_1", "displayName": "You"},
      "headVersion": 8,
      "metadataVersion": 12,
      "counts": {"included": 4, "excluded": 1, "resolved": 7},
      "effectivePermissions": {
        "canUse": true,
        "canEdit": true,
        "canShare": true,
        "canDelete": true
      },
      "updatedAt": "2026-07-29T18:00:00Z"
    }
  ],
  "nextCursor": "opaque"
}
```
Use opaque keyset cursors over `(updated_at, id)`. Filtering must occur in the authorized SQL query, not after pagination.
Error vocabulary:
```plain text
not_found
permission_denied
revision_conflict
cycle_detected
dependency_inaccessible
resource_inaccessible
copy_not_permitted
copy_too_large
unsupported_resource_kind
classification_denied
job_in_progress
materialization_conflict
```
No error includes a hidden Resource or Context name.
# Backend implementation plan
## Package boundaries
```plain text
core/kernel/library/
    types.go          # pure owner/grant/permission/lineage values
    policy.go         # pure effective-permission evaluation

core/capability/contextlibrary/
    model.go
    service.go
    resolve.go
    copy.go
    ports.go
    errors.go

core/wiring/
    context_library_catalog.go
    context_library_copy.go

core/platform/storage/sqlite/
    sqlite_library.go
    sqlite_context_library.go
    sqlite_library_jobs.go

core/handlers/contextlibrary/
    context_library.go
```
`contextlibrary` consumes narrow ports:
```go
type ProjectContextReader interface {
    GetAuthorized(ctx context.Context, actor Actor, projectID, contextID string) (ProjectContextSnapshot, error)
    ResolveAuthorized(ctx context.Context, actor Actor, projectID, contextID string, revision int64) ([]ProjectLeaf, error)
}

type ProjectResourceCopier interface {
    CopyToLibrary(ctx context.Context, actor Actor, leaf ProjectLeaf, ownerUserID string) (ResourceSnapshot, error)
    CopyToProject(ctx context.Context, actor Actor, snapshot ResourceSnapshot, projectID string) (ProjectResourceRef, error)
}

type ProjectContextWriter interface {
    CreateFromLibrary(ctx context.Context, actor Actor, projectID string, in ProjectContextCopy) (ProjectContextRef, error)
}
```
Wiring adapters may import both capabilities. The Context Library capability does not import project Resource stores or bypass their authorization.
The same caller-aware rule must reach existing consumers: Document prompt-resolution jobs persist and pass `requesterUserID`, and the Agent Knowledge adapter receives an authorized origin set or requester-bearing scope. A background worker must never reconstruct Context scope from only `projectID`.
## Ordered delivery
1. Make existing project Context reads and mutations caller-aware; enforce `CanWrite` and Resource access in capability/service boundaries, including `whole-project`.
2. Add `description`, monotonic revision, and expected-revision CAS to existing project Contexts, their SQLite store, and DTOs.
3. Propagate requester identity through asynchronous Document prompt resolution and the Agent Knowledge adapter; add adversarial tests for restricted Resources.
4. Add the shared user-library envelope, grants, effective permissions, and signed-in/project-independent middleware.
5. Add user-level Context metadata, revisions, self-contained package validation, and resolution over library snapshots.
6. Add stable `/library/context/:id` frontend routing and replace list/detail fixtures.
7. Add project-to-library copy with durable jobs and safe snapshotting.
8. Add library-to-project materialization and lineage/usage.
9. Wire all Context editor mutations, sharing, and caller-visible provenance.
10. Replace the Assistant mock with the normal AI boundary using explicit library Context scope.
11. Run security, scale, recovery, and two-user/two-organization acceptance suites before removing the Mock badge.
“Ask about this Context” uses a separately authorized retrieval namespace keyed by `(assetID, version)`, for example `library/context/{assetID}/{version}`. Ingestion and embeddings for that namespace are produced from only the self-contained published package. Every query reauthorizes the root asset and keys any result/cache by the viewer’s access epoch. The implementation must not silently insert library snapshots into a project Knowledge lattice or call the current project-only Agent Knowledge port. Retrieval returns only material included in the exact published version and labels description and source text as untrusted context.
# Frontend integration plan
1. Replace `library-mock.ts` with a typed `context-library-client.ts`.
2. Drive selection from `/library/context/:contextID`.
3. Keep server state in a query/cache layer keyed by asset ID and version; keep only drafts, modal state, hover, and Assistant turns locally.
4. Add draft state, dirty indication, validation, and revision-conflict recovery to name, description, Includes, and Excludes.
5. Bind the add-member search field to an authorized, paginated package-source catalog. Another library Context is snapshotted at an exact version. A project Resource requires an explicit source-project selection and the same copy/export-policy boundary as promotion; it is never inserted as a live ID.
6. Render effective permissions and remove or disable unauthorized controls.
7. Virtualize the resolved list and reuse a shared Resource-table row primitive.
8. Re-resolve after a successful revision; never optimistically invent the authoritative leaf list.
9. Reset/branch Assistant state on asset change.
10. Surface copy-job progress and typed failures without exposing hidden member names.
# Security and privacy review
The release is blocked until all of these are true:
- caller identity is required by Context, Resource, Activity, Reference, and Session reads that can emit Resource identity;
- project mutation requires current write authority;
- library list SQL applies owner/direct-share/current-org membership before pagination;
- by-ID unauthorized reads do not confirm existence;
- nested resolution never widens grants;
- a published package has no live dependency on another top-level library Context;
- promote cannot copy an inaccessible or restricted leaf;
- copy strips credentials, source ACLs, and live provider tokens;
- sharing clearly grants access to the copied material contained in the Context;
- project-to-personal-library capture passes the governing export policy or an explicit recorded approval;
- origin and usage are reauthorized at response time;
- organization removal invalidates grants;
- background jobs reauthorize actor membership and asset access before every protected phase;
- logs, traces, audit events, and job errors contain safe IDs and counts, not source bodies;
- Resource classification/retention policy may block promotion or external sharing;
- encrypted blob and extracted-text storage uses the same backup, deletion, and key-rotation guarantees as project content;
- trash/retention jobs do not delete a snapshot still referenced by an active Context version.
# Performance, reliability, and observability
- Use keyset pagination for assets and resolved leaves.
- Resolve with one per-call memo and batched member reads; reject excessive depth/node/leaf counts explicitly.
- Cache a resolved projection only by the complete fingerprint: asset ID, version, package hash, grant/membership epoch, resolver schema version, and classification policy revision.
- Invalidate on any governing revision or access epoch.
- Copy blobs by streaming; never load a full corpus into memory.
- Batch metadata writes and downstream ingestion/embedding work.
- Use content hashes to avoid recomputing extraction when policy allows, while keeping authorization metadata independent.
- Jobs have leases, heartbeats, resumable cursors, bounded retries, dead-letter state, cancel, and safe cleanup.
- Metrics cover list/resolve latency, leaf and binding-slot counts, cache hit rate, copy bytes, job duration, retry count, grant denials, and redaction count. No metric label contains user content.
# Migration and compatibility
- Keep `/contexts`, `/contexts/:id/resolved`, and existing project Context behavior available.
- Backfill the new project Context description as empty.
- Do not automatically lift every project Context into a user library; that would copy sensitive material without an explicit user action.
- “Save to library” creates the first lineage record.
- Existing project Context IDs and definitions remain unchanged.
- Add the user-library feature behind a short-lived rollout flag only if required for deployment safety; do not maintain two durable truths.
- The Alpha Mock badge is removed slice by slice only when the corresponding real path is complete and authorized.
# Verification matrix
## Unit
- Include/exclude precedence, stable order, duplicate leaves, nested provenance, cycle detection, depth/node/leaf bounds.
- Permission lattice, current organization membership, owner-only grant management.
- Revision CAS, idempotent retry, definition hashing, trash/restore.
- Origin and usage redaction.
## Store and contract
- Authorized SQL list and keyset cursor correctness.
- No post-pagination filtering.
- Atomic asset/version publication.
- Snapshot reference retention and garbage collection.
- Memory and SQLite stores pass the same Context contract suite.
## Integration
- two users, two organizations, direct share, organization share, edit versus use;
- organization removal and direct grant revocation;
- attempt to add an inaccessible nested Context fails without disclosing its name;
- source nested Context revoked after a parent revision was published; the parent still resolves from its embedded snapshot without leaking the source asset;
- project Resource ACL exclusion;
- organization-governed project export denied/approved by policy;
- promote with `whole-project`;
- connector-backed source copied without a credential;
- origin project deletion;
- copy job crash/restart at every phase;
- two concurrent editors and stale expected version;
- idempotent duplicate materialization request.
## End-to-end
1. Create a personal Context before selecting a project.
2. Edit its description and Included/Excluded members.
3. Resolve nested members and display correct provenance.
4. Share `use` to an organization; a current member can inspect and materialize but cannot edit.
5. Share `edit` to a user; that user creates a new revision.
6. Save a project Context containing six authorized Resources to the library.
7. Delete the origin project; the library copy still resolves to six.
8. Materialize the library version into a different project; six new project Resources and one ordinary project Context appear.
9. Edit the project copy; the library master does not change.
10. Remove the organization member; future library reads return not found.
## Security
- guessed IDs;
- hidden Resource names in resolved output, errors, Activity, References, Sessions, origin, and usage;
- cross-project IDs in library definitions;
- share escalation;
- stale organization membership cache;
- promotion of restricted/classified material;
- connector-token transfer;
- prompt injection in description and copied source;
- background job continuing after project membership or library grant revocation.
# Acceptance criteria
1. `/library/context` works with no selected project.
2. Every canonical library Context is user-owned and private by default.
3. Users and organizations can receive `use` or `edit`; the server returns effective permissions.
4. The screen’s Included, Excluded, and Resources projections operate on real data.
5. Existing Context expansion, exclusion, memoization, and cycle semantics remain intact.
6. Description round-trips and enters Context assembly only as labeled untrusted guidance.
7. Project promotion and project materialization are independent version-pinned copies.
8. No library Context contains a live project Resource reference.
9. No published library Context contains a live dependency on another top-level library Context.
10. No unauthorized Resource, project, user, organization, source Context, origin, or usage identity leaks.
11. Large copies are durable, idempotent, resumable, and publish atomically.
12. Concurrent edits use revisions and cannot silently overwrite one another.
13. The resolved list remains responsive at thousands of leaves.
14. Existing project Context APIs remain compatible.
15. The Mock badge is removed only after the production API, permissions, jobs, and adversarial tests pass.
# Non-goals
- live synchronization between a library Context and project copies;
- automatic promotion of project Contexts;
- transferring connector credentials;
- a public Context marketplace;
- organization ownership in the first increment;
- semantic search over sensitive source bodies;
- silently omitting inaccessible dependencies;
- replacing Omega’s existing Context set algebra or project retrieval pipeline.
# Sources
- [Taurus Alpha — latest audited library implementation](https://github.com/gccurtis/taurus-alpha/commit/d00b20450f6c0cbc8be82cf7d4fde942ebadda86)
- [Taurus Omega — latest audited runtime](https://github.com/gccurtis/taurus-omega/commit/d1d4c2fd5343daee9faf39c1a6896a922c417bd9)
- [Taurus Alpha latest library implementation and backend request](https://github.com/gccurtis/taurus-alpha/blob/main/docs/backend-requests/asset-library-owner-scope.md)
- [Taurus Alpha Context/Template console contract](https://github.com/gccurtis/taurus-alpha/blob/main/src/lib/features/library/LibraryConsole.svelte.md)
- [Taurus Alpha access-enforcement audit](https://github.com/gccurtis/taurus-alpha/blob/main/docs/backend-requests/resource-access-enforcement.md)
- [Taurus Omega Context model and service](https://github.com/gccurtis/taurus-omega/blob/main/core/capability/contexts/contexts.go)
- [Taurus Omega Context resolver and caller-free Catalog port](https://github.com/gccurtis/taurus-omega/blob/main/core/capability/contexts/resolve.go)
- [Taurus Omega Context handlers](https://github.com/gccurtis/taurus-omega/blob/main/core/handlers/context/context.go)
- [Taurus Omega Context Resource catalog wiring](https://github.com/gccurtis/taurus-omega/blob/main/core/wiring/context_catalog.go)
- [Taurus Omega Context SQLite store](https://github.com/gccurtis/taurus-omega/blob/main/core/platform/storage/sqlite/sqlite_context.go)
- [Taurus Omega Document asynchronous prompt resolution](https://github.com/gccurtis/taurus-omega/blob/main/core/capability/document/prompt.go)
- [Taurus Omega Agent Knowledge boundary](https://github.com/gccurtis/taurus-omega/blob/main/core/capability/agent/ask.go)
- [Taurus Omega project identity and membership model](https://github.com/gccurtis/taurus-omega/blob/main/core/capability/access/project.go)
- [Taurus Omega organization membership model](https://github.com/gccurtis/taurus-omega/blob/main/core/capability/organization/organization.go)
- [Taurus Omega route composition](https://github.com/gccurtis/taurus-omega/blob/main/core/transport/routes.go)
- [Operation Biblioteca — Corpora, Libraries, and Connectors](https://app.notion.com/p/394b6410e5028197a7fbcb72b6212ec7)
- [SOL Z 109 — Context Assembly, Trust Labels, Scope, and Budgets](https://app.notion.com/p/39bb6410e5028161b7b8c4f78f96de73)
- [Product — Taurus Product Vision](https://app.notion.com/p/38bb6410e502813e928cdd165dfe773d)

