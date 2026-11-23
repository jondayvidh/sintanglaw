/* Shared application state. Every module reads and updates this one object (no scattered globals).
     activeId      selected building / location id
     destIds       guide-line destination ids
     query         active search query (lower-cased)
     filter        selected category filter: "all" | "academic" | "landmark"
     directoryOpen whether the directory dropdown is open
     mode          camera mode: "orbit" | "topdown" | "walking" */
import { categoryOf } from "./locations.js";

export const DEFAULT_ACTIVE_ID = 1;
export const DEFAULT_DEST_IDS = [20];
export const MAX_DESTINATIONS = 3;

export const state = {
  activeId: DEFAULT_ACTIVE_ID, destIds: [...DEFAULT_DEST_IDS], query: "", filter: "all",
  directoryOpen: false,
  mode: "orbit"
};

/* Does a location pass the current search query and category filter? */
export function matches(l) {
  const q = state.query;
  const okQ = !q || l.title.toLowerCase().includes(q) || l.description.toLowerCase().includes(q) || String(l.id).includes(q);
  return okQ && (state.filter === "all" || categoryOf(l) === state.filter);
}
