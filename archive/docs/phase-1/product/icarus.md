# Icarus

> Mirrored from [Notion](https://app.notion.com/p/3aeb6410e50281f99c1bfe622444917c).

<callout icon="☀️" color="yellow_bg">
	Icarus is a TypeScript knowledge-production workbench organized around questions, research, evidence, structured analysis, authored resources, collaboration, and agentic execution.
</callout>
## Reference Authority
The Resources related to Icarus define the target runtime and persistence contracts for capability work. The pushed repository defines the runtime layers and every object already implemented. A capability page is ready to guide implementation when its prerequisites and seven primary sections agree with the current repository contracts.
## Canonical Build Groups
1. **Foundations:** Intelligence → Context → Formula → Data
2. **Resources:** Knowledge → Document → Slides → Spreadsheet
3. **Research:** Analysis → Evidence → Research
4. **Project:** Project → Workspace
5. **Collaboration:** Activity → Presence → Comments → Questions
6. **Agentic:** Persona → Agents → Automation
Groups and capabilities are ordered. Earlier units establish contracts consumed by later units. The group names organize the reference and build sequence; physical runtime placement still follows the numbered repository layers.
## Capability Page Anatomy
Every capability reference uses these primary sections in order:
1. **Summary / Concept** — purpose, authority, prerequisites, build position, and runtime placement.
2. **Types & Interfaces** — TypeScript domain values, commands, queries, ports, results, and errors.
3. **Runtime Objects** — construction, injected dependencies, services, stores, adapters, and projections.
4. **Change Operations** — the closed operation vocabulary applied to canonical state.
5. **Endpoints** — external and internal request surfaces.
6. **Jobs** — endpoint or intent mapping, Job name, queue, response mode, called ports, emitted operations, and follow-on stages.
7. **SQL Tables** — complete capability-owned tables, constraints, and SQL indexes.
Invariants, projections, conformance scenarios, and acceptance checks may follow as appendices.
## Runtime Law
- HTTP transport creates a shared request envelope.
- Exact endpoint mapping constructs a fresh Job.
- Job wiring chooses serial or concurrent execution and the response mode.
- Serial Jobs own ordered canonical mutations.
- Concurrent Jobs occupy the bounded worker pool; overflow waits in the concurrent FIFO queue.
- Long work freezes inputs, computes concurrently, persists a result, and settles through a new serial Job.
- Capability stores receive configuration-bound scope and attribution during initialization.
- Each capability owns its tables, migrations, repository port, canonical state, and rebuildable projections.
## Supporting References
Sources, Media, Library Kernel, Templates, and Import / Export remain active supporting references. Their final placement in the build groups is tracked separately; any capability that declares one as a prerequisite waits for that contract.
