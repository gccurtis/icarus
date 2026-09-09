# Project

Project-scoped metadata used by the Project Overview context and inspector
panels. These reads expose bounded projections only: authored resource bodies
may be reduced to useful counts, but bodies, authentication subjects, settings,
membership tokens, and foreign project rows never cross this capability.

The procedures are:

- `readProjectOverview` — status, the viewer's role, and project creation time.
- `readProjectHistory` — searched and windowed activity records.
- `readProjectPerson` — one visible member's profile and contribution summary.
- `readProjectActivity` — one immutable event.
- `readProjectComment` — one discussion with its resource, opening, and replies.
- `readProjectResource` — one resource's summary, provenance, useful counts, and
  recent activity.
- `updateProjectResourceSummary` — a scoped edit to the resource's executive summary.
