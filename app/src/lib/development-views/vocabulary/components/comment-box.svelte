<script lang="ts">
  import { commentLog } from "$development-views/vocabulary/shared/comment-log.svelte";

  /**
   * The note box that sits beside one row of the page.
   *
   * **The id is built here rather than passed in.** A scope and the row's own
   * label are already unique together, and deriving the id from them means a row
   * cannot acquire notes under one key and read them back under another — the
   * mistake a hand-written id per call site would eventually make.
   *
   * Enter saves, because a thought typed while reading is abandoned if it needs
   * a second gesture. Shift-Enter is the escape hatch for the longer note.
   */
  let {
    scope,
    label,
    placeholder = "Note…"
  }: {
    /** Which family of rows this is — `entry`, `section`, `choosing`, `shape`. */
    scope: string;
    /** The row's own label. Half of the id, and what the log records. */
    label: string;
    placeholder?: string;
  } = $props();

  const log = commentLog();

  const slug = (text: string) =>
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60);

  const id = $derived(`${scope}/${slug(label)}`);
  const thread = $derived(log.about(id));

  let draft = $state("");
  let sending = $state(false);
  let focused = $state(false);
  let failed = $state<string | undefined>(undefined);

  const stamp = (at: string) =>
    new Date(at).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });

  const send = async () => {
    const text = draft.trim();
    if (!text || sending) return;

    sending = true;
    failed = await log.add({ id, label, text });
    sending = false;

    if (!failed) draft = "";
  };

  const key = (event: KeyboardEvent) => {
    if (event.key !== "Enter" || event.shiftKey) return;
    event.preventDefault();
    void send();
  };
</script>

<div
  class="flex flex-col gap-1.5 transition-opacity focus-within:opacity-100 hover:opacity-100"
  class:opacity-65={thread.length === 0 && !focused}
>
  {#each thread as comment (comment.at)}
    <div class="border-l-accent-1-border bg-surface-panel rounded-control border-l-2 px-2.5 py-1.5">
      <p class="text-body-sm text-ink-primary m-0 break-words whitespace-pre-wrap">{comment.text}</p>
      <span class="text-caption text-ink-muted tabular-nums">{stamp(comment.at)}</span>
    </div>
  {/each}

  <textarea
    bind:value={draft}
    onkeydown={key}
    onfocus={() => (focused = true)}
    onblur={() => (focused = false)}
    rows="1"
    disabled={sending}
    placeholder={thread.length > 0 ? "Add another…" : placeholder}
    aria-label="Note on {label}"
    class="text-body-sm border-border-subtle text-ink-primary placeholder:text-ink-muted focus:border-interactive-border focus:bg-surface-panel rounded-control min-h-8 resize-none border border-dashed bg-transparent px-2.5 py-1.5 outline-none [field-sizing:content] disabled:opacity-50"
  ></textarea>

  {#if failed}
    <span class="text-caption text-danger-text">{failed}</span>
  {:else if focused}
    <span class="text-caption text-ink-muted">Enter saves · Shift-Enter for a new line</span>
  {/if}
</div>
