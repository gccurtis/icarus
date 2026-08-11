# Canonical user journeys

These journeys define product outcomes. Detailed backend sequences live in
`docs/flows/`; capability pages define individual operations.

## First sign-in and Project entry

1. The visitor chooses Google or Microsoft.
2. Taurus completes OIDC with state, nonce, and PKCE, links the exact provider
   identity, and creates an opaque Taurus session.
3. If policy allows, Taurus idempotently creates the User's single personal
   Organization and first Project; otherwise it lists only directly granted
   Projects with bounded search/filter/group/sort and private pin ordering.
4. Project creation remains visibly provisioning until its isolated Project
   Database is verified and Active.
5. Selecting an Active Project creates or attaches a bound Cell and restores
   that User's workspace, including tabs/panels and private authorized
   Resource/Data favorites.

Success is not “redirect completed.” It is an authorized, durable, restart-safe
Project entry with no synthetic authority in production.

## Create and edit a Document

1. New Tab offers Document only when the capability is registered and entitled.
2. Create chooses blank or a Document-specific template and commits catalog +
   initial Document state atomically.
3. The browser receives a bounded projection and observed head.
4. An edit becomes a typed Document command and proposed ChangeSet.
5. Taurus checks current authority, reconciles against canonical head, consumes
   a fresh one-use permit, appends once, and returns the new canonical head.
6. Other tabs/Users refresh or receive a hint and read canonical changes.
7. The Document can be reconstructed and rendered to Markdown without a
   browser.

## Resolve a prompt block

1. The User inserts/configures a prompt block with instructions and explicit
   source/corpus/knowledge scope.
2. The Document handler starts a durable Resolution under exact Document and
   block versions.
3. Resolution plans retrieval, Knowledge returns authorized exact-version
   artifacts, and Intelligence performs policy-approved inference.
4. Resolution seals Evidence, contradictions, decisions, Result, usage, and
   source versions.
5. The Document incorporates editable Output through a normal ChangeSet.
6. Later source changes mark the output stale; refresh creates another
   Resolution and visible diff rather than silently rewriting the old result.

## Analyze data in a Workbook

1. The User imports or enters values into a Workbook.
2. Workbooks validate Worksheet/cell/range/table commands under expected
   revisions.
3. Formula evaluates typed deterministic expressions over authorized data and
   named values without network/model side effects.
4. Grounded extraction or model-assisted transformations occur through
   Resolution and produce typed, cited proposals rather than fabricated filler.
5. Results can be materialized into governed data objects or chart/table
   structures with lineage.

## Build a Deck from Project knowledge

1. The User creates a Deck/template and defines audience/outcome.
2. Resolution retrieves Project evidence and proposes an outline and slide
   contents under a reviewable plan.
3. Deck commands create Slides/layout/elements/notes and exact references.
4. The User edits and approves changes normally.
5. Export pins exact Deck/source versions, renders and validates every slide,
   and reports unsupported/lost fidelity before producing PPTX/native output.

## Agent-assisted work

1. Ask returns a grounded read-only answer.
2. Action displays scope, target, consequence, and review behavior before one
   bounded effect.
3. Plan creates an immutable inspectable plan revision; high-risk steps require
   approval.
4. A Task executes through the same public operations and authority as a User,
   with Agent/Persona/delegator attribution and budgets.
5. It pauses for missing authority, ambiguity, contradiction, or required
   approval; it never silently widens scope.
6. Proposed changes can be reviewed, accepted, rejected, or reverted through
   domain-owned commands.

## Share a Project

1. The owner/authorized manager selects specific Users or chooses an
   Organization-share convenience action.
2. Organization-share resolves current Users and presents the explicit grant
   set before commit.
3. Control atomically writes grants and Audit under expected authority.
4. Each affected User sees the Project only while their own Organization/User,
   Project lifecycle, grant, entitlement, and policy remain active.
5. Revocation becomes effective only after older mutation permits cannot
   commit; open Cells then fail protected requests regardless of cache.

An owner/manager may instead create an expiring signed-in share link with a
bounded grant ceiling. Acceptance rechecks the current User and current link/
Project policy, then materializes an explicit direct User grant. The link is
not anonymous access, and revoking it does not silently remove already accepted
grants. A non-owner may leave by revoking their own grant; the sole owner
cannot leave. Project duplication creates and provisions a new destination and
uses separately authorized source export/destination import without changing
the source.

## Import, export, and archive

1. Single-file upload or a declared multi-file/folder UploadBatch creates
   bounded intents with safe logical paths and visible per-item state.
2. Files independently verifies each item's bytes, creates the immutable
   quarantined FileVersion, detects safe media type and scans it. Partial
   success, cancel, exact-item retry and restart never erase already committed
   Files; a ready FileVersion is not yet an import.
3. The User explicitly starts import for one exact ready FileVersion.
   Translation then inventories/parses it in a sandbox and returns the typed
   mapping, loss and ambiguity plan.
4. The User confirms any material mapping/consequence; destination-owned
   commands commit a complete Resource or nothing visible.
5. Export pins exact dependencies, requires exact-plan confirmation for material
   loss, and produces a checksummed artifact plus a fidelity report.
6. A Project Archive is a policy-shaped portable package, not a backup or an
   authorization snapshot.

## Sign out

- **Sign out:** revoke the current session family, clear the browser credential,
  and prevent its older permits from committing before effective.
- **Sign out everywhere:** revoke all session families and every User-sponsored
  durable-work authority/delegation, Task sponsorship and standing Routine
  delegation; advance User authority, fence every older permit, and make every
  protected request fail.

Finding and killing live Cells is an optimization. Durable authority defines
the security outcome.

## Account security and Organization administration

1. The User reviews safe session/device and identity-link metadata, then may
   revoke a selected family or link under current policy.
2. A high-risk operation starts a one-use browser/session/operation-class-bound
   step-up. Production prefers WebAuthn/passkeys; TOTP, recovery codes or fresh
   federated reauthentication are explicit governed methods.
3. Organization administrators may configure versioned standards-based OIDC or
   SAML providers, including Okta through those standards, without creating a
   second Taurus password system.
4. Recovery is rate-limited and non-enumerating and cannot change the User's
   Organization, transfer Project ownership or revive revoked authority.
5. Billing administration shows reconciled subscription/entitlement state,
   immutable normalized usage and discrepancies. Provider redirects/webhooks
   are never trusted as Project authority.
