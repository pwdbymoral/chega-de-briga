import React from "react";
import ReactDOM from "react-dom/client";
import "@chega-de-briga/design-system/tokens.css";
import "./styles.css";
import { LandingPage } from "./LandingPage";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <LandingPage />
  </React.StrictMode>,
);
