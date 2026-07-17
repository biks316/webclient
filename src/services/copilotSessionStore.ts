import { CopilotSession } from "../types/copilot";

const COPILOT_PANEL_WIDTH_KEY = "bikapi:copilot-panel-width";
const COPILOT_SESSION_KEY_PREFIX = "bikapi:copilot-sessions:";

interface PersistedCopilotSessions {
  activeSessionId: string | null;
  sessions: CopilotSession[];
}

function sessionStorageKey(workspacePath: string | null) {
  return `${COPILOT_SESSION_KEY_PREFIX}${encodeURIComponent(workspacePath ?? "global")}`;
}

export function loadCopilotPanelWidth(defaultWidth: number) {
  try {
    const raw = window.localStorage.getItem(COPILOT_PANEL_WIDTH_KEY);
    const parsed = raw ? Number(raw) : NaN;
    return Number.isFinite(parsed) ? parsed : defaultWidth;
  } catch {
    return defaultWidth;
  }
}

export function saveCopilotPanelWidth(width: number) {
  try {
    window.localStorage.setItem(COPILOT_PANEL_WIDTH_KEY, String(width));
  } catch {
    // Storage can fail in private or sandboxed contexts.
  }
}

export function loadCopilotSessions(workspacePath: string | null): PersistedCopilotSessions | null {
  try {
    const raw = window.localStorage.getItem(sessionStorageKey(workspacePath));
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as Partial<PersistedCopilotSessions>;
    return {
      activeSessionId: typeof parsed.activeSessionId === "string" ? parsed.activeSessionId : null,
      sessions: Array.isArray(parsed.sessions) ? parsed.sessions as CopilotSession[] : [],
    };
  } catch {
    return null;
  }
}

export function saveCopilotSessions(workspacePath: string | null, value: PersistedCopilotSessions) {
  try {
    window.localStorage.setItem(sessionStorageKey(workspacePath), JSON.stringify(value));
  } catch {
    // Ignore storage failures.
  }
}
