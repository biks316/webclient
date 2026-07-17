import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { applyTheme, loadThemePreference } from "./services/themeStore";
import "./styles.css";

applyTheme(loadThemePreference());

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
