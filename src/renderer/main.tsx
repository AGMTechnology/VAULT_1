import React from "react";
import ReactDOM from "react-dom/client";

import { vaultCssVariables } from "@shared/design-tokens";

import { App } from "./App";
import "./styles.css";

Object.entries(vaultCssVariables).forEach(([key, value]) => {
  document.documentElement.style.setProperty(key, value);
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
