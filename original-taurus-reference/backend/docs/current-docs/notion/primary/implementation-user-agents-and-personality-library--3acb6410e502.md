---
title: "Implementation — User Agents & Personality Library"
notion_page_id: "3acb6410e50281229fe9eec53047607c"
notion_url: "https://app.notion.com/3acb6410e50281229fe9eec53047607c"
project: "Taurus Yesod"
role: "Primary"
format: "Spec"
created: "2026-07-29 19:53:31Z"
mirrored_at: "2026-07-30"
mirrored_from_notion: true
---

# Implementation — User Agents & Personality Library

> Source mirror. Preserve this page as planning evidence; use the agent-facing execution packet when one exists.

> **Implementation outcome**
>
> Build `/library/agents` as a signed-in, user-level workspace that works before a project is selected. It presents every Agent Task currently working for the signed-in user across projects they can still access, lets the user start a new project-bound Agent, and provides a durable exchange for answering questions and steering active work. The same route contains the user’s Personality library.
>
> Canonical library Personalities are owned by one user. Other users and organizations may receive `use` or `edit` grants, but they are not v1 owners. Bringing a Personality into a project creates an independent project-local Persona copy at an exact version. Agent Tasks remain project-scoped, requester-private, and permanently bound to the project selected when they are created.
## Bottom line
Omega already contains most of the reasoning and execution engine this screen requires: durable Plan and Action Tasks, a background job runner, bounded tools, versioned Personas, immutable Persona snapshots, and persistent chat turns. The new work is primarily about scope, interaction, and production hardening:
- Add a user-level, cross-project Agent projection without moving Tasks out of their projects.
- Add a canonical user-owned Personality library with user and organization grants.
- Preserve the existing project-local Persona model as the independent copy used inside projects.
- Add a durable Task exchange with typed questions, answers, and steering.
- Add Task revision/CAS, request idempotency, and atomic Task-plus-job creation.
- Reauthorize project membership, project role, Resource access, and Context access during background execution—not only when the HTTP request creates the Task.
- Make requester privacy explicit. A project membership alone must not reveal another user’s Task objective, context, exchange, or result.
- Resolve the current composer ambiguity: when a Task is selected, the composer communicates with that Task; it never silently starts a new Agent.
This is not a redesign of the Agent reasoning model. It is the user-facing application and authority layer around the engine that already exists.
## Governing terminology and scope
The product and the code intentionally use different words:
<table header-row="true">
<tr>
<td>Surface</td>
<td>Canonical term</td>
<td>Meaning</td>
</tr>
<tr>
<td>Frontend, product copy, and new user-level API</td>
<td>**Personality**</td>
<td>A reusable behavior profile visible in the user’s library</td>
</tr>
<tr>
<td>Internal Go packages and domain types</td>
<td>**Persona**</td>
<td>The implementation term already used by Omega</td>
</tr>
<tr>
<td>User library</td>
<td>**Library Persona** internally</td>
<td>A user-owned, versioned master that may be shared</td>
</tr>
<tr>
<td>Project</td>
<td>**Project Persona copy**</td>
<td>An independent copy admitted into one project</td>
</tr>
<tr>
<td>Agent Task</td>
<td>**Persona snapshot**</td>
<td>Immutable behavior copied onto the Task for deterministic execution</td>
</tr>
</table>
The scopes are equally deliberate:
```plain text
User library scope
  Library Persona master
    ├── immutable versions
    ├── user/org grants
    ├── global user default
    └── origin and visible usage projection

Project scope
  Project Persona copy
    ├── independent metadata and versions
    ├── source lineage only
    └── project-local default override, if retained

Task scope
  Agent Task
    ├── one immutable ProjectID
    ├── one RequesterID
    ├── exact Persona snapshot
    ├── durable runs and exchange
    └── current authority rechecked during execution
```
The `/library/agents` route is user-level. It does not make Agent Tasks user-level objects. It is a filtered projection over project-local Tasks.
## Current Omega evidence
The implementation should preserve the parts of Omega that are already sound.
### Durable Agent Tasks
[`core/capability/agent/task.go`](https://github.com/gccurtis/taurus-omega/blob/main/core/capability/agent/task.go) already defines:
- `plan` and `action` Task modes;
- lifecycle states including `queued`, `running`, `waiting`, `completed`, `partially_completed`, `failed`, and `canceled`;
- immutable objective, `ProjectID`, and `RequesterID`;
- bounded Context items;
- an immutable Persona snapshot;
- Task-local notes, to-dos, working plans, generated Plan revisions, and Task runs;
- a durable `agent.task.run` job payload that contains only Task and run identifiers;
- project-scoped `Get`, `List`, `ListByDocument`, and `ListByPersona`;
- heartbeat and stale-run recovery hooks.
[`core/capability/agent/workflow.go`](https://github.com/gccurtis/taurus-omega/blob/main/core/capability/agent/workflow.go) already:
- resolves an exact Persona before creating a Task;
- reloads the Task from durable state inside the worker;
- binds Knowledge and Task-local tools;
- conditionally binds Document mutation tools for Action mode;
- validates Plan and Action structured output;
- maps an Action report with `outcome: "blocked"` to `TaskStateWaiting`;
- pushes best-effort terminal notifications.
These are the execution primitives to extend. A second Agent engine must not be created for the library route.
### Versioned Personas and snapshots
[`core/capability/persona/persona.go`](https://github.com/gccurtis/taurus-omega/blob/main/core/capability/persona/persona.go) already provides:
- stable Persona identity;
- immutable versions;
- expected-version conflict detection;
- explicit definitions for focus, behavioral guidance, Context references, verification, and output preferences;
- per-user/per-project defaults;
- immutable snapshots copied onto Tasks;
- a managed General Persona;
- bounded fields and reference counts.
The immutable version and snapshot model is correct. The missing layer is a user-owned library above the existing project-local Persona.
### Existing routes are selected-project routes
[`core/handlers/agent/agent.go`](https://github.com/gccurtis/taurus-omega/blob/main/core/handlers/agent/agent.go) and [`core/transport/routes.go`](https://github.com/gccurtis/taurus-omega/blob/main/core/transport/routes.go) currently expose Agent and Persona endpoints only behind `requireProject`. A user cannot call them before selecting a project, and a Task list covers only the selected project.
The route table already has a signed-in `gated` group that does not require an active project. Project listing and organization management live there. The new user-level APIs belong in that group.
### Persistent chats are not yet a Task exchange
[`core/capability/chat/chat.go`](https://github.com/gccurtis/taurus-omega/blob/main/core/capability/chat/chat.go) persists project-scoped Chats and ordered turns. [`core/wiring/chat_engine.go`](https://github.com/gccurtis/taurus-omega/blob/main/core/wiring/chat_engine.go) answers Ask turns inline, but every Plan or Action turn starts a new Task.
That behavior means the current `PostTurn` contract cannot implement “answer the Agent’s question” or “steer this Task.” Posting another Plan or Action turn would create a second Task. The implementation must add a Task-owned exchange or deliberately refactor Chat into a generic conversation service before reuse. This specification chooses a Task-owned exchange because it allows the answer, Task state transition, new run, idempotency receipt, and job insertion to commit atomically.
### Persistence and access primitives
[`core/platform/storage/sqlite/sqlite_agent.go`](https://github.com/gccurtis/taurus-omega/blob/main/core/platform/storage/sqlite/sqlite_agent.go), [`core/platform/storage/sqlite/sqlite_persona.go`](https://github.com/gccurtis/taurus-omega/blob/main/core/platform/storage/sqlite/sqlite_persona.go), and [`core/platform/storage/sqlite/sqlite_migrate.go`](https://github.com/gccurtis/taurus-omega/blob/main/core/platform/storage/sqlite/sqlite_migrate.go) already persist Tasks, project Personas, Persona versions/defaults, Chats, and Chat turns.
[`core/capability/access/project.go`](https://github.com/gccurtis/taurus-omega/blob/main/core/capability/access/project.go) already supports:
- `ProjectsForUser`, which can populate the New Agent project picker;
- `MembershipRole`, which can authorize an explicitly selected project without changing the session’s active project;
- project roles with `CanWrite`;
- organization and project membership primitives.
These should be reached through narrow ports and wiring adapters so the Agent and Persona capabilities do not acquire ambient authority.
## Product and screen contract
### Route and availability
The canonical Alpha route remains:
```plain text
/library/agents
```
It must be available whenever the user is signed in, including:
- before any project has been selected;
- after the user signs in on a new device;
- while another project is selected in the main workspace;
- after the user loses access to one of several projects.
Opening or operating this route must not change the session’s active project. Starting an Agent in Helios while Vanguard is selected does not switch the main workspace to Helios.
### Left navigation
The left rail contains:
```plain text
AGENTS
  Activity

PERSONALITIES
  Search
  Owner filter
  Personality list
```
Behavior:
- `Activity` selects the cross-project Task projection.
- Search filters the Personality library by name and description.
- Owner filter values are `All owners`, `Owned by me`, and `Shared with me`.
- Each Personality row identifies shared state without exposing grants the viewer is not authorized to inspect.
- The default Personality carries a visible default marker.
- Selecting a Personality opens its definition in the center and Details/Sharing/About in the right panel.
- Shared `use` assets are readable and copyable but not editable.
- Shared `edit` assets expose revision editing but not owner-only share or trash/restore controls.
### Activity center stage
The Activity center stage contains:
```plain text
Activity
Every agent working for you, across projects.

[New agent]

Working now (N)
  Running / Queued / Needs you rows

Recently finished (N)
  Done / Partially completed / Failed / Canceled rows
```
Only Tasks whose `RequesterID` is the signed-in user appear. A user does not inherit another user’s Tasks merely because both are members of the same project or use the same Personality.
Each row shows:
- presentation status;
- objective;
- project name;
- Personality name;
- mode (`plan` or `action`);
- relative update time;
- attention indicator when input is required.
The presentation mapping is deterministic:
```go
func PresentTaskState(state TaskState, openRequiredQuestions int) string {
	switch {
	case state == TaskStateWaiting && openRequiredQuestions > 0:
		return "needs_you"
	case state == TaskStateQueued || state == TaskStateRunning:
		return "working"
	case state == TaskStateCompleted:
		return "done"
	case state == TaskStatePartiallyCompleted:
		return "partially_completed"
	case state == TaskStateFailed:
		return "failed"
	case state == TaskStateCanceled:
		return "canceled"
	default:
		return "working"
	}
}
```
Selecting a Task:
- keeps Activity selected in the left rail;
- highlights the Task row;
- opens the Task exchange in the right panel;
- changes the composer’s semantic mode;
- never changes the active project.
### Right panel: Now
When no Task is selected, the Now lens shows cross-project counts and the instruction to select a Task.
When a Task is selected, it shows:
- objective and state;
- project and exact Personality snapshot;
- ordered exchange;
- running/queued progress;
- open typed questions;
- task result when settled;
- pause, resume, and cancel controls when legal;
- a link to open the project or target Resource;
- safe explanation of when steering will take effect.
The exchange must not expose hidden chain-of-thought. It contains only product-facing messages:
- objective;
- progress summaries;
- explicit questions;
- user answers;
- user steering;
- verified result summaries;
- safe system state changes.
### Right panel: New agent
The New Agent lens contains:
- project picker populated from the signed-in user’s accessible projects;
- Personality picker populated from the effective library;
- exact selected Personality version;
- mode picker if more than Action is exposed;
- optional target Resource;
- objective composer.
The selected project is immutable after creation. The UI explains this before submission.
The project picker disables projects in which the user cannot currently create work. The backend remains authoritative and rechecks `CanWrite`.
### Personality editor
Selecting a Personality opens:
- title, owner, and default marker;
- immutable current version indicator;
- editable definition fields when permitted;
- `Save as new revision`;
- requester-private Task history across accessible projects;
- Details, Sharing, and About lenses.
Definition fields map to the existing internal Persona model:
```typescript
export interface PersonalityDefinition {
  focus: string;
  behavioralGuidance: string;
  outputPreferences: string;
  defaultVerification: string;
  contextReferences: string[];
}
```
The current version is never edited in place. Saving submits the shared asset’s `expectedHeadVersion` and `expectedMetadataVersion`; a conflict refetches the current asset and Personality version and asks the user to reconcile.
### Composer state machine
The screenshots currently imply two incompatible meanings for the bottom composer: “start a new Agent” and “talk to the selected Agent.” The implementation must make the mode explicit.
```typescript
export type AgentComposerMode =
  | {
      kind: 'new_task';
      projectId: string | null;
      personalityId: string | null;
    }
  | {
      kind: 'answer_question';
      taskId: string;
      questionId: string;
      expectedRevision: number;
    }
  | {
      kind: 'steer_task';
      taskId: string;
      expectedRevision: number;
    }
  | {
      kind: 'terminal';
      taskId: string;
    };
```
Rules:
- No selected Task + New Agent lens: submit creates a new Task.
- Selected waiting Task + open required question: submit answers that exact question.
- Selected queued/running Task: submit appends steering to that exact Task.
- Selected terminal Task: composer is read-only and offers `Continue as new agent`, which creates a new draft with explicit confirmation.
- Switching to New Agent preserves a separate unsent new-Agent draft; it does not reinterpret text typed for a selected Task.
- The submit button label and accessible name reflect the mode: `Start agent`, `Answer`, or `Steer`.
- A Task answer or steering request always carries `taskId`, `expectedRevision`, and `clientRequestId`.
No input may silently fall back from Task interaction to Task creation.
## Domain model
### Shared library envelope and Personality projection
Personality must use the same neutral library kernel as Context and Template. The shared `library.Asset` is the single authority for stable identity, user ownership, display metadata, head and metadata revisions, lifecycle, protected origin/lineage, and timestamps. The shared `library.Grant` and permission evaluator are the single authority for user and organization grants.
Do **not** create a second Persona-specific asset, owner, grant, or ACL vocabulary. The Persona capability owns only the immutable Personality definition payload and Personality-specific behavior. Its aggregate projects the shared envelope:
```go
package persona

import "taurus/core/kernel/library"

type LibraryPersona struct {
	library.Asset
}

type PersonalityVersion struct {
	AssetID        string     `json:"assetId"`
	Version        int64      `json:"version"`
	Definition     Definition `json:"definition"`
	DefinitionHash string     `json:"definitionHash"`
	CreatedBy      string     `json:"createdBy"`
	CreatedAt      time.Time  `json:"createdAt"`
}
```
The owner is always `Asset.OwnerUserID` in v1; ownership is not polymorphic. `Asset.Kind` must be `library.AssetPersonality`. The asset’s `HeadVersion` points to an immutable `PersonalityVersion`, while `MetadataVersion` is the compare-and-swap token for name, description, lifecycle, and grant mutations.
Handlers return the shared `library.EffectivePermissions` projection. They do not reconstruct access from owner or grant rows and do not introduce Personality-only permission names.
<table header-row="true">
<tr>
<td>Caller relationship</td>
<td>Read</td>
<td>Use/copy</td>
<td>Revise</td>
<td>Manage grants</td>
<td>Trash/restore</td>
</tr>
<tr>
<td>Owner user</td>
<td>Yes</td>
<td>Yes</td>
<td>Yes</td>
<td>Yes</td>
<td>Yes</td>
</tr>
<tr>
<td>User/org `edit` grant</td>
<td>Yes</td>
<td>Yes</td>
<td>Yes</td>
<td>No</td>
<td>No</td>
</tr>
<tr>
<td>User/org `use` grant</td>
<td>Yes</td>
<td>Yes</td>
<td>No</td>
<td>No</td>
<td>No</td>
</tr>
<tr>
<td>No effective grant</td>
<td>No</td>
<td>No</td>
<td>No</td>
<td>No</td>
<td>No</td>
</tr>
</table>
Grant resolution is dynamic in the shared library kernel. A user leaving an organization immediately loses the organization-derived permission. The common kernel also applies non-disclosing by-ID behavior, lifecycle checks, and owner-only grant management consistently across Personality, Context, and Template.
### Project Persona copy
The existing project Persona remains canonical inside a project. Add lineage rather than replacing it:
```go
type ProjectCopyLineage struct {
	SourceLibraryAssetID    string    `json:"sourceLibraryPersonalityId,omitempty"`
	SourceLibraryVersion    int64     `json:"sourceLibraryVersion,omitempty"`
	SourceDefinitionDigest string    `json:"sourceDefinitionDigest,omitempty"`
	CopiedBy                string    `json:"copiedBy,omitempty"`
	CopiedAt                time.Time `json:"copiedAt,omitempty"`
}
```
Copy behavior:
1. Authorize `use` on the exact Library Persona version.
2. Authorize `CanWrite` in the destination project.
3. Read the exact immutable source version.
4. Validate or rebind Context references.
5. Reuse an existing project copy only when its current definition digest still exactly matches the selected source version; otherwise create a normal project-local Persona and version 1.
6. Store lineage.
7. Record a safe audit event and idempotency receipt.
The project copy does not retain a live content dependency. Updating, sharing, revoking, trashing, or deleting the source does not mutate the copy.
This exact-digest rule prevents a subtle failure: selecting Library Analyst v4 must not silently run a locally modified project copy that originally came from v4 but has since diverged. Reuse is an optimization, never a semantic substitution. A duplicate HTTP submission reuses the copy recorded in its idempotency receipt.
### Global default
```go
type UserDefault struct {
	UserID             string    `json:"userId"`
	PersonalityAssetID string    `json:"personalityId"`
	UpdatedAt          time.Time `json:"updatedAt"`
}
```
The referenced Personality must remain usable by the user. If access is later revoked, default resolution falls back to the managed General Personality and clears or marks the stale preference.
Existing per-user/per-project defaults may remain as explicit project overrides during migration. New Agent uses:
```plain text
explicit selection
  > project override, when applicable
  > global user default
  > managed General
```
### Task lineage and revision
Extend the existing Task without changing its project-local identity:
```go
type Task struct {
	ID          string
	ProjectID   string
	RequesterID string
	Revision    int64

	Mode      TaskMode
	State     TaskState
	Objective string

	Persona TaskPersonaSnapshot

	Attention      Attention
	Control        TaskControl
	ExchangeHead   int64
	ConsumedThrough int64

	// Existing Context, Workspace, Plans, Runs, timestamps, and target remain.
}

type TaskPersonaSnapshot struct {
	ProjectPersonaID       string
	ProjectPersonaVersion  int
	PersonalityAssetID     string
	LibraryPersonaVersion  int64
	Name                   string
	Focus                  string
	Instructions           string
	ContextReferences      []string
	DefaultVerification    string
	OutputPreferences      string
	DefinitionDigest       string
}

type Attention struct {
	Required bool   `json:"required"`
	Reason   string `json:"reason,omitempty"` // question | approval | access_revoked
	Count    int    `json:"count,omitempty"`
}

type TaskControl struct {
	DesiredState string `json:"desiredState,omitempty"` // running | paused | canceled
}
```
`PersonalityAssetID` provides a stable cross-project filter for “Task history for Analyst,” while the full snapshot keeps past work deterministic.
### Exchange and questions
```go
type MessageKind string

const (
	MessageObjective MessageKind = "objective"
	MessageProgress  MessageKind = "progress"
	MessageQuestion  MessageKind = "question"
	MessageAnswer    MessageKind = "answer"
	MessageSteering  MessageKind = "steering"
	MessageResult    MessageKind = "result"
	MessageSystem    MessageKind = "system"
)

type Message struct {
	TaskID      string          `json:"taskId"`
	Seq         int64           `json:"seq"`
	Kind        MessageKind     `json:"kind"`
	ActorKind   string          `json:"actorKind"` // user | agent | system
	ActorUserID string          `json:"actorUserId,omitempty"`
	QuestionID  string          `json:"questionId,omitempty"`
	Body        string          `json:"body"`
	Payload     json.RawMessage `json:"payload,omitempty"`
	CreatedAt   time.Time       `json:"createdAt"`
}

type QuestionState string

const (
	QuestionOpen      QuestionState = "open"
	QuestionAnswered  QuestionState = "answered"
	QuestionDismissed QuestionState = "dismissed"
)

type Question struct {
	ID         string        `json:"id"`
	TaskID     string        `json:"taskId"`
	Prompt     string        `json:"prompt"`
	Required   bool          `json:"required"`
	State      QuestionState `json:"state"`
	Options    []string      `json:"options,omitempty"`
	AnswerSeq  int64         `json:"answerSeq,omitempty"`
	CreatedAt  time.Time     `json:"createdAt"`
	AnsweredAt *time.Time    `json:"answeredAt,omitempty"`
}
```
Invariants:
- Message sequence is strictly increasing within a Task.
- A required open question makes `Attention.Required` true.
- An answer names exactly one open question on the same Task.
- One question may be answered once.
- Steering never rewrites `Objective`.
- A message cannot move a Task to another project.
- Only the requester may read or append the Task exchange in v1.
- Product-facing messages never contain hidden reasoning or provider transport.
## Persistence design
The schema below extends the existing SQLite design. Exact migration numbering follows the repository’s migration mechanism.
### Shared envelope and Personality-owned tables
The common library migration creates `library_assets`, `library_asset_grants`, protected lineage, usage, idempotency receipts, durable library jobs, and materialization records once for all three library capabilities. Personality must not create parallel item, grant, job, or materialization tables. For a Personality:
- `library_assets.kind = 'personality'`;
- `library_assets` owns identity, `owner_user_id`, name, description, `head_version`, `metadata_version`, lifecycle, safe `origin_json`, and timestamps;
- `library_asset_grants` owns user/organization `use` and `edit` grants;
- the shared permission evaluator owns current-organization expansion and effective permissions;
- the shared usage, mutation-receipt, and protected-lineage machinery records copies without making provenance an authorization shortcut.
The shared migration is defined once by the library kernel. Its authoritative shape is:
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
```
In the shared envelope, `head_version = 0` means “no published version yet.” Personality creation writes immutable version 1 and advances the head to 1 in the same transaction before the asset becomes listable, so a visible Personality never exposes version 0.
`library_materializations` is the canonical cross-capability operation/receipt record. `library_asset_usage` is an append-only successful-materialization event keyed to it; repeated use of the same asset or a later version in the same target is valid and produces another event. `library_jobs` is the common durable record for asynchronous work. Status is exposed through `/me/library-materializations/:materializationID` and, when a job exists, `/me/library-jobs/:jobID`. Fast operations may complete inline with a materialization and mutation receipt but no job row.
Personality adds only its immutable version payload and the user’s default pointer:
```sql
CREATE TABLE personality_library_versions (
    asset_id         TEXT NOT NULL,
    version          INTEGER NOT NULL,
    definition_json  BLOB NOT NULL,
    definition_hash  TEXT NOT NULL,
    created_by       TEXT NOT NULL REFERENCES users(id),
    created_at       TEXT NOT NULL,
    PRIMARY KEY (asset_id, version),
    CHECK (version >= 1),
    FOREIGN KEY (asset_id) REFERENCES library_assets(id) ON DELETE CASCADE
);

CREATE TABLE user_personality_defaults (
    user_id     TEXT PRIMARY KEY REFERENCES users(id),
    asset_id    TEXT NOT NULL REFERENCES library_assets(id),
    updated_at  TEXT NOT NULL
);
```
The service validates `kind = 'personality'` for every version and default read/write; a foreign key alone cannot express that cross-table discriminator. Creating a Personality or publishing a revision commits the common asset envelope, the `personality_library_versions` row, and the shared idempotency receipt in one SQLite transaction. Grant writes go only through the shared library Store and validate the user or organization subject through the identity capability.
### Project-copy lineage
Retain the existing `personas` and `persona_versions` tables. Add lineage to the stable project Persona:
```sql
ALTER TABLE personas
ADD COLUMN source_library_asset_id TEXT;

ALTER TABLE personas
ADD COLUMN source_library_version INTEGER;

ALTER TABLE personas
ADD COLUMN source_definition_digest TEXT NOT NULL DEFAULT '';

ALTER TABLE personas
ADD COLUMN copied_by TEXT NOT NULL DEFAULT '';

ALTER TABLE personas
ADD COLUMN copied_at TEXT NOT NULL DEFAULT '';

CREATE INDEX idx_project_personas_source
ON personas(project_id, source_library_asset_id);
```
Lineage is informational. It does not create a foreign-key cascade from the library master to project content.
### Task projection and CAS
The existing `agent_tasks` table already contains requester, project, Persona, state, timestamps, heartbeat, and the serialized aggregate. Add narrow query and concurrency fields:
```sql
ALTER TABLE agent_tasks
ADD COLUMN revision INTEGER NOT NULL DEFAULT 1;

ALTER TABLE agent_tasks
ADD COLUMN personality_asset_id TEXT NOT NULL DEFAULT '';

ALTER TABLE agent_tasks
ADD COLUMN project_persona_id TEXT NOT NULL DEFAULT '';

ALTER TABLE agent_tasks
ADD COLUMN presentation_state TEXT NOT NULL DEFAULT 'working';

ALTER TABLE agent_tasks
ADD COLUMN attention_required INTEGER NOT NULL DEFAULT 0;

ALTER TABLE agent_tasks
ADD COLUMN attention_reason TEXT NOT NULL DEFAULT '';

ALTER TABLE agent_tasks
ADD COLUMN latest_summary TEXT NOT NULL DEFAULT '';

CREATE INDEX idx_agent_tasks_requester_state_updated
ON agent_tasks(requester_id, state, updated_at DESC, id DESC);

CREATE INDEX idx_agent_tasks_requester_persona_updated
ON agent_tasks(requester_id, personality_asset_id, updated_at DESC, id DESC);
```
Task aggregate mutations use compare-and-swap:
```sql
UPDATE agent_tasks
SET
    state = ?,
    content = ?,
    presentation_state = ?,
    attention_required = ?,
    attention_reason = ?,
    latest_summary = ?,
    updated_at = ?,
    revision = revision + 1
WHERE id = ?
  AND requester_id = ?
  AND revision = ?;
```
Zero changed rows are a version conflict or inaccessible Task, not permission to overwrite the current value.
Heartbeat updates are operational lease updates and need not increment the user-domain revision:
```sql
UPDATE agent_tasks
SET heartbeat_at = ?
WHERE id = ?
  AND state = 'running';
```
### Exchange, questions, and idempotency
```sql
CREATE TABLE agent_task_messages (
    task_id       TEXT NOT NULL REFERENCES agent_tasks(id),
    seq           INTEGER NOT NULL,
    kind          TEXT NOT NULL,
    actor_kind    TEXT NOT NULL,
    actor_user_id TEXT NOT NULL DEFAULT '',
    question_id   TEXT NOT NULL DEFAULT '',
    body          TEXT NOT NULL,
    payload       TEXT NOT NULL DEFAULT '{}',
    created_at    TEXT NOT NULL,

    PRIMARY KEY (task_id, seq),
    CHECK (kind IN (
        'objective', 'progress', 'question', 'answer',
        'steering', 'result', 'system'
    )),
    CHECK (actor_kind IN ('user', 'agent', 'system'))
);

CREATE INDEX idx_agent_task_messages_task_created
ON agent_task_messages(task_id, seq);
```
```sql
CREATE TABLE agent_task_questions (
    id          TEXT PRIMARY KEY,
    task_id     TEXT NOT NULL REFERENCES agent_tasks(id),
    prompt      TEXT NOT NULL,
    required    INTEGER NOT NULL DEFAULT 1,
    state       TEXT NOT NULL,
    options     TEXT NOT NULL DEFAULT '[]',
    answer_seq  INTEGER,
    created_at  TEXT NOT NULL,
    answered_at TEXT,

    CHECK (state IN ('open', 'answered', 'dismissed'))
);

CREATE INDEX idx_agent_task_questions_open
ON agent_task_questions(task_id, state, created_at);
```
```sql
CREATE TABLE agent_task_submissions (
    requester_id      TEXT NOT NULL REFERENCES users(id),
    client_request_id TEXT NOT NULL,
    operation         TEXT NOT NULL,
    task_id           TEXT NOT NULL REFERENCES agent_tasks(id),
    response          TEXT NOT NULL,
    created_at        TEXT NOT NULL,

    PRIMARY KEY (requester_id, client_request_id)
);
```
The existing durable `jobs` table should serve as the outbox. Do not create a second background queue. Add a Store unit-of-work that commits:
```plain text
Task aggregate
+ first TaskRun
+ objective exchange message
+ idempotency receipt
+ agent.task.run job
```
in one SQLite transaction.
The same rule applies when an answer resumes a waiting Task:
```plain text
answer message
+ answered Question
+ Task state/revision
+ new queued TaskRun
+ idempotency receipt
+ agent.task.run job
```
## Backend service contracts
### Persona library service
```go
type LibraryAssetPort interface {
	Create(ctx context.Context, asset library.Asset) error
	UpdateMetadata(
		ctx context.Context,
		asset library.Asset,
		expectedMetadataVersion int64,
	) error
	ByID(ctx context.Context, actor Actor, assetID string) (library.Asset, error)
	ListEffective(
		ctx context.Context,
		actor Actor,
		kind library.AssetKind,
		request library.PageRequest,
	) (library.AssetPage, error)
	EffectivePermissions(
		ctx context.Context,
		actor Actor,
		assetID string,
	) (library.EffectivePermissions, error)
	UpsertGrant(ctx context.Context, actor Actor, grant library.Grant, expectedMetadataVersion int64) error
	DeleteGrant(
		ctx context.Context,
		actor Actor,
		assetID string,
		subjectKind library.SubjectKind,
		subjectID string,
		expectedMetadataVersion int64,
	) error
	Grants(ctx context.Context, actor Actor, assetID string) ([]library.Grant, error)
	Trash(ctx context.Context, actor Actor, assetID string, expectedMetadataVersion int64) error
	Restore(ctx context.Context, actor Actor, assetID string, expectedMetadataVersion int64) error
}

type PersonalityVersionStore interface {
	Create(
		ctx context.Context,
		asset library.Asset,
		version PersonalityVersion,
		receipt library.MutationReceipt,
	) error
	Publish(
		ctx context.Context,
		asset library.Asset,
		version PersonalityVersion,
		expectedHeadVersion int64,
		expectedMetadataVersion int64,
		receipt library.MutationReceipt,
	) error
	Version(ctx context.Context, assetID string, version int64) (PersonalityVersion, error)
	Versions(ctx context.Context, assetID string) ([]PersonalityVersion, error)
	DefaultForUser(ctx context.Context, userID string) (UserDefault, error)
	SetDefaultForUser(ctx context.Context, actor Actor, value UserDefault, receipt library.MutationReceipt) error
}

type PersonalityLibrary struct {
	assets   LibraryAssetPort
	versions PersonalityVersionStore
}
```
`LibraryAssetPort` is an adapter to the shared kernel and shared tables, not a second Personality ACL implementation. The SQLite unit of work composes the shared asset Store with `personality_library_versions` so asset creation and head publication are atomic. Every capability read first resolves a `kind = personality` asset through the common authorization path, then reads the exact Personality payload.
Unknown and unauthorized Personalities should normally be indistinguishable at the API boundary.
### Project copy service
```go
type ProjectAuthorizer interface {
	Role(userID, projectID string) (ProjectRole, error)
}

type CopyRequest struct {
	ProjectID           string
	PersonalityAssetID  string
	Version             int64
	Name                string
	ClientRequestID     string
}

func (p *Personas) CopyLibraryPersonaIntoProject(
	actorID string,
	req CopyRequest,
) (Record, error)
```
`CopyLibraryPersonaIntoProject` must authorize both source use and destination write. The caller cannot provide the Persona definition in this request.
### User Task projection
```go
type UserTaskQuery struct {
	RequesterID      string
	AuthorizedProjects []string
	States           []TaskState
	PersonalityAssetID string
	ProjectID        string
	Limit            int
	Cursor           string
}

type UserTaskPage struct {
	Items      []AgentActivityItem `json:"items"`
	NextCursor string              `json:"nextCursor,omitempty"`
}
```
The handler obtains the caller’s current project memberships and passes only authorized project IDs. Detail and mutation requests reauthorize the exact Task immediately before returning or committing.
### Task authority
Background work cannot rely on the membership check that happened when the Task was created.
```go
type TaskAuthorityPort interface {
	AuthorizeRun(
		requesterID string,
		projectID string,
		mode TaskMode,
	) error

	AuthorizeResource(
		requesterID string,
		projectID string,
		kind string,
		resourceID string,
		operation string,
	) error

	AuthorizeContext(
		requesterID string,
		projectID string,
		contextID string,
	) error
}
```
Authorization occurs:
- when a worker claims a run;
- before Knowledge retrieval returns a source;
- before every Resource read;
- immediately before every protected Resource mutation;
- after pause/cancel/revocation checkpoints;
- before a waiting Task is resumed.
The existing Resource access resolver explicitly assumes its caller is already a project member. Wiring must compose project membership with Resource narrowing; the worker must not call the narrowing resolver by itself.
Knowledge tools must become requester-aware:
```go
type AuthorizedKnowledge interface {
	SearchTool(actor ActorScope) intelligence.ToolBinding
	ListTool(actor ActorScope) intelligence.ToolBinding
	ReadTool(actor ActorScope) intelligence.ToolBinding
}

type ActorScope struct {
	UserID    string
	ProjectID string
	TaskID    string
}
```
Every returned source is filtered through current Resource/attachment/connector access before any text reaches the model.
### Task exchange service
```go
type AppendMessageRequest struct {
	TaskID          string
	RequesterID     string
	ExpectedRevision int64
	ClientRequestID string
	Kind            MessageKind
	QuestionID      string
	Body            string
}

type AppendMessageResult struct {
	Task     Task     `json:"task"`
	Message  Message  `json:"message"`
	Question *Question `json:"question,omitempty"`
}
```
Validation:
```go
func validateUserMessage(task Task, req AppendMessageRequest, q *Question) error {
	if task.RequesterID != req.RequesterID {
		return ErrTaskNotFound
	}
	if task.Revision != req.ExpectedRevision {
		return ErrTaskVersionConflict
	}

	switch req.Kind {
	case MessageAnswer:
		if task.State != TaskStateWaiting ||
			q == nil ||
			q.TaskID != task.ID ||
			q.State != QuestionOpen {
			return ErrInvalidTaskMessage
		}
	case MessageSteering:
		if task.State != TaskStateQueued &&
			task.State != TaskStateRunning &&
			task.State != TaskStateWaiting {
			return ErrTaskNotSteerable
		}
	default:
		return ErrInvalidTaskMessage
	}
	return nil
}
```
### Safe worker checkpoints
The current Intelligence tool loop is long-running. It needs a checkpoint hook that can observe Task control and pending exchange messages between safe phases.
```go
type Checkpoint struct {
	TaskID          string
	RunID           string
	ConsumedThrough int64
	Phase           string
}

type CheckpointDecision struct {
	Continue        bool
	Pause           bool
	Cancel          bool
	NewMessages     []Message
	ConsumeThrough  int64
}

type CheckpointPort interface {
	Check(context.Context, Checkpoint) (CheckpointDecision, error)
}
```
Checkpoints occur:
1. before retrieval;
2. after retrieval and before final prompt assembly;
3. before each model/tool round;
4. after a provider response and before dispatching proposed tools;
5. immediately before each protected tool effect;
6. after each tool result;
7. before settlement.
Semantics:
- Steering received before a checkpoint is incorporated into the next model round.
- Steering cannot undo an effect that committed before the checkpoint.
- Pause stops scheduling new rounds and lets an already-started safe operation settle.
- Cancel denies future effects at the next checkpoint.
- A single provider request may finish before pause/cancel becomes observable.
- The UI states this honestly.
If a run reports blocked:
```plain text
validated blocked report
  -> append typed Question rows/messages
  -> set Task waiting + attention
  -> settle current run
  -> do not enqueue another run
```
If the user answers:
```plain text
authorized answer
  -> append answer
  -> close exact Question
  -> create new queued TaskRun
  -> set Task queued, clear resolved attention
  -> enqueue one job atomically
```
## HTTP API
Product-facing URLs and JSON use `personality`; internal services translate to `persona`.
The browser route is `/library/agents`. The project-independent backend routes below use `/me/...`; examples omit the deployment API prefix (for example `/api/v1`) so routing code can apply the environment’s canonical prefix once.
### List Agent activity
```javascript
GET /me/agent-tasks?states=queued,running,waiting&personalityId=lp_123&limit=50&cursor=...
```
```json
{
  "items": [
    {
      "taskId": "task_123",
      "project": {
        "id": "project_helios",
        "name": "Helios"
      },
      "objective": "Synthesize the Q3 interviews into a findings draft",
      "mode": "action",
      "state": "running",
      "presentation": "working",
      "personality": {
        "id": "lp_analyst",
        "name": "Analyst",
        "version": 4
      },
      "attention": {
        "required": false
      },
      "latestSummary": "Reviewing interview transcripts",
      "createdAt": "2026-07-29T15:00:00Z",
      "updatedAt": "2026-07-29T15:02:40Z"
    }
  ],
  "nextCursor": "opaque"
}
```
The response never includes raw Task Context, provider messages, evidence text, or tool arguments.
### Create an Agent Task
```javascript
POST /me/agent-tasks
Content-Type: application/json
X-CSRF-Token: ...
```
```json
{
  "projectId": "project_helios",
  "mode": "action",
  "objective": "Synthesize the Q3 interviews into a findings draft",
  "personality": {
    "libraryPersonalityId": "lp_analyst",
    "version": 4
  },
  "context": [],
  "target": {
    "kind": "document",
    "id": "doc_findings"
  },
  "clientRequestId": "01J4T8HMR9Y7A0W3K6P2N5Q8VX"
}
```
The server:
- authorizes the project without selecting it;
- proves `CanWrite`;
- proves `use` access to version 4;
- reuses only an exact-digest project copy or creates a new independent project copy;
- snapshots the Persona;
- creates Task, first run, objective message, idempotency receipt, and job atomically.
```json
{
  "task": {
    "id": "task_123",
    "projectId": "project_helios",
    "revision": 1,
    "state": "queued",
    "presentation": "working"
  },
  "projectPersonality": {
    "id": "persona_project_copy",
    "sourceLibraryPersonalityId": "lp_analyst",
    "sourceLibraryVersion": 4
  }
}
```
A duplicate `clientRequestId` from the same requester returns the original response.
### Get Task detail
```javascript
GET /me/agent-tasks/task_123
```
The service returns `404` when the Task is unknown, belongs to another requester, or is in a project the requester can no longer access.
### Read exchange
```javascript
GET /me/agent-tasks/task_123/exchange?afterSeq=24&limit=100
```
```json
{
  "taskRevision": 9,
  "messages": [
    {
      "seq": 25,
      "kind": "question",
      "actorKind": "agent",
      "questionId": "question_7",
      "body": "Should the findings be organized by customer segment or by theme?",
      "createdAt": "2026-07-29T15:05:00Z"
    }
  ],
  "questions": [
    {
      "id": "question_7",
      "prompt": "Should the findings be organized by customer segment or by theme?",
      "required": true,
      "state": "open",
      "options": ["Customer segment", "Theme"]
    }
  ],
  "nextAfterSeq": 25
}
```
### Answer a question
```javascript
POST /me/agent-tasks/task_123/messages
```
```json
{
  "kind": "answer",
  "questionId": "question_7",
  "body": "Organize them by theme, with customer segments noted within each theme.",
  "expectedRevision": 9,
  "clientRequestId": "01J4T8Q9P66Q3F0D0J75Q0ZHYC"
}
```
```json
{
  "task": {
    "id": "task_123",
    "revision": 10,
    "state": "queued",
    "presentation": "working"
  },
  "message": {
    "seq": 26,
    "kind": "answer",
    "questionId": "question_7",
    "body": "Organize them by theme, with customer segments noted within each theme."
  },
  "question": {
    "id": "question_7",
    "state": "answered",
    "answerSeq": 26
  }
}
```
### Steer an active Task
```json
{
  "kind": "steering",
  "body": "Prioritize claims supported by at least three interviews.",
  "expectedRevision": 6,
  "clientRequestId": "01J4T8S5FPN9Q5RR4BFA4EHV0X"
}
```
Response copy states whether the message is already consumed or is waiting for the next safe checkpoint.
### Control
```javascript
POST /me/agent-tasks/:taskID/pause
POST /me/agent-tasks/:taskID/resume
POST /me/agent-tasks/:taskID/cancel
```
Every request includes:
```json
{
  "expectedRevision": 12,
  "clientRequestId": "01J4T8..."
}
```
### Personality library list
```javascript
GET /me/personalities?query=analyst&owner=all&limit=50&cursor=...
```
```json
{
  "items": [
    {
      "id": "lp_analyst",
      "name": "Analyst",
      "description": "Careful, evidence-first research work.",
      "headVersion": 4,
      "metadataVersion": 7,
      "owner": {
        "kind": "user",
        "id": "user_me",
        "name": "You"
      },
      "effectivePermissions": {
        "canUse": true,
        "canEdit": true,
        "canShare": true,
        "canDelete": true
      },
      "isDefault": true,
      "updatedAt": "2026-07-26T18:00:00Z"
    }
  ],
  "nextCursor": null
}
```
### Create and revise
```javascript
POST /me/personalities
```
```json
{
  "name": "Analyst",
  "description": "Careful, evidence-first research work.",
  "definition": {
    "focus": "Research synthesis: weigh sources, separate claims from evidence, surface gaps.",
    "behavioralGuidance": "Never assert without a source...",
    "outputPreferences": "Findings as claim → evidence → confidence.",
    "defaultVerification": "Every claim traces to a cited span.",
    "contextReferences": []
  },
  "clientRequestId": "01J4T9..."
}
```
```javascript
POST /me/personalities/lp_analyst/revisions
```
```json
{
  "expectedMetadataVersion": 7,
  "expectedHeadVersion": 4,
  "name": "Analyst",
  "description": "Careful, evidence-first research work.",
  "definition": {
    "focus": "Research synthesis...",
    "behavioralGuidance": "Never assert without a source...",
    "outputPreferences": "Findings as claim → evidence → confidence.",
    "defaultVerification": "Every claim traces to a cited span.",
    "contextReferences": []
  },
  "clientRequestId": "01J4TA..."
}
```
### Sharing
```javascript
GET    /me/personalities/lp_analyst/shares
PUT    /me/personalities/lp_analyst/shares/organization/org_atlas_research
DELETE /me/personalities/lp_analyst/shares/organization/org_atlas_research
```
```json
{
  "permission": "use",
  "expectedMetadataVersion": 7,
  "clientRequestId": "01J4TB..."
}
```
The public grant identity is `(subjectKind, subjectID)`, matching the shared table’s uniqueness constraint. `PUT` creates or replaces the permission; `DELETE` removes it. Both mutations require the expected metadata version and client request ID; a DELETE transport may carry those values as `If-Metadata-Version` and `Idempotency-Key` headers. Only the owner may manage grants in V1. An `edit` recipient may revise the Personality but cannot share or trash/restore it. Ownership transfer is not supported in V1.
### Lifecycle
```javascript
DELETE /me/personalities/lp_analyst
POST   /me/personalities/lp_analyst/restore
```
`DELETE` is recoverable trash, never hard deletion. Both operations are owner-only, use metadata-version CAS plus `clientRequestId`, preserve immutable versions and protected lineage, and increment `metadataVersion` on success.
### Copy into the library
From a project:
```javascript
POST /me/personalities/captures
```
```json
{
  "projectId": "project_helios",
  "projectPersonalityId": "persona_analyst",
  "version": 4,
  "clientRequestId": "01J4TC..."
}
```
This endpoint is an explicit **project-to-personal-library data-export operation**, not a convenience copy implied by project membership. Before reading the definition and again immediately before commit, it must authorize:
1. current membership in the named project;
2. read access to the exact project Persona and version;
3. current access to every referenced Context whose identity would be preserved;
4. the governing project/organization personal-library export policy;
5. any required, recorded approval; and
6. an unchanged source revision or immutable source digest.
The resulting common `library.Asset` is owned by the authenticated exporting user. Safe origin and policy-decision lineage is written through the shared library envelope; project ACLs, organization grants, credentials, and live Context bindings are never copied upward.
Omega’s current `access.Project` has no organization ID. The server therefore cannot infer which organization governs a project or which export policy applies. When governance cannot be resolved, the policy decision is `unknown` and the operation fails closed. Do not infer permission from `CreatedBy`, project ownership, the session’s selected organization, or the fact that the caller can edit the Persona. A development deployment may permit explicitly classified ungoverned projects only through a configured policy rule; absence of a policy is denial.
```go
type ExportDecision string

const (
	ExportAllow            ExportDecision = "allow"
	ExportDeny             ExportDecision = "deny"
	ExportApprovalRequired ExportDecision = "approval_required"
	ExportUnknown          ExportDecision = "unknown"
)

type PersonalLibraryExportPolicyPort interface {
	EvaluatePersonaExport(
		ctx context.Context,
		actor Actor,
		projectID string,
		personaID string,
		version int,
	) (ExportDecision, error)
}
```
`deny`, `unknown`, a policy-store error, an unresolvable governing organization, a stale approval, or a changed source all abort without creating `library_assets`, `personality_library_versions`, grant, default, or lineage rows. The audit event records safe IDs, policy revision, decision, approver where applicable, and definition digest—never the Personality definition or hidden Context names.
From another library asset:
```javascript
POST /me/personalities/lp_shared/copy
```
```json
{
  "version": 3,
  "name": "Analyst — My copy",
  "clientRequestId": "01J4TD..."
}
```
The resulting owner is always the copying user.
### Bring into a project
```javascript
POST /me/personalities/lp_analyst/materializations
GET  /me/library-materializations/:materializationID
```
```json
{
  "version": 4,
  "targetProjectId": "project_helios",
  "clientRequestId": "01J4TE..."
}
```
This endpoint is signed-in and project-independent. It reauthorizes `use` on the exact library version plus current write access to the explicit target project; that project need not be the session’s current selection. Large operations return a common `/me/library-jobs/:jobID` status URL.
### Errors
Use stable codes in addition to safe messages:
```json
{
  "error": {
    "code": "task_version_conflict",
    "message": "The task changed. Refresh and try again.",
    "currentRevision": 10
  }
}
```
Relevant codes:
```plain text
not_found
forbidden
project_write_required
personality_use_required
personality_edit_required
personality_version_conflict
task_version_conflict
task_not_steerable
question_not_open
access_revoked
invalid_cursor
limit_exceeded
```
Do not reveal whether an inaccessible ID exists.
## Backend implementation
### Package placement
Keep capability ownership clear:
```plain text
core/kernel/library/
  types.go                      shared Asset, Grant, Permission, lineage values
  policy.go                     shared effective-permission evaluation

core/capability/persona/
  persona.go                    existing project Persona
  library.go                    Personality projection over library.Asset
  library_versions.go           immutable Personality definition payloads
  copy.go                       independent project-copy behavior
  export.go                     governed project-to-personal-library export

core/capability/agent/
  task.go                       existing Task aggregate
  task_exchange.go              Messages, Questions, CAS transitions
  task_control.go               pause/resume/cancel
  user_projection.go            cross-project summary contract
  workflow.go                   worker reauthorization/checkpoints

core/handlers/useragent/
  useragent.go                  gated `/me/agent-tasks` adapter

core/handlers/personality/
  personality.go                product-facing `/me/personalities` adapter

core/platform/storage/sqlite/
  sqlite_library.go             shared assets, grants, usage, receipts
  sqlite_personality_library.go Personality versions and user default
  sqlite_agent_exchange.go
  sqlite_agent_uow.go

core/wiring/
  user_agents.go                access/resource/org adapters
```
The handler and wiring layers may compose Access, Persona, Agent, Resource, Context, Organization, and Job services. Capabilities consume narrow ports and do not import Access merely to authorize themselves.
### User-level route registration
Register the new routes under:
```go
gated := e.Group("", s.requireUser, requireCSRF)
```
not:
```go
scoped := e.Group("", s.requireProject, requireCSRF)
```
Read-only list/detail requests still require the signed-in user. Mutations inherit CSRF protection.
### Atomic Task creation
Replace:
```go
store.CreateTask(task)
enqueuer.Enqueue(...)
```
with one Store transaction:
```go
type TaskCreateUoW interface {
	CreateTaskAndEnqueue(
		task Task,
		objective Message,
		submission Submission,
		job job.Record,
	) (CreateReceipt, error)
}
```
If the existing job package cannot expose a prepared record, add a narrow transaction method to the SQLite Store. Do not make the Agent capability write SQL or create a second queue.
### Requester-private reads
Add requester-aware Store methods:
```go
TaskForRequester(taskID, requesterID string) (Task, error)
TasksForRequester(query UserTaskQuery) (UserTaskPage, error)
```
Project-level administrative visibility is a separate future contract. Existing project Task routes should be cut over to requester-private behavior unless a deliberate Task-sharing model is added.
### Worker authority
At job claim:
```go
if err := authority.AuthorizeRun(
	task.RequesterID,
	task.ProjectID,
	task.Mode,
); err != nil {
	return workflows.SettleAccessRevoked(task, run, err)
}
```
For Action, a downgrade from edit/owner to read stops future mutations. A removed member cannot retrieve Knowledge or open a project-wide Resource simply because the Task was queued earlier.
The Document authorizer and Knowledge adapters must fail closed when required production dependencies are absent. A nil authorizer may remain valid only in focused unit tests.
### Questions from blocked reports
Do not leave `openQuestions` only inside `TaskRun.Result`. During settlement:
```go
func questionsFromReport(task Task, report ExecutionReport) []Question {
	out := make([]Question, 0, len(report.OpenQuestions))
	for _, prompt := range report.OpenQuestions {
		prompt = strings.TrimSpace(prompt)
		if prompt == "" {
			continue
		}
		out = append(out, Question{
			ID:        newID(),
			TaskID:    task.ID,
			Prompt:    prompt,
			Required:  true,
			State:     QuestionOpen,
			CreatedAt: time.Now().UTC(),
		})
	}
	return out
}
```
A blocked report with no actionable question should become a constructive failure or partially completed result, not an unresumable `waiting` Task.
### Progress messages
Progress is a bounded product projection, not raw model narration. Append it only at meaningful state transitions:
- queued;
- started;
- retrieving;
- applying a named safe operation;
- waiting for user;
- resumed;
- verifying;
- completed/failed/canceled.
Coalesce noisy updates and cap stored message size.
### Audit and observability
Record safe audit events for:
- Library Persona create/revise/trash/restore;
- grant create/change/delete;
- copy from project/library;
- bring into project;
- global default change;
- Agent Task create;
- answer/steering/pause/resume/cancel;
- access-revoked settlement.
Audit records contain IDs, actors, versions, roles, digests, and outcomes—not full behavioral guidance, prompts, Context content, or provider payloads.
Metrics:
```plain text
agent_tasks_created_total{mode}
agent_tasks_state_total{state}
agent_tasks_waiting_seconds
agent_task_messages_total{kind}
agent_task_cas_conflicts_total{operation}
agent_task_duplicate_submissions_total{operation}
agent_task_access_revocations_total{phase}
library_assets_total{kind,ownership}
library_asset_grants_total{kind,subject_kind,permission}
personality_library_versions_total
persona_project_copies_total
library_asset_query_seconds{kind}
personality_project_export_total{decision}
```
## Frontend implementation
### Route-level store
The route store is independent of the main selected-project workspace:
```typescript
export interface AgentsLibraryState {
  activity: {
    items: AgentActivityItem[];
    nextCursor: string | null;
    loading: boolean;
    selectedTaskId: string | null;
    filters: AgentActivityFilters;
  };

  personalities: {
    items: PersonalitySummary[];
    nextCursor: string | null;
    query: string;
    ownerFilter: 'all' | 'me' | 'shared';
    selectedPersonalityId: string | null;
  };

  selectedTask: TaskDetail | null;
  exchange: TaskExchangePage | null;

  rightLens: 'now' | 'new_agent' | 'details' | 'assistant';
  newAgentDraft: NewAgentDraft;
  composer: AgentComposerMode;
}
```
Entering `/library/agents`:
1. Fetch `GET /projects`.
2. Fetch user Agent activity.
3. Fetch the effective Personality library.
4. Fetch the global default.
5. Resolve URL-selected Task or Personality, if present.
These reads can run concurrently.
### New Agent flow
```typescript
async function startAgent(draft: NewAgentDraft) {
  const clientRequestId = draft.clientRequestId ?? newSubmissionId();

  const response = await api.post('/me/agent-tasks', {
    projectId: draft.projectId,
    mode: draft.mode,
    objective: draft.objective,
    personality: {
      libraryPersonalityId: draft.personalityId,
      version: draft.personalityVersion,
    },
    context: draft.context,
    target: draft.target,
    clientRequestId,
  });

  activity.upsert(response.task);
  selectTask(response.task.id);
  clearDraftAfterAcknowledgement();
}
```
The client retains the same `clientRequestId` across network retry. It does not generate a new ID after an ambiguous timeout.
### Selected Task and composer
```typescript
function deriveComposerMode(
  task: TaskDetail | null,
  openQuestions: TaskQuestion[],
  rightLens: RightLens,
  draft: NewAgentDraft,
): AgentComposerMode {
  if (rightLens === 'new_agent' || task === null) {
    return {
      kind: 'new_task',
      projectId: draft.projectId,
      personalityId: draft.personalityId,
    };
  }

  const required = openQuestions.find(
    (question) => question.required && question.state === 'open',
  );

  if (task.state === 'waiting' && required) {
    return {
      kind: 'answer_question',
      taskId: task.id,
      questionId: required.id,
      expectedRevision: task.revision,
    };
  }

  if (task.state === 'queued' || task.state === 'running' || task.state === 'waiting') {
    return {
      kind: 'steer_task',
      taskId: task.id,
      expectedRevision: task.revision,
    };
  }

  return { kind: 'terminal', taskId: task.id };
}
```
Submission dispatches by the discriminant. It does not infer intent from placeholder text.
### Optimistic behavior
- New Task rows may appear optimistically as `Submitting`, but transition to a canonical Task only after acknowledgement.
- Answers and steering appear as `pending` local messages keyed by `clientRequestId`.
- A successful response replaces the pending item with canonical `seq`.
- A `409 task_version_conflict` refetches Task detail/exchange and preserves the user’s unsent text for explicit resubmission.
- Permission loss removes inaccessible items and clears selected detail without showing stale sensitive content.
- Do not optimistically mark a question answered until the server confirms the atomic Task transition.
### Updates
The minimum implementation may poll:
```plain text
GET /me/agent-tasks?updatedAfter=<cursor>
GET /me/agent-tasks/:id/exchange?afterSeq=<n>
```
An SSE projection may be added:
```javascript
GET /me/agent-tasks/stream?afterEvent=<cursor>
Accept: text/event-stream
```
The durable Task/message state remains authoritative. A disconnected event stream must recover by cursor or refetch.
### Personality editing and grants
- Save always creates a revision.
- The editor sends both `expectedMetadataVersion` and `expectedHeadVersion`.
- `use` recipients see read-only fields and `Copy` / `Bring into project`.
- `edit` recipients see `Save as new revision`.
- Only owners see grant management and trash/restore.
- Owner names and organization names come from authorized public identity projections.
- About/Used In hides projects the viewer cannot access.
- Origin becomes `Unavailable project` when lineage remains but project metadata is no longer visible.
### Accessibility
- Status is communicated with text, not color alone.
- Composer mode is announced on Task selection.
- Open questions are labeled and associated with their answer input.
- Pause/cancel confirmation explains checkpoint semantics.
- Task list rows and Personality list rows are keyboard navigable.
- The right panel’s active lens uses proper tab semantics.
- Relative times retain machine-readable absolute timestamps.
## Security and privacy
### Authority rules
- The Library Persona owner is one user.
- A user/org grant never transfers ownership.
- Organization access is evaluated from current organization membership.
- `use` does not imply `edit`.
- `edit` does not imply share management or trash/restore.
- Bringing into a project requires both source `use` and destination `CanWrite`.
- Promoting a project Persona into a personal library is a governed data export; project read/write access alone is insufficient.
- Unknown organization linkage, unknown policy, policy errors, and missing or stale required approval fail closed.
- Starting an Agent requires current destination `CanWrite`.
- Plan/Action workers revalidate current authority.
- A Task is visible only to its requester in v1.
- A Task cannot move between projects.
- Project copies are independent and do not inherit library grants.
### Resource and Context privacy
The current Agent Knowledge tool contract is bound only to `ProjectID`. That is insufficient once Resources can be restricted to owners, users, or organizations. The implementation must pass the requester identity into Knowledge reads and filter every source before returning text.
Persona `ContextReferences` are references, not authority:
- A shared Personality must not disclose a private Context’s contents or name.
- Copy/import reauthorizes each reference.
- Inaccessible references are removed, left as unbound requirements, or require explicit user rebinding.
- A Task resolves Context again under current user and project authority.
- Revocation prevents future reads even though the Task retains a behavioral snapshot.
### Prompt and shared-content safety
Shared behavioral guidance is untrusted user-authored content:
- It may influence style and reasoning.
- It cannot register tools, broaden project scope, select credentials, or grant permissions.
- Server-owned tool schemas and authority checks remain fixed.
- The UI renders names/descriptions/guidance as escaped content.
- Logs and analytics do not record full definitions or Task messages by default.
### Revocation
<table header-row="true">
<tr>
<td>Revocation</td>
<td>Result</td>
</tr>
<tr>
<td>Library `use` grant removed</td>
<td>Future reads/copies denied; existing project copies remain</td>
</tr>
<tr>
<td>Library `edit` grant removed</td>
<td>Future revisions denied</td>
</tr>
<tr>
<td>User leaves organization</td>
<td>Organization-derived library access ends immediately</td>
</tr>
<tr>
<td>User removed from project</td>
<td>Project disappears from activity; future Task reads/effects stop</td>
</tr>
<tr>
<td>User downgraded to read</td>
<td>Existing Action cannot perform new writes</td>
</tr>
<tr>
<td>Resource access removed</td>
<td>Future retrieval/read/write denied</td>
</tr>
<tr>
<td>Source Personality trashed</td>
<td>Existing project copies and Task snapshots remain</td>
</tr>
</table>
### Error privacy
Unknown and inaccessible Task/Personality IDs return the same external not-found behavior. Logs may retain an internal denial reason with safe identifiers.
### Quotas and bounds
Define and enforce deployment-owned limits:
- Personalities owned per user;
- versions per Personality;
- grants per Personality;
- maximum definition bytes and Context references;
- open and total Agent Tasks per user;
- messages/questions per Task;
- message bytes;
- activity and exchange page sizes;
- concurrent running Tasks;
- model/tool/time/cost budgets.
Expensive Agent creation should have a per-user rate limit in addition to CSRF and Task concurrency quotas.
## Performance and reliability
### Query shape
The Activity list must use normalized columns and keyset pagination. It must not:
- load every project Task and filter in memory;
- decode full Task JSON for a summary list;
- issue one project lookup per row;
- issue one Personality lookup per row.
Flow:
```plain text
ProjectsForUser(user)
  -> authorized ProjectID set + safe project summaries
  -> one indexed TasksForRequester query
  -> batch-map project summary
  -> use denormalized snapshot name/version
```
Personality list similarly resolves effective access with indexed owner and grant queries, followed by a bounded batch of safe owner summaries.
### Cursor
Use an opaque versioned cursor:
```go
type TaskCursor struct {
	Version   int       `json:"v"`
	UpdatedAt time.Time `json:"updatedAt"`
	TaskID    string    `json:"taskId"`
}
```
Stable order:
```sql
ORDER BY updated_at DESC, id DESC
```
### Idempotency and retries
- Every client mutation carries `clientRequestId`.
- A duplicate returns the original canonical response.
- Task creation and answer-resume insert the durable job atomically.
- Worker tool effects retain their existing operation idempotency.
- Process restart reconstructs from Task, run, messages, and job state.
- A lost HTTP response does not create a second Task or second answer.
### CAS and concurrent edits
- Personality revision publication uses the shared asset’s metadata and head-version CAS tokens.
- Task interaction/control uses Task revision.
- Heartbeat is separate from domain revision.
- Worker checkpoints update consumed message watermark by CAS.
- Conflicts refetch; they do not silently merge incompatible state.
## Migration and cutover
This is a pre-release product, so the implementation may use a direct coordinated cutover. The migration still needs deterministic behavior.
### Existing project Personas
Keep every existing Persona as a project-local Persona. **Do not automatically promote any project Persona into a user-owned library asset.** Such promotion would move potentially organization-governed data into a personal, reshareable scope without an explicit user action or export-policy decision.
The cutover creates no `library_assets` or `personality_library_versions` row from project data. A user may later invoke the explicit project-to-library export endpoint for one exact Persona version. That operation performs current source authorization, governance resolution, export-policy evaluation, optional approval validation, sanitization, and immutable snapshot creation before it records protected origin lineage.
Because the current Project aggregate lacks organization identity, any project whose governance cannot be proven returns `export_unknown` and fails closed. A deployment can enable export from explicitly classified ungoverned test projects through policy configuration; a migration must never infer that classification from `CreatedBy`, project role, or name.
Managed General is not migrated into one owned asset per project. It remains a managed fallback available to every user.
### Existing defaults
- Preserve `persona_defaults` as project overrides during transition.
- Do not guess or export a global library default from a project default, even when the same project Persona is selected everywhere.
- A user may set a global default only to a currently usable `kind = personality` library asset created directly, copied from another authorized library asset, or admitted through an explicit governed project export.
- Until then, global resolution uses managed General while existing project defaults remain project-local overrides.
- Once Alpha writes only the global default, remove legacy project-default UI. The project table may remain for explicit project overrides if the product keeps them.
### Existing Tasks
- Set `revision = 1`.
- Set `project_persona_id` from the existing snapshot ID.
- Backfill `personality_asset_id` only when a prior explicit, auditable library-copy lineage already exists; otherwise leave it blank.
- Preserve snapshots and run results exactly.
- Create no synthetic exchange beyond an optional objective and terminal-result projection that is clearly marked as migrated.
- Historical Tasks without library lineage remain visible in Activity but may not appear under a library Personality history filter.
- Enforce requester-private reads at cutover.
### Existing chats
- Keep Chat resources and Ask behavior unchanged.
- Keep Plan/Action-origin Task links.
- Do not route selected-Task steering through the existing “new turn starts new Task” behavior.
- If future design unifies conversations, perform an explicit one-authority migration rather than dual-writing.
### Route cutover
- Add `/library/agents` in Alpha.
- Add gated `/me/agent-tasks` and `/me/personalities` APIs.
- Move Alpha Agent-library data access to them.
- Retain existing project Agent/Persona endpoints only for project-local editor integrations during migration.
- Remove or harden project-wide Task list/detail semantics before production.
## Delivery phases
### Phase 0 — Contracts and threat model
- Freeze owner/grant/copy semantics.
- Freeze requester-private Task visibility.
- Freeze composer state machine.
- Define authorization matrix and error codes.
- Define Context-reference rebinding behavior.
- Add adversarial fixtures for two users, two organizations, and two projects.
### Phase 1 — User Personality library
- Add or reuse the shared `library_assets`, `library_asset_grants`, permission, usage, lineage, and mutation-receipt foundation.
- Add `personality_library_versions`, `user_personality_defaults`, and the Personality payload Store.
- Reuse shared user/org grant resolution; do not implement a Persona-specific ACL path.
- Add immutable revisions, CAS, trash/restore, global default.
- Add library list/detail/create/revise/share/copy APIs.
- Add project-copy lineage and bring-into-project.
- Add the explicit governed project-to-library export operation; leave existing project Personas in place.
### Phase 2 — User Agent projection
- Add Task normalized columns and indexes.
- Add requester-aware Store queries.
- Add gated cross-project activity/detail APIs.
- Batch project summaries.
- Enforce requester-private reads.
- Implement New Agent project selection without session project mutation.
### Phase 3 — Reliable Task creation
- Add Task revision.
- Add submission receipts.
- Add Task-plus-job unit of work using the existing jobs table.
- Make creation idempotent.
- Add current membership/role reauthorization at worker claim.
### Phase 4 — Exchange and control
- Add Task messages/questions.
- Materialize blocked report questions.
- Add answer and steering APIs.
- Add pause/resume/cancel.
- Add safe checkpoint hook to the model/tool loop.
- Resume waiting Tasks through a new queued run and atomic job insertion.
- Add durable event cursor or polling projection.
### Phase 5 — Resource and Context hardening
- Make Knowledge tools actor-aware.
- Compose project membership with Resource narrowing.
- Reauthorize Context references.
- Fail closed when production authorizers are absent.
- Add revocation tests during retrieval, tool execution, waiting, and resume.
### Phase 6 — Alpha integration
- Implement `/library/agents`.
- Connect activity, filters, Personality editor, sharing, About, New Agent, and selected Task exchange.
- Implement explicit composer modes.
- Add optimistic/idempotent submission handling.
- Add accessibility and responsive behavior.
- Remove mock data.
### Phase 7 — Production proof
- Load-test cross-project activity and library search.
- Exercise restart and duplicate-delivery scenarios.
- Validate audit redaction.
- Validate project/org/resource revocation.
- Validate migration reports.
- Remove incompatible legacy routes or clearly mark them internal.
## Test plan
### Persona library unit tests
- Personality identity, ownership, metadata, lifecycle, grants, and origin resolve through the shared library envelope.
- A non-`personality` asset cannot receive a `personality_library_versions` row or become the user’s Personality default.
- Owner receives every permission.
- `use` receives read/use only.
- `edit` receives read/use/edit but not owner controls.
- User and organization grants compose to the strongest role.
- Organization departure removes effective access.
- Revision conflict preserves the accepted current version.
- Trash/restore preserves versions and lineage.
- Copy pins the requested exact version.
- Source revision/revocation/trash does not change project copies.
- Global default falls back safely when access is lost.
- Project-to-library export denies an unknown governing organization or unknown policy.
- Project-to-library export denies a stale/missing approval and source revision mismatch without leaving partial rows.
- An allowed export records the exact source version, policy revision, safe origin, and authenticated user owner.
### Task domain unit tests
- Project and requester never change.
- Only requester can read/interact.
- Answer requires an open question on the same Task.
- Duplicate answer is idempotent.
- Waiting answer creates exactly one new run/job.
- Steering does not rewrite objective.
- Terminal Tasks reject steering.
- Pause/cancel transitions obey expected revision.
- Heartbeat does not create false user-domain conflicts.
- A blocked report without questions does not create an unresumable waiting Task.
### Store tests
- Library item and version create atomically.
- Revision append and pointer advance atomically.
- Grant uniqueness is enforced.
- Task CAS rejects stale writes.
- Message sequence is monotonic.
- Task creation + submission + job roll back together.
- Answer + Question + run + job roll back together.
- Duplicate client request returns the original receipt.
- Keyset pagination is stable during concurrent inserts.
- Requester/personality indexes are used for representative queries.
### Handler tests
- Signed-in user can list activity without selected project.
- Starting a Task does not alter selected project.
- Read project cannot start an Agent.
- Inaccessible project/Task/Personality returns safe not-found/forbidden behavior.
- Shared `use` can copy but cannot revise.
- Shared `edit` can revise but cannot manage grants.
- Non-owner cannot trash or restore.
- CSRF is required for mutations.
- Body and page limits are enforced.
### Adversarial authorization tests
Use at least:
```plain text
User A — Org Red — Project Helios owner
User B — Org Red — Project Helios editor
User C — Org Blue — Project Vanguard owner
```
Prove:
- B cannot see A’s Task objective/exchange/result.
- C cannot enumerate A’s Library Persona without a grant.
- Org Red `use` grant admits B but not C.
- Removing B from Org Red removes access immediately.
- An existing project copy remains after source grant removal.
- Removing A from Helios while A’s Task is queued prevents run claim.
- Downgrading A to read while an Action is running prevents the next mutation.
- Restricting a Resource prevents later Knowledge/read/tool access.
- A shared Personality’s private Context reference does not leak.
- Forged project IDs cannot start Tasks.
- Duplicate submission IDs cannot create duplicate Tasks/messages/effects.
### Worker and recovery tests
- Crash after Task transaction but before HTTP response returns same Task on retry.
- Crash after answer transaction resumes from durable job.
- Crash during running work is recovered without losing exchange.
- Steering appended during a provider call is consumed at the next checkpoint.
- Cancel before a tool checkpoint prevents the effect.
- Cancel after a committed effect does not falsely claim it was reverted.
- Lost SSE/poll interval recovers by cursor.
- Process restart preserves `Needs you`.
### Frontend tests
- Route loads before project selection.
- Activity groups and counts match presentation mapping.
- Task selection changes composer mode.
- Required question mode posts an answer, not a new Task.
- Running mode posts steering, not a new Task.
- Terminal mode cannot silently submit.
- New Agent draft survives selecting and leaving a Task.
- Network retry reuses `clientRequestId`.
- CAS conflict preserves unsent text.
- Permission loss clears stale detail.
- `use`, `edit`, and owner controls render correctly.
- Keyboard and screen-reader behavior identifies status, lens, and composer mode.
## Acceptance criteria
The work is complete when all of the following are true:
- [ ] `/library/agents` works for a signed-in user with no selected project.
- [ ] Activity shows requester-owned Tasks across every currently accessible project.
- [ ] No project member can read another requester’s private Task through list, detail, exchange, chat, job, or indirect identity routes.
- [ ] Starting an Agent accepts an explicit accessible project and does not change the session’s active project.
- [ ] The Task’s project is immutable.
- [ ] Library Personalities are owned by users only.
- [ ] Personality identity, metadata, lifecycle, grants, effective permissions, and protected origin use the common `library_assets` / `library_asset_grants` authority; no Persona-specific ACL tables exist.
- [ ] Users and organizations may receive `use` or `edit` grants.
- [ ] Grants do not create ownership.
- [ ] Library versions are immutable and revision saves use CAS.
- [ ] Bringing a Personality into a project creates an independent exact-version project Persona copy.
- [ ] Source edits, revocation, trash, and deletion do not mutate existing copies or Task snapshots.
- [ ] Used-in and origin projections reveal only projects the caller may access.
- [ ] The global user default resolves safely with managed General fallback.
- [ ] Project-to-personal-library promotion occurs only through an explicit governed export operation.
- [ ] Unknown project organization or export policy fails closed and produces no partial library asset.
- [ ] Agent Task creation is idempotent and commits its durable job atomically.
- [ ] Task mutations use revision/CAS.
- [ ] A blocked Task exposes typed durable questions.
- [ ] Answering a question resumes the same Task with exactly one new run.
- [ ] Steering reaches the same selected Task at the next safe checkpoint.
- [ ] The composer visibly distinguishes new Task, answer, steering, and terminal modes.
- [ ] The composer never silently creates a Task while a Task interaction is selected.
- [ ] Pause/cancel semantics are honest about already-started provider calls and committed effects.
- [ ] Worker execution reauthorizes project membership, required role, Resource access, and Context access.
- [ ] Knowledge retrieval cannot bypass user-specific Resource access.
- [ ] Revocation prevents future reads and effects.
- [ ] Cross-project lists are cursor-paginated and use normalized indexed projections.
- [ ] Product responses and logs do not expose hidden reasoning, provider transport, or inaccessible content.
- [ ] Migration preserves existing project Personas and Task snapshots without implicitly exporting project data, guessing ownership, or guessing defaults.
- [ ] Unit, Store, handler, adversarial, restart, and frontend suites pass.
## Non-goals
The first production slice does not include:
- organization-owned library assets;
- ownership transfer;
- public marketplace or anonymous share links;
- nested groups or team ownership;
- automatic promotion of existing project Personas into personal libraries;
- live synchronization from a Library Personality into project copies;
- automatic deletion of copies after source revocation;
- moving a Task between projects;
- sharing Agent Tasks with collaborators;
- collaborative real-time editing of one Personality beyond optimistic CAS;
- arbitrary user-defined tool grants;
- autonomous Routines, schedules, or multi-Agent delegation;
- immediate interruption of an already executing provider request or committed Resource effect;
- redesign of the document, chat, slide, or spreadsheet editors;
- replacement of the existing Agent reasoning engine;
- exposing chain-of-thought.
## Source map
- [Taurus Alpha — latest audited library implementation](https://github.com/gccurtis/taurus-alpha/commit/d00b20450f6c0cbc8be82cf7d4fde942ebadda86)
- [Taurus Alpha — Agents feature components](https://github.com/gccurtis/taurus-alpha/tree/main/src/lib/features/agents)
- [Taurus Alpha — Agent and Personality mock data](https://github.com/gccurtis/taurus-alpha/blob/main/src/lib/features/agents/agents-mock.ts)
- [Taurus Alpha — Agents console backend scope](https://github.com/gccurtis/taurus-alpha/blob/main/docs/backend-requests/agents-console-scope.md)
- [Taurus Alpha — user-owned library scope](https://github.com/gccurtis/taurus-alpha/blob/main/docs/backend-requests/asset-library-owner-scope.md)
- [Taurus Alpha — Resource access enforcement audit](https://github.com/gccurtis/taurus-alpha/blob/main/docs/backend-requests/resource-access-enforcement.md)
- [Taurus Omega — latest audited runtime](https://github.com/gccurtis/taurus-omega/commit/d1d4c2fd5343daee9faf39c1a6896a922c417bd9)
- [Agent Task model and service](https://github.com/gccurtis/taurus-omega/blob/main/core/capability/agent/task.go)
- [Agent workflow and worker](https://github.com/gccurtis/taurus-omega/blob/main/core/capability/agent/workflow.go)
- [Agent runner, prompts, and structured output](https://github.com/gccurtis/taurus-omega/blob/main/core/capability/agent/runner.go)
- [Task-local tools](https://github.com/gccurtis/taurus-omega/blob/main/core/capability/agent/task_tools.go)
- [Document Agent tools](https://github.com/gccurtis/taurus-omega/blob/main/core/capability/agent/document_tools.go)
- [Agent HTTP handlers](https://github.com/gccurtis/taurus-omega/blob/main/core/handlers/agent/agent.go)
- [Persona capability](https://github.com/gccurtis/taurus-omega/blob/main/core/capability/persona/persona.go)
- [Persona HTTP handlers](https://github.com/gccurtis/taurus-omega/blob/main/core/handlers/persona/persona.go)
- [Persona SQLite Store](https://github.com/gccurtis/taurus-omega/blob/main/core/platform/storage/sqlite/sqlite_persona.go)
- [Agent SQLite Store](https://github.com/gccurtis/taurus-omega/blob/main/core/platform/storage/sqlite/sqlite_agent.go)
- [SQLite schema and migrations](https://github.com/gccurtis/taurus-omega/blob/main/core/platform/storage/sqlite/sqlite_migrate.go)
- [Chat capability](https://github.com/gccurtis/taurus-omega/blob/main/core/capability/chat/chat.go)
- [Chat HTTP handlers](https://github.com/gccurtis/taurus-omega/blob/main/core/handlers/chat/chat.go)
- [Chat-to-Agent wiring adapter](https://github.com/gccurtis/taurus-omega/blob/main/core/wiring/chat_engine.go)
- [Project access and membership](https://github.com/gccurtis/taurus-omega/blob/main/core/capability/access/project.go)
- [Route groups](https://github.com/gccurtis/taurus-omega/blob/main/core/transport/routes.go)
- [CSRF, Resource guard, and session activity middleware](https://github.com/gccurtis/taurus-omega/blob/main/core/transport/middleware.go)
- [Resource access scope](https://github.com/gccurtis/taurus-omega/blob/main/core/capability/resource/access.go)
- [Resource access resolver](https://github.com/gccurtis/taurus-omega/blob/main/core/capability/resource/resource.go)
- [Ephemeral Task notifications](https://github.com/gccurtis/taurus-omega/blob/main/core/capability/notification/notification.go)
- [Composition root](https://github.com/gccurtis/taurus-omega/blob/main/core/wiring/wiring.go)
- [SOL X 45 — Quarterback, Agents, Personas & Task Execution](https://app.notion.com/p/39ab6410e50281b0bb98d7a1d726080f)
- [Architecture — Agent Personas](https://app.notion.com/p/395b6410e50281689ffdfcbdf1fd8c5c)
- [SOL Z 105 — Agents Screen](https://app.notion.com/p/39bb6410e50281cbafd9f930ba1f5302)

