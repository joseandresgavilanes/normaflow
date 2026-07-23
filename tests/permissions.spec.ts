import { test, expect } from "@playwright/test";
import { permissionMatches, roleCan } from "@/lib/permissions/matrix";

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

test("live roles expose the canonical module/action contract", () => {
  expect(roleCan("OWNER", "documents:delete")).toBe(true);
  expect(roleCan("ADMIN", "documents:export")).toBe(true);
  expect(roleCan("MANAGER", "documents:approve")).toBe(true);
  expect(roleCan("AUDITOR", "documents:approve")).toBe(true);
  expect(roleCan("AUDITOR", "documents:delete")).toBe(false);
  expect(roleCan("VIEWER", "documents:view")).toBe(true);
  expect(roleCan("VIEWER", "documents:create")).toBe(false);
  expect(roleCan("VIEWER", "documents:export")).toBe(false);
});

test("legacy read permissions remain equivalent to view during migration", () => {
  expect(permissionMatches("documents:view", "documents:read")).toBe(true);
  expect(permissionMatches("documents:read", "documents:view")).toBe(true);
  expect(permissionMatches("documents:*", "documents:export")).toBe(true);
  expect(permissionMatches("documents:update", "documents:delete")).toBe(false);
});

test("evidence repository permissions separate contribution, approval, and export", () => {
  expect(roleCan("CONTRIBUTOR", "evidence:create")).toBe(true);
  expect(roleCan("CONTRIBUTOR", "evidence:approve")).toBe(false);
  expect(roleCan("AUDITOR", "evidence:read")).toBe(true);
  expect(roleCan("AUDITOR", "evidence:export")).toBe(true);
  expect(roleCan("VIEWER", "evidence:export")).toBe(false);
});

test("record control permissions protect catalog maintenance and matrix export", () => {
  expect(roleCan("CONTRIBUTOR", "records:create")).toBe(true);
  expect(roleCan("CONTRIBUTOR", "records:update")).toBe(false);
  expect(roleCan("CONTRIBUTOR", "records:export")).toBe(false);
  expect(roleCan("AUDITOR", "records:read")).toBe(true);
  expect(roleCan("AUDITOR", "records:export")).toBe(true);
  expect(roleCan("VIEWER", "records:export")).toBe(false);
});
