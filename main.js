import { animate, bindCameraControls, initScene, resetCameraView, syncDock, updateVisualState } from "./scene.js";
import { DEFAULT_ACTIVE_ID, DEFAULT_DEST_IDS, state } from "./appState.js";
import { initNavigation, renderDirectory, renderInfo, selectLocation, setPanelOpen, syncFilterState } from "./navigation.js";
import { dom } from "./dom.js";

function resetView() {
  state.activeId = DEFAULT_ACTIVE_ID;
  state.destIds = [...DEFAULT_DEST_IDS];
  setPanelOpen(false);
  dom.filterMenu.hidden = true;
  dom.filterBtn.setAttribute("aria-expanded", "false");
  state.mode = "orbit";
  syncDock();
  refreshAll();
  resetCameraView();
}

function refreshAll() {
  renderDirectory();
  renderInfo();
  updateVisualState();
  syncFilterState();
}

function bindUI() {
  dom.reset.addEventListener("click", resetView);
  initNavigation();
  bindCameraControls({ onEscape: resetView });
}

function init() {
  bindUI();
  syncDock();
  refreshAll();
  setPanelOpen(false);
  try {
    initScene({ onSelectLocation: (id) => selectLocation(id, { fly: true, open: true }) });
    updateVisualState();
    requestAnimationFrame(animate);
  } catch (err) {
    console.error(err);
    dom.fallbackText.textContent = err.message + " The directory and search still work.";
    dom.fallback.hidden = false;
    setPanelOpen(true);
  }
}

init();
