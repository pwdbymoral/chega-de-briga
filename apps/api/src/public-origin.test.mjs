import assert from "node:assert/strict";
import test from "node:test";
import { allowedLandingApiMethod } from "./public-origin.ts";

const origins = new Set(["https://chegadebriga.forjacorp.com"]);

test("only the configured landing origin can use the three public API routes", () => {
  assert.equal(allowedLandingApiMethod("https://chegadebriga.forjacorp.com", "GET", "/api/public/config", undefined, origins), "GET");
  assert.equal(allowedLandingApiMethod("https://chegadebriga.forjacorp.com", "POST", "/api/waitlist?campaign=x", undefined, origins), "POST");
  assert.equal(allowedLandingApiMethod("https://other.example", "POST", "/api/waitlist", undefined, origins), undefined);
  assert.equal(allowedLandingApiMethod("https://chegadebriga.forjacorp.com", "POST", "/api/admin/waitlist", undefined, origins), undefined);
  assert.equal(allowedLandingApiMethod("https://chegadebriga.forjacorp.com", "DELETE", "/api/waitlist", undefined, origins), undefined);
});

test("preflight must match the route's allowed method", () => {
  assert.equal(allowedLandingApiMethod("https://chegadebriga.forjacorp.com", "OPTIONS", "/api/waitlist", "POST", origins), "POST");
  assert.equal(allowedLandingApiMethod("https://chegadebriga.forjacorp.com", "OPTIONS", "/api/waitlist", "DELETE", origins), undefined);
});
