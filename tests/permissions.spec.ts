import { test, expect } from "@playwright/test";
import { roleCan } from "@/lib/permissions/matrix";

test("contributors can read and create risks, indicators, and audits without update or delete access", () => {
  expect(roleCan("CONTRIBUTOR", "risks:read")).toBe(true);
  expect(roleCan("CONTRIBUTOR", "risks:create")).toBe(true);
  expect(roleCan("CONTRIBUTOR", "indicators:read")).toBe(true);
  expect(roleCan("CONTRIBUTOR", "indicators:create")).toBe(true);
  expect(roleCan("CONTRIBUTOR", "audits:read")).toBe(true);
  expect(roleCan("CONTRIBUTOR", "audits:create")).toBe(true);
  expect(roleCan("CONTRIBUTOR", "risks:update")).toBe(false);
  expect(roleCan("CONTRIBUTOR", "risks:delete")).toBe(false);
  expect(roleCan("CONTRIBUTOR", "indicators:update")).toBe(false);
  expect(roleCan("CONTRIBUTOR", "indicators:delete")).toBe(false);
  expect(roleCan("CONTRIBUTOR", "audits:update")).toBe(false);
  expect(roleCan("CONTRIBUTOR", "audits:delete")).toBe(false);
});
