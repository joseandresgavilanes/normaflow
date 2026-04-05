import ProcessesModule from "@/components/modules/ProcessesModule";
import { getAppContext } from "@/lib/app-context";
import { prisma } from "@/lib/prisma";
import { DEMO_PROCESSES } from "@/lib/demo-data";

export const metadata = { title: "Procesos | NormaFlow" };

export default async function ProcessesPage() {
  const ctx = await getAppContext();
  let processes;

  if (ctx?.mode === "live") {
    const rows = await prisma.process.findMany({ where: { organizationId: ctx.organization.id }, orderBy: { name: "asc" } });
    processes = rows.map(p => ({
      id: p.id,
      name: p.name,
      code: p.code,
      type: p.type,
      description: p.description,
      inputs: p.inputs,
      outputs: p.outputs,
    }));
  } else {
    processes = DEMO_PROCESSES.map(d => ({
      id: d.id,
      name: d.name,
      code: d.code,
      type: d.type,
      description: d.description,
      inputs: d.inputs,
      outputs: d.outputs,
    }));
  }

  return <ProcessesModule processes={processes} />;
}
