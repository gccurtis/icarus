# Alpha remaining gaps — implementation plan

> **For agentic workers:** each phase is an **independently shippable,
> project-scoped increment** in the pattern of records 0060–0070 (capability or
> focused extension → SQLite → routes → wiring → unit + free dev-tests → paired
> `*.go.md` companions → numbered record). Checkbox steps track progress. **No time
> estimates — think in tasks.**

**Goal.** Build the Alpha backend needs decided on 2026-07-25 (summary:
[`alpha-remaining-gaps-summary.md`](alpha-remaining-gaps-summary.md)): resource
pinning, **document templates** (a document-level template object with named
context variables + optional per-block persona), **toast notifications**, and
**organizations + per-resource access scoping**. Non-Markdown import/export
(pdf/docx) is **on hold** by decision; Markdown already ships (record 0066).

**Architecture.** Capabilities/extensions under `core/capability/` behind narrow
ports, wired in `core/wiring`, on the project-scoped transport group, in the one
SQLite store. No capability imports another.

## Global constraints (every task inherits these)

1. **Project-scoped by default.** New tables key on `project_id`; new routes sit on
   `requireProject` and read `ctx.Project.ID`; capabilities take `Scope{ProjectID}`
   and re-check `entity.ProjectID == scope.ProjectID`. The **only** new
   above-project surfaces this plan adds are **organizations** (Phase 4) and
   **per-user toast delivery** (Phase 3) — each called out explicitly, like the
   already-shipped per-user avatar (record 0068).
2. **Ports & adapters** — no cross-capability imports; `wiring` injects.
3. **Paired docs in the same commit**; a `docs/records/NNNN-*.md` per increment.
   **Next free record number: 0071.**
4. **No external/commercial dependencies.** Pure-Go, in-tree, no AGPL/commercial
   libraries.
5. **Prove plumbing with unit tests + a free `dev-test/`.** No model-backed logic
   is added except that template variables and per-block persona flow into the
   existing `ResolveBlock`; the shipped `dev-test/prompt` covers resolution.
6. **Small, working steps** — smallest useful slice first.

## Build order

1. **Resource pinning** — small, self-contained; no decisions.
2. **Document templates** — the document-level template object + context variables
   + optional per-block persona.
3. **Toast notifications** — transient per-user toast delivery.
4. **Organizations + resource access scoping** — the access-model addition; one
   design decision (below) sets its blast radius.

**On hold (decision):** pdf/docx (and any non-Markdown) import/export. Not built
now; the UI offers Markdown only.

---

## Phase 1 — Resource pinning

**What / why.** `ResourceSettingsDialog` "Pin to top." Resources are a unified
catalog projected from family owners, so a cross-kind attribute lives in a small
side table the `resource` capability owns and merges into listings.

**Files:** create `core/capability/resource/attributes.go` (+`.md`),
`attributes_memory.go` (+`.md`); modify `resource.go`, `sqlite.go`,
`core/handlers/resource/resource.go`, `transport.go`, `wiring.go`; test
`attributes_test.go`; extend `dev-test/resources`.

**Interfaces (produces):** `Attributes{Pinned bool}`; `AttributeStore{Get, Set,
ByProject}`.

- [ ] Failing test: set `pinned` → surfaces in Get/List; pinned sort first;
      cross-project isolation. Run → red.
- [ ] Domain: `Attributes` + `AttributeStore` + memory store; `Resources` merges
      attributes into `Summary`, sorts pinned-first; `SetPinned`. Run → green.
- [ ] SQLite: `resource_attributes(project_id, kind, resource_id, pinned INTEGER
      NOT NULL DEFAULT 0, PRIMARY KEY(project_id, kind, resource_id))`; store
      methods; `var _ resource.AttributeStore = (*Store)(nil)`.
- [ ] Handler/transport: `PATCH /resources/:kind/:resourceID/attributes` `{pinned?}`
      (canWrite), `operationSync` sync; re-check project.
- [ ] Wiring + free dev-test (pin → lists first; isolated) + companions;
      `docs/records/0071-resource-pinning.md`. Green; commit.

---

## Phase 2 — Document templates

**Model (locked with product).** A template is not a separate resource type. The
document `Base` gets an **optional `Template` object, exactly like `layout`** — a
document either doesn't have it, or has it with these fields:

```
Base.Template  (optional)
  IsTemplate   bool                 // this document is a reusable template
  Persona      *PersonaSelection    // optional document-level default persona
  Variables    []ContextVariable    // named context slots
      Name          string
      Description   string
      BoundContext  string          // the bound context (cleared on duplicate)
```

**Flow (mostly frontend; backend is thin):**
- While **building** a template the client defines variables (names + descriptions)
  and binds each to real context; the document is a template by having
  `IsTemplate = true`.
- **Using** a template: the client duplicates it — the backend copies the structure
  and **clears every `BoundContext`** (keeps names/descriptions, sets
  `IsTemplate=false`). The client then prompts the user "what context for
  `<name>` (`<description>`)?" and, per answer, calls **one endpoint to set that
  variable's context across the whole document**, then triggers a refresh.
- A template with **no variables** is just a structural starting point.

Because `Template` lives on `Base`, it is **versioned through the existing
changeset machinery** (like `set_page_layout`/`set_header`) — no bespoke storage.

**Per-block persona (same phase).** `PromptData` gains an **optional persona
selection**; each prompt block may choose its persona, and if unset falls back to
the document-level `Template.Persona`, then the prior/default. `ResolveBlock`
threads the resolved persona and the document's bound variables into resolution.

**Files:** create `core/capability/document/template.go` (+`.md`)
(`TemplateInfo`, `ContextVariable`, validation, clone, clear-bindings); modify
`model.go` (`Base.Template`, `PromptData.Persona`), `changeset.go` /
`changeset_apply.go` / `changeset_inverse.go` / `changeset_validate.go` /
`rebase.go` / `clone.go` (new ops `set_template` and `set_context_variable`),
`prompt.go` (feed bound variables + selected persona into `ResolveBlock`),
`duplicate.go` (clear bindings on copy), handlers + `transport.go` + `wiring.go`;
tests + `dev-test/templates`.

**Interfaces (produces):** ops `set_template` (replace the `TemplateInfo`) and
`set_context_variable {name, boundContext}` (bind one variable document-wide);
`Documents.Templates(scope)` (list `IsTemplate` docs);
`Documents.CreateFromTemplate(scope, templateID, actor)` (duplicate + clear
bindings + `IsTemplate=false`).

- [ ] **Design record stub** `docs/records/0072-document-templates.md`: fix the
      `TemplateInfo` shape, the two ops, the persona fallback chain, and the
      clear-on-duplicate rule before code.
- [ ] Failing tests (`template_test.go`): `set_template` marks a doc + defines two
      variables → appears in `Templates`; `set_context_variable` binds one
      document-wide; `CreateFromTemplate` copies structure, clears bindings, sets
      `IsTemplate=false`; binding an undeclared variable is rejected; a prompt
      block's persona overrides the template default; undo/redo of both ops
      round-trips; cross-project isolation. Run → red.
- [ ] Domain: `TemplateInfo`/`ContextVariable` (+ bounds: name/description lengths,
      max variables), `Base.Template`, `PromptData.Persona`; clone + clear-bindings
      helpers. Run → green.
- [ ] Changeset ops: `set_template` (validate + apply + inverse + rebase + clone +
      summarize) and `set_context_variable` (set one variable's `BoundContext`;
      inverse restores prior). Follow the `set_page_layout` / `set_block_custom_typography`
      pattern exactly.
- [ ] `ResolveBlock`: resolve the effective persona (block → template → default)
      and make the document's bound variables available to the prompt model; unit
      test the selection precedence.
- [ ] `Duplicate` / `CreateFromTemplate`: copy the template structure, clear every
      `BoundContext`, set `IsTemplate=false`.
- [ ] Routes: the two ops flow through `POST /documents/:id/changes`; add
      `GET /documents/templates` (list `IsTemplate` docs) and
      `POST /documents { fromTemplateId }` (instantiate).
- [ ] Wiring + free `dev-test/templates` (define template + variables → list →
      instantiate → bindings cleared → set one variable → it's stored document-wide)
      + companions; finish record 0072. Green; commit.

---

## Phase 3 — Toast notifications

**Model (product).** Not an inbox — the system can **push a transient toast to a
user** at any time (e.g. a background task finishing), which the client drains on
its existing poll. Toast preferences (if backend-stored) are a small user field.

**Design.** A `notification` capability = an **ephemeral, bounded, per-user
(project-scoped) toast queue**. Producers enqueue via an injected `Notifier` port;
the client drains via a route. No durable history. **Per-user delivery is an
explicit above-strict-project surface** (a toast targets a user), but every toast
still carries the project it was raised in.

**Files:** create `core/capability/notification/notification.go` (+`.md`),
`memory.go` (+`.md`), `core/handlers/notification/notification.go` (+`.md`);
modify `transport.go`, `wiring.go` (inject `Notifier` into the agent task runner);
tests + `dev-test/notifications`.

**Interfaces (produces):** `Toast{id, level, title, body, projectID, createdAt}`;
`Notifier.Push(userID string, Toast)`; `Notifications.Drain(scope, userID)`.

- [ ] Decide durability in the record: **ephemeral in-memory** (recommended — a
      lost toast on restart is fine) vs a short-TTL table. Default: in-memory.
- [ ] Failing test: push two toasts for a user → `Drain` returns them once then
      empty; another user sees none; the per-user queue is length-bounded (drop
      oldest). Run → red.
- [ ] Domain: `Notifications` + `Notifier` port + bounded per-user store. Green.
- [ ] Route: `GET /notifications` drains the caller's queue.
- [ ] Wiring hook: inject `Notifier` into the agent task runner; push a toast on
      task completion/failure (proves the push path).
- [ ] Free `dev-test/notifications` (a completed task → `GET /notifications`
      returns it → second drain empty) + companions;
      `docs/records/0073-toast-notifications.md`. Green; commit.

---

## Phase 4 — Organizations + resource access scoping

**Model (product).** Add **organizations** — users belong to organizations — and
per-resource **access scoping**: private, anyone in the project, anyone in the
organization, specific people, or any combination.

**DECIDED (2026-07-25): narrowing-only — the project-scope invariant is absolute.**
To read or act on any resource you must be a member of its project, always. A
resource's access setting can only **further restrict within that project's
members** — it can never grant access to a non-member. Therefore:
- **Enforcement is one extra check** layered on the existing project gate:
  `member of project` **AND** `passes the resource's access scope`. The transport
  `requireProject` gate and every capability's `Scope` check are **unchanged**.
- The access modes are all **subsets of project members**: `project` = all members
  (default), `private` = owner only, `specific-people` = a named subset of members,
  `organization` = members who are also in the named org. "Any combination" = the
  union of those subsets, still ∩ project members.
- **Organizations never bypass project membership.** An org is an entity users
  belong to; the `organization` access mode just filters project members by org
  membership. (Whether org membership can *grant* project access is a separate,
  later concern — out of scope here.)

**Sub-phase 4a — Organizations.**

- [ ] `organization` capability (or `access` extension): `Organization{ID, Name}`,
      `OrgMembership{UserID, OrgID, Role}`; **user↔org is above-project** (explicit
      exception).
- [ ] SQLite `organizations`, `org_memberships`; routes: create org, add/remove
      member, list my orgs; tests (membership, isolation); companions;
      `docs/records/00NN-organizations.md`. Commit.

**Sub-phase 4b — Resource access scoping (gated on 4a + the design decision).**

- [ ] Design record: pick narrowing-only vs broadening; sign off before code.
- [ ] Extend resource `Attributes` (Phase 1) with `AccessScope{mode:
      private|project|org|custom, orgIDs?, userIDs?}`; default `project`.
- [ ] A single `CanAccessResource(userID, projectID, kind, resourceID) bool`
      resolver, consulted by every resource read path (and, under broadening, by the
      transport gate). Under narrowing-only it is an extra check atop project
      membership — small blast radius.
- [ ] Route `PATCH /resources/:kind/:resourceID/access {scope}` (owner only);
      tests for each mode + combinations + cross-project isolation preserved;
      companions; `docs/records/00NN-resource-access.md`. Commit.

---

## On hold — non-Markdown import/export (decision)

pdf/docx (and any other formats) are **not** built now. Markdown import/export
already ship (record 0066) and are the only formats offered. Revisit as its own
plan when prioritized; when it happens it will be **pure-Go, no commercial/AGPL
libraries** (hand-rolled WordprocessingML for DOCX, a pure-Go PDF writer over the
existing `Paginate` metrics for PDF export).

---

## Self-review before executing

- Phases 1 and 2 stay project-scoped. Phase 3 (per-user toasts) and Phase 4
  (organizations) are the only new above-project surfaces — each with a design
  record.
- Templates live on `Base` and ride the changeset machinery (versioned, undoable),
  not bespoke storage; `BoundContext` clears on duplicate.
- Phase 4's **narrowing-vs-broadening** choice is made and signed off before any 4b
  code — it decides whether resource ACLs preserve project-scoping.
- No commercial or AGPL dependency is introduced anywhere.
