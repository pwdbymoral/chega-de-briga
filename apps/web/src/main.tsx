import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router";
import "@chega-de-briga/design-system/tokens.css";
import "./styles.css";
import { App } from "./App";
import { TooltipLayer } from "./components/TooltipLayer";
import { ToastProvider } from "./components/Toast";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ToastProvider>
      <BrowserRouter>
        <>
          <App />
          <TooltipLayer />
        </>
      </BrowserRouter>
    </ToastProvider>
  </React.StrictMode>
);
