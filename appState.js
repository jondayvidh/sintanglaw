import { categoryOf } from "./locations.js";

export const DEFAULT_ACTIVE_ID = 1;
export const DEFAULT_DEST_IDS = [];
export const MAX_DESTINATIONS = 3;

export const state = {
  activeId: DEFAULT_ACTIVE_ID, destIds: [...DEFAULT_DEST_IDS], query: "", filter: "all",
  directoryOpen: false,
  mode: "orbit"
};

export function matches(l) {
  const q = state.query;
  const okQ = !q || l.title.toLowerCase().includes(q) || l.description.toLowerCase().includes(q) || String(l.id).includes(q);
  return okQ && (state.filter === "all" || categoryOf(l) === state.filter);
}
