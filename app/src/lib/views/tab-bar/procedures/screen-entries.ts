import type { Component } from "svelte";
import ChartNoAxesColumn from "@lucide/svelte/icons/chart-no-axes-column";
import FileText from "@lucide/svelte/icons/file-text";
import FlaskConical from "@lucide/svelte/icons/flask-conical";
import LayoutDashboard from "@lucide/svelte/icons/layout-dashboard";
import LayoutTemplate from "@lucide/svelte/icons/layout-template";
import Library from "@lucide/svelte/icons/library";
import Plus from "@lucide/svelte/icons/plus";
import Presentation from "@lucide/svelte/icons/presentation";
import Sheet from "@lucide/svelte/icons/sheet";
import Users from "@lucide/svelte/icons/users";
import Workflow from "@lucide/svelte/icons/workflow";

import type { Screen, Tab } from "$model/client/view-state";

/**
 * What a tab is called, and what it looks like.
 *
 * Display copy for a screen lives here because this is the surface that displays
 * it — the workspace maps the same key to a component and the context panel maps
 * its rail. Three maps on one vocabulary is deliberate: a label, an icon and a
 * component are different decisions, and the model publishes keys precisely so
 * that each surface can make its own.
 *
 * **A label is a function of the whole tab, not of its screen.** Every document
 * tab would otherwise read "Document", which is the one thing a tab strip exists
 * to prevent.
 *
 * `Record<Screen, …>` and not `Partial`: a screen with no label cannot be drawn,
 * and a new one should fail to compile rather than appear blank.
 */
export type ScreenEntry = {
  readonly label: (tab: Tab) => string;
  readonly icon: Component;
};

/**
 * A resource tab is named by what it holds. The id stands in until a title
 * arrives: a title lives on the metadata row rather than in the body, so it is
 * an ordinary query the day the table answers — and a placeholder that reads as
 * an id is better than one that reads as a name and is not.
 */
const resourceId = (tab: Tab): string => tab.resourceId ?? "Untitled";

export const SCREEN_ENTRIES: Record<Screen, ScreenEntry> = {
  "project-overview": { label: () => "Overview", icon: LayoutDashboard },
  research: { label: () => "Research", icon: FlaskConical },
  analysis: { label: () => "Analysis", icon: ChartNoAxesColumn },
  context: { label: () => "Context", icon: Library },
  templates: { label: () => "Templates", icon: LayoutTemplate },
  personas: { label: () => "Personas", icon: Users },
  automations: { label: () => "Automations", icon: Workflow },

  "document-editor": { label: resourceId, icon: FileText },
  "slide-deck-editor": { label: resourceId, icon: Presentation },
  "spreadsheet-editor": { label: resourceId, icon: Sheet },
  "new-tab": { label: () => "New tab", icon: Plus }
};

/** What this tab is called right now. */
export const labelOf = (tab: Tab): string => SCREEN_ENTRIES[tab.screen].label(tab);
