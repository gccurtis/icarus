import type { Component } from "svelte";
import Bot from "@lucide/svelte/icons/bot";
import ChartNoAxesColumn from "@lucide/svelte/icons/chart-no-axes-column";
import FileText from "@lucide/svelte/icons/file-text";
import FlaskConical from "@lucide/svelte/icons/flask-conical";
import House from "@lucide/svelte/icons/house";
import LayoutTemplate from "@lucide/svelte/icons/layout-template";
import Plus from "@lucide/svelte/icons/plus";
import Presentation from "@lucide/svelte/icons/presentation";
import Sheet from "@lucide/svelte/icons/sheet";

import type { Screen, Tab } from "$model/client/view-state";
import { nameOf } from "$capabilities/naming";

/**
 * What a tab is called, and what it looks like.
 *
 * Display copy for a screen lives here because this is the surface that displays
 * it — the context panel reads the same vocabulary for its rail, and the
 * workspace reads it as a path. Each surface deciding for itself is deliberate:
 * a name and a path are different decisions, and the model publishes keys
 * precisely so that neither has to be its business.
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

/** A tab that holds one identified thing is named by that thing. */
const subject = (tab: Tab): string =>
  tab.resourceId === undefined ? "Untitled" : nameOf(tab.resourceId);

export const SCREEN_ENTRIES: Record<Screen, ScreenEntry> = {
  // The house, because this is the one tab that is where you came from rather
  // than a kind of work: every other permanent tab is a collection.
  "project-overview": { label: () => "Overview", icon: House },
  agents: { label: () => "Agents", icon: Bot },
  templates: { label: () => "Templates", icon: LayoutTemplate },

  // A chart is opened, worked in and closed like a thread, so its tab is named
  // by the chart rather than by the screen: two of them are two tabs, and two
  // tabs both reading "Analysis" would be a strip you cannot navigate by.
  analysis: { label: subject, icon: ChartNoAxesColumn },

  research: { label: subject, icon: FlaskConical },
  "document-editor": { label: subject, icon: FileText },
  "slide-deck-editor": { label: subject, icon: Presentation },
  "spreadsheet-editor": { label: subject, icon: Sheet },
  "new-tab": { label: () => "New tab", icon: Plus }
};

/** What this tab is called right now. */
export const labelOf = (tab: Tab): string => SCREEN_ENTRIES[tab.screen].label(tab);
