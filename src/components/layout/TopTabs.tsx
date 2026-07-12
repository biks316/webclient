import { Bot, LayoutPanelLeft, MonitorDown, PanelsRightBottom, Plus, X } from "lucide-react";
import { MethodBadge } from "../common/MethodBadge";
import { IconButton } from "../common/IconButton";
import styles from "./TopTabs.module.css";

interface TopTab {
  id: string;
  collectionId: string;
  endpointId: string;
  method: string;
  name: string;
  active: boolean;
  dirty: boolean;
}

interface TopTabsProps {
  tabs: TopTab[];
  hiddenPanels: Array<"sidebar" | "timeline" | "copilot" | "console">;
  onSelect: (collectionId: string, endpointId: string) => void;
  onClose: (collectionId: string, endpointId: string) => void;
  onCreate: () => void;
  onRestorePanel: (panel: "sidebar" | "timeline" | "copilot" | "console") => void;
}

const hiddenPanelMeta = {
  sidebar: { label: "Collections", icon: LayoutPanelLeft },
  timeline: { label: "Timeline", icon: PanelsRightBottom },
  copilot: { label: "Copilot", icon: Bot },
  console: { label: "Console", icon: MonitorDown },
} as const;

export function TopTabs({ tabs, hiddenPanels, onSelect, onClose, onCreate, onRestorePanel }: TopTabsProps) {
  return (
    <div className={styles.wrap}>
      <div className={styles.scroll}>
        {tabs.map((tab) => (
          <div key={tab.id} className={`${styles.tab} ${tab.active ? styles.active : ""}`}>
            <button type="button" className={styles.main} onClick={() => onSelect(tab.collectionId, tab.endpointId)}>
              <MethodBadge method={tab.method} compact />
              <span>{tab.name}</span>
              {tab.dirty && <span className={styles.dot} />}
            </button>
            <IconButton title={`Close ${tab.name}`} onClick={() => onClose(tab.collectionId, tab.endpointId)}>
              <X size={13} />
            </IconButton>
          </div>
        ))}
      </div>
      {hiddenPanels.length > 0 && (
        <div className={styles.hiddenPanels}>
          {hiddenPanels.map((panel) => {
            const meta = hiddenPanelMeta[panel];
            const Icon = meta.icon;
            return (
              <button key={panel} type="button" className={styles.restore} onClick={() => onRestorePanel(panel)}>
                <Icon size={13} />
                {meta.label}
              </button>
            );
          })}
        </div>
      )}
      <IconButton title="Create request" onClick={onCreate}>
        <Plus size={15} />
      </IconButton>
    </div>
  );
}
