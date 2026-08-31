import type { Component } from "svelte";
import ChartNoAxesColumn from "@lucide/svelte/icons/chart-no-axes-column";
import FileText from "@lucide/svelte/icons/file-text";
import FlaskConical from "@lucide/svelte/icons/flask-conical";
import Plus from "@lucide/svelte/icons/plus";
import Presentation from "@lucide/svelte/icons/presentation";
import Sheet from "@lucide/svelte/icons/sheet";

import { isSingleton, type Screen, type Singleton, type Tab } from "$model/client/view-state";
import { nameOf } from "$views/tab-bar/procedures/resource-name";

/**
 * What an opened tab is called, and what it looks like.
 *
 * Display copy for a screen lives here rather than in the model: the model
 * publishes a `Screen` and never interprets it, and each surface reads that one
 * vocabulary its own way.
 *
 * The three permanent screens are not in the table. The strip writes them out.
 */

/** A screen a person opens, rather than one that is always there. */
export type OpenedScreen = Exclude<Screen, Singleton>;

export type OpenedTab = Tab & { readonly screen: OpenedScreen };

export const isOpened = (tab: Tab): tab is OpenedTab => !isSingleton(tab.screen);

export type ScreenEntry = {
  readonly label: (tab: OpenedTab) => string;
  readonly icon: Component;
};

const subject = (tab: OpenedTab): string =>
  tab.resourceId === undefined ? "Untitled" : nameOf(tab.resourceId);

export const SCREEN_ENTRIES: Record<OpenedScreen, ScreenEntry> = {
  // Named by what they hold: two tabs both reading "Analysis" would be a strip
  // you cannot navigate by.
  analysis: { label: subject, icon: ChartNoAxesColumn },
  research: { label: subject, icon: FlaskConical },
  "document-editor": { label: subject, icon: FileText },
  "slide-deck-editor": { label: subject, icon: Presentation },
  "spreadsheet-editor": { label: subject, icon: Sheet },

  "new-tab": { label: () => "New tab", icon: Plus }
};

export const labelOf = (tab: OpenedTab): string => SCREEN_ENTRIES[tab.screen].label(tab);
