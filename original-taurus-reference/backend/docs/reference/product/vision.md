# Product vision

## Product promise

Taurus is a knowledge-aware work environment in which a person can collect
evidence, reason over it, create polished deliverables, and keep those
deliverables connected to their sources. Documents, workbooks, decks, boards,
chats, files, and agent activity are Project resources rather than disconnected
applications.

The product should feel direct and familiar for ordinary editing while making
advanced behavior—grounded prompting, formulas, agents, provenance, refresh,
review, and rollback—available when needed.

## Primary workflow

1. A User signs in with an external identity provider.
2. The Host resolves the User, their single Organization, and Projects they may
   access.
3. The User creates or selects a Project.
4. Taurus opens a Project workspace containing overview, data, agents, recent
   activity, and Resource tabs.
5. The User creates, imports, or opens a Resource.
6. The User edits directly or uses formulas, prompt blocks, knowledge, and
   agents to produce work.
7. Taurus records canonical changes, source versions, attribution, decisions,
   and required Audit.
8. The User reviews, exports, shares, refreshes, or rolls back the result.

## Product principles

### Backend-owned truth

The complete canonical Resource exists in the backend. The browser receives a
bounded projection and sends explicit commands. Closing a browser, opening a
second tab, moving between Hosts, or disabling caches cannot alter truth.

### Project-scoped knowledge

Knowledge is authorized and versioned. A result identifies the exact source
artifacts and versions used, not merely a mutable URL or a provider citation.
Knowledge changes can make derived material stale without silently rewriting
the deliverable.

### Live intelligence with durable evidence

Prompt blocks and agent work can call model providers, but the durable result
is provider-neutral: request intent, policy, evidence, normalized output,
attribution, usage, and relevant decisions. Provider credentials and transport
objects never become Resource state.

### One product, distinct Resource families

Resource families share product concepts—identity, lifecycle, access,
provenance, tabs, export—but do not collapse into a generic content model.
Documents, workbooks, decks, boards, chats, and files each own their canonical
structures, editing operations, templates, and concurrency rules.

### Explicit human control

Automation proposes or performs bounded, attributable work. Users can inspect
what happened, what evidence was used, which decisions were made, what changed,
and how to undo or revise it.

### Headless parity

Every important product operation must be callable and testable without a
browser. Resources can be reconstructed and rendered to reviewable JSON,
Markdown, or family-specific export formats from canonical backend state.

## People and tenancy

- A User belongs to exactly one Organization.
- An Organization is the administrative and identity home for its Users.
- A Project belongs to exactly one home Organization and has exactly one User
  owner.
- Projects authorize specific Users. A Project may be shared across
  Organizations by granting those Users access.
- “Share with Organization” initially means an explicit, auditable snapshot of
  grants to that Organization's current Users; it is not a hidden group or a
  permanent dynamic membership rule.
- Groups are deliberately deferred.

## Product surfaces

- Sign-in, session, project selection, and project creation
- Project shell, Overview, Data, Agents, New Tab, Resource tabs, context, and
  inspector
- Documents, workbooks, decks, boards, chats, and files
- Sources, corpora, connectors, import, translation, and export
- Knowledge lattice, exact-version artifacts, retrieval, and staleness
- Intelligence providers, normalized inference, usage, policy, and budgets
- Resolution plans, evidence, decisions, results, outputs, pause, and resume
- Formula, named formulas, named tables, typed values, and analytic compute
- Agents, personas, plans, task runs, proposals, review, and memory controls
- Activity, working context, memory, comments, notes, search, and collaboration
- Resource-family templates and Project archive/restore
- Administration, entitlement, policy, Audit, telemetry, recovery, and
  production operations

## Explicit non-goals for the foundation

- Recreating Nova directory-for-directory
- A universal event runtime or global ordered event stream
- Independently deployed internal services by default
- A generic Resource payload or generic template capability
- Browser-owned canonical content
- Multi-Organization Users or Groups
- Provider-specific identity or inference objects in the domain
- Production claims without live failure, isolation, recovery, and performance
  evidence
