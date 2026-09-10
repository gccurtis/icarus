# Project

Project-scoped metadata used by the Project Overview context and inspector
panels. These reads expose bounded projections only: authored resource bodies
may be reduced to useful counts, but bodies, authentication subjects, settings,
membership tokens, and foreign project rows never cross this capability.

Every panel read admits the one current persisted shape before projecting it.
Incomplete activity, project, membership, user, resource, snapshot, comment,
anchor, and resolution rows are quarantined or make the selected subject
unavailable. Required fields are never reconstructed from related rows, an
incomplete leader is never replaced by a checkpoint, and a malformed optional
field is not treated as though it were absent. Comment targets must agree with
the resource kind, anchors must belong to that target family, contribution
counts include only complete owned subjects, and required nested body/cell rows
are validated before any fact is calculated. Historical actors are returned as
`null` when their exact project-owned subject no longer exists; the server does
not invent a replacement identity or label.

The procedures are:

- `readProjectOverview` — status, the viewer's role, and project creation time.
- `readProjectHistory` — searched and windowed activity records.
- `readProjectPerson` — one visible member's profile and contribution summary.
- `readProjectActivity` — one immutable event.
- `readProjectComment` — one discussion with its resource, opening, and replies.
- `readProjectResource` — one resource's summary, provenance, useful counts, and
  recent activity.
- `updateProjectResourceSummary` — a scoped edit to the resource's executive summary.
