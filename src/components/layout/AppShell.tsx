import { ReactNode } from "react";
import { SplitPane } from "../common/SplitPane";
import styles from "./AppShell.module.css";

interface AppShellProps {
  toolbar?: ReactNode;
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

function AppShellRoot({ toolbar, sidebar, main, rightPanel, showSidebar, showRightPanel }: AppShellProps) {
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
    return (
      <div className={styles.shell}>
        {toolbar && <div className={styles.toolbar}>{toolbar}</div>}
        <div className={styles.body}>{center}</div>
      </div>
    );
  }

  return (
    <div className={styles.shell}>
      {toolbar && <div className={styles.toolbar}>{toolbar}</div>}
      <div className={styles.body}>
        <SplitPane
          direction="horizontal"
          first={sidebar}
          second={center}
          initialPrimarySize={248}
          minPrimarySize={208}
          maxPrimarySize={360}
          className={styles.outerSplit}
        />
      </div>
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
