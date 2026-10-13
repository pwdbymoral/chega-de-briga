import React from "react";
import ReactDOM from "react-dom/client";
import "@chega-de-briga/design-system/tokens.css";
import "./styles.css";
import { PublicSite } from "./landing/PublicSite";
import { isPublicPage } from "@chega-de-briga/domain";

const root = document.getElementById("root")!;
const page = isPublicPage(root.dataset.page) ? root.dataset.page : "not_found";
ReactDOM.hydrateRoot(root,
  <React.StrictMode>
    <PublicSite page={page} />
  </React.StrictMode>,
);
