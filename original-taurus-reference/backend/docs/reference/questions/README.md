# Open questions

Only unresolved choices that can materially change product behavior, security,
data representation, public contracts, or construction belong here. Questions
must identify a decision deadline; they should not block unrelated work.

The foundational Host/Cell/capability model, tenancy, Project database
boundary, and strong revocation semantics are accepted decisions, not open
questions.

## Q001 — Organization-share lifecycle

- **Question:** After “share with Organization” snapshots User grants, should
  later membership changes trigger an automatic prompt, automatically follow
  membership, or remain visible only when an administrator manually refreshes?
- **Current default:** No automatic follow or prompt. Each explicit repeat of
  `projects.grants.organization_snapshot.create.v1` creates a new immutable
  auditable snapshot/diff from current Organization Users; earlier snapshots
  and direct grant outcomes remain history.
- **Needed by:** Collaboration/admin implementation.

## Q002 — Project ownership transfer

- **Question:** What verified, audited ceremony transfers the sole Project
  owner, including the last-owner and cross-Organization cases?
- **Current default:** No self-service transfer; operator-assisted fail-closed
  path only.
- **Needed by:** Control Project mutation implementation.

## Q003 — Retention and legal hold

- **Question:** Which Resource versions, required Audit, agent evidence,
  provider payloads, and deleted Project artifacts have configurable retention
  or legal hold?
- **Current default:** Preserve canonical history required for correctness and
  recovery; redact/minimize provider payloads; do not promise deletion timing.
- **Needed by:** Persistence and production-readiness implementation.

## Q004 — Project placement tiers

- **Question:** Which product/enterprise policy selects Bridge versus Silo
  placement, region, encryption key scope, backup, and recovery objectives?
- **Current default:** Bridge for development and initial production design;
  placement contract must support Silo without data-model changes.
- **Needed by:** Provisioning implementation.

## Q005 — Realtime collaboration UX

- **Question:** Which Resources require active push notifications versus
  refresh-on-focus/mutation plus bounded polling?
- **Current default:** Notifications are hints only; Documents can converge by
  canonical reads and mutation responses.
- **Needed by:** Web/realtime implementation, not backend correctness.

## Q006 — External connector priority

- **Question:** Which source systems follow local upload and Microsoft/Google
  identity—Drive, OneDrive/SharePoint, Outlook Mail/Calendar, Slack, or others?
- **Current default:** Build connector contracts and local upload first;
  prioritize providers only when product workflows are selected.
- **Needed by:** Files/Sources/Connectors implementation.

## Q007 — Native package cryptographic policy

- **Question:** Must `.tars` and Project archives be signed, encrypted, or both,
  and who controls verification keys?
- **Current default:** Checksummed, versioned, zip-safe package; signatures and
  encryption required before cross-trust-boundary import.
- **Needed by:** Translation/archive implementation.

## Q008 — Provider data residency and retention

- **Question:** Which model/provider regions, zero-retention modes, customer
  keys, and content classes are allowed per entitlement and policy?
- **Current default:** Deny unknown providers/models; store normalized outputs
  and minimum evidence; keep provider credentials and raw transport objects out
  of canonical Resources.
- **Needed by:** Intelligence production implementation.

## Q009 — User transfer between Organizations

- **Question:** What verified, audited ceremony may move an existing active
  User from their one Organization to another while preserving or revoking
  direct Project grants, ownership, sessions, connector authority, sponsored
  work, retention obligations, and administrative history?
- **Current default:** No self-service or invitation-driven transfer. An
  invitation is consumed only for a first verified User before personal-
  Organization fallback; an already assigned User fails closed.
- **Needed by:** Any future Organization-transfer product surface. It does not
  block first-login invitation or ordinary one-Organization administration.
