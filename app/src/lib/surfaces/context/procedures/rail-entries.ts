import type { Component } from "svelte";
import Activity from "@lucide/svelte/icons/activity";
import AtSign from "@lucide/svelte/icons/at-sign";
import Axis3d from "@lucide/svelte/icons/axis-3d";
import BookOpen from "@lucide/svelte/icons/book-open";
import Bot from "@lucide/svelte/icons/bot";
import Brain from "@lucide/svelte/icons/brain";
import ChartColumn from "@lucide/svelte/icons/chart-column";
import CircleQuestionMark from "@lucide/svelte/icons/circle-question-mark";
import Clock from "@lucide/svelte/icons/clock";
import ClockArrowLeft from "@lucide/svelte/icons/clock-arrow-left";
import FileText from "@lucide/svelte/icons/file-text";
import Footprints from "@lucide/svelte/icons/footprints";
import Group from "@lucide/svelte/icons/group";
import Hash from "@lucide/svelte/icons/hash";
import HeartPulse from "@lucide/svelte/icons/heart-pulse";
import Info from "@lucide/svelte/icons/info";
import Layers from "@lucide/svelte/icons/layers";
import LayoutPanelTop from "@lucide/svelte/icons/layout-panel-top";
import LayoutTemplate from "@lucide/svelte/icons/layout-template";
import Lightbulb from "@lucide/svelte/icons/lightbulb";
import List from "@lucide/svelte/icons/list";
import MessageSquare from "@lucide/svelte/icons/message-square";
import MessagesSquare from "@lucide/svelte/icons/messages-square";
import Network from "@lucide/svelte/icons/network";
import Palette from "@lucide/svelte/icons/palette";
import Play from "@lucide/svelte/icons/play";
import Plus from "@lucide/svelte/icons/plus";
import Presentation from "@lucide/svelte/icons/presentation";
import Proportions from "@lucide/svelte/icons/proportions";
import Printer from "@lucide/svelte/icons/printer";
import ScrollText from "@lucide/svelte/icons/scroll-text";
import Search from "@lucide/svelte/icons/search";
import Sparkles from "@lucide/svelte/icons/sparkles";
import SquareFunction from "@lucide/svelte/icons/square-function";
import SquarePlus from "@lucide/svelte/icons/square-plus";
import StickyNote from "@lucide/svelte/icons/sticky-note";
import Tag from "@lucide/svelte/icons/tag";
import Target from "@lucide/svelte/icons/target";
import Type from "@lucide/svelte/icons/type";
import Upload from "@lucide/svelte/icons/upload";
import Users from "@lucide/svelte/icons/users";
import Workflow from "@lucide/svelte/icons/workflow";
import Wrench from "@lucide/svelte/icons/wrench";
import Zap from "@lucide/svelte/icons/zap";

import type { ContextView } from "$model/client/workspace-state";

/**
 * What each context view looks like in the rail: a name and an icon.
 *
 * The rail is a vertical strip of icons down the left of the context panel, and
 * collapsed it is all that is left of the panel — so the icon is the whole
 * affordance, and an entry that does not say what it opens is a dead end. Which
 * views a category offers, and in what order, is not here: that is `RAILS`.
 *
 * **`Record<ContextView, …>` rather than a partial map**, so a context view with
 * no rail entry fails to compile rather than failing to draw. Every key in the
 * vocabulary has an entry here whether or not its panel is built yet — the rail
 * is how an unbuilt view is reached, and a key with no way to reach it cannot be
 * proved to route at all.
 *
 * **The labels are written, not derived.** Never inferred from the id or the
 * file name; the subject document beside the panels is where the wording is
 * argued. Where two ids carry the same label that is intended: every category has
 * an "Overview" and no two show the same thing, so the label names the job and
 * the id names the content.
 *
 * **The icons follow the subject, not the word.** The same subject looks the same
 * on every category that carries it — Variables is always a hash, Context always a
 * target, Overview always the same mark — while two entries in one rail never
 * share one, which is the only collision that matters when the panel is closed.
 */
export type RailEntry = { readonly label: string; readonly icon: Component };

export const RAIL_ENTRIES: Record<ContextView, RailEntry> = {
  /**
   * Agents: how a persona is defined and what an automation does. `Health` takes
   * the heartbeat rather than a warning triangle — the view is the state of every
   * rule, not an error report.
   */
  "agents.automations": { label: "Automations", icon: Workflow },
  "agents.behaviour": { label: "Behaviour", icon: ScrollText },
  "agents.context-persona": { label: "Context", icon: Target },
  "agents.do-this": { label: "Do this", icon: Play },
  "agents.health": { label: "Health", icon: HeartPulse },
  "agents.personas": { label: "Personas", icon: Bot },
  "agents.tasks": { label: "Tasks", icon: Sparkles },
  "agents.tools": { label: "Tools", icon: Wrench },
  "agents.when": { label: "When", icon: Zap },
  "agents.work": { label: "Work", icon: Activity },

  /** Analysis: building one chart. `Fields` is the axes, because that is where a field goes. */
  "analysis.chart": { label: "Chart", icon: ChartColumn },
  "analysis.fields": { label: "Fields", icon: Axis3d },
  "analysis.formula": { label: "Formula", icon: SquareFunction },
  "analysis.chartable-variables": { label: "Variables", icon: Hash },

  /** Library: browsing what a project already has, and starting something new. */
  "analysis.analyses": { label: "Analyses", icon: ChartColumn },
  "new-tab.bring-in": { label: "Bring in", icon: Upload },
  "project-overview.contexts-library": { label: "Contexts", icon: Target },
  "new-tab.create": { label: "Create", icon: Plus },
  "research.findings-library": { label: "Findings", icon: Lightbulb },
  "research.inquiry-library": { label: "Inquiry", icon: CircleQuestionMark },
  "new-tab.recent": { label: "Recent", icon: Clock },
  "new-tab.templates": { label: "Templates", icon: LayoutTemplate },
  "research.threads": { label: "Threads", icon: MessagesSquare },

  /**
   * Overview: eleven different views doing one job — what is this and where am I.
   * One icon for all of them, and it is `Info` rather than a dashboard mark
   * because the rails that lead with an Overview also carry Templates and
   * Layouts, and those three panel glyphs are not tellable apart at rail size.
   */
  "agents.overview": { label: "Overview", icon: Info },
  "analysis.overview": { label: "Overview", icon: Info },
  "context-editor.overview": { label: "Overview", icon: Info },
  "slide-deck-editor.overview": { label: "Overview", icon: Info },
  "document-editor.overview": { label: "Overview", icon: Info },
  "project-overview.overview": { label: "Overview", icon: Info },
  "research.overview": { label: "Overview", icon: Info },
  "spreadsheet-editor.overview": { label: "Overview", icon: Info },
  "templates.overview-library": { label: "Overview", icon: Info },

  /**
   * Project: the whole project rather than one resource. `Mentions` is a person
   * addressing you and `Health` is what cannot proceed, so the two never share a
   * mark. `variables-create` is the Variables panel becoming a form and is on no
   * rail; it is named here because the table is total.
   */
  "project-overview.activity": { label: "Activity", icon: Activity },
  "project-overview.contexts": { label: "Context", icon: Target },
  "project-overview.history": { label: "History", icon: Clock },
  "project-overview.mentions": { label: "Mentions", icon: AtSign },
  "project-overview.people": { label: "People", icon: Users },
  "project-overview.resources": { label: "Resources", icon: Layers },
  "project-overview.tasks": { label: "Tasks", icon: Sparkles },
  "project-overview.templates": { label: "Templates", icon: LayoutTemplate },
  "project-overview.variables": { label: "Variables", icon: Hash },
  "analysis.variables": { label: "Variables", icon: Hash },
  "document-editor.variables": { label: "Variables", icon: Hash },
  "slide-deck-editor.variables": { label: "Variables", icon: Hash },
  "spreadsheet-editor.variables": { label: "Variables", icon: Hash },
  "project-overview.variables-create": { label: "Create variable", icon: Plus },

  /**
   * Research: one line of enquiry. `Trace` is footprints — the steps the agent
   * took — and `History` is a clock turned back, so a record and a reasoning
   * path never read as the same thing.
   */
  "research.context": { label: "Context", icon: Target },
  "research.findings": { label: "Findings", icon: Lightbulb },
  "research.history": { label: "History", icon: ClockArrowLeft },
  "research.inquiry": { label: "Inquiry", icon: CircleQuestionMark },
  "research.sources": { label: "Sources", icon: BookOpen },
  "research.trace": { label: "Trace", icon: Footprints },

  /**
   * Resource: the document, deck and spreadsheet editors. The same job in three
   * editors is one icon — Find, Insert, Comments, Context and Styles are each a
   * single mark wherever they appear.
   */
  "slide-deck-editor.comments": { label: "Comments", icon: MessageSquare },
  "document-editor.comments": { label: "Comments", icon: MessageSquare },
  "spreadsheet-editor.comments": { label: "Comments", icon: MessageSquare },
  "slide-deck-editor.context": { label: "Context", icon: Target },
  "document-editor.context": { label: "Context", icon: Target },
  "spreadsheet-editor.context": { label: "Context", icon: Target },
  "spreadsheet-editor.dependencies": { label: "Dependencies", icon: Network },
  "slide-deck-editor.find": { label: "Find", icon: Search },
  "document-editor.find": { label: "Find", icon: Search },
  "spreadsheet-editor.find": { label: "Find", icon: Search },
  "slide-deck-editor.insert": { label: "Insert", icon: SquarePlus },
  "document-editor.insert": { label: "Insert", icon: SquarePlus },
  "spreadsheet-editor.insert": { label: "Insert", icon: SquarePlus },
  "slide-deck-editor.layers": { label: "Layers", icon: Layers },
  "slide-deck-editor.layout-layouts": { label: "Layouts", icon: LayoutTemplate },
  "slide-deck-editor.layout-objects": { label: "Objects", icon: Group },
  "slide-deck-editor.layout-theme": { label: "Theme", icon: Palette },
  "slide-deck-editor.layouts": { label: "Layouts", icon: LayoutTemplate },
  "spreadsheet-editor.named-ranges": { label: "Named ranges", icon: Tag },
  "document-editor.navigator": { label: "Sections", icon: LayoutPanelTop },
  "slide-deck-editor.notes": { label: "Notes", icon: StickyNote },
  "spreadsheet-editor.objects": { label: "Objects", icon: Group },
  "document-editor.layout": { label: "Layout", icon: FileText },
  "spreadsheet-editor.print": { label: "Print", icon: Printer },
  "slide-deck-editor.slides": { label: "Slides", icon: Presentation },
  "slide-deck-editor.stage": { label: "Stage", icon: Proportions },
  "document-editor.styles": { label: "Styles", icon: Type },
  "spreadsheet-editor.styles": { label: "Styles", icon: Type },
  "slide-deck-editor.theme": { label: "Theme", icon: Palette },

  /**
   * Scope: one Context — what it names, what that resolves to, and what leans on
   * it. `Used by` takes the same graph mark as a spreadsheet's Dependencies,
   * because both answer what would break.
   */
  "context-editor.add": { label: "Add to this Context", icon: Plus },
  "context-editor.contents": { label: "Contents", icon: List },
  "context-editor.contexts": { label: "Contexts", icon: Target },
  "context-editor.knowledge": { label: "Knowledge", icon: Brain },
  "context-editor.used-by": { label: "Used by", icon: Network }
};
