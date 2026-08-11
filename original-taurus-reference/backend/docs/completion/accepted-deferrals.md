# Accepted V1 deferrals

These are deliberate exclusions from the completion definition, not missing
rows that can silently become requirements. A later product decision may
promote one into a numbered packet; until then the baseline gate accepts these
classifications.

| Deferred surface | V1 boundary | What remains allowed |
|---|---|---|
| Audio, video, and transcription | No audio/video resource aggregate, transcription worker, descriptor lattice, or editing contract | Existing files may be stored as opaque uploads subject to file limits |
| Legacy XLS and executable workbook content | No binary `.xls`, VBA/macro execution, external-link execution, or full legacy workbook fidelity | XLSX/CSV work owned by Ω-021, Ω-022, Ω-029, and Ω-036; imported formulas remain data, never executable code |
| Slide animations and transitions | No animation timeline, transition engine, or fidelity promise | Static slide model/render/import/export remains owned by Ω-023, Ω-024, and Ω-037 |
| Editable PDF import | PDF is not converted into a fully editable Document/Slides aggregate | Bounded reference ingestion, text extraction, preview, and PDF export may be implemented by the ingestion/conversion packets |
| Commercial or source-available-only libraries | No proprietary office SDK, commercial renderer, or source-available dependency may satisfy a completion gate | Free/open-source implementations may be selected after license review |
| Organization-owned library masters | V1 library masters are user-owned; there is no organization-owned canonical template/context/personality master | Explicit grants, lineage, and copy-based project materialization remain owned by Ω-038 and Ω-039 |
| Premature distributed Project placement | No correctness may require distributed User Cell/Project Subcell placement, sticky routing, or a cluster coordinator | In-process logical cells and production single-node operation remain owned by Ω-013, Ω-014, Ω-043, and Ω-044 |

Also excluded from the V1 claim are a general notification-feed UI and arbitrary
provider-specific office fidelity beyond the numbered import/export contracts.
These exclusions do not waive tenant isolation, authorization, recovery, or
bounded-resource requirements for the behavior that does ship.
