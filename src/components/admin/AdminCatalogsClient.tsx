"use client";

import { useMemo, useState, useTransition } from "react";
import { Plus, Pencil, Power } from "lucide-react";
import { useAdminMock } from "@/context/AdminMockStore";
import { useDemoPermission } from "@/hooks/useDemoPermission";
import Card from "@/components/ui/Card";
import SectionTitle from "@/components/ui/SectionTitle";
import Badge from "@/components/ui/Badge";
import Modal from "@/components/ui/Modal";

const CATALOGS = [
  ["DOCUMENT_TYPE", "Tipos documentales"],
  ["STATUS", "Estados"],
  ["PRIORITY", "Prioridades"],
  ["RISK_CATEGORY", "Categorías de riesgo"],
  ["FINDING_TYPE", "Tipos de hallazgo"],
  ["EVIDENCE_TYPE", "Tipos de evidencia"],
] as const;

export default function AdminCatalogsClient() {
  const admin = useAdminMock();
  const canEdit = useDemoPermission().can("catalogs:*");
  const rows = admin.state.catalogItems ?? [];
  const [kind, setKind] = useState<string>(CATALOGS[0][0]);
  const [editing, setEditing] = useState<(typeof rows)[number] | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isPending, startTransition] = useTransition();
  const visible = useMemo(() => rows.filter((row) => row.kind === kind), [rows, kind]);
  const currentLabel = CATALOGS.find(([value]) => value === kind)?.[1] ?? kind;

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setError("");
    setSuccess("");
    startTransition(async () => {
      try {
        const data = { kind, name: String(form.get("name") ?? ""), description: String(form.get("description") ?? "") };
        if (editing) await admin.updateAdminCatalogItem?.({ id: editing.id, name: data.name, description: data.description });
        else await admin.createAdminCatalogItem?.(data);
        setCreating(false);
        setEditing(null);
        setSuccess(editing ? "Elemento actualizado." : "Elemento creado.");
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "No se pudo guardar el elemento.");
      }
    });
  }

  return (
    <div className="space-y-5">
      <SectionTitle title="Catálogos base" sub="Personaliza los valores que utiliza tu organización en documentos, riesgos, auditorías y evidencias." action={canEdit ? <span className="inline-flex items-center gap-2"><Plus size={16} /> Nuevo valor</span> : undefined} onAction={canEdit ? () => { setCreating(true); setEditing(null); setError(""); } : undefined} />
      {success && <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">{success}</div>}
      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      <div className="grid gap-5 lg:grid-cols-[240px_1fr]">
        <Card className="h-fit p-3">
          <div className="space-y-1">
            {CATALOGS.map(([value, label]) => <button key={value} type="button" onClick={() => setKind(value)} className={`w-full rounded-lg px-3 py-2 text-left text-sm transition ${kind === value ? "bg-indigo-50 font-semibold text-indigo-700" : "text-gray-600 hover:bg-gray-50"}`}>{label}</button>)}
          </div>
        </Card>
        <Card>
          <div className="mb-4 flex items-center justify-between gap-3"><div><h3 className="text-base font-semibold text-gray-900">{currentLabel}</h3><p className="mt-1 text-xs text-gray-500">{visible.length} valores configurados</p></div></div>
          {visible.length === 0 ? <div className="rounded-xl border border-dashed border-gray-300 px-6 py-12 text-center"><p className="text-sm font-medium text-gray-700">No hay valores configurados</p><p className="mt-1 text-xs text-gray-500">Crea el primero para usarlo en los módulos de NormaFlow.</p></div> : <div className="divide-y divide-gray-100 rounded-xl border border-gray-200">{visible.map((row) => <div key={row.id} className="flex items-center justify-between gap-3 px-4 py-3"><div className="min-w-0"><p className="truncate text-sm font-medium text-gray-900">{row.name}</p>{row.description && <p className="truncate text-xs text-gray-500">{row.description}</p>}</div><div className="flex items-center gap-2"><Badge status={row.active ? "ACTIVE" : "OBSOLETE"} label={row.active ? "Activo" : "Inactivo"} />{canEdit && <><button type="button" className="rounded-md p-2 text-gray-500 hover:bg-gray-100" title="Editar" onClick={() => { setEditing(row); setError(""); }}><Pencil size={15} /></button><button type="button" className="rounded-md p-2 text-gray-500 hover:bg-gray-100" title={row.active ? "Desactivar" : "Activar"} onClick={() => startTransition(async () => { try { await admin.updateAdminCatalogItem?.({ id: row.id, active: !row.active }); setSuccess(row.active ? "Elemento desactivado." : "Elemento activado."); } catch (err: unknown) { setError(err instanceof Error ? err.message : "No se pudo actualizar el elemento."); } })}><Power size={15} /></button></>}</div></div>)}</div>}
        </Card>
      </div>
      <Modal open={creating || !!editing} onClose={() => !isPending && (setCreating(false), setEditing(null))} title={editing ? "Editar valor" : `Nuevo valor · ${currentLabel}`} width={480}>
        <form onSubmit={submit} className="nf-modal-form"><label className="nf-modal-field"><span className="nf-modal-field-label">Nombre *</span><input name="name" required defaultValue={editing?.name ?? ""} className="nf-app-input" /></label><label className="nf-modal-field"><span className="nf-modal-field-label">Descripción</span><textarea name="description" rows={3} defaultValue={editing?.description ?? ""} className="nf-app-input" /></label>{error && <div className="nf-modal-error">{error}</div>}<div className="nf-modal-actions"><button type="button" className="nf-app-btn-ghost" disabled={isPending} onClick={() => { setCreating(false); setEditing(null); }}>Cancelar</button><button type="submit" className="nf-app-btn-primary" disabled={isPending || !admin.createAdminCatalogItem && !admin.updateAdminCatalogItem}>{isPending ? "Guardando…" : "Guardar"}</button></div></form>
      </Modal>
    </div>
  );
}
