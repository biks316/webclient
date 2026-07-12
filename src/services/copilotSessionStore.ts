const COPILOT_PANEL_WIDTH_KEY = "bikapi:copilot-panel-width";

export function loadCopilotPanelWidth(defaultWidth: number) {
  try {
    const raw = window.localStorage.getItem(COPILOT_PANEL_WIDTH_KEY);
    if (!raw) {
      return defaultWidth;
    }
    const value = Number(raw);
    return Number.isFinite(value) && value > 0 ? value : defaultWidth;
  } catch {
    return defaultWidth;
  }
}

export function saveCopilotPanelWidth(width: number) {
  try {
    window.localStorage.setItem(COPILOT_PANEL_WIDTH_KEY, String(width));
  } catch {
    // Ignore storage failures.
  }
}
