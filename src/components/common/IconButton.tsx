import { ButtonHTMLAttributes } from "react";
import styles from "./IconButton.module.css";

type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement>;

export function IconButton({ className, ...props }: IconButtonProps) {
  return <button {...props} className={`${styles.button} ${className ?? ""}`.trim()} type={props.type ?? "button"} />;
}
