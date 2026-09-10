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
import CornerDownRight from "@lucide/svelte/icons/corner-down-right";
import FileText from "@lucide/svelte/icons/file-text";
import Footprints from "@lucide/svelte/icons/footprints";
import Grid3x3 from "@lucide/svelte/icons/grid-3x3";
import Group from "@lucide/svelte/icons/group";
import Hash from "@lucide/svelte/icons/hash";
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
import Sparkles from "@lucide/svelte/icons/sparkles";
import SquareFunction from "@lucide/svelte/icons/square-function";
import SquarePlus from "@lucide/svelte/icons/square-plus";
import Tag from "@lucide/svelte/icons/tag";
import Target from "@lucide/svelte/icons/target";
import Type from "@lucide/svelte/icons/type";
import Upload from "@lucide/svelte/icons/upload";
import Users from "@lucide/svelte/icons/users";
import Workflow from "@lucide/svelte/icons/workflow";

import type { ContextView } from "$model/client/workspace-state";

export type RailEntry = { readonly label: string; readonly icon: Component };

export const RAIL_ENTRIES: Record<ContextView, RailEntry> = {
  "agents.automations": { label: "Automations", icon: Workflow },
  "agents.personas": { label: "Personas", icon: Bot },
  "agents.tasks": { label: "Tasks", icon: Sparkles },

  "analysis.chart": { label: "Chart", icon: ChartColumn },
  "analysis.fields": { label: "Fields", icon: Axis3d },
  "analysis.formula": { label: "Formula", icon: SquareFunction },
  "analysis.chartable-variables": { label: "Variables", icon: Hash },

  "analysis.analyses": { label: "Analyses", icon: ChartColumn },
  "new-tab.bring-in": { label: "Bring in", icon: Upload },
  "new-tab.create": { label: "Create", icon: Plus },
  "research.findings-library": { label: "Findings", icon: Lightbulb },
  "research.inquiry-library": { label: "Inquiry", icon: CircleQuestionMark },
  "new-tab.recent": { label: "Recent", icon: Clock },
  "new-tab.templates": { label: "Templates", icon: LayoutTemplate },
  "research.threads": { label: "Threads", icon: MessagesSquare },
  "research.turns": { label: "Turns", icon: CornerDownRight },

  "analysis.overview": { label: "Overview", icon: Info },
  "context-editor.overview": { label: "Overview", icon: Info },
  "slide-deck-editor.prompts": { label: "Prompts", icon: Sparkles },
  "document-editor.overview": { label: "Overview", icon: Info },
  "project-overview.overview": { label: "Overview", icon: Info },
  "research.overview": { label: "Overview", icon: Info },
  "spreadsheet-editor.overview": { label: "Overview", icon: Info },
  "templates.overview-library": { label: "Overview", icon: Info },

  "project-overview.activity": { label: "Activity", icon: Activity },
  "project-overview.history": { label: "History", icon: Clock },
  "project-overview.mentions": { label: "Mentions", icon: AtSign },
  "project-overview.people": { label: "People", icon: Users },
  "project-overview.resources": { label: "Resources", icon: Layers },
  "project-overview.tasks": { label: "Tasks", icon: Sparkles },
  "project-overview.templates": { label: "Templates", icon: LayoutTemplate },
  "project-overview.variables": { label: "Variables", icon: Hash },
  "analysis.variables": { label: "Variables", icon: Hash },
  "document-editor.variables": { label: "Variables", icon: Hash },
  "external.history": { label: "History", icon: ClockArrowLeft },
  "external.overview": { label: "Overview", icon: Info },
  "slide-deck-editor.variables": { label: "Variables", icon: Hash },
  "spreadsheet-editor.variables": { label: "Variables", icon: Hash },
  "project-overview.variables-create": { label: "Create variable", icon: Plus },

  "research.context": { label: "Context", icon: Target },
  "research.findings": { label: "Findings", icon: Lightbulb },
  "research.history": { label: "History", icon: ClockArrowLeft },
  "research.inquiry": { label: "Inquiry", icon: CircleQuestionMark },
  "research.sources": { label: "Sources", icon: BookOpen },
  "research.trace": { label: "Trace", icon: Footprints },

  "slide-deck-editor.comments": { label: "Comments", icon: MessageSquare },
  "document-editor.comments": { label: "Comments", icon: MessageSquare },
  "spreadsheet-editor.comments": { label: "Comments", icon: MessageSquare },
  "document-editor.context": { label: "Context", icon: Target },
  "spreadsheet-editor.context": { label: "Context", icon: Target },
  "spreadsheet-editor.dependencies": { label: "Dependencies", icon: Network },
  "spreadsheet-editor.grid": { label: "Grid", icon: Grid3x3 },
  "spreadsheet-editor.formulas": { label: "Formulas", icon: SquareFunction },
  "spreadsheet-editor.templates": { label: "Templates", icon: LayoutTemplate },
  "spreadsheet-editor.prompts": { label: "Prompts", icon: Sparkles },
  "slide-deck-editor.find": { label: "Find", icon: Search },
  "document-editor.find": { label: "Find", icon: Search },
  "spreadsheet-editor.find": { label: "Find", icon: Search },
  "slide-deck-editor.insert": { label: "Insert", icon: SquarePlus },
  "document-editor.insert": { label: "Insert", icon: SquarePlus },
  "spreadsheet-editor.insert": { label: "Insert", icon: SquarePlus },
  "slide-deck-editor.layers": { label: "Layers", icon: Layers },
  "spreadsheet-editor.named-ranges": { label: "Named ranges", icon: Tag },
  "document-editor.navigator": { label: "Sections", icon: LayoutPanelTop },
  "spreadsheet-editor.charts": { label: "Charts", icon: ChartColumn },
  "document-editor.layout": { label: "Layout", icon: FileText },
  "document-editor.prompts": { label: "Prompts", icon: Sparkles },
  "document-editor.templates": { label: "Templates", icon: LayoutTemplate },
  "spreadsheet-editor.print": { label: "Print", icon: Printer },
  "slide-deck-editor.slides": { label: "Slides", icon: Presentation },
  "slide-deck-editor.templates": { label: "Templates", icon: LayoutPanelTop },
  "document-editor.styles": { label: "Styles", icon: Type },
  "spreadsheet-editor.styles": { label: "Styles", icon: Type },
  "slide-deck-editor.theme": { label: "Style", icon: Palette },

  "context-editor.add": { label: "Add to this Context", icon: Plus },
  "context-editor.contents": { label: "Contents", icon: List },
  "context-editor.contexts": { label: "Contexts", icon: Target },
  "context-editor.knowledge": { label: "Knowledge", icon: Brain },
  "context-editor.used-by": { label: "Used by", icon: Network }
};
