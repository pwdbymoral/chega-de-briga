import assert from "node:assert/strict";
import test from "node:test";
import { campaignTag, normalizeWaitlistContact } from "./waitlist.ts";

test("waitlist contacts are normalized before deduplication", () => {
  assert.equal(normalizeWaitlistContact("email", "  Julia@Example.com "), "julia@example.com");
  assert.equal(normalizeWaitlistContact("whatsapp", "+55 (11) 99999-0001"), "+5511999990001");
  assert.equal(normalizeWaitlistContact("whatsapp", "(11) 99999-0001"), "+5511999990001");
  assert.equal(normalizeWaitlistContact("whatsapp", "+1 (202) 555-0100"), "+12025550100");
});

test("invalid contacts and campaign values are rejected", () => {
  assert.equal(normalizeWaitlistContact("email", "not-an-email"), null);
  assert.equal(normalizeWaitlistContact("whatsapp", "123"), null);
  assert.equal(normalizeWaitlistContact("sms", "1234567890"), null);
  assert.equal(campaignTag("launch_2026-10"), "launch_2026-10");
  assert.equal(campaignTag("email@example.com"), null);
  assert.equal(campaignTag("x".repeat(101)), null);
});
