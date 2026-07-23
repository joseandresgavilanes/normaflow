"use client";

import CatalogManager, { type CatalogField, type CatalogRow } from "./CatalogManager";
import { useAdminMock } from "@/context/AdminMockStore";
import { useDemoPermission } from "@/hooks/useDemoPermission";

type SimpleCatalogKey = "position" | "location" | "disposition" | "archiveMethod" | "recordType";

function asRow(r: { id: string; code?: string | null; name: string; active: boolean; createdAt: string; description?: string | null }): CatalogRow {
  return {
    id: r.id,
    code: r.code ?? null,
    name: r.name,
    description: r.description ?? null,
    active: r.active,
    createdAt: r.createdAt,
  };
}

export function SimpleCatalogClient(props: {
  catalog: SimpleCatalogKey;
  title: string;
  subtitle?: string;
  permission: string;
  withDescription?: boolean;
}) {
  const admin = useAdminMock();
  const perm = useDemoPermission();
  const canEdit = perm.can(props.permission);

  const fields: CatalogField[] = [{ key: "name", label: "Nombre", type: "text", required: true }];
  if (props.catalog === "recordType") fields.unshift({ key: "code", label: "Código", type: "text", required: true, helper: "Código único dentro de la organización." });
  if (props.withDescription) fields.push({ key: "description", label: "Descripción", type: "textarea" });

  let rows: CatalogRow[] = [];
  let onCreate: (form: { name: string; code?: string; description?: string }) => Promise<void>;
  let onUpdate: (id: string, form: { name?: string; code?: string; description?: string }) => Promise<void>;
  let onDelete: (id: string) => Promise<void>;

  switch (props.catalog) {
    case "position":
      rows = admin.state.positions.map(asRow);
      onCreate = async (f) => admin.createPosition({ name: f.name, description: f.description });
      onUpdate = async (id, f) => admin.updatePosition(id, f);
      onDelete = async (id) => admin.deactivatePosition(id);
      break;
    case "location":
      rows = admin.state.locations.map(asRow);
      onCreate = async (f) => admin.createLocation({ name: f.name, description: f.description });
      onUpdate = async (id, f) => admin.updateLocation(id, f);
      onDelete = async (id) => admin.deactivateLocation(id);
      break;
    case "disposition":
      rows = admin.state.dispositions.map(asRow);
      onCreate = async (f) => admin.createDisposition({ name: f.name });
      onUpdate = async (id, f) => admin.updateDisposition(id, { name: f.name });
      onDelete = async (id) => admin.deactivateDisposition(id);
      break;
    case "archiveMethod":
      rows = admin.state.archiveMethods.map(asRow);
      onCreate = async (f) => admin.createArchiveMethod({ name: f.name });
      onUpdate = async (id, f) => admin.updateArchiveMethod(id, { name: f.name });
      onDelete = async (id) => admin.deactivateArchiveMethod(id);
      break;
    case "recordType":
      rows = admin.state.recordTypes.map(asRow);
      onCreate = async (f) => admin.createRecordType({ name: f.name, code: f.code });
      onUpdate = async (id, f) => admin.updateRecordType(id, { name: f.name, code: f.code });
      onDelete = async (id) => admin.deactivateRecordType(id);
      break;
  }

  return (
    <CatalogManager
      title={props.title}
      subtitle={props.subtitle}
      rows={rows}
      fields={fields}
      canEdit={canEdit}
      onCreate={onCreate}
      onUpdate={onUpdate}
      onDelete={onDelete}
    />
  );
}

export function RetentionCatalogClient() {
  const admin = useAdminMock();
  const perm = useDemoPermission();
  const canEdit = perm.can("catalogs:*");

  const rows: CatalogRow[] = admin.state.retentionTimes.map((r) => ({
    id: r.id,
    name: r.name,
    months: r.months,
    active: r.active,
    createdAt: r.createdAt,
  }));

  const fields: CatalogField[] = [
    { key: "name", label: "Nombre", type: "text", required: true },
    { key: "months", label: "Meses de retención", type: "number", required: true, helper: "Número de meses durante los que se conserva el registro." },
  ];

  return (
    <CatalogManager
      title="Tiempo de retención"
      subtitle="Plazos durante los cuales se conservan los registros antes de su disposición final."
      rows={rows}
      fields={fields}
      canEdit={canEdit}
      onCreate={async (form) => admin.createRetention({ name: form.name, months: form.months ?? 0 })}
      onUpdate={async (id, form) => admin.updateRetention(id, form)}
      onDelete={async (id) => admin.deactivateRetention(id)}
    />
  );
}
