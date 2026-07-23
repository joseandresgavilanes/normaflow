"use client";

import { downloadReportExport, getReportExportStatus } from "@/lib/actions/reporting";

export async function downloadQueuedReport(id: string) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const status = await getReportExportStatus(id);
    if (status.status === "COMPLETED") {
      const artifact = await downloadReportExport(id);
      const anchor = document.createElement("a");
      anchor.href = artifact.url;
      anchor.download = artifact.fileName;
      anchor.click();
      return artifact;
    }
    if (status.status === "FAILED") throw new Error(status.error ?? "No se pudo generar el reporte.");
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error("El reporte sigue en cola. Puedes descargarlo desde el historial.");
}
