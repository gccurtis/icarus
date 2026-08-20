<script lang="ts">
  import type { Component } from "svelte";
  import Activity from "@lucide/svelte/icons/activity";
  import AtSign from "@lucide/svelte/icons/at-sign";
  import Clock from "@lucide/svelte/icons/clock";
  import FileText from "@lucide/svelte/icons/file-text";
  import Hash from "@lucide/svelte/icons/hash";
  import HeartPulse from "@lucide/svelte/icons/heart-pulse";
  import Info from "@lucide/svelte/icons/info";
  import Layers from "@lucide/svelte/icons/layers";
  import LayoutDashboard from "@lucide/svelte/icons/layout-dashboard";
  import LayoutTemplate from "@lucide/svelte/icons/layout-template";
  import Plus from "@lucide/svelte/icons/plus";
  import Sparkles from "@lucide/svelte/icons/sparkles";
  import Target from "@lucide/svelte/icons/target";
  import Upload from "@lucide/svelte/icons/upload";
  import Users from "@lucide/svelte/icons/users";

  import { clientModel, screenKindOf, type Tab } from "$model/client";
  import { ResizeHandle } from "$lib/unique-components/resize-handle";
  import NewtabBringIn from "$views/context-panel/components/newtab-bring-in.svelte";
  import NewtabCreate from "$views/context-panel/components/newtab-create.svelte";
  import NewtabRecent from "$views/context-panel/components/newtab-recent.svelte";
  import NewtabTemplates from "$views/context-panel/components/newtab-templates.svelte";
  import Outline from "$views/context-panel/components/outline.svelte";
  import Overview from "$views/context-panel/components/overview.svelte";
  import ProjectActivity from "$views/context-panel/components/project-activity.svelte";
  import ProjectContexts from "$views/context-panel/components/project-contexts.svelte";
  import ProjectHealth from "$views/context-panel/components/project-health.svelte";
  import ProjectMentions from "$views/context-panel/components/project-mentions.svelte";
  import ProjectOverview from "$views/context-panel/components/project-overview.svelte";
  import ProjectPeople from "$views/context-panel/components/project-people.svelte";
  import ProjectResources from "$views/context-panel/components/project-resources.svelte";
  import ProjectTasks from "$views/context-panel/components/project-tasks.svelte";
  import ProjectTemplates from "$views/context-panel/components/project-templates.svelte";
  import ProjectVariables from "$views/context-panel/components/project-variables.svelte";
  import Rail from "$views/context-panel/components/rail.svelte";
  import { COLLAPSE_BELOW, MAX_WIDTH, MIN_WIDTH, RAIL_WIDTH } from "$views/context-panel/types";
  import {
    CONTEXTS_BY_SCREEN,
    resolveContext,
    type ContextId
  } from "$views/context-panel/procedures/resolve-context";

  /**
   * The context panel — the map. It answers "where am I and what else is here?"
   *
   * A context is a way of looking at what surrounds the active resource: its
   * outline, what it relates to, who commented on it. Never a mode of working —
   * a rail entry answers "what else is here?", not "what am I doing?", which is
   * why the model says context rather than activity.
   *
   * The rail is inside this panel rather than beside it in the frame's grid: it
   * is the panel's own navigation and has no meaning without it, so the frame
   * sees one zone and this view owns how it divides. It is also what makes
   * collapsing work — the panel narrows to the rail rather than disappearing, so
   * there is always something left to click.
   *
   * **The key map.** `ContextId` is a stable model key and never a component —
   * the model says so explicitly, because a model type naming a component drags
   * a DOM into every test of it. Resolving the key is this view's job, and the
   * map lives here rather than in a shared registry so that adding a context is
   * an edit to the surface that renders it.
   *
   * `Record<ContextId, …>` rather than a partial map, so a new context fails to
   * compile until it has a label, an icon, and something to show. The model
   * guarantees `activeContext` is one this resource kind offers, falling back to
   * the kind's default when a stored id no longer resolves, so there is no
   * unknown-key branch to write here.
   */
  type ContextEntry = {
    label: string;
    icon: Component;
    content: Component<{ tab: Tab }>;
  };

  const CONTEXTS: Record<ContextId, ContextEntry> = {
    overview: { label: "Overview", icon: LayoutDashboard, content: Overview },
    outline: { label: "Outline", icon: FileText, content: Outline },

    /**
     * The project overview's rail. `project` is that screen's own orientation
     * view and is labelled "Overview" like every other screen's — two ids with
     * one label, because the label names the job and the id names the content.
     */
    project: { label: "Overview", icon: Info, content: ProjectOverview },
    resources: { label: "Resources", icon: Layers, content: ProjectResources },
    mentions: { label: "Mentions", icon: AtSign, content: ProjectMentions },
    people: { label: "People", icon: Users, content: ProjectPeople },
    activity: { label: "Activity", icon: Activity, content: ProjectActivity },
    tasks: { label: "Tasks", icon: Sparkles, content: ProjectTasks },
    health: { label: "Health", icon: HeartPulse, content: ProjectHealth },
    variables: { label: "Variables", icon: Hash, content: ProjectVariables },
    contexts: { label: "Context", icon: Target, content: ProjectContexts },
    templates: { label: "Templates", icon: LayoutTemplate, content: ProjectTemplates },

    /** New Tab's rail. Four ways to answer one question. */
    "newtab-create": { label: "Create", icon: Plus, content: NewtabCreate },
    "newtab-recent": { label: "Recent", icon: Clock, content: NewtabRecent },
    "newtab-templates": { label: "Templates", icon: LayoutTemplate, content: NewtabTemplates },
    "newtab-bring-in": { label: "Bring in", icon: Upload, content: NewtabBringIn }
  };

  const { workbench } = clientModel();

  const tab = $derived(workbench.active);
  const screen = $derived(screenKindOf(tab.target));
  const available = $derived(CONTEXTS_BY_SCREEN[screen]);
  const active = $derived(resolveContext(screen, tab.viewState.frame.contextId));
  const Content = $derived(CONTEXTS[active].content);

  /** The model stores content only; the handle works in painted pixels. */
  const visible = $derived(RAIL_WIDTH + workbench.frame.contextWidth);
  const collapsed = $derived(workbench.frame.contextCollapsed);

  /**
   * Selecting a context always opens the panel.
   *
   * That is the whole uncollapse affordance on this side, and it needs no arrow
   * of its own: the rail is visible while collapsed, and the thing a user wants
   * when they reach for an icon is to see what it holds. Choosing the context
   * that is already showing is left alone rather than treated as a toggle —
   * closing a panel by clicking into it is a surprise, and the edge already
   * closes it.
   */
  const select = (id: ContextId) => {
    workbench.selectContext(id);
    if (collapsed) workbench.resize({ contextCollapsed: false });
  };
</script>

<aside class="panel" aria-label="Context">
  <Rail
    contexts={CONTEXTS}
    {available}
    {active}
    {collapsed}
    onselect={select}
  />

  <!--
    One scroll context per zone, and it belongs to `Panel` rather than to this
    div. The frame has to own it: a pinned title row is only pinned if what
    scrolls is everything under it, which is a decision no wrapper outside the
    panel can make. So this passes the full height down and scrolls nothing
    itself.
  -->
  {#if !collapsed}
    <div class="content">
      <Content {tab} />
    </div>
  {/if}

  <ResizeHandle
    side="start"
    width={visible}
    {collapsed}
    min={MIN_WIDTH}
    max={MAX_WIDTH}
    collapseBelow={COLLAPSE_BELOW}
    label="the context panel"
    onchange={({ width, collapsed: next }) =>
      workbench.resize({ contextWidth: width - RAIL_WIDTH, contextCollapsed: next })}
  />
</aside>

<style>
  .panel {
    position: relative;
    height: 100%;
    display: flex;
    min-height: 0;
    background-color: var(--token-surface-panel);
    border-right: 1px solid var(--token-border-subtle);
  }

  .content {
    flex: 1;
    min-width: 0;
    min-height: 0;
  }
</style>
