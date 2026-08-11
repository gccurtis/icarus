# Per-user avatar & color (BR-USER-AVATAR) + typography decision

## BR-USER-AVATAR

Identity presentation — a stable `color` and an `avatarUrl` — belongs on the
**User**, the one identity that spans projects. This is the deliberate exception
to the "everything is project-scoped" rule: the fields live on the account, not
on any project membership.

- **access**: `User` and `PublicUser` gain `Color` and `AvatarURL`.
  `Access.UpdateProfile(userID, name, color, avatarURL *string)` applies a partial
  update — any nil field is left unchanged — validating `name` (≤80 runes),
  `color` (a `#rgb`/`#rrggbb` hex or a short `[A-Za-z0-9-]` token; empty clears),
  and `avatarUrl` (≤512 chars; the client derives it from an uploaded fileId).
  `UserStore` gains `UpdateUserProfile`; `PublicUserInProject` carries the fields
  into the project-peer projection.
- **sqlite**: `users` gains `color` and `avatar_url` columns (ALTER, default '');
  the user reads/writes select and set them.
- **handlers**: `PATCH /auth/me` accepts `{name?, color?, avatarUrl?}` and returns
  the enriched profile; `GET /users/:userID` surfaces `color`/`avatarUrl`.

### Tests

- **Unit** (`access/profile_test.go`): set color+avatar and see them in the
  public projection; a partial update leaves other fields unchanged; bad color,
  bad hex, over-long avatar, and over-long name are rejected; empty color clears.
- **Integration** (`dev-test/profile/run.sh`, no model, always runs): PATCH
  /auth/me sets and persists color+avatar, a partial update preserves the rest,
  `GET /users/:id` shows them, and an invalid color is a 400.

## BR-BLOCK-TYPOGRAPHY-CUSTOM — deferred (decision-gated)

The plan gates this on product confirmation and recommends **not** building it:
Omega's semantic style registry (`assign_block_style`,
`set_block_style_overrides`, tokens/tones) already persists typography, so the
inspector can be scoped to the semantic model with **zero backend work**. No
product signal has confirmed a need for arbitrary `{fontFamily, fontSize, color}`
values, so this is intentionally **not built**. If product later confirms it, the
plan's Phase 8.2 describes the bounded `BlockStyleRef.overrides` extension and a
`set_block_custom_typography` changeset op to add then.
