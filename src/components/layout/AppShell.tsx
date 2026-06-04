import { ReactNode } from "react";
import { SplitPane } from "../common/SplitPane";
import styles from "./AppShell.module.css";

interface AppShellProps {
  sidebar: ReactNode;
  main: ReactNode;
  rightPanel: ReactNode;
  showSidebar: boolean;
  showRightPanel: boolean;
}

interface CenterColumnProps {
  top: ReactNode;
  content: ReactNode;
  bottom?: ReactNode;
  bottomCollapsed?: boolean;
}

function AppShellRoot({ sidebar, main, rightPanel, showSidebar, showRightPanel }: AppShellProps) {
  const center = showRightPanel ? (
    <SplitPane
      direction="horizontal"
      first={main}
      second={rightPanel}
      initialPrimarySize={320}
      primary="second"
      minPrimarySize={260}
      maxPrimarySize={420}
      className={styles.mainSplit}
    />
  ) : (
    <div className={styles.main}>{main}</div>
  );

  if (!showSidebar) {
    return <div className={styles.shell}>{center}</div>;
  }

  return (
    <div className={styles.shell}>
      <SplitPane
        direction="horizontal"
        first={sidebar}
        second={center}
        initialPrimarySize={284}
        minPrimarySize={220}
        maxPrimarySize={420}
        className={styles.outerSplit}
      />
    </div>
  );
}

function CenterColumn({ top, content, bottom, bottomCollapsed = false }: CenterColumnProps) {
  if (!bottom) {
    return (
      <div className={styles.center}>
        <div className={styles.top}>{top}</div>
        <div className={styles.content}>{content}</div>
      </div>
    );
  }

  return (
    <SplitPane
      direction="vertical"
      first={
        <div className={styles.center}>
          <div className={styles.top}>{top}</div>
          <div className={styles.content}>{content}</div>
        </div>
      }
      second={bottom}
      initialPrimarySize={190}
      primary="second"
      minPrimarySize={72}
      maxPrimarySize={280}
      collapsePane="second"
      collapsed={bottomCollapsed}
      className={styles.consoleSplit}
    />
  );
}

export const AppShell = Object.assign(AppShellRoot, {
  CenterColumn,
});
