<script lang="ts">
  import {
    Panel,
    PanelChoice,
    PanelEditableText,
    PanelField,
    PanelFields,
    PanelNote,
    PanelSection
  } from "$authored-components/panel";

  /**
   * The inspector for whichever block is selected.
   *
   * **What it offers depends on how the block is sized**, and that is the point
   * of putting it beside the two surfaces. A `flow` paragraph has no width to
   * set — the column owns it — so offering one would be a control that either
   * does nothing or breaks the document. A `grow` text object has a maximum
   * width but not a width. A `fixed` shape has both, and they are the reason it
   * exists.
   *
   * **Vertical alignment appears only where there is a vertical axis.** A block
   * whose height is its text has nowhere to move that text to, so top/middle/
   * bottom is offered on `fixed` blocks and withheld everywhere else, by the
   * same rule that withholds width from a paragraph.
   *
   * The alternative — one panel with every control, greying out what does not
   * apply — was rejected here for the reason `PanelButton` gives about disabled
   * controls: an action that can never work on this thing should not be drawn.
   */
  type Block = {
    id: string;
    sizing: "flow" | "grow" | "fixed";
    align: "start" | "center" | "end" | "justify";
    vertical: "top" | "middle" | "bottom";
    size: "caption" | "body-sm" | "body" | "body-lg" | "h4" | "h3";
    weight: "normal" | "medium" | "semibold";
    width?: string;
    height?: string;
  };

  /**
   * One setter taking a field name and a string, rather than a generic keyed to
   * this file's `Block`. The page owns the real record; a generic here would
   * make the two type declarations have to be the same one, which is a coupling
   * that buys nothing — every value this panel sets is a string.
   */
  let {
    block,
    update,
    collapsed = false
  }: {
    block?: Block;
    update: (
      key: "align" | "vertical" | "size" | "weight" | "width" | "height",
      value: string
    ) => void;
    collapsed?: boolean;
  } = $props();

  const SIZING = {
    flow: "Flow — the column sets the width, the text sets the height",
    grow: "Grow — the text sets the width, you set the height",
    fixed: "Fixed — you set both"
  };
</script>

{#if collapsed}
  <div class="flex h-full items-start justify-center pt-3">
    <span class="text-micro text-ink-muted tracking-caps font-mono [writing-mode:vertical-rl]">
      Inspector
    </span>
  </div>
{:else}
  <Panel title={block ? "Block" : "Nothing selected"}>
    {#if !block}
      <PanelNote>Select a block on either surface.</PanelNote>
    {:else}
      <PanelSection title="What it is">
        <PanelFields>
          <PanelField label="Sizing" stacked>{SIZING[block.sizing]}</PanelField>
        </PanelFields>
      </PanelSection>

      <PanelSection title="Text">
        <PanelChoice
          label="Style"
          value={block.size}
          options={[
            { value: "body-sm", label: "Small" },
            { value: "body", label: "Body" },
            { value: "h4", label: "Heading" },
            { value: "h3", label: "Title" }
          ]}
          onchange={(next) => update("size", next)}
        />
        <div class="pt-2">
          <PanelChoice
            label="Weight"
            value={block.weight}
            options={[
              { value: "normal", label: "400" },
              { value: "medium", label: "500" },
              { value: "semibold", label: "600" }
            ]}
            onchange={(next) => update("weight", next)}
          />
        </div>
        <PanelNote>
          Three weights are loaded and no more. 400 to 500 is a fine step by design — it is for
          small dense labels, where it reads. A component asking for 700 gets a face the browser
          invented.
        </PanelNote>
      </PanelSection>

      <PanelSection title="Alignment">
        <PanelChoice
          label="Horizontal alignment"
          value={block.align}
          options={[
            { value: "start", label: "Left" },
            { value: "center", label: "Centre" },
            { value: "end", label: "Right" },
            { value: "justify", label: "Justify" }
          ]}
          onchange={(next) => update("align", next)}
        />
        {#if block.sizing === "fixed"}
          <div class="pt-2">
            <PanelChoice
              label="Vertical alignment"
              value={block.vertical}
              options={[
                { value: "top", label: "Top" },
                { value: "middle", label: "Middle" },
                { value: "bottom", label: "Bottom" }
              ]}
              onchange={(next) => update("vertical", next)}
            />
          </div>
        {:else}
          <PanelNote>
            No vertical alignment. This block's height is its text, so there is no axis to move the
            text along.
          </PanelNote>
        {/if}
      </PanelSection>

      {#if block.sizing === "fixed"}
        <PanelSection title="Size">
          <PanelFields>
            <PanelField label="Width">
              <PanelEditableText
                value={block.width ?? "16rem"}
                label="Block width"
                mono
                onchange={(next) => update("width", next)}
              />
            </PanelField>
            <PanelField label="Height">
              <PanelEditableText
                value={block.height ?? "8rem"}
                label="Block height"
                mono
                onchange={(next) => update("height", next)}
              />
            </PanelField>
          </PanelFields>
          <PanelNote>
            Content that outgrows a fixed box is left visible rather than clipped. A box quietly
            hiding half a sentence is how a slide gets presented wrong.
          </PanelNote>
        </PanelSection>
      {:else if block.sizing === "grow"}
        <PanelSection title="Size">
          <PanelFields>
            <PanelField label="Height">
              <PanelEditableText
                value={block.height ?? "auto"}
                label="Block height"
                mono
                onchange={(next) => update("height", next)}
              />
            </PanelField>
          </PanelFields>
          <PanelNote>
            No width here — the text sets it, up to the slide's measure. That is what makes it a
            text object rather than a shape.
          </PanelNote>
        </PanelSection>
      {:else}
        <PanelSection title="Size">
          <PanelNote>
            No size controls. A paragraph in a document cannot choose its width — the column owns
            it — and its height is whatever the text needs.
          </PanelNote>
        </PanelSection>
      {/if}
    {/if}
  </Panel>
{/if}
