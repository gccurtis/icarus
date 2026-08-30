# Collaboration

## What the subject is

Four lenses covering the people in a project and the things they say to each
other. Together they answer *who is this, and what has been said here* — and they
are the smallest subject in the tree while being the one everything else leads
into. Two of the four are one person seen at two scales: a single profile and the
whole roster. The other two are one comment thread seen from two angles: the
conversation itself, and the single line of it that has your name in it.

**The person lens is the hub of the whole panel tree.** More than twenty other
panels route into it, from almost every subject: the author of a comment, the
creator of a template or an automation, whoever last touched a resource, the actor
in a row of the activity record, a face in a presence strip, a row of a roster, an
owner of a task. A name anywhere is a way into it.

That has one consequence worth stating before the sections: **a person lens has to
stand up from any entrance.** It carries no breadcrumb, because there is no one
place it is inside of, and it can assume nothing about what the reader was looking
at a moment ago. Whoever arrives — from an activity row, from a comment, from the
roster — must get the same four answers: who this is, what standing they have in
this project and whether they are here right now, what they have said, and what
they have done. Anything an entrance knows that the lens does not is a thing the
reader has just lost by following a link.

## Person

A person, inside this project. The picture sits at the head of the panel at head
size rather than as a row-sized face, with the name beside it and their standing
under it — their role, or their role and where they are when presence says they
are here now. Then three bands: who they are, what they have said, what they have
done.

The head actor is not a link. This person is the subject of the panel and cannot
be navigated to from inside itself.

The identity fields are email, role, and when they joined. The presence line is
only ever presence: a last-seen time is a different claim wearing presence's
clothes, so where nobody is here the line falls back to the role alone rather than
softening into "active two hours ago".

Comments carry **two controls, because there are two axes.** Which comments to
show is a choice between alternatives — everything they have said, or only what
mentions you. Whether a settled thread is still worth showing is an independent
yes or no that applies to either. One row of chips offering "Mentions of you" and
"Resolved" side by side would be a control that cannot say what picking both
means. The band's count reads matched of total whenever either is on, so a
narrowed list never reads as everything the person has said. Each row names the
resource, and the place inside it where there is one, with the excerpt beneath.

Activity arrives shut — it is context rather than the reason the panel was opened
— and carries no commenting, because that is the band above it and a feed holding
both would be the same rows twice. Only an entry that left a resource behind is a
row you can follow; the rest are readable and inert.

What it deliberately does not do: **there is nowhere here to write to them.** A
comment belongs on the thing it is about — you reach a person by mentioning them
on the memo, the cell or the slide, where the remark has a subject and everyone
who needs it can see it. A composer under someone's name would be a private
channel in a project that has none.

Routes to `collaboration.comment` for a comment row, and to `project.resource` for
an activity row that names one.

## Everyone

Everybody in the project at once, rather than one person. This is what a reader
gets for pressing "+4 more" instead of a face, so it is a roster and not a
profile: every row opens the person lens and the panel holds nothing a profile
would hold. Two bands: Here now, then Everyone.

Here now says plainly that nobody has the project open when that is the case,
rather than drawing an empty band. Everyone is truncated, and while it is, its
count reads as a fraction of the membership — a shortened roster must never read
as the whole of it.

**The overflow row summarises rather than hides.** A truncated list ending in a
bare count says how many people you cannot see; saying what they are — three
editors, one viewer — is the part that answers the question. Pressing it expands
the list here rather than sending the reader somewhere else, because being sent
somewhere else is what the reader was avoiding by pressing it.

What it deliberately does not do: presence needs an ephemeral collaboration
channel, which does not exist. It is never inferred from a last-seen time and
never from the activity record — both would report someone as here who closed the
tab an hour ago.

Routes to `collaboration.person`.

## Comment

One comment thread: what was said, what it is attached to, and the replies. **One
lens for every anchor kind** — a document range, a cell, a slide — because those
are the same thread with the same two controls, and only the anchor differs.

**The controls are at the top.** A thread has no ceiling, so a Reply button under
fifty replies is a button nobody reaches. Reply with nothing typed puts the cursor
in the composer at the foot of the thread; with something typed it sends, so there
is one send rather than two. Beside it, one control for both directions of
settling, labelled from the state — Resolve or Reopen — rather than a fixed word
sitting next to a chip that contradicts it. Settling leaves the thread in place: a
panel that vanished on the press would look like a deletion.

Then the state, said in words as well as colour so it survives being read without
colour, with a mentions-you chip that is absent rather than negated; who started
it and when; and the comment itself in full, never truncated and with no control
to expand it, because it is the thing the lens is about.

*Anchored to* is the band that makes the lens self-sufficient. **The anchor is
always shown**, because the trail above names the resource when the comment was
reached from a resource and a person when it was reached from a profile — a thread
that leaned on its breadcrumb could not say what it is about. The row opens the
resource at the anchor rather than at its top: the cell, the slide, or the text
itself. Where the anchor is a passage, the passage is quoted; a cell address or a
slide number is a location and not a quotation, so nothing is quoted for those.

Where the text has moved, both versions are shown and labelled — what it was
written on, and what now reads there. Whatever currently sits at the offset is
never shown as the anchor on its own: that would attribute the remark to a
sentence nobody was talking about. Where the text is gone entirely the panel says
so and the row still lands on the position it held.

Replies run oldest first: a thread is read as a conversation rather than scanned
as a feed, so the newest reply is next to where the next one gets written, and the
composer sits at the end. Nothing is collapsed — a thread long enough to want that
should have become a task.

What it deliberately does not do: resolving is local. The chip and the button
change, and the change lasts as long as the panel does, because nothing stores the
state yet.

Routes to `resource.cell`, `resource.slide` or `resource.text-selection` for an
anchored position, or the whole-resource lens for its kind —
`resource.document`, `resource.deck`, `resource.spreadsheet` — when there is no
position; and to `collaboration.person` from every name in the panel, the author's
and each replier's alike.

## Mention

One comment addressed to you: who wrote it, where it sits, what it says, and the
text it is attached to. Enough to answer without opening the document, and one
click to open the document when that is not enough.

**The controls are in the action row rather than at the foot.** A panel has no
footer band, on the rule that what a panel offers must be visible before what it
lists — and *Open in context* is the reason this lens exists, so it is the first
thing under the title. Beside it, Reply and Mark read.

**Replying opens the thread.** There is no composer here: the reply belongs beside
the rest of the conversation, and a second place to write one would be a second
draft nobody can find again.

The fields are who it came from, where it sits — the resource as a link that opens
at the anchor, with the place inside it where one is known — and when. Then the
comment in full: a clipped question is a question you cannot answer.

*Anchored to* works as it does on the comment lens, and for the same reasons. The
passage is quoted where the anchor is a passage, and where it is a place rather
than a passage the panel says that rather than quoting nothing. Where the text has
changed, both the original and what now reads there are shown and labelled: the
specification left it open which to quote, and showing the current text alone
attributes the question to a sentence nobody asked it about. Where the text is
gone, Open in context still lands on the position it held.

What it deliberately does not do, twice. A location inside a resource — "page 2",
"C2", "Slide 4" — is named by the editor that owns it and cannot be derived from
the anchor, so it is simply absent on anything that has not supplied one. And Mark
read would write a per-user read marker the model does not have; clearing lasts as
long as this panel does.

Routes to `collaboration.comment` for Reply, to `collaboration.person` for the
author, and to the same anchor lenses the comment lens uses.

## What is not here

**No private channel.** Nothing in the subject can address a person directly. The
person lens has no composer, the roster has no message control, and a reply always
lands in the thread it belongs to. Everything said in this project is said on the
thing it is about.

**Presence has no source.** Two panels display it and both say so. Neither will
substitute a last-seen time or an activity entry, because both would report
someone as here who has been gone for an hour, and a wrong presence is worse than
none.

**Nothing that changes state survives the panel.** Resolving a thread and marking
a mention read both work as the real thing for as long as the panel is up, then
start over. In both cases the panel is the behaviour without the memory.

**No groups, no teams, no per-resource permissions.** Membership here is a flat
roster of three roles, and a role is a fact about the project rather than about
any one document in it.

**Two lenses describe one thread**, and they must keep agreeing about the anchor —
the same passage, the same handling when it has changed or gone, the same
destinations. The difference between them is who the thread is being shown to, not
what the thread is.
