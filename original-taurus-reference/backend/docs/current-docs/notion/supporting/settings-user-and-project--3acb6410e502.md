---
title: "Settings — User & Project"
notion_page_id: "3acb6410e5028122ab96eed1434bb897"
notion_url: "https://app.notion.com/3acb6410e5028122ab96eed1434bb897"
project: "Taurus Yesod"
role: "Supporting"
format: "Spec"
created: "2026-07-29 22:17:17Z"
mirrored_at: "2026-07-30"
mirrored_from_notion: true
---

# Settings — User & Project

> Source mirror. Preserve this page as planning evidence; use the agent-facing execution packet when one exists.

Status: Supporting specification  
Scope: Taurus Alpha settings surfaces and the Taurus Enterprise Control Plane mutation contract  
Authorities: [Model — Identity, Organization, Project Ownership & Access](https://app.notion.com/p/3acb6410e5028106b617d05f162b5ddf), [Architecture — Enterprise Control Plane](https://app.notion.com/p/3acb6410e50281988386c4559a26cd22), and [Architecture — Taurus Layered Application Model](https://app.notion.com/p/3acb6410e502812bb4e0ff2c91ff753f)
## Purpose
This document defines what appears in the ordinary Taurus settings experience, what a User may change, and what Omega must enforce. It covers:
- a User managing their own account;
- a User managing a Project named explicitly by the route and current Project access context;
- the differences between personal and enterprise-managed accounts;
- the boundary between durable settings, User-level library preferences, and per-User/per-Project Workspace state.
Organization-wide administration belongs in the companion Organization Administration experience.
Settings are control-plane interactions. They do not acquire a Project Subcell merely to show account, Organization, entitlement, ownership, or access information. A request to open Project content is a separate, explicitly admitted action executed through the User's `(UserID, ProjectID)` subcell.
## Entry points
Alpha exposes two distinct settings entry points:
- **User menu → Account settings**
- **Project menu → Project settings**
If the User may administer an Organization, the User menu also exposes **Organization administration**. That opens the separate, Organization-scoped console; it does not turn the normal account settings page into an admin page.
Every settings route is permission-shaped. Alpha may hide an unavailable section, show it read-only, or label it “Managed by your organization.” Omega must still authorize every read and mutation independently.
The User menu and Project menu are navigation surfaces, not authority switches. Selecting or revisiting a Project in Alpha may update local navigation preference and the per-User/per-Project Workspace aggregate, but it never grants access or changes the Project scope of another open client. Each Project settings route contains its `projectID` and receives a fresh Project access decision.
## 1. Account settings
### Profile
Editable for an ordinary account:
- display name;
- avatar;
- locale;
- time zone;
- preferred color or other identity presentation used in collaboration.
Primary email changes require verification of the new address and recent authentication. If the primary identity is managed by enterprise provisioning, Alpha shows the value and its management source but does not offer an edit.
Omega operations:
```plain text
GetAccountSettings()
UpdateProfile(expected_version, patch)
BeginPrimaryEmailChange(new_email)
ConfirmPrimaryEmailChange(token)
```
### Sign-in and security
For a password-enabled account:
- change password;
- show when it was last changed;
- begin or complete recovery outside an authenticated session;
- configure supported multifactor methods when available.
Changing a password requires the current password or a recent step-up authentication, checks the new value against password policy and a compromised-password blocklist, rotates the credential, writes an audit event, and offers to revoke other sessions.
For an OIDC/SSO-only account:
- no Taurus password form is shown;
- Alpha explains that sign-in is managed by the named Organization;
- linked enterprise identity and last successful sign-in may be shown;
- identity changes route the User to the administrator or identity provider.
Omega operations:
```plain text
ChangePassword(current_password, new_password, revoke_other_sessions)
BeginPasswordRecovery(email) // response never reveals whether the email exists
CompletePasswordRecovery(token, new_password)
BeginStepUp(method)
CompleteStepUp(challenge)
```
### Sessions and devices
The User can view active sessions with:
- approximate device/browser;
- approximate location where permitted;
- created time;
- last activity;
- current-session marker.
Actions:
- sign out one other session;
- sign out all other sessions;
- sign out all sessions, including the current one.
Enterprise policy may impose maximum lifetime or force revocation, but should not conceal the User’s own session list without a specific security reason.
Session state authenticates the User and supports security controls; it is not the source of a mutable selected-Project authorization grant. “Last opened Project” may be shown as a convenience and stored as a User preference, while each active Project workspace and every Project request remain independently scoped.
### Preferences and accessibility
These settings are personal and synchronize across devices:
- theme and contrast;
- motion reduction;
- language, locale, date, and number formats;
- keyboard preference where alternatives exist;
- default notification preferences.
Workspace state—open tabs, panel lenses, viewport, panel geometry, and visible undo destination—does not belong here. It remains in the per-User/per-Project Workspace aggregate. It is durable user interaction state, not account preference, Organization policy, or Project content.
The User's Project Subcell may load and serve that Workspace aggregate while the Project is active, but a subcell is not a setting and never becomes the source of cross-Project preferences. Eviction, restart, or node failover cannot erase accepted Workspace state.
### Connected identities
The User may see approved linked identities. Linking or unlinking requires recent authentication. The final usable sign-in method cannot be removed. Enterprise identities may be locked by policy.
Third-party content connectors are not automatically authentication identities. Google Drive or SharePoint access belongs to connector settings even if it uses the same email address.
### Plan and usage
For a User-owned plan, show:
- plan name and status;
- renewal or expiry information when supplied by billing;
- relevant usage and limits;
- billing-management action when Taurus owns billing.
For an Organization-managed User, show:
- “Managed by \[Organization\]”;
- effective plan and relevant entitlements;
- the policy/version source when it explains a disabled feature;
- no personal upgrade control when it cannot affect the enterprise plan.
Alpha must not imply that a personal purchase can bypass Organization policy.
The control plane resolves entitlement into a bounded `EntitlementSnapshot` for the relevant User or Project request. Resource capabilities and admitted Project Subcells consume the resulting allowance or refusal; they do not query billing or license stores directly.
### Data and account
Potential operations:
- export personal account data;
- leave an Organization when policy and custody allow it;
- deactivate or delete the account.
Account deletion is blocked or converted to a transfer/deactivation workflow when the User still owns Projects. Historical authorship and security audit records are retained or anonymized according to policy; they are not rewritten as though the actions never occurred.
## 2. Project settings
### General
Fields:
- name;
- icon;
- purpose/description;
- project status.
Managers may edit ordinary metadata. Owner-sensitive identifiers and custody are not ordinary metadata.
### Ownership
Show:
- current owner type and name;
- owning root Organization, if applicable;
- effective plan source;
- pending ownership transfer, if any.
Permitted Users may initiate, cancel, accept, or decline an ownership transfer under the rules in the model. A Project manager cannot claim ownership merely because they manage access.
### Members and access
The access list must show both direct and inherited access:
<table header-row="true">
<tr>
<td>Principal</td>
<td>Source</td>
<td>Role</td>
<td>Example explanation</td>
</tr>
<tr>
<td>User</td>
<td>Direct</td>
<td>Viewer</td>
<td>“Granted directly by Alice”</td>
</tr>
<tr>
<td>Organization unit</td>
<td>Direct grant</td>
<td>Editor</td>
<td>“Applied AI and its child units”</td>
</tr>
<tr>
<td>User</td>
<td>Inherited</td>
<td>Editor</td>
<td>“Via Applied AI”</td>
</tr>
</table>
Managers can:
- invite a User;
- grant a User or Organization a role;
- change or revoke a direct Project grant;
- resend or cancel pending invitations.
Inherited grants cannot be edited on the User row. Alpha links to the Organization grant that produces the inheritance.
The UI should always be able to answer, “Why does this person have access?” Omega should return the access path rather than forcing Alpha to reconstruct it.
### Sharing links
Show active and revoked links, role, creator, created time, expiry, and last use where available.
Managers can create, rotate, expire, or revoke links within Organization policy. If public links are disabled or editor links are prohibited, the control is disabled with the policy source named.
### Project defaults
This section contains Project-wide behavior rather than personal editor preferences:
- default resource creation behavior;
- default knowledge/context participation where supported;
- AI/model policy references when Project-scoped;
- default template or project focus settings.
The exact controls may grow with capabilities, but every setting needs an owning Omega capability and a versioned mutation. Alpha must not create a miscellaneous JSON bag that no backend domain owns.
Project settings are addressed as `/projects/{projectID}/...` and admitted against the current User, grants, policy, and entitlements. They are not inferred from a cookie's last selected Project. User-cell affinity, subcell activation/eviction, idle draining, and deployment topology remain operational concerns; they do not appear as ordinary Project settings unless a future product requirement exposes a safe, user-facing status projection.
### Connectors
Show Project-scoped connections and ingestion sources:
- provider and account or site;
- health and last synchronization;
- granted scopes;
- reconnect, pause, or disconnect;
- affected resources and knowledge jobs where relevant.
Only Users with connector-management permission may mutate these. OAuth tokens remain server-side and are never returned to Alpha.
### Retention, export, and deletion
Depending on owner policy:
- view effective retention;
- request or download Project export;
- archive Project;
- restore Project;
- permanently delete after a confirmation and retention window.
An Organization policy can make retention read-only or prohibit permanent deletion. Destructive operations require explicit confirmation, recent authentication where appropriate, version checking, and audit.
## 3. Project admission and permission contract
Before serving Project settings, Omega resolves a fresh control-plane decision:
```go
type ProjectSettingsContext struct {
    SubjectUserID string
    ProjectID     string
    EffectiveRole ProjectRole
    Owner         OwnerRef
    Entitlements  EntitlementSnapshot
    AccessEpoch   uint64
    PolicyVersion string
}
```
The route `projectID`, this context, and the target Project must agree. A manager's Project-settings authority does not grant ownership, and an Organization administrator's custody authority does not grant content access.
Recommended named actions include:
```plain text
account.profile.update
account.email.change
account.password.change
account.session.revoke
account.deactivate

project.settings.read
project.metadata.update
project.grant.manage
project.share_link.manage
project.connector.manage
project.export.request
project.archive
project.delete
project.ownership.transfer
```
Alpha requests an effective capability set for the current User and resource. Omega returns decisions and optional management explanations:
```json
{
  "action": "account.password.change",
  "allowed": false,
  "reason": "managed_identity",
  "managed_by": {
    "kind": "organization",
    "id": "org_acme",
    "name": "Acme Corporation"
  }
}
```
This is presentation support, not a substitute for mutation-time authorization.
## 4. Concurrency and audit
Settings mutations use expected versions or equivalent compare-and-swap protection. On conflict, Omega returns the current projection and Alpha asks the User to review materially changed fields.
Audit events include:
- human actor and session;
- owning root Organization and Project, when relevant;
- named action;
- target principal;
- before/after security-relevant values;
- reason or policy source;
- success or refusal.
Secrets, passwords, recovery tokens, OAuth tokens, and raw identity assertions are never written to the audit payload.
## 5. Alpha behavior
- Keep Account and Project settings visually simple; complexity appears only when the User has authority to manage it.
- Clearly label direct, inherited, and managed values.
- Never present a locked enterprise setting as broken.
- For dangerous actions, state the concrete effect before confirmation.
- After a successful mutation, use the returned canonical projection rather than assuming the optimistic patch is complete.
- Project-scoped calls always carry the active route Project ID; Alpha never depends on a hidden server-side selection.
- Access and ownership changes should reconcile open Workspace tabs if the current User loses access, close live Project subscriptions safely, and preserve only navigation state that remains authorized.
- A User-level library, account preference, or Organization setting is not silently stored as Project Workspace state, and Project Workspace state is not treated as a global account preference.
## 6. Acceptance criteria
- Password Users can securely change and recover passwords.
- SSO-managed Users do not see a misleading local-password flow.
- Users can inspect and revoke their sessions.
- Account plan state distinguishes personal and Organization-managed plans.
- Project settings distinguish owner, managers, editors, and viewers.
- Direct and inherited access are visible and explainable.
- Managers can administer grants but cannot take ownership.
- Organization policy can manage or lock applicable settings.
- Connectors, exports, archival, and deletion are permissioned and audited.
- Every visible setting maps to a typed Omega read or mutation.
- User and Organization settings are usable with no Project selected.
- Project settings require an explicit, current Project admission; opening one Project never changes another client's authority.
- Settings mutations can invalidate live Project access through access/policy epochs without making Alpha guess what state remains visible.
## Sources
- Model — Identity, Organization, Project Ownership & Access
- Taurus Omega current Identity model: [https://github.com/gccurtis/taurus-omega/blob/main/core/capability/access/access.go](https://github.com/gccurtis/taurus-omega/blob/main/core/capability/access/access.go)
- Taurus Omega current Project access model: [https://github.com/gccurtis/taurus-omega/blob/main/core/capability/access/project.go](https://github.com/gccurtis/taurus-omega/blob/main/core/capability/access/project.go)
- NIST SP 800-63B: [https://pages.nist.gov/800-63-4/sp800-63b/authenticators/](https://pages.nist.gov/800-63-4/sp800-63b/authenticators/)
- OWASP Forgot Password guidance: [https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html)
## Related specifications
- [Model — Identity, Organization, Project Ownership & Access](https://app.notion.com/p/3acb6410e5028106b617d05f162b5ddf)
- [Architecture — Taurus Layered Application Model](https://app.notion.com/p/3acb6410e502812bb4e0ff2c91ff753f)
- [Architecture — Enterprise Control Plane](https://app.notion.com/p/3acb6410e50281988386c4559a26cd22)
- [Architecture — User Cell & Project Subcell Runtime](https://app.notion.com/p/3acb6410e5028147909ef7214406baad)
- [Implementation — Control Plane, User Cell & Project Subcell Integration](https://app.notion.com/p/3acb6410e50281b2999bce58d559d902)
- [Experience — Organization Administration](https://app.notion.com/p/3acb6410e502815c8782cb126c93b787)

