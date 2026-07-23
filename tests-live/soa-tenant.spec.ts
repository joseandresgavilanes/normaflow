import { expect, test } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { actorClient, readLiveState, type LiveFixtureState } from "./support";

test.describe.configure({ mode: "serial" });

let state: LiveFixtureState;
let prisma: PrismaClient;
let soaId: string;
let firstEntryId: string;

test.describe("Statement of Applicability live tenant boundary", () => {
  test.beforeAll(async () => {
    state = readLiveState();
    prisma = new PrismaClient();
    const version = await prisma.controlCatalogVersion.findFirst({ where: { standard: { code: "ISO_27001" }, active: true, status: "PUBLISHED" }, include: { controls: { where: { active: true }, orderBy: { sortOrder: "asc" } } } });
    if (!version) throw new Error("Catálogo ISO 27001 no disponible en el entorno de prueba.");
    const soa = await prisma.statementOfApplicability.create({ data: { organizationId: state.actorA.organizationId, version: 1, status: "DRAFT" } });
    soaId = soa.id;
    await prisma.soAControlEntry.createMany({ data: version.controls.map((c) => ({ organizationId: state.actorA.organizationId, soaId: soa.id, controlId: c.id, controlCode: c.code, controlTitle: c.title, controlDomain: c.domain })) });
    const first = await prisma.soAControlEntry.findFirst({ where: { soaId: soa.id }, orderBy: { controlCode: "asc" } });
    firstEntryId = first!.id;
  });

  test.afterAll(async () => {
    await prisma.statementOfApplicability.deleteMany({ where: { id: soaId } }).catch(() => undefined);
    await prisma.$disconnect();
  });

  test("cubre 93 controles y aísla la SoA del otro tenant", async () => {
    const clientA = await actorClient(state.actorA);
    const clientB = await actorClient(state.actorB);
    const entriesA = await clientA.from("soa_control_entries").select("id,organizationId").eq("soaId", soaId);
    expect(entriesA.error).toBeNull();
    expect(entriesA.data).toHaveLength(93);
    expect(entriesA.data?.every((row) => row.organizationId === state.actorA.organizationId)).toBe(true);
    const crossEntries = await clientB.from("soa_control_entries").select("id").eq("soaId", soaId);
    expect(crossEntries.error).toBeNull();
    expect(crossEntries.data).toEqual([]);
    const crossSoa = await clientB.from("statements_of_applicability").select("id").eq("id", soaId);
    expect(crossSoa.error).toBeNull();
    expect(crossSoa.data).toEqual([]);
  });

  test("rechaza una exclusión sin justificación (CHECK) y admite la justificada", async () => {
    const clientA = await actorClient(state.actorA);
    const invalid = await clientA.from("soa_control_entries").update({ applicability: "EXCLUDED", justification: null }).eq("id", firstEntryId).select("id");
    expect(invalid.error).not.toBeNull();
    const valid = await clientA.from("soa_control_entries").update({ applicability: "EXCLUDED", justification: "No se desarrolla software a medida." }).eq("id", firstEntryId).select("id");
    expect(valid.error).toBeNull();
    expect(valid.data).toHaveLength(1);
  });

  test("una versión aprobada es inmutable frente a escrituras directas", async () => {
    await prisma.soAControlEntry.updateMany({ where: { soaId }, data: { applicability: "INCLUDED", justification: null } });
    await prisma.statementOfApplicability.update({ where: { id: soaId }, data: { status: "APPROVED", approverId: state.actorA.userId, approvedAt: new Date() } });
    const clientA = await actorClient(state.actorA);
    const entryUpdate = await clientA.from("soa_control_entries").update({ notes: "cambio posterior" }).eq("id", firstEntryId).select("id");
    expect(entryUpdate.error).toBeNull();
    expect(entryUpdate.data).toEqual([]);
    const soaUpdate = await clientA.from("statements_of_applicability").update({ scope: "cambio posterior" }).eq("id", soaId).select("id");
    expect(soaUpdate.error).toBeNull();
    expect(soaUpdate.data).toEqual([]);
  });

  test("persiste un artefacto de reporte SoA por tenant", async () => {
    const report = await prisma.reportExport.create({ data: { organizationId: state.actorA.organizationId, reportType: "soa", format: "PDF", dateFrom: new Date(), dateTo: new Date(), rowCount: 0, fileName: "soa.pdf", status: "QUEUED" } });
    const clientB = await actorClient(state.actorB);
    const crossRead = await clientB.from("report_exports").select("id").eq("id", report.id);
    expect(crossRead.error).toBeNull();
    expect(crossRead.data).toEqual([]);
    await prisma.reportExport.delete({ where: { id: report.id } }).catch(() => undefined);
  });
});
