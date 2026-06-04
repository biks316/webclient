import styles from "./ResponseTabs.module.css";

interface ResponseTabsProps {
  activeTab: string;
  onChange: (tab: string) => void;
}

export function ResponseTabs({ activeTab, onChange }: ResponseTabsProps) {
  return (
    <div className={styles.tabs}>
      {["response", "headers", "timeline", "tests"].map((tab) => (
        <button
          key={tab}
          type="button"
          className={`${styles.tab} ${activeTab === tab ? styles.active : ""}`}
          onClick={() => onChange(tab)}
        >
          {tab[0].toUpperCase()}
          {tab.slice(1)}
        </button>
      ))}
    </div>
  );
}
