/**
 * People and comments: the doors the collaboration lenses read.
 *
 * `docs/screen-panel-views/inspector/collaboration/` is what these serve. Every
 * one is shaped like a real capability door — scoped by an id, answering with a
 * `Read` handle — so the panels above them do not change when the real one lands.
 */
import { PEOPLE, RESOURCES, VIEWER, type Person, type PersonId } from "$mock-capabilities/cast";
import { read, type Read } from "$mock-capabilities/read.svelte";

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

const ACTIVITY: readonly ActorActivity[] = [
  { id: "a-1", verb: "Created", subject: "Outage minutes by substation", age: "3d" },
  { id: "a-2", verb: "Edited", subject: "Regulatory filing shell", age: "2w" },
  { id: "a-3", verb: "Accepted", subject: "Undergrounding cut SAIDI 38%", age: "6d" },
  { id: "a-4", verb: "Uploaded", subject: "NERC-2025-winter-review.pdf", age: "4d" }
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

export const activityBy = (id: PersonId): Read<readonly ActorActivity[]> => {
  void id;
  return read(ACTIVITY, "collaboration.activityBy");
};

/** Everyone in the project, for the presence-overflow lens. */
export const members = (): Read<readonly Person[]> => read(PEOPLE, "collaboration.members");

export const thread = (id: string): Read<Thread> => {
  void id;
  return read(
    {
      id: "t-1",
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
    "collaboration.thread"
  );
};

/** What a person addressed to the viewer, newest first. */
export const mentionsForViewer = (): Read<readonly PersonComment[]> =>
  read(COMMENTS.filter((comment) => comment.mentionsViewer), "collaboration.mentionsForViewer");

/** The resource a comment hangs on, for a lens that needs to name it. */
export const resourceNamed = (name: string) =>
  RESOURCES.find((resource) => resource.name === name);
