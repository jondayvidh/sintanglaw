/* Top navigation: directory dropdown (list + info card), search input and category filter. */
import { campusLocations, categoryLabel, categoryOf, locById, placeImage } from "./locations.js";
import { focusLocation, updateVisualState } from "./scene.js";
import { MAX_DESTINATIONS, matches, state } from "./appState.js";
import { dom, reduceMotion } from "./dom.js";

/* =====================================================================
   Directory panel
   ===================================================================== */

export function setPanelOpen(open) {
  state.directoryOpen = open;
  dom.panel.classList.toggle("is-collapsed", !open);
  dom.toggle.setAttribute("aria-expanded", String(open));
}

export function renderDirectory() {
  const vis = campusLocations.filter(matches);
  dom.counter.textContent = vis.length === campusLocations.length ? `${vis.length} locations` : `${vis.length} of ${campusLocations.length} locations`;
  dom.list.innerHTML = "";
  if (!vis.length) {
    const p = document.createElement("p");
    p.className = "empty"; p.style.padding = "12px";
    p.textContent = "No location found.";
    dom.list.appendChild(p);
    return;
  }
  const frag = document.createDocumentFragment();
  vis.forEach((l) => {
    const c = categoryOf(l);
    const row = document.createElement("div");
    row.className = "dir-row"; row.setAttribute("role", "listitem");
    row.innerHTML = `<button type="button" class="dir-item" data-id="${l.id}" title="${l.id}. ${l.title}"><span class="dir-badge ${c}">${l.id}</span><span class="dir-title">${l.title}</span></button>` +
      `<button type="button" class="dir-dest" data-dest="${l.id}" aria-pressed="false" title="Toggle guide line to this location" aria-label="Toggle guide line to ${l.title}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 21V4M6 5h11l-2.500 3.500L17 12H6"/></svg></button>`;
    frag.appendChild(row);
  });
  dom.list.appendChild(frag);
  syncDirectoryState();
}

function syncDirectoryState() {
  dom.list.querySelectorAll(".dir-item").forEach((b) => b.classList.toggle("is-active", Number(b.dataset.id) === state.activeId));
  dom.list.querySelectorAll(".dir-dest").forEach((b) => {
    const id = Number(b.dataset.dest);
    b.setAttribute("aria-pressed", String(state.destIds.includes(id)));
    b.disabled = id === state.activeId;
  });
}

export function renderInfo() {
  const l = locById.get(state.activeId), c = categoryOf(l);
  const dests = state.destIds.map((id) => locById.get(id)).filter((d) => d && d.id !== l.id);
  dom.infoCard.innerHTML = `
    <div class="info-thumb"><img src="${placeImage(l.id)}" alt="${l.title}" /><span class="chip chip-${c}">${categoryLabel(c)}</span></div>
    <div class="info-body">
      <p class="info-kicker">Location ${l.id}</p>
      <h2>${l.title}</h2>
      <p class="info-desc">${l.description}</p>
      <dl class="facts">
        <div><dt>Category</dt><dd>${categoryLabel(c)}</dd></div>
        <div><dt>Map position</dt><dd>x ${l.coordinates.center.x}, y ${l.coordinates.center.y}</dd></div>
      </dl>
      <div class="info-actions"><button type="button" class="btn-sm" data-act="focus">Focus on map</button></div>
      <div class="route">
        <h3>Guide lines from here</h3>
        <div class="route-chips">${dests.length ? dests.map((d) => `<button type="button" class="route-chip" data-remove="${d.id}" title="Remove guide line">${d.id} · ${d.title} ×</button>`).join("") : `<span class="empty">None. Use the flag next to a directory entry.</span>`}</div>
        <p class="route-note">Straight-line guides between marker positions, not surveyed walking routes.</p>
      </div>
    </div>`;
}

export function selectLocation(id, opts = {}) {
  if (!locById.has(id)) return;
  state.activeId = id;
  if (opts.open) setPanelOpen(true);
  renderInfo();
  syncDirectoryState();
  updateVisualState();
  if (opts.fly) focusLocation(id);
  const btn = dom.list.querySelector(`.dir-item[data-id="${id}"]`);
  if (btn) btn.scrollIntoView({ block: "nearest", behavior: reduceMotion ? "auto" : "smooth" });
}

function toggleDestination(id) {
  if (id === state.activeId) return;
  const i = state.destIds.indexOf(id);
  if (i >= 0) state.destIds.splice(i, 1);
  else { state.destIds.push(id); if (state.destIds.length > MAX_DESTINATIONS) state.destIds.shift(); }
  renderInfo();
  syncDirectoryState();
  updateVisualState();
}

/* Directory toggle, list rows and info-card actions. */
function bindDirectory() {
  dom.toggle.addEventListener("click", () => setPanelOpen(!state.directoryOpen));

  dom.list.addEventListener("click", (e) => {
    const dest = e.target.closest("[data-dest]");
    if (dest) return toggleDestination(Number(dest.dataset.dest));
    const item = e.target.closest("[data-id]");
    if (item) selectLocation(Number(item.dataset.id), { fly: true });
  });

  dom.infoCard.addEventListener("click", (e) => {
    const rm = e.target.closest("[data-remove]");
    if (rm) return toggleDestination(Number(rm.dataset.remove));
    if (e.target.closest("[data-act='focus']")) focusLocation(state.activeId);
  });
}

/* =====================================================================
   Search
   ===================================================================== */

/* Search input: updates the query, refreshes the directory and map, and opens the directory when there is a query. */
function bindSearch() {
  dom.search.addEventListener("input", () => {
    state.query = dom.search.value.trim().toLowerCase();
    renderDirectory();
    updateVisualState();
    if (state.query) setPanelOpen(true);
  });
}

/* =====================================================================
   Filter
   ===================================================================== */

export function syncFilterState() {
  const on = state.filter !== "all";
  dom.filterDot.hidden = !on;
  dom.filterBtn.classList.toggle("is-filtered", on);
  dom.filterBtn.title = on ? "Filter locations (filter active)" : "Filter locations";
}

/* Filter button, menu and outside-click dismissal. */
function bindFilters() {
  dom.filterBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    const open = dom.filterMenu.hidden;
    dom.filterMenu.hidden = !open;
    dom.filterBtn.setAttribute("aria-expanded", String(open));
  });
  dom.filterMenu.addEventListener("click", (e) => {
    const b = e.target.closest("[data-filter]");
    if (!b) return;
    state.filter = b.dataset.filter;
    dom.filterMenu.querySelectorAll("[data-filter]").forEach((x) => x.setAttribute("aria-checked", String(x === b)));
    syncFilterState();
    renderDirectory();
    updateVisualState();
  });
  document.addEventListener("click", (e) => {
    if (!dom.filterMenu.hidden && !e.target.closest(".filter-wrap")) {
      dom.filterMenu.hidden = true;
      dom.filterBtn.setAttribute("aria-expanded", "false");
    }
  });
}

/* Binds the navigation controls. */
export function initNavigation() {
  bindDirectory();
  bindSearch();
  bindFilters();
}
