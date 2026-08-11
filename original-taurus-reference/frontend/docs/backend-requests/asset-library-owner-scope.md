# Backend request — owner-scoped contexts and templates (the asset library)

**Priority:** **High** · **Status:** Open · **Filed:** 2026-07-29
**Blocks:** the `/library/context` and `/library/templates` screens having any real data. Both
are built and shipped; both are badged **Mock**, because the model they present does not exist.

> **Standalone.** Everything needed to build this is in this document: what you already have
> (a lot), the exact gap, the shapes we need, the rules, and how we will verify it.

This is a **scope** ask, not a design ask. Contexts and templates already exist and are good.
They are project-scoped, and the product needs them to also live above a project — owned by a
user or an organization — so a person can reuse them in the next project without rebuilding them.

## What already works — please do not rebuild any of it

**Contexts are complete** (`core/capability/contexts`, routes at `core/transport/routes.go`):

| Route | What it does |
| --- | --- |
| `POST /contexts` | create with `{name, includes[], excludes[]}` |
| `GET /contexts` | list for the selected project |
| `GET /contexts/:contextID` | read one |
| `GET /contexts/:contextID/resolved` | **flatten to leaf origins** |
| `PATCH /contexts/:contextID` | replace name + membership |
| `DELETE /contexts/:contextID` | delete |

The model is exactly what the UI wants: a `Definition{Includes, Excludes}` over
`Ref{kind, id, name}`, resolved live, with nested contexts expanding recursively, `exclude` winning
at the leaf, a memo per resolve call, and the context→context graph kept **acyclic at write time**.
`whole-project` is a reserved virtual id. Connector members expand to their file origins. None of
this needs to change.

**Document templates are complete too** (`core/capability/document/template.go`):

- `TemplateInfo{IsTemplate, Variables[]}` lives on `Base`, so it is versioned by the changeset
  machinery (`set_template` / `set_context_variable`) and persists with the document.
- `ContextVariable{Name, Description, BoundContext | BoundResource}` — a named slot, bounded and
  validated (≤64 name, ≤512 description, ≤64 variables, names unique per document).
- `GET /documents/templates` lists a project's templates.
- `POST /documents {fromTemplateId}` instantiates one, copying structure and **clearing the
  bindings** — exactly right.
- `BlockContext{Include, Exclude}` scopes a prompt block to declared variable names.

**Alpha already calls the template routes.** `NewTabStage` lists templates and creates from them
today. Nothing about the per-project behaviour is in question.

**Organizations exist** (`core/capability/organization`) with `owner | admin | member` roles, and
already feed `AccessScope.orgIds` on a resource. They are the natural owner for a shared library.

## The gap

Everything above hangs off `scoped`, gated by the session's selected project. There is no way to
own a context or a template *above* a project, so:

| What a user wants | Possible today? |
| --- | --- |
| Reuse a context I built in project A while working in project B | **No** |
| Give my organization a shared "Brand voice" context | **No** |
| Reuse a template across my projects | **No** |
| Describe what a context is for, in the context itself | **No** — `Context` has no description field |
| Share one context with one teammate | **No** — there is no per-asset sharing model |

What a user sees today: two complete library screens whose every row is invented, badged Mock.

## What we need

Four pieces. **They are independently shippable and listed in the order we want them.**

### 1. A `description` on a context (very small)

```jsonc
POST /contexts   { "name": "Q3 research inputs", "description": "…", "includes": […], "excludes": […] }
GET  /contexts   [ { "id": …, "name": …, "description": "…", … } ]
```

Free text, optional, bounded however you like (we will not exceed ~1KB). It is displayed in
pickers **and sent to the agent as guidance about the material** — one field doing both jobs, which
is a deliberate product decision, not an oversight. This is useful on its own even before scope
changes, so it can ship first and alone.

### 2. Owner-scoped library records

A context or a template may be owned by a **user** or an **organization** instead of a project.

```jsonc
// Library contexts — not project-scoped.
POST   /library/contexts        { "owner": {"kind":"user"}            , "name": …, "description": …, "includes": […], "excludes": […] }
POST   /library/contexts        { "owner": {"kind":"org","id":"org_…"}, … }
GET    /library/contexts        // everything the caller can reach: their own + every org they belong to
GET    /library/contexts/:id
PATCH  /library/contexts/:id
DELETE /library/contexts/:id

// Library templates — same shape, same rules.
GET    /library/templates
…
```

- **Not gated by a selected project.** These must work from the project-selection screen, where
  no project is selected at all — that is the whole point of a library.
- `GET` returns assets owned by the caller plus assets owned by any organization the caller
  belongs to (plus anything shared with them, see 4).
- **Editing is role-gated for org-owned assets**: an org `member` can use; `admin`/`owner` can
  edit. A user-owned asset is editable only by its owner.
- A library context's members are refs like any other. Resolution rules stay exactly as they are.

### 3. Promote and bring-in — both are **copies**

This is the part most likely to be built the wrong way, so it is stated plainly: **library assets
are copies, and there is no live link back.** Editing a library context does not change the
project it came from; bringing it into a project copies it again. Two independent things.

```jsonc
// Project → library. Copies the asset AND the resources it resolves to.
POST /contexts/:contextID/promote   { "owner": {"kind":"org","id":"org_…"}, "name": …, "description": … }
  → 201 { "id": "libctx_…", … }

// Library → project. Copies back into the selected project.
POST /library/contexts/:id/bring-in
  → 201 { "id": "ctx_…", … }     // a normal project context
```

- **Promote copies the resolved resources into the library's ownership**, not just the refs — a
  library asset that pointed at project A's resources would break for everyone outside project A.
  This is the piece with real work in it.
- **Bring-in copies back**, producing an ordinary project-scoped context whose members are
  ordinary project resources. Everything downstream (retrieval, prompt-block scoping, the
  knowledge lattice) then works unchanged, which is why we want copies rather than a new
  cross-project resolution path.
- Templates work identically: promote a document template up, bring one down. Bring-in for a
  template can reuse `POST /documents {fromTemplateId}` semantics — copy structure, clear
  bindings.
- If copying a large resource set is expensive, **an async job with a status is fine** — the UI can
  show progress. We would rather have a job than a synchronous request that times out.

### 4. Per-asset sharing

```jsonc
GET    /library/contexts/:id/shares     → [ { "subject": {"kind":"user","id":…}, "access": "use" | "edit" } ]
POST   /library/contexts/:id/shares     { "subject": {"kind":"org","id":…}, "access": "use" }
DELETE /library/contexts/:id/shares/:subjectID
```

Two levels only: **`use`** (can bring it into a project) and **`edit`** (can also change it).
Nothing finer. Sharing changes who can reach the **library original** — projects that already
brought a copy in are unaffected, by definition, since they hold copies.

This is the least urgent of the four; owner scope alone (2) already makes the library useful,
because org ownership covers the common case.

## The rules that matter

- **Copies, not links.** No cross-project resolution, no dangling refs into another project's
  catalog. A library asset must be resolvable by someone who has never opened the project it came
  from.
- **Authorization on read is per-asset**, not per-project: the library is reachable with no
  project selected, so `requireProject` cannot be the gate.
- **Do not change project-scoped behaviour.** `/contexts`, `GET /documents/templates`, and
  `POST /documents {fromTemplateId}` must keep working exactly as they do — Alpha uses them today.
- **Resolution semantics are already correct** — expansion, leaf-level subtraction, cycle
  prevention, the memo. Reuse them verbatim for library contexts.
- Prefer a **400 we can surface** over silent truncation anywhere a limit is hit.

## How we will verify

1. Create a library context owned by the caller with no project selected → **201**; `GET
   /library/contexts` returns it.
2. Create one owned by an org; a second user in that org sees it, a third user outside does not.
3. `PATCH` as an org `member` → **403**; as an `admin` → **200**.
4. Promote a project context that resolves to 6 resources → the library copy resolves to 6, and
   deleting the original project changes nothing about it.
5. Bring that library context into a *different* project → a normal project context appears,
   resolving to 6 project-local resources; editing it does not alter the library original.
6. Promote a document template, bring it into another project → the document is created with
   structure intact and **bindings cleared**.
7. Share a library context with one user at `use` → they can bring it in but `PATCH` returns 403.
8. Set a `description` on a context → it round-trips on `GET`.

## Current front-end fallback

The screens are **built and shipped** at `/library/context` and `/library/templates`, running on
fixtures in `src/lib/features/library/library-mock.ts` and badged **Mock** in the top bar; unbuilt
actions say so rather than pretending. We will replace the fixtures with real clients slice by
slice as the four pieces land — starting with (1), which we can adopt the day it ships.
