import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const SECURITY_CONTROL_CATALOG_VERSION = "2022";

export type SecurityControlDomainKey = "ORGANIZATIONAL" | "PEOPLE" | "PHYSICAL" | "TECHNOLOGICAL";

type ControlSeed = {
  code: string;
  domain: SecurityControlDomainKey;
  title: string;
};

const rows = (domain: SecurityControlDomainKey, codes: string[], titles: string[]) =>
  codes.map((code, index) => ({ code, domain, title: titles[index] ?? `Control ${code}` }));

/**
 * Identifiers and short original working titles only. This catalog intentionally
 * does not reproduce licensed normative text. Authorized content may be added
 * later through the product owner's controlled catalog process.
 */
export const SECURITY_CONTROL_CATALOG: readonly ControlSeed[] = [
  ...rows("ORGANIZATIONAL", [
    "5.1", "5.2", "5.3", "5.4", "5.5", "5.6", "5.7", "5.8", "5.9", "5.10", "5.11", "5.12", "5.13", "5.14", "5.15", "5.16", "5.17", "5.18", "5.19", "5.20", "5.21", "5.22", "5.23", "5.24", "5.25", "5.26", "5.27", "5.28", "5.29", "5.30", "5.31", "5.32", "5.33", "5.34", "5.35", "5.36", "5.37",
  ], [
    "Security policies", "Security roles and responsibilities", "Segregation of duties", "Management responsibilities", "Authorities liaison", "Professional groups liaison", "Threat intelligence", "Security in project management", "Asset inventory", "Acceptable asset use", "Asset return", "Information classification", "Information labelling", "Information transfer", "Access control", "Identity management", "Authentication information", "Access rights", "Security in supplier relations", "Security clauses in supplier agreements", "ICT supply-chain security", "Supplier-service monitoring", "Cloud-service security", "Incident-management preparation", "Event assessment and decision", "Incident response", "Incident lessons learned", "Evidence collection", "Security during disruption", "ICT continuity readiness", "Legal, regulatory and contractual requirements", "Intellectual property protection", "Records protection", "Privacy and PII protection", "Independent security review", "Policy and rule compliance review", "Operating procedures",
  ]),
  ...rows("PEOPLE", ["6.1", "6.2", "6.3", "6.4", "6.5", "6.6", "6.7", "6.8"], [
    "Personnel screening", "Employment security terms", "Awareness and training", "Disciplinary process", "Post-change and termination duties", "Confidentiality agreements", "Remote working", "Security event reporting",
  ]),
  ...rows("PHYSICAL", ["7.1", "7.2", "7.3", "7.4", "7.5", "7.6", "7.7", "7.8", "7.9", "7.10", "7.11", "7.12", "7.13", "7.14"], [
    "Physical security perimeters", "Physical entry controls", "Secure offices and facilities", "Physical monitoring", "Environmental threat protection", "Secure-area working", "Clear desk and screen", "Equipment placement and protection", "Off-premises assets", "Storage media handling", "Supporting utilities", "Cabling protection", "Equipment maintenance", "Secure disposal and reuse",
  ]),
  ...rows("TECHNOLOGICAL", ["8.1", "8.2", "8.3", "8.4", "8.5", "8.6", "8.7", "8.8", "8.9", "8.10", "8.11", "8.12", "8.13", "8.14", "8.15", "8.16", "8.17", "8.18", "8.19", "8.20", "8.21", "8.22", "8.23", "8.24", "8.25", "8.26", "8.27", "8.28", "8.29", "8.30", "8.31", "8.32", "8.33", "8.34"], [
    "Endpoint devices", "Privileged access", "Information access restriction", "Source-code access", "Secure authentication", "Capacity management", "Malware protection", "Technical vulnerability management", "Configuration management", "Information deletion", "Data masking", "Data leakage prevention", "Information backup", "Processing-facility redundancy", "Logging", "Activity monitoring", "Clock synchronization", "Privileged utility use", "Software installation control", "Network security", "Network service security", "Network segregation", "Web filtering", "Cryptography use", "Secure development lifecycle", "Application security requirements", "Secure architecture principles", "Secure coding", "Development security testing", "Outsourced development", "Dev, test and production separation", "Change management", "Test information", "Audit-test protection",
  ]),
];

export function securityControlCounts() {
  return SECURITY_CONTROL_CATALOG.reduce<Record<SecurityControlDomainKey, number>>((acc, row) => {
    acc[row.domain] += 1;
    return acc;
  }, { ORGANIZATIONAL: 0, PEOPLE: 0, PHYSICAL: 0, TECHNOLOGICAL: 0 });
}

type Db = PrismaClient | Prisma.TransactionClient;

export async function ensureSecurityControlCatalog(db: Db = prisma) {
  const standard = await db.standardEdition.findFirst({ where: { family: { code: "ISO_27001" } }, orderBy: { version: "desc" } });
  if (!standard) throw new Error("ISO_27001 debe existir antes de cargar el catálogo de controles.");
  const version = await db.controlCatalogVersion.upsert({
    where: { standardId_version: { standardId: standard.id, version: SECURITY_CONTROL_CATALOG_VERSION } },
    update: { catalogDate: new Date("2022-10-25T00:00:00.000Z"), status: "PUBLISHED", active: true },
    create: { standardId: standard.id, version: SECURITY_CONTROL_CATALOG_VERSION, catalogDate: new Date("2022-10-25T00:00:00.000Z"), status: "PUBLISHED", active: true },
  });
  await db.controlCatalogVersion.updateMany({ where: { standardId: standard.id, id: { not: version.id } }, data: { active: false } });
  await db.securityControl.createMany({
    data: SECURITY_CONTROL_CATALOG.map((item, index) => ({
      catalogVersionId: version.id,
      code: item.code,
      domain: item.domain,
      title: item.title,
      descriptionInternal: "Resumen operativo propio de NormaFlow; contenido autorizado pendiente de carga.",
      objective: `Mantener una práctica verificable para el control ${item.code}.`,
      sortOrder: index + 1,
      active: true,
    })),
    skipDuplicates: true,
  });
  await db.securityControl.updateMany({ where: { catalogVersionId: version.id }, data: { active: true } });
  return version;
}

export async function ensureOrganizationControlSet(organizationId: string, db: Db = prisma) {
  const version = await db.controlCatalogVersion.findFirst({ where: { standard: { code: "ISO_27001" }, active: true, status: "PUBLISHED" }, include: { controls: { where: { active: true }, select: { id: true } } } });
  if (!version) return { version: null, created: 0 };
  const result = await db.organizationControl.createMany({
    data: version.controls.map((control) => ({ organizationId, controlId: control.id })),
    skipDuplicates: true,
  });
  return { version, created: result.count };
}
