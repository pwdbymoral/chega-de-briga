import assert from "node:assert/strict";
import test from "node:test";
import { parseLandingEvent } from "./landing-metrics.ts";

test("legacy payloads keep their landing meaning and unknown origin", () => {
  assert.deepEqual(parseLandingEvent({ event: "view" }), { event: "landing_view", page: "landing", source: "unknown" });
  assert.deepEqual(parseLandingEvent({ event: "form_start", channel: "email" }), { event: "form_start", page: "landing", source: "unknown" });
});

test("guide views cannot masquerade as form starts or arbitrary pages/sources", () => {
  assert.deepEqual(parseLandingEvent({ event: "view", page: "tasks_guide", source: "chatgpt" }), { event: "guide_view", page: "tasks_guide", source: "chatgpt" });
  for (const body of [
    { event: "form_start", page: "shopping_guide" }, { event: "view", page: "/private" },
    { event: "view", source: "https://google.com/private" }, { event: "view", source: null },
    { event: "waitlist_signup" }, { event: "view", channel: "google" },
  ]) assert.equal(parseLandingEvent(body), null);
});
