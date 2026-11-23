/* Reusable DOM helpers: element lookup, the app's element registry, motion preference and toast. */

const $ = (id) => document.getElementById(id);

export const dom = {
  host: $("sceneHost"), fallback: $("sceneFallback"), fallbackText: $("sceneFallbackText"),
  panel: $("infoPanel"), toggle: $("sidebarToggleBtn"), counter: $("locationCounter"),
  infoCard: $("infoCard"), list: $("directoryList"), search: $("locationSearch"),
  filterBtn: $("filterBtn"), filterMenu: $("filterMenu"), filterDot: $("filterDot"),
  reset: $("resetZoomBtn"), zoomIn: $("zoomInBtn"), zoomOut: $("zoomOutBtn"),
  toast: $("toast"), tooltip: $("tooltip"), tImg: $("tooltipImage"), tTitle: $("tooltipTitle"), tDesc: $("tooltipDescription")
};

export const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

let toastTimer = null;

export function showToast(text, ms = 2600) {
  dom.toast.textContent = text;
  dom.toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { dom.toast.hidden = true; }, ms);
}
