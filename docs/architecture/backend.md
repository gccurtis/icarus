# Backend Architecture

## Goal

The Icarus backend is a TypeScript domain application over Supabase and DBOS. It should contain the behavior unique to Icarus and delegate general infrastructure to established systems.

Supabase provides PostgreSQL, row-level security, Storage, Realtime, optional future Auth integration, and local development infrastructure. DBOS provides durable workflows, retries, idempotent workflow identities, and serial or bounded-concurrent queues. The backend does not recreate a general web server framework, persistence abstraction, migration engine, or job scheduler.

## Directory template

```text
backend/
├── src/
│   ├── initialization/
│   │   ├── create-runtime.ts         # Constructs capabilities in dependency order
│   │   └── configuration.ts          # Reads validated application configuration
│   ├── api/
│   │   ├── context.ts                # Trusted request/project context
│   │   ├── errors.ts                 # Transport-safe error mapping
│   │   └── routes/                   # Thin adapters to capability procedures
│   ├── capabilities/
│   │   └── <capability>/             # One and only capability location
│   ├── workflows/
│   │   ├── queues.ts                 # Shared DBOS queue declarations
│   │   └── worker.ts                 # DBOS application bootstrap
│   └── shared/                        # Backend-only primitives
├── supabase/
│   ├── migrations/                   # SQL schema, functions, indexes, and RLS
│   ├── tests/                        # Policy and database behavior tests
│   ├── config.toml
│   └── seed.sql
└── test/
```

The API directory is intentionally thin. The public capability contract must not depend on whether a procedure is reached through a Postgres RPC, an HTTP handler, an agent tool, or an in-process workflow call.

## Capability template

```text
capabilities/<capability>/
├── index.ts                          # Deliberate public exports
├── types.ts                          # Runtime objects, inputs, outputs, records
├── runtime.ts                        # Runtime interface and constructor
├── procedures/
│   ├── <query>.ts
│   └── <mutation>.ts
├── workflows.ts                      # Optional; omit when no durable work exists
├── README.md                         # Objects, API table, procedure flow, invariants
└── test/
```

Do not create optional files merely for symmetry. A stateless capability such as Formula may have no schema or workflow. A derived system such as Knowledge may use a storage model unlike an ordinary current/history resource.

## Runtime pattern

Most capabilities expose one runtime object created during application initialization.

```ts
export interface ProjectContext {
  userId: string;
  projectId: string;
  requestId: string;
}

export interface GeneralFilesRuntime {
  get(context: ProjectContext, input: GetGeneralFileInput): Promise<GeneralFile>;
  create(context: ProjectContext, input: CreateGeneralFileInput): Promise<GeneralFile>;
  update(context: ProjectContext, input: UpdateGeneralFileInput): Promise<GeneralFile>;
}

export function createGeneralFilesRuntime(
  dependencies: GeneralFilesDependencies,
): GeneralFilesRuntime {
  // Capability construction only; no process-global project state.
}
```

The runtime is a small coordinating object, not a service container. Its dependencies are explicit narrow interfaces to lower-level capabilities or external infrastructure.

The initial application receives `userId` and `projectId` from a trusted bootstrap binding. There is no sign-in or project-selection surface in the first build. Future identity infrastructure may establish the same context, but public capability signatures do not change.

## Procedure contract

Every public procedure documents:

| Field | Meaning |
| --- | --- |
| Kind | Query, mutation, or workflow |
| Runtime | The object that exposes it |
| Inputs | Typed values and project context it accepts |
| Output | The single result value or receipt it returns |
| Transaction | Rows and facts committed atomically, if any |
| Procedure | Ordered behavior, using `||` for conditional branches |
| Failures | Expected authorization, conflict, validation, and dependency failures |

A mutation follows one consistent path:

```text
load trusted bound request context
→ preserve user and project scope
→ authorize capability action
→ validate domain input
→ begin transaction
→ lock/read current state when required
→ write new current state and immutable revision
→ append compact Activity fact when the change belongs in the project feed
→ commit
→ publish/invalidate project-scoped realtime state
```

## Persistence and resource revisions

Capabilities own their SQL migrations and records. There is no generic Persistence runtime wrapping PostgreSQL.

A normal revisioned resource has two logical tables:

```text
<resource>_current
<resource>_revisions
```

The current table makes ordinary reads direct. The revisions table contains complete immutable historical records. Both include `project_id`, and foreign keys include project scope so a resource cannot refer across projects.

`getRevision`, `listRevisions`, and `revert` remain methods of the owning capability's runtime. They do not require another runtime object. Revert copies an old complete version into a newly committed revision; it never changes or deletes an old revision.

The convention is not forced onto everything. Formula is stateless. Activity is an append-only feed. Knowledge revisions derived lattice artifacts rather than copying the entire lattice on every change.

## Supabase boundary

Use Supabase directly where it eliminates infrastructure without weakening capability ownership:

- generated TypeScript database types for schema values;
- PostgreSQL and RLS for project-scoped reads and writes;
- SQL functions/RPC for mutations that must be one database transaction;
- Storage for large file bytes with project-scoped paths and policies;
- private Realtime channels for invalidation, presence, and collaboration signals;
- local Supabase CLI for migrations, policies, and integration tests.

RLS is mandatory on every project-owned table. Service-role credentials never enter the browser. The browser may perform only operations whose RLS and database contract make them safe; trusted orchestration crosses the backend boundary.

## DBOS boundary

DBOS is used only when an operation needs durable execution, retries, waiting, scheduling, or queue ordering. An ordinary database mutation does not become a workflow by default.

Capability-specific workflow definitions live with the capability. `src/workflows/` contains only the shared DBOS startup and queue declarations.

### Idempotency

Every accepted durable operation receives a stable operation or registration ID. The DBOS workflow ID includes its project and operation identity. Retrying the same accepted operation therefore resumes or returns the same workflow instead of creating duplicate work.

```text
workflow ID = <project ID>:<capability>:<procedure>:<operation ID>
```

The workflow input contains serializable identifiers and values, never a live stream, reader, database connection, or runtime object. The worker reloads the exact resource revision and constructs transient readers in-process.

### Serial and concurrent work

- Work that must be ordered uses a DBOS queue with `concurrency: 1`, partitioned by the narrowest authority that requires ordering—usually project plus resource.
- Independent work uses a bounded queue with an explicit worker concurrency.
- Different serial partitions may run concurrently.
- A workflow step may call capability procedures in process. It should not create a web of nested jobs without a durability requirement.

## Planned backend libraries

| Library or platform | Purpose | Boundary |
| --- | --- | --- |
| TypeScript on Node.js | Capability and workflow implementation | One language across frontend and backend |
| Supabase OSS | PostgreSQL, RLS, Storage, Realtime, optional Auth, local stack | Infrastructure substrate, not domain owner |
| `@supabase/supabase-js` | Typed Supabase access | Browser/user client and appropriate server access |
| Supabase generated types | Database value types | Generated; never hand-maintained in parallel |
| DBOS TypeScript SDK | Durable workflows, retries, queues, workflow identities | Only operations that need durability or ordering |
| pgvector | Embedding storage and similarity operations used by Knowledge | Knowledge schema and queries only |
| Vitest | Unit and capability integration tests | Fast TypeScript test suite |
| PostgreSQL policy tests | RLS and project-isolation verification | Required for each project-owned table |

Not selected at this stage:

- Zod or a second application-wide validation framework;
- an ORM that hides PostgreSQL or RLS behavior;
- a general HTTP framework before a transport actually requires one;
- a custom queue, runner, migration engine, or persistence abstraction.

These choices can be revisited for a demonstrated requirement, but they are not speculative dependencies.

## Agent access

Agents use the same capability procedures as people. An agent layer may submit commands concurrently, but it does not bypass project context, authorization, revision rules, or RLS. Long-running agent work becomes a DBOS workflow when it needs durability; otherwise it is ordinary traffic to stateless backend instances.

## Capability definition of done

A migrated capability is complete when:

1. its runtime object and public procedure table are documented;
2. its dependencies are narrow and explicit;
3. its project-scoped schema and RLS tests exist when it persists state;
4. mutations commit current state, immutable revision, and Activity fact atomically where applicable;
5. DBOS is used only for justified durable work, with a stable workflow identity and queue policy;
6. frontend and agent callers use the same procedure contract;
7. no active behavior remains duplicated in an archived implementation.
