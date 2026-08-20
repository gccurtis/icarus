# A person

| Selecting | What it is | Sections |
| --- | --- | --- |
| A person — their avatar, their name in a table, any "who" link | Their profile inside this project, and the one place you can write to them | Person · Message · Between you · Recently · Access |

Hovering an avatar names them. Clicking opens this. It is a project profile, not
an account page: everything here is scoped to the project you are in, and the
panel says so where it matters.

## Layout

| 300px |
| --- |
| person |
| person |
| message |
| message |
| between you |
| recently |
| access |

## Person

Picture, name, what they are doing right now, and the few facts about them that
are worth carrying.

**Shows**

| | |
| --- | --- |
| Name | Mira Jain |
| Presence | Owner · here now, in Outage Cost Model |
| Email | mira.jain@northwind.example |
| Role | Owner |
| Member since | 12 Mar 2026 |

**Needs** — `User` for name, avatar and email; project membership for the role;
an ephemeral presence channel for "here now". Presence is never inferred from
`lastSeenAt` and never from Activity.

## Message

A composer addressed to this person, and the sentence that says what sending it
actually does.

This is a comment in *this project* addressed to them. It is not email and not a
private inbox — it lands in their Mentions here, and anyone in the project can
read it. That has to be stated in the panel, because a box with someone's name
above it reads as private unless told otherwise.

**Shows** — an empty composer, a **Send** button, and one line of explanation.

**Needs** — a project-level comment with no resource anchor.

**Open** — every current `Comment` anchors to a resource, so an unanchored one has
nowhere to live. This section is blocked until that exists.

## Between you

What has passed between the two of you: their mentions of you, and yours of them.
Not their whole activity — the part that concerns you.

**Shows**

- Mentioned you on Q3 Resilience Memo — "@ana can you confirm 1,842,000…" — 2h
- Mentioned you in Outage Cost Model, C2 — "@ana corrected total or the old one?" — 1d

**Needs** — a comment-mention query filtered to a pair of actors, in one project.

## Recently

What they have done in this project. Starts collapsed — it is context, not the
reason you opened the panel.

**Shows**

- Created *Outage minutes by substation* — 3d
- Edited *Regulatory filing shell* — 2w

**Needs** — `Activity`, filtered by actor and project.

## Access

What they can do here, and where to change it. Starts collapsed.

Role changes and removal live in project settings. This section names the role
and points there rather than becoming membership administration inside a 320px
panel.

**Shows** — `Can · Create, edit, manage membership, archive`, `Change role · Project settings`

**Needs** — the project's membership record and the capability set each role
implies.
