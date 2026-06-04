import styles from "./RequestTabs.module.css";

interface RequestTabsProps {
  tabs: Array<{ id: string; label: string }>;
  activeTab: string;
  onChange: (tab: string) => void;
}

export function RequestTabs({ tabs, activeTab, onChange }: RequestTabsProps) {
  return (
    <div className={styles.tabs}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          className={`${styles.tab} ${activeTab === tab.id ? styles.active : ""}`}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
