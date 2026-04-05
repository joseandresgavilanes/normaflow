import EvidenceModule from "@/components/modules/EvidenceModule";
import { getAppContext } from "@/lib/app-context";
import { prisma } from "@/lib/prisma";
import { DEMO_EVIDENCE } from "@/lib/demo-data";

export const metadata = { title: "Evidencias | NormaFlow" };

export default async function EvidencePage() {
  const ctx = await getAppContext();
  let items;

  if (ctx?.mode === "live") {
    const rows = await prisma.evidenceFile.findMany({
      where: { organizationId: ctx.organization.id },
      orderBy: { createdAt: "desc" },
    });
    items = rows.map(e => ({
      id: e.id,
      title: e.title,
      module: e.module,
      fileUrl: e.fileUrl,
      fileSize: e.fileSize,
      createdAt: e.createdAt.toISOString(),
    }));
  } else {
    items = DEMO_EVIDENCE.map(e => ({
      id: e.id,
      title: e.title,
      module: e.module,
      fileUrl: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
      fileSize: null as number | null,
      createdAt: `${e.date}T12:00:00.000Z`,
    }));
  }

  return <EvidenceModule items={items} />;
}
