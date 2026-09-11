/** Each mounted resource table owns its search, filters, and ordering. */
export class ResourceTableState {
  search = $state("");
  kind = $state("all");
  actor = $state("all");
  sortBy = $state("updated");
  direction = $state<"asc" | "desc">("asc");

  clear(): void {
    this.search = "";
    this.kind = "all";
    this.actor = "all";
  }
}
