import { useEffect, useRef } from "react";
import type { PublicPage } from "@chega-de-briga/domain";
import { activeAcquisition, browserAcquisition, type Acquisition, type Attribution } from "./acquisition";

export function appOrigin() {
  return import.meta.env.VITE_APP_ORIGIN || (import.meta.env.MODE === "landing"
    ? "https://app.chegadebriga.forjacorp.com" : window.location.origin);
}

export async function track(event: "view" | "form_start", page: PublicPage, acquisition: Acquisition, channel?: "email" | "whatsapp") {
  try {
    await fetch(`${appOrigin()}/api/public/landing-events`, {
      method: "POST", headers: { "Content-Type": "application/json" }, credentials: "omit",
      body: JSON.stringify({ event, page, ...acquisition, channel }),
    });
  } catch { /* Metrics never block reading or registration. */ }
}

export function usePageView(page: PublicPage) {
  const attribution = useRef<Attribution>({ acquisition: { source: "unknown" }, expiresAt: 0 });
  const sent = useRef(false);
  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    attribution.current = browserAcquisition();
    void track("view", page, attribution.current.acquisition);
  }, [page]);
  return () => activeAcquisition(attribution.current);
}
