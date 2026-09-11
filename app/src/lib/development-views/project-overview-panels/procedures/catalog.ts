import ActivityInspectorMock from "$development-views/project-overview-panels/components/activity-inspector-mock.svelte";
import CommentInspectorMock from "$development-views/project-overview-panels/components/comment-inspector-mock.svelte";
import HistoryContextMock from "$development-views/project-overview-panels/components/history-context-mock.svelte";
import OverviewContextMock from "$development-views/project-overview-panels/components/overview-context-mock.svelte";
import PersonInspectorMock from "$development-views/project-overview-panels/components/person-inspector-mock.svelte";
import ResourceInspectorMock from "$development-views/project-overview-panels/components/resource-inspector-mock.svelte";
import type {
  PanelReference,
  PanelReferenceId,
  SourceReadiness
} from "$development-views/project-overview-panels/types";

/**
 * The code-derived contract for the six Project Overview flanks.
 *
 * The mock components answer what the panels should look like. This catalogue
 * answers the separate question of whether each displayed fact can be supplied
 * by today's scoped browser API. Keeping the two beside one another prevents a
 * convincing mock from silently becoming an invented data contract.
 */
export const PANEL_REFERENCES = [
  {
    id: "overview",
    label: "Overview",
    surface: "context",
    viewKey: "project-overview.overview",
    destination:
      "src/lib/app-views/categories/project-overview/context/overview.svelte",
    implementation: "existing",
    purpose:
      "A light administrative companion to the centre: project status, the viewer's role, and when the project began.",
    selection: "No row selection. Reads the active project and signed-in viewer.",
    component: OverviewContextMock,
    sources: [
      {
        label: "Project context",
        read: "readProjectOverview()",
        owner: "project capability · projects + memberships",
        provides: "Active or archived state, the viewer's project role, and project creation time.",
        readiness: "available",
        note: "The server resolves both project and viewer from request scope; no first-row or display-name inference remains in this panel."
      }
    ],
    decisions: [
      "Do not repeat the project name, description, roster, resource counts, mentions, or activity already visible in the centre.",
      "Keep this resting context intentionally sparse; three administrative facts are enough.",
      "Project identity editing belongs to a dedicated project-settings path, not this context panel."
    ]
  },
  {
    id: "history",
    label: "History",
    surface: "context",
    viewKey: "project-overview.history",
    destination:
      "src/lib/app-views/categories/project-overview/context/history.svelte",
    implementation: "existing",
    purpose:
      "A searchable, date-scoped chronological project record made only from immutable activity events.",
    selection: "No row selection. Scoped by the active project.",
    component: HistoryContextMock,
    sources: [
      {
        label: "Project record",
        read: "readProjectHistory(input)",
        owner: "project capability · activity",
        provides: "Actor snapshot label, verb, target, optional detail, and event time.",
        readiness: "available",
        note: "Only project activity is queried. Comments and mention recipients are outside this result by construction."
      },
      {
        label: "Search, windows, and paging",
        read: "readProjectHistory({ search, since, before, limit })",
        owner: "project capability",
        provides: "One ordered page plus matched, total, and continuation state.",
        readiness: "available",
        note: "The server owns filtering and counts over the whole selected window."
      }
    ],
    decisions: [
      "Do not place comments addressed to any person in History; mentions remain on the centre surface.",
      "A neutral activity entry may record that somebody commented without exposing a recipient.",
      "Keep one filter, one search field, and one flat result list; the search already makes date-group disclosures unnecessary."
    ]
  },
  {
    id: "person",
    label: "Person",
    surface: "inspector",
    viewKey: "general.person",
    destination: "src/lib/app-views/general/person/person.svelte",
    implementation: "existing",
    purpose:
      "Who this collaborator is in the current project, what access they have, and their recent contribution.",
    selection: '{ kind: "person", id: userId }',
    component: PersonInspectorMock,
    sources: [
      {
        label: "Project person",
        read: "readProjectPerson({ userId })",
        owner: "project capability · users + memberships",
        provides: "Display identity, policy-safe profile fields, role, and join time.",
        readiness: "available",
        note: "The read returns a person only when their membership belongs to the resolved project."
      },
      {
        label: "Contribution",
        read: "readProjectPerson({ userId })",
        owner: "project capability · activity + comments + resource metadata",
        provides: "Project-local counts and a bounded recent activity stream.",
        readiness: "available",
        note: "Ordering and counts are resolved server-side without widening generic store/read."
      },
      {
        label: "Presence",
        read: "No current read",
        owner: "Not represented",
        provides: "Here-now state and current location.",
        readiness: "missing",
        note: "The production panel omits presence until a live owner exists; the mock retains the target-state shape."
      }
    ],
    decisions: [
      "The lens is general because a person can be inspected from every category.",
      "Current profile data and historical actorLabel are different facts; a rename must not rewrite event prose.",
      "Do not expose authSubject, settings, or membership tokens through the person capability."
    ]
  },
  {
    id: "comment",
    label: "Comment",
    surface: "inspector",
    viewKey: "project-overview.comment",
    destination:
      "src/lib/app-views/categories/project-overview/inspector/comment.svelte",
    implementation: "existing",
    purpose:
      "The selected discussion in context: anchor, original remark, replies, resolution, and the next reply.",
    selection: '{ kind: "comment", id: threadId }',
    component: CommentInspectorMock,
    sources: [
      {
        label: "Comment detail",
        read: "readProjectComment({ threadId })",
        owner: "project capability · commentThreads + comments + resources + users",
        provides: "Resource name and type, state, selected text, authors, original comment, replies, and relative chronology.",
        readiness: "available",
        note: "The server scopes every joined row to the active project and returns no generic store payloads."
      },
      {
        label: "Reply and resolution",
        read: "comments.reply() + comments.resolveThread()",
        owner: "comments capability",
        provides: "Scoped reply, resolve, and reopen mutations.",
        readiness: "available",
        note: "The Project Overview lens uses the existing scoped mutations, then refreshes its own projection."
      },
      {
        label: "Resource navigation",
        read: "workspaceState.open() + workspaceState.inspect()",
        owner: "workspace state",
        provides: "Locate in document or presentation, resource detail, and author inspection.",
        readiness: "available",
        note: "The scoped projection supplies bounded anchor identifiers; the workspace owns the actual navigation."
      }
    ],
    decisions: [
      "The lens lifetime is a thread, not one remark, so the selection ID must be commentThreads:<id>.",
      "Project Overview owns this lens; general.comment remains independent for other categories.",
      "Show resource name, resource type, and Open or Resolved before the selected text and conversation."
    ]
  },
  {
    id: "activity",
    label: "Activity",
    surface: "inspector",
    viewKey: "project-overview.activity",
    destination:
      "src/lib/app-views/categories/project-overview/inspector/activity.svelte",
    implementation: "existing",
    purpose:
      "One immutable event organized around what happened, where, who, and when.",
    selection: '{ kind: "activity", id: activityId }',
    component: ActivityInspectorMock,
    sources: [
      {
        label: "Event record",
        read: "readProjectActivity({ activityId })",
        owner: "project capability · activity",
        provides: "Event time, actor reference, frozen actor label, verb, target, context, and optional detail.",
        readiness: "available",
        note: "The event must belong to the resolved project; frozen labels keep it readable after a rename or deletion."
      },
      {
        label: "Inspectable actor",
        read: "readProjectActivity({ activityId }).actor",
        owner: "project capability · current actor records",
        provides: "A route from the historical name to the actor's current lens.",
        readiness: "available",
        note: "The sentence keeps actorLabel; only the inspectable link uses the live actor projection."
      },
      {
        label: "Context and detail",
        read: "readProjectActivity({ activityId })",
        owner: "activity.context + activity.detail",
        provides: "Secondary target and human-readable supporting detail when the event recorded it.",
        readiness: "available",
        note: "A research event's frozen target label preserves the exact question asked. Edited events currently carry no delta or revision pointer."
      }
    ],
    decisions: [
      "This lens is read-only: an activity record is evidence, not an editable resource.",
      "Translate storage verbs into consumer-facing actions while retaining the stored value as evidence.",
      "Feature exact authored content when the event carries it; never present a resource's current body as a historical edit.",
      "Do not expose event IDs, nearby inferred activity, or implementation notes in the panel."
    ]
  },
  {
    id: "resource",
    label: "Resource",
    surface: "inspector",
    viewKey: "project-overview.resource",
    destination:
      "src/lib/app-views/categories/project-overview/inspector/resource.svelte",
    implementation: "existing",
    purpose:
      "Executive context for deciding whether a resource is worth opening: summary, useful scale, provenance, and recent activity.",
    selection: '{ kind: resourceKind, id: resourceId }',
    component: ResourceInspectorMock,
    sources: [
      {
        label: "Summary and provenance",
        read: "readProjectResource({ resourceId })",
        owner: "project capability · five resource tables",
        provides: "Recognizable name and type, creator, creation time, editable summary, and whether a native editor can open it.",
        readiness: "available",
        note: "updateProjectResourceSummary() writes only the selected scoped resource and stamps the current viewer where supported."
      },
      {
        label: "At-a-glance facts",
        read: "readProjectResource({ resourceId })",
        owner: "project capability · leader snapshots + sheetCells + commentThreads",
        provides: "Words, slides, sheet dimensions, filled cells, findings, sources, research use, and comments as appropriate to the type.",
        readiness: "available",
        note: "Only derived counts cross the boundary; authored bodies remain owned by their native capabilities."
      },
      {
        label: "Recent activity",
        read: "readProjectResource({ resourceId })",
        owner: "project capability · activity",
        provides: "A bounded project-local activity list for the selected resource.",
        readiness: "available",
        note: "Last-editor metadata is omitted because the activity record already carries that information."
      }
    ],
    decisions: [
      "Never expose resource IDs, templates, revisions, or internal record language in this panel.",
      "Files and connectors keep their dedicated lenses because their facts and actions do not share this contract.",
      "Use a compact figure band with direct labels and counts, such as Comments / 1."
    ]
  }
] as const satisfies readonly PanelReference[];

export const REFERENCE_GROUPS = [
  {
    label: "Context",
    ids: ["overview", "history"]
  },
  {
    label: "Inspector",
    ids: ["person", "comment", "activity", "resource"]
  }
] as const satisfies readonly {
  readonly label: string;
  readonly ids: readonly PanelReferenceId[];
}[];

export const READINESS_LABELS: Record<SourceReadiness, string> = {
  available: "Available now",
  join: "Client join today",
  capability: "Needs capability",
  missing: "Not represented"
};

export const referenceById = (id: PanelReferenceId): PanelReference => {
  const found = PANEL_REFERENCES.find((panel) => panel.id === id);
  // The id union and the catalogue are kept exhaustive above. This throw turns
  // an accidental future omission into a useful development-page failure.
  if (found === undefined) throw new Error(`Unknown project overview panel: ${id}`);
  return found;
};
