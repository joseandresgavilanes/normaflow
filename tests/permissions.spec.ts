import { test, expect } from "@playwright/test";
import { permissionMatches, roleCan } from "@/lib/permissions/matrix";
import { directoryPayload, memberAccessFor } from "@/lib/payload-privacy";
import { selfApprovalOutcome } from "@/lib/document-approval-workflow";

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
  // El auditor perdió la aprobación: no puede firmar lo que luego audita.
  expect(roleCan("AUDITOR", "documents:approve")).toBe(false);
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

test("nombrar a alguien no exige poder administrar la plantilla", () => {
  // El defecto que arregla esto: para escribir «responsable: Ana» había que ser
  // administrador de la organización, y con ello se veía el correo de todos.
  for (const role of ["MANAGER", "COMPLIANCE_MANAGER", "AUDITOR", "CONTRIBUTOR"] as const) {
    expect(roleCan(role, "members:directory")).toBe(true);
    expect(roleCan(role, "members:*")).toBe(false);
  }

  // La ficha con el correo es un grado intermedio: quien opera el sistema, sí;
  // quien solo aporta trabajo o audita, no.
  expect(roleCan("MANAGER", "members:view")).toBe(true);
  expect(roleCan("COMPLIANCE_MANAGER", "members:view")).toBe(true);
  expect(roleCan("AUDITOR", "members:view")).toBe(false);
  expect(roleCan("CONTRIBUTOR", "members:view")).toBe(false);

  // El visor no asigna nada, así que no necesita el directorio.
  expect(roleCan("VIEWER", "members:directory")).toBe(false);

  // Y quien administra sigue satisfaciendo los dos grados inferiores, para que
  // el cambio no obligue a tocar a los administradores existentes.
  for (const role of ["OWNER", "ADMIN", "ORG_ADMIN"] as const) {
    expect(roleCan(role, "members:directory")).toBe(true);
    expect(roleCan(role, "members:view")).toBe(true);
  }
});

test("el grado mínimo entrega nombres y roles, nunca correos", () => {
  expect(memberAccessFor((permission) => roleCan("CONTRIBUTOR", permission))).toBe("directory");
  expect(memberAccessFor((permission) => roleCan("AUDITOR", permission))).toBe("directory");
  expect(memberAccessFor((permission) => roleCan("MANAGER", permission))).toBe("full");
  expect(memberAccessFor((permission) => roleCan("ORG_ADMIN", permission))).toBe("full");
  expect(memberAccessFor((permission) => roleCan("VIEWER", permission))).toBe("none");

  const gente = [{ userId: "u1", name: "Ana Vega", email: "ana@empresa.com", role: "MANAGER", canApprove: true }];

  // El rol y la capacidad de aprobar se conservan: son lo que decide a quién se
  // puede mandar un documento a revisión, no son ficha personal.
  expect(directoryPayload("directory", gente)).toEqual([
    { userId: "u1", name: "Ana Vega", role: "MANAGER", canApprove: true },
  ]);
  expect(directoryPayload("full", gente)).toEqual(gente);
  expect(directoryPayload("none", gente)).toEqual([]);
});

test("nadie aprueba la versión que subió, salvo que no quede nadie más", () => {
  const yo = "u-ana";

  // Caso normal: hay más gente que puede aprobar, así que la separación se exige.
  expect(selfApprovalOutcome({ approverId: yo, versionCreatedById: yo, otherApproversAvailable: true })).toBe("blocked");

  // Aprobar el trabajo de otro nunca se bloquea.
  expect(selfApprovalOutcome({ approverId: yo, versionCreatedById: "u-luis", otherApproversAvailable: true })).toBe("allowed");
  expect(selfApprovalOutcome({ approverId: yo, versionCreatedById: "u-luis", otherApproversAvailable: false })).toBe("allowed");

  // Organización de una sola persona: exigirlo dejaría el documento bloqueado
  // para siempre, así que se permite y queda marcado como excepción.
  expect(selfApprovalOutcome({ approverId: yo, versionCreatedById: yo, otherApproversAvailable: false })).toBe("sole-approver");

  // Versiones antiguas sin autor registrado no se bloquean: no hay dato con el
  // que afirmar que las subió quien ahora las aprueba.
  expect(selfApprovalOutcome({ approverId: yo, versionCreatedById: null, otherApproversAvailable: true })).toBe("allowed");
});
