import { test, expect } from "@playwright/test";
import { roleCan } from "@/lib/permissions/matrix";

test("contributors can read and create risks without update or delete access", () => {
  expect(roleCan("CONTRIBUTOR", "risks:read")).toBe(true);
  expect(roleCan("CONTRIBUTOR", "risks:create")).toBe(true);
  expect(roleCan("CONTRIBUTOR", "risks:update")).toBe(false);
  expect(roleCan("CONTRIBUTOR", "risks:delete")).toBe(false);
});
