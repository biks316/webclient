import { ReactNode } from "react";
import styles from "./CollectionListCard.module.css";

interface CollectionListCardProps {
  title: string;
  children: ReactNode;
}

export function CollectionListCard({ title, children }: CollectionListCardProps) {
  return (
    <section className={styles.collectionListCard}>
      <div className={styles.collectionListTitle}>{title}</div>
      <div className={styles.collectionList}>{children}</div>
    </section>
  );
}
