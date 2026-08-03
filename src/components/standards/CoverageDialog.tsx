"use client";

import { useEffect, useState } from "react";
import { Link2, Trash2, Search } from "lucide-react";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import { SelectField, TextField, FormGrid, FormError } from "@/components/ui/Field";
import { useServerAction } from "@/hooks/useServerAction";
import {
  linkRequirementCoverage,
  listRequirementCoverage,
  searchCoverageCandidates,
  unlinkRequirementCoverage,
  type CoverageLink,
} from "@/lib/actions/requirement-coverage";

/**
 * Vincular elementos del sistema a un requisito de norma.
 *
 * Esta pantalla no existía. `linkRequirementCoverage` estaba escrita, validada
 * y auditada desde el principio, pero ningún componente la importaba: cero
 * consumidores en todo el repositorio. La consecuencia era que la tabla
 * `RequirementCoverage` estaba vacía, y con ella salían en cero el factor de
 * reutilización, los elementos compartidos entre normas y la columna de
 * evidencia del motor de normas.
 *
 * Es la pieza que hace real la evidencia compartida: un mismo documento puede
 * satisfacer la cláusula 7.5 de ISO 9001 y la 7.5 de ISO 14001 a la vez, y eso
 * es lo que evita mantener dos sistemas de gestión en paralelo.
 */

const TIPOS = [
  { value: "DOCUMENT", label: "Documento" },
  { value: "EVIDENCE", label: "Evidencia" },
  { value: "PROCESS", label: "Proceso" },
  { value: "RISK", label: "Riesgo" },
  { value: "INDICATOR", label: "Indicador" },
  { value: "AUDIT", label: "Auditoría" },
  { value: "CAPA", label: "CAPA" },
  { value: "RECORD", label: "Registro" },
] as const;

type Tipo = (typeof TIPOS)[number]["value"];

const TIPO_LABEL = new Map<string, string>(TIPOS.map((t) => [t.value, t.label]));

export function CoverageDialog({
  requirement,
  canEdit,
  onClose,
}: {
  requirement: { id: string; code: string; title: string; editionLabel: string } | null;
  canEdit: boolean;
  onClose: () => void;
}) {
  const { run, isPending, error } = useServerAction();
  const [links, setLinks] = useState<CoverageLink[] | null>(null);
  const [tipo, setTipo] = useState<Tipo>("DOCUMENT");
  const [query, setQuery] = useState("");
  const [candidatos, setCandidatos] = useState<{ id: string; label: string }[]>([]);
  const [seleccion, setSeleccion] = useState("");
  const [nota, setNota] = useState("");
  const [cargandoLista, setCargandoLista] = useState(false);

  const requirementId = requirement?.id ?? null;

  useEffect(() => {
    if (!requirementId) return;
    let cancelado = false;
    setLinks(null);
    listRequirementCoverage(requirementId)
      .then((rows) => !cancelado && setLinks(rows))
      .catch(() => !cancelado && setLinks([]));
    return () => {
      cancelado = true;
    };
  }, [requirementId]);

  // El buscador espera a que el usuario deje de teclear: cada pulsación
  // dispararía una consulta contra una tabla del inquilino.
  useEffect(() => {
    if (!requirementId || !canEdit) return;
    let cancelado = false;
    setCargandoLista(true);
    const timeoutId = window.setTimeout(() => {
      searchCoverageCandidates({ entityType: tipo, query: query || undefined })
        .then((rows) => {
          if (cancelado) return;
          setCandidatos(rows);
          setSeleccion((actual) => (rows.some((r) => r.id === actual) ? actual : ""));
        })
        .catch(() => !cancelado && setCandidatos([]))
        .finally(() => !cancelado && setCargandoLista(false));
    }, 300);
    return () => {
      cancelado = true;
      window.clearTimeout(timeoutId);
    };
  }, [canEdit, query, requirementId, tipo]);

  function recargar() {
    if (!requirementId) return;
    listRequirementCoverage(requirementId).then(setLinks).catch(() => setLinks([]));
  }

  if (!requirement) return null;

  const yaVinculados = new Set((links ?? []).map((l) => `${l.entityType}:${l.entityId}`));
  const disponibles = candidatos.filter((c) => !yaVinculados.has(`${tipo}:${c.id}`));

  return (
    <Modal
      open
      onClose={onClose}
      title={`${requirement.code} · cobertura del requisito`}
      width={720}
    >
      <div style={{ display: "grid", gap: 18 }}>
        <p style={{ margin: 0, fontSize: 13, color: "var(--nf-text-secondary)", lineHeight: 1.55 }}>
          <strong>{requirement.editionLabel}</strong> · {requirement.title}
        </p>

        {error && <FormError>{error}</FormError>}

        <section style={{ display: "grid", gap: 10 }}>
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>
            Elementos que lo cubren {links ? `(${links.length})` : ""}
          </h3>
          {links === null ? (
            <p style={{ fontSize: 13, color: "var(--nf-text-subtle)" }} aria-busy="true">
              Cargando…
            </p>
          ) : links.length === 0 ? (
            <EmptyState
              kind="empty"
              title="Ningún elemento cubre todavía este requisito."
              description="Vincula el documento, proceso, riesgo o evidencia con el que demuestras su cumplimiento. Un mismo elemento puede cubrir requisitos de varias normas."
            />
          ) : (
            <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 6 }}>
              {links.map((link) => (
                <li
                  key={link.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 10,
                    padding: "8px 10px",
                    border: "1px solid var(--nf-border)",
                    borderRadius: "var(--nf-radius-s)",
                    fontSize: 13,
                  }}
                >
                  <span style={{ minWidth: 0 }}>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        color: "var(--nf-text-secondary)",
                        textTransform: "uppercase",
                        letterSpacing: "0.04em",
                      }}
                    >
                      {TIPO_LABEL.get(link.entityType) ?? link.entityType}
                    </span>
                    <span style={{ display: "block", overflowWrap: "anywhere" }}>{link.label}</span>
                    {link.note && (
                      <span style={{ display: "block", fontSize: 12, color: "var(--nf-text-subtle)" }}>
                        {link.note}
                      </span>
                    )}
                  </span>
                  {canEdit && (
                    <Button
                      variant="ghost"
                      size="sm"
                      iconOnly
                      icon={Trash2}
                      aria-label={`Desvincular ${link.label}`}
                      disabled={isPending}
                      onClick={() =>
                        run(() => unlinkRequirementCoverage(link.id), {
                          onSuccess: recargar,
                          successMessage: "Vínculo eliminado.",
                        })
                      }
                    />
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        {canEdit && (
          <section
            style={{
              display: "grid",
              gap: 12,
              paddingTop: 14,
              borderTop: "1px solid var(--nf-border)",
            }}
          >
            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>Vincular un elemento</h3>
            <FormGrid columns={2}>
              <SelectField
                label="Tipo de elemento"
                value={tipo}
                onChange={(event) => {
                  setTipo(event.target.value as Tipo);
                  setSeleccion("");
                }}
              >
                {TIPOS.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </SelectField>
              <TextField
                label="Buscar por nombre"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Parte del título…"
              />
              <SelectField
                label="Elemento"
                span="full"
                value={seleccion}
                onChange={(event) => setSeleccion(event.target.value)}
                hint={
                  cargandoLista
                    ? "Buscando…"
                    : disponibles.length === 0
                      ? "No hay elementos de este tipo sin vincular. Prueba otro tipo o afina la búsqueda."
                      : `${disponibles.length} disponibles`
                }
              >
                <option value="">Selecciona un elemento…</option>
                {disponibles.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </SelectField>
              <TextField
                label="Nota"
                optional
                span="full"
                value={nota}
                onChange={(event) => setNota(event.target.value)}
                placeholder="Cómo demuestra el cumplimiento"
                maxLength={2000}
              />
            </FormGrid>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <Button
                icon={Link2}
                disabled={isPending || !seleccion}
                onClick={() =>
                  run(
                    () =>
                      linkRequirementCoverage({
                        requirementId: requirement.id,
                        entityType: tipo,
                        entityId: seleccion,
                        note: nota || undefined,
                      }),
                    {
                      onSuccess: () => {
                        setSeleccion("");
                        setNota("");
                        recargar();
                      },
                      successMessage: "Elemento vinculado al requisito.",
                    },
                  )
                }
              >
                Vincular
              </Button>
            </div>
          </section>
        )}

        {!canEdit && (
          <p style={{ margin: 0, fontSize: 12, color: "var(--nf-text-subtle)", display: "flex", alignItems: "center", gap: 6 }}>
            <Search size={13} aria-hidden />
            Solo lectura: hace falta el permiso de activación de normas para vincular elementos.
          </p>
        )}
      </div>
    </Modal>
  );
}
