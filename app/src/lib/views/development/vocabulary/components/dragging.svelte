<script lang="ts">
  import Filter from "@lucide/svelte/icons/filter";
  import Hash from "@lucide/svelte/icons/hash";
  import Sigma from "@lucide/svelte/icons/sigma";

  import Entry from "$views/development/vocabulary/components/entry.svelte";
  import SectionTitle from "$views/development/vocabulary/components/section-title.svelte";
  import { Draggable, DropZone } from "$authored-components/drag";
  import { PanelChip, PanelNote } from "$authored-components/panel";

  /**
   * Moving something from one place to another.
   *
   * Its own family because a drag crosses the other two: the thing picked up is
   * a row in a 300px flank and the place it lands is a zone in the middle of the
   * plane, and neither vocabulary can own a shape that only exists between them.
   *
   * **Both examples work, and they are separate.** A drag is the one gesture on
   * this page that cannot be judged from a picture at all, and the two things a
   * drag does — change an order, and move something into a place — are different
   * enough that one example demonstrating both demonstrates neither.
   */
  type Field = { id: string; label: string; icon: typeof Hash };

  /** Reordering: dropping one onto another moves it there. */
  let order = $state<Field[]>([
    { id: "name", label: "substations.name", icon: Hash },
    { id: "minutes", label: "sum of customerMinutes", icon: Sigma },
    { id: "date", label: "eventDate", icon: Filter },
    { id: "region", label: "region", icon: Hash }
  ]);

  const move = (id: string, to: number) => {
    const from = order.findIndex((field) => field.id === id);
    if (from === -1 || to < 0 || to >= order.length) return;
    const next = [...order];
    const [field] = next.splice(from, 1);
    next.splice(to, 0, field);
    order = next;
  };

  /** The zones have their own fields, so the two examples cannot interfere. */
  const FIELDS: Field[] = [
    { id: "z-name", label: "substations.name", icon: Hash },
    { id: "z-minutes", label: "sum of customerMinutes", icon: Sigma },
    { id: "z-date", label: "eventDate", icon: Filter }
  ];

  const ZONES = [
    { value: "x", label: "X — across" },
    { value: "y", label: "Y — up" },
    { value: "filters", label: "Filters" }
  ];

  let placed = $state<Record<string, string[]>>({ x: [], y: [], filters: [] });

  const place = (id: string, zone: string) => {
    placed = Object.fromEntries(
      Object.entries(placed).map(([key, ids]) => [
        key,
        key === zone ? [...new Set([...ids, id])] : ids.filter((held) => held !== id)
      ])
    );
  };

  const held = $derived(Object.values(placed).flat());
  const labelOf = (id: string) => FIELDS.find((field) => field.id === id)?.label ?? id;

  const CODE = {
    reorder: `{#each order as field, index (field.id)}
  <Draggable
    id={field.id}
    label={field.label}
    destinations={[
      { value: "up", label: "Move up" },
      { value: "down", label: "Move down" }
    ]}
    onplace={(way) => move(field.id, index + (way === "up" ? -1 : 1))}
    onreceive={(dragged) => move(dragged, index)}
  >
    …
  </Draggable>
{/each}`,
    zone: `<DropZone
  label="Y — up"
  empty="drop a field to plot it"
  count={placed.y.length}
  additions={FIELDS}
  ondrop={(id) => place(id, "y")}
  onadd={(id) => place(id, "y")}
>
  {#each placed.y as id (id)}
    <PanelChip tone="active">{labelOf(id)}</PanelChip>
  {/each}
</DropZone>`
  };
</script>

<section class="flex flex-col gap-8">
  <SectionTitle title="Moving things" source="src/lib/components/authored/drag/">
    A third family, because a drag crosses the other two: what is picked up is
    usually a row in the 300px flank and where it lands is a zone in the middle
    of the plane. The rule underneath both words comes from the specifications
    verbatim — <em>nothing is drag-only</em>.
  </SectionTitle>

  <Entry
    name="Draggable"
    use="Something you can pick up. It takes the list of destinations rather than only firing drag events, so the same declaration draws the drag and the menu that does it without one. Dropping one item onto another is how a list reorders."
    instead="a thing with nowhere to go. An item with no destinations gets no grip, no draggable attribute and no menu — a handle that lifts something that cannot land is a promise the surface cannot keep."
    code={CODE.reorder}
    width="screen"
  >
    <div class="flex flex-col gap-1 p-4">
      {#each order as field, index (field.id)}
        {@const FieldIcon = field.icon}
        <Draggable
          id={field.id}
          label={field.label}
          destinations={[
            { value: "up", label: "Move up" },
            { value: "down", label: "Move down" }
          ]}
          onplace={(way) => move(field.id, index + (way === "up" ? -1 : 1))}
          onreceive={(dragged) => move(dragged, index)}
        >
          <span class="text-body-sm text-ink-primary flex items-center gap-2 px-1 py-1">
            <span class="text-ink-muted tabular-nums">{index + 1}</span>
            <FieldIcon size={13} aria-hidden="true" />
            {field.label}
          </span>
        </Draggable>
      {/each}

      <PanelNote>
        Drag one onto another and the order changes — the line shows where it
        lands. The ⋯ menu does the same with Move up and Move down, which is the
        path that has to work when a drag is not available.
      </PanelNote>
    </div>
  </Entry>

  <Entry
    name="DropZone"
    use="A place something can be put. An empty one says what belongs in it, and every zone carries an add menu — the other end of the same path, for reaching the place first rather than the thing."
    instead="a target that lights up for everything. A zone that says yes and then refuses is worse than one that never lit up: the highlight is the only promise a drag ever gets."
    code={CODE.zone}
    width="screen"
  >
    <div class="flex flex-col gap-3 p-4">
      <div class="flex flex-wrap gap-2">
        {#each FIELDS.filter((field) => !held.includes(field.id)) as field (field.id)}
          {@const FieldIcon = field.icon}
          <Draggable
            id={field.id}
            label={field.label}
            destinations={ZONES}
            onplace={(zone) => place(field.id, zone)}
          >
            <span class="text-body-sm text-ink-primary flex items-center gap-2 px-1 py-1">
              <FieldIcon size={13} aria-hidden="true" />
              {field.label}
            </span>
          </Draggable>
        {/each}
        {#if held.length === FIELDS.length}
          <span class="text-caption text-ink-muted italic">Every field has been placed.</span>
        {/if}
      </div>

      <div class="grid gap-3" style="grid-template-columns: repeat(auto-fit, minmax(13rem, 1fr))">
        {#each ZONES as zone (zone.value)}
          <DropZone
            label={zone.label}
            empty={zone.value === "filters"
              ? "drop a field to filter by it"
              : "drop a field to plot it"}
            count={placed[zone.value].length}
            additions={FIELDS.map((field) => ({ value: field.id, label: field.label }))}
            ondrop={(id) => place(id, zone.value)}
            onadd={(id) => place(id, zone.value)}
          >
            {#each placed[zone.value] as id (id)}
              <PanelChip tone="active">{labelOf(id)}</PanelChip>
            {/each}
          </DropZone>
        {/each}
      </div>
    </div>
  </Entry>
</section>
