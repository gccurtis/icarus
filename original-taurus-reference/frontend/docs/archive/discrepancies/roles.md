# Discrepancy — project roles & visibility

## Role vocabulary

- **Front-end:** `owner` / `editor` / `viewer` — the labels used in the UI (role
  badges, member management), because they read clearly to users.
- **Backend:** `owner` / `edit` / `read` (per the Omega backend-guide).
- **Mapping (translated at the data boundary, both directions):**

  | UI (front-end) | Omega (backend) |
  | --- | --- |
  | `owner` | `owner` |
  | `editor` | `edit` |
  | `viewer` | `read` |

- **Wired:** `toUiRole` (in) and `toOmegaRole` (out) in
  [`src/lib/data/projects.ts`](../../src/lib/data/projects.ts). Member management
  sends `toOmegaRole(role)` and reads back `toUiRole`. Writes require `owner` or
  `edit`.

## Visibility

- **Front-end:** each project has `visibility: 'private' | 'link'`, driving the access
  toggle and the "anyone with the link" share model.
- **Backend:** **real** — `GET /projects` returns `visibility` and
  `PATCH /projects/:id {visibility}` sets it (owner only). Sharing is done with
  **role-carrying links**: owners mint read/edit links (`PUT /projects/:id/links/:role`)
  and `POST /join/:token` joins — or upgrades — the recipient at the link's role.
  Visibility is the master switch: `private` disables the links.
- **Wired in the UI:** the settings dialog manages the read/edit links, and the
  `/join/:token` route signs the recipient in (if needed) and opens the project.

## Status

Real as of 2026-07-21: the role translation, the visibility master switch, and the
role-carrying share-link flow (mint / rotate / turn off + `/join/:token`) are all wired
across `projects.ts`, the settings dialog, and the join route.
