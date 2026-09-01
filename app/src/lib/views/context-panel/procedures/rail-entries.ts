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
import Printer from "@lucide/svelte/icons/printer";
import ScrollText from "@lucide/svelte/icons/scroll-text";
import Search from "@lucide/svelte/icons/search";
import Shapes from "@lucide/svelte/icons/shapes";
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

import type { ContextId } from "$model/client/workspace-state";

/**
 * What each context view looks like in the rail: a name and an icon.
 *
 * The rail is a vertical strip of icons down the left of the context panel, and
 * collapsed it is all that is left of the panel — so the icon is the whole
 * affordance, and an entry that does not say what it opens is a dead end. Which
 * views a screen offers, and in what order, is not here: that is `RAILS`.
 *
 * **`Record<ContextId, …>` rather than a partial map**, so a context view with
 * no rail entry fails to compile rather than failing to draw. Every key in the
 * vocabulary has an entry here whether or not its panel is built yet — the rail
 * is how an unbuilt view is reached, and a key with no way to reach it cannot be
 * proved to route at all.
 *
 * **The labels are written, not derived.** Never inferred from the id or the
 * file name; the subject document beside the panels is where the wording is
 * argued. Where two ids carry the same label that is intended: every screen has
 * an "Overview" and no two show the same thing, so the label names the job and
 * the id names the content.
 *
 * **The icons follow the subject, not the word.** The same subject looks the same
 * on every screen that carries it — Variables is always a hash, Context always a
 * target, Overview always the same mark — while two entries in one rail never
 * share one, which is the only collision that matters when the panel is closed.
 */
export type RailEntry = { readonly label: string; readonly icon: Component };

export const RAIL_ENTRIES: Record<ContextId, RailEntry> = {
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
  "analysis.variables": { label: "Variables", icon: Hash },

  /**
   * Library: browsing what a project already has, and starting something new.
   * The template-authoring entries are the ordinary editor's views under the
   * names a template gives them, so they carry the editor's icons.
   */
  "library.analyses": { label: "Analyses", icon: ChartColumn },
  "library.authoring-body": { label: "Body", icon: FileText },
  "library.authoring-design": { label: "Design", icon: Palette },
  "library.authoring-insert": { label: "Insert", icon: SquarePlus },
  "library.authoring-variables": { label: "Variables in this template", icon: Hash },
  "library.bring-in": { label: "Bring in", icon: Upload },
  "library.contexts": { label: "Contexts", icon: Target },
  "library.create": { label: "Create", icon: Plus },
  "library.findings": { label: "Findings", icon: Lightbulb },
  "library.inquiry": { label: "Inquiry", icon: CircleQuestionMark },
  "library.recent-newtab": { label: "Recent", icon: Clock },
  "library.recent-templates": { label: "Recent", icon: Clock },
  "library.resources": { label: "Resources", icon: Layers },
  "library.template": { label: "Template", icon: LayoutTemplate },
  "library.template-kinds": { label: "Kinds", icon: Shapes },
  "library.templates": { label: "Library", icon: LayoutTemplate },
  "library.templates-newtab": { label: "Templates", icon: LayoutTemplate },
  "library.threads": { label: "Threads", icon: MessagesSquare },

  /**
   * Overview: eleven different views doing one job — what is this and where am I.
   * One icon for all of them, and it is `Info` rather than a dashboard mark
   * because the rails that lead with an Overview also carry Templates and
   * Layouts, and those three panel glyphs are not tellable apart at rail size.
   */
  "overview.agents": { label: "Overview", icon: Info },
  "overview.analysis": { label: "Overview", icon: Info },
  "overview.context": { label: "Overview", icon: Info },
  "overview.deck": { label: "Overview", icon: Info },
  "overview.document": { label: "Overview", icon: Info },
  "overview.project": { label: "Overview", icon: Info },
  "overview.research": { label: "Overview", icon: Info },
  "overview.spreadsheet": { label: "Overview", icon: Info },
  "overview.templates-authoring": { label: "Overview", icon: Info },
  "overview.templates-library": { label: "Overview", icon: Info },

  /**
   * Project: the whole project rather than one resource. `Mentions` is a person
   * addressing you and `Health` is what cannot proceed, so the two never share a
   * mark. `variables-create` is the Variables panel becoming a form and is on no
   * rail; it is named here because the table is total.
   */
  "project.activity": { label: "Activity", icon: Activity },
  "project.contexts": { label: "Context", icon: Target },
  "project.history": { label: "History", icon: Clock },
  "project.mentions": { label: "Mentions", icon: AtSign },
  "project.people": { label: "People", icon: Users },
  "project.resources": { label: "Resources", icon: Layers },
  "project.tasks": { label: "Tasks", icon: Sparkles },
  "project.templates": { label: "Templates", icon: LayoutTemplate },
  "project.variables": { label: "Variables", icon: Hash },
  "project.variables-create": { label: "Create variable", icon: Plus },

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
  "resource.comments-deck": { label: "Comments", icon: MessageSquare },
  "resource.comments-document": { label: "Comments", icon: MessageSquare },
  "resource.comments-sheet": { label: "Comments", icon: MessageSquare },
  "resource.context-deck": { label: "Context", icon: Target },
  "resource.context-document": { label: "Context", icon: Target },
  "resource.context-sheet": { label: "Context", icon: Target },
  "resource.dependencies": { label: "Dependencies", icon: Network },
  "resource.find-deck": { label: "Find", icon: Search },
  "resource.find-document": { label: "Find", icon: Search },
  "resource.find-sheet": { label: "Find", icon: Search },
  "resource.insert-deck": { label: "Insert", icon: SquarePlus },
  "resource.insert-document": { label: "Insert", icon: SquarePlus },
  "resource.insert-sheet": { label: "Insert", icon: SquarePlus },
  "resource.layers": { label: "Layers", icon: Layers },
  "resource.layout-layouts": { label: "Layouts", icon: LayoutTemplate },
  "resource.layout-objects": { label: "Objects", icon: Group },
  "resource.layout-theme": { label: "Theme", icon: Palette },
  "resource.layouts": { label: "Layouts", icon: LayoutTemplate },
  "resource.named-ranges": { label: "Named ranges", icon: Tag },
  "resource.navigator": { label: "Navigator", icon: FileText },
  "resource.notes": { label: "Notes", icon: StickyNote },
  "resource.objects": { label: "Objects", icon: Group },
  "resource.page": { label: "Page", icon: LayoutPanelTop },
  "resource.print": { label: "Print", icon: Printer },
  "resource.slides": { label: "Slides", icon: Presentation },
  "resource.styles-document": { label: "Styles", icon: Type },
  "resource.styles-sheet": { label: "Styles", icon: Type },
  "resource.theme": { label: "Theme", icon: Palette },

  /**
   * Scope: one Context — what it names, what that resolves to, and what leans on
   * it. `Used by` takes the same graph mark as a spreadsheet's Dependencies,
   * because both answer what would break.
   */
  "scope.add": { label: "Add to this Context", icon: Plus },
  "scope.contents": { label: "Contents", icon: List },
  "scope.contexts": { label: "Contexts", icon: Target },
  "scope.knowledge": { label: "Knowledge", icon: Brain },
  "scope.used-by": { label: "Used by", icon: Network }
};
