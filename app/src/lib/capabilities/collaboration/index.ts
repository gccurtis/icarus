/**
 * People and comments: the doors the collaboration lenses read.
 *
 * `docs/screen-panel-views/inspector/collaboration/` is what these serve. Every
 * one is shaped like a real capability door — scoped by an id, answering with a
 * `Read` handle — so the panels above them do not change when the real one lands.
 */
import { PEOPLE, RESOURCES, VIEWER, type Person, type PersonId } from "$capabilities/cast";
import { read, type Read } from "$capabilities/read.svelte";

/** Whether someone is here now, and what they have open. */
export type Presence = {
  readonly here: boolean;
  readonly at?: string;
};

/** One comment, flagged for the two things the person lens filters on. */
export type PersonComment = {
  readonly id: string;
  readonly author: PersonId;
  /** The resource it is anchored to, named as a reader would recognise it. */
  readonly resource: string;
  /** Where inside it — `C2`, `Slide 4`, or absent for the whole thing. */
  readonly location?: string;
  readonly excerpt: string;
  readonly age: string;
  readonly mentionsViewer: boolean;
  readonly resolved: boolean;
};

/** One thing someone did, for a profile's Activity band. */
export type ActorActivity = {
  readonly id: string;
  readonly verb: string;
  readonly subject: string;
  /**
   * What it was done to, where the project holds a row for it. Absent for work
   * that left no resource behind, and a row with no target is not a link — a
   * button that opens nothing is worse than a line of text.
   */
  readonly subjectId?: string;
  readonly age: string;
};

/** A thread, as the comment lens reads it. */
export type Thread = {
  readonly id: string;
  readonly state: "open" | "resolved";
  readonly mentionsViewer: boolean;
  readonly author: PersonId;
  readonly started: string;
  readonly body: string;
  readonly anchor: {
    readonly resource: string;
    readonly location?: string;
    /** Present only on a text anchor. A cell address is not a quotation. */
    readonly text?: string;
    /** How the anchor resolved against the resource as it is now. */
    readonly resolution: "intact" | "changed" | "gone";
    /** What is at that position today, when the anchor has moved under it. */
    readonly nowReads?: string;
  };
  readonly replies: readonly {
    readonly id: string;
    readonly author: PersonId;
    readonly body: string;
    readonly age: string;
  }[];
};

const COMMENTS: readonly PersonComment[] = [
  {
    id: "c-1",
    author: "mira",
    resource: "Q3 Resilience Memo",
    excerpt: "@ana can you confirm 1,842,000 against the relay log?",
    age: "2h",
    mentionsViewer: true,
    resolved: false
  },
  {
    id: "c-2",
    author: "mira",
    resource: "Outage Cost Model",
    location: "C2",
    excerpt: "@ana corrected total or the old one? The event log says 1,840,200.",
    age: "1d",
    mentionsViewer: true,
    resolved: false
  },
  {
    id: "c-3",
    author: "mira",
    resource: "Interconnect Failure Review",
    excerpt: "This paragraph needs the 2025 figure, not the 2024 one.",
    age: "3d",
    mentionsViewer: false,
    resolved: true
  },
  {
    id: "c-4",
    author: "tomas",
    resource: "Board Update — October",
    location: "Slide 4",
    excerpt: "@ana is this the chart you wanted, on the same scale as slide 3?",
    age: "4h",
    mentionsViewer: true,
    resolved: false
  },
  {
    id: "c-5",
    author: "tomas",
    resource: "Storm Hardening Options",
    excerpt: "Approved, thanks.",
    age: "3d",
    mentionsViewer: false,
    resolved: true
  }
];

/**
 * What each person has done here.
 *
 * `by` is the only field a caller never sees: it is how the door answers for one
 * person, and a profile showing everybody's work under one name is the failure
 * this exists to prevent. Devi has no rows, because a Viewer has done nothing —
 * an empty band is a true answer and the lens says so in words.
 */
const ACTIVITY: readonly (ActorActivity & { readonly by: PersonId })[] = [
  {
    id: "a-1",
    by: "mira",
    verb: "Created",
    subject: "Outage minutes by substation",
    subjectId: "r-minutes",
    age: "3d"
  },
  {
    id: "a-2",
    by: "mira",
    verb: "Changed C2 in",
    subject: "Outage Cost Model",
    subjectId: "r-cost",
    age: "26m"
  },
  {
    id: "a-3",
    by: "mira",
    verb: "Edited",
    subject: "Interconnect Failure Review",
    subjectId: "r-review",
    age: "1d"
  },
  {
    id: "a-4",
    by: "ana",
    verb: "Edited",
    subject: "Q3 Resilience Memo",
    subjectId: "r-memo",
    age: "4m"
  },
  {
    id: "a-5",
    by: "ana",
    verb: "Opened the thread",
    subject: "Why did Feeder 12 fail twice?",
    subjectId: "r-feeder",
    age: "1d"
  },
  {
    /** No resource came out of it, so the row below carries no link. */
    id: "a-6",
    by: "ana",
    verb: "Reconnected",
    subject: "SharePoint — Ops Reports",
    age: "5d"
  },
  {
    id: "a-7",
    by: "tomas",
    verb: "Added slide 4 to",
    subject: "Board Update — October",
    subjectId: "r-board",
    age: "1d"
  },
  {
    id: "a-8",
    by: "tomas",
    verb: "Edited",
    subject: "Storm Hardening Options",
    subjectId: "r-options",
    age: "1w"
  },
  {
    id: "a-9",
    by: "tomas",
    verb: "Uploaded",
    subject: "NERC-2025-winter-review.pdf",
    subjectId: "r-nerc",
    age: "4d"
  }
];

/** One person's membership in this project. */
export const member = (id: PersonId): Read<Person> =>
  read(PEOPLE.find((person) => person.id === id) ?? VIEWER, "collaboration.member");

export const presenceFor = (id: PersonId): Read<Presence> => {
  const person = PEOPLE.find((candidate) => candidate.id === id);
  return read(
    person?.at === undefined ? { here: false } : { here: true, at: person.at },
    "collaboration.presenceFor"
  );
};

/**
 * Everything one person has said here, each flagged for whether it mentions the
 * viewer and whether its thread is resolved.
 *
 * Both flags come back on the row rather than from a second query, because the
 * section's matched-of-total count has to be right for either filter and two
 * queries cannot both be the denominator.
 */
export const commentsBy = (id: PersonId): Read<readonly PersonComment[]> =>
  read(COMMENTS.filter((comment) => comment.author === id), "collaboration.commentsBy");

export const activityBy = (id: PersonId): Read<readonly ActorActivity[]> =>
  read(
    ACTIVITY.filter((entry) => entry.by === id),
    "collaboration.activityBy"
  );

/** Everyone in the project, for the presence-overflow lens. */
export const members = (): Read<readonly Person[]> => read(PEOPLE, "collaboration.members");

/**
 * The five threads in full, keyed by the same ids the comment rows carry.
 *
 * **One id space, and that is the whole point of the array.** A mention row, a
 * profile's comment list and the status bar all hold a `c-` id; a thread stored
 * under an id of its own would mean every one of those three reached a panel
 * about a different conversation than the one they named.
 *
 * The three anchor resolutions are each represented once — intact, changed, gone
 * — because the lens draws a different thing for each and a sample that only
 * exercises the first is a sample that hides two of the three.
 */
const THREADS: readonly Thread[] = [
  {
    id: "c-1",
    state: "open",
    mentionsViewer: true,
    author: "mira",
    started: "2 hours ago",
    body: "@ana can you confirm 1,842,000 against the relay log? The event log says 1,840,200.",
    anchor: {
      resource: "Q3 Resilience Memo",
      text: "nearly a third of customer-minutes lost",
      resolution: "intact"
    },
    replies: [
      { id: "r-1", author: "ana", body: "Checking against the relay log.", age: "1h" },
      { id: "r-2", author: "mira", body: "Thanks — no rush before Thursday.", age: "48m" }
    ]
  },
  {
    id: "c-2",
    state: "open",
    mentionsViewer: true,
    author: "mira",
    started: "1 day ago",
    body: "@ana corrected total or the old one? The event log says 1,840,200 and this cell does not.",
    // A cell address is a location rather than a quotation, so no `text`.
    anchor: { resource: "Outage Cost Model", location: "C2", resolution: "intact" },
    replies: [
      { id: "r-3", author: "ana", body: "The old one. I will repoint it at the event log.", age: "20h" }
    ]
  },
  {
    id: "c-3",
    state: "resolved",
    mentionsViewer: false,
    author: "mira",
    started: "3 days ago",
    body: "This paragraph needs the 2025 figure, not the 2024 one.",
    anchor: {
      resource: "Interconnect Failure Review",
      text: "the 2024 review put the shortfall at 340 MW",
      resolution: "changed",
      nowReads: "the 2025 review puts the shortfall at 410 MW"
    },
    replies: [{ id: "r-4", author: "tomas", body: "Updated — thanks.", age: "2d" }]
  },
  {
    id: "c-4",
    state: "open",
    mentionsViewer: true,
    author: "tomas",
    started: "4 hours ago",
    body: "@ana is this the chart you wanted, on the same scale as slide 3?",
    anchor: { resource: "Board Update — October", location: "Slide 4", resolution: "intact" },
    replies: []
  },
  {
    id: "c-5",
    state: "resolved",
    mentionsViewer: false,
    author: "tomas",
    started: "3 days ago",
    body: "Approved, thanks.",
    anchor: {
      resource: "Storm Hardening Options",
      text: "Option C, staged over two rate years",
      resolution: "gone"
    },
    replies: []
  }
];

/**
 * One thread, by the id the row that named it carries.
 *
 * The first is the fallback for an id no thread answers for, which keeps the
 * lens drawing rather than blank — but it is a fallback and not the answer, and
 * a caller reaching it means an id came from somewhere that does not hold one.
 */
export const thread = (id: string): Read<Thread> =>
  read(THREADS.find((candidate) => candidate.id === id) ?? THREADS[0], "collaboration.thread");

/** What a person addressed to the viewer, newest first. */
export const mentionsForViewer = (): Read<readonly PersonComment[]> =>
  read(COMMENTS.filter((comment) => comment.mentionsViewer), "collaboration.mentionsForViewer");

/** The resource a comment hangs on, for a lens that needs to name it. */
export const resourceNamed = (name: string) =>
  RESOURCES.find((resource) => resource.name === name);
