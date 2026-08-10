"use client";

import { Children, cloneElement, isValidElement, useMemo, useState, type ReactNode } from "react";
import { Archive, ArchiveRestore, ArrowRight, Check, Download, Info, Pencil, Search, Table2, Trash2, X, type LucideIcon } from "lucide-react";

function textContent(node: ReactNode): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textContent).join(" ");
  if (isValidElement(node)) {
    return textContent((node.props as { children?: ReactNode }).children);
  }
  return "";
}

/** Etiquetas de estado que llegan del dominio como enums. Mantener la
 * traducción en la tabla evita exponer códigos internos en los cinco módulos. */
const TABLE_ENUM_LABEL: Record<string, string> = {
  ACTIVE: "Activo", INACTIVE: "Inactivo", ARCHIVED: "Archivado", DRAFT: "Borrador",
  PENDING: "Pendiente", PLANNED: "Planificado", SUBMITTED: "Enviado", IN_PROGRESS: "En curso",
  UNDER_REVIEW: "En revisión", HUMAN_REVIEW: "Revisión humana", APPROVED: "Aprobado", REJECTED: "Rechazado",
  ACCEPTED: "Aceptado", CLOSED: "Cerrado", CANCELLED: "Cancelado", IDENTIFIED: "Identificado",
  IMPLEMENTED: "Implementado", CALCULATED: "Calculado", VERIFIED: "Verificado", PASSED: "Superado",
  FAILED: "No superado", NOT_EVALUATED: "Sin evaluar", NOT_ASSESSED: "Sin evaluar",
  PASS: "Conforme", FAIL: "No conforme", CONDITIONAL: "Condicional",
  LOW: "Baja", MEDIUM: "Media", MODERATE: "Moderada", HIGH: "Alta", CRITICAL: "Crítica",
  MAJOR: "Mayor", MINOR: "Menor", SERIOUS: "Grave", DEATH: "Fallecimiento",
  ELECTRICITY: "Electricidad", NATURAL_GAS: "Gas natural", HUMAN_IN_THE_LOOP: "Humano en el ciclo",
  HUMAN_ON_THE_LOOP: "Humano supervisando", HUMAN_IN_COMMAND: "Humano al mando", FULLY_AUTOMATED: "Totalmente automatizado",
  LINEAR: "Lineal", PRODUCTION: "Producción", INTERNAL: "Interno", EXTERNAL: "Externo",
};

function localizeTableText(node: ReactNode): ReactNode {
  if (typeof node === "string") return TABLE_ENUM_LABEL[node.trim()] ?? node;
  if (Array.isArray(node)) return node.map(localizeTableText);
  if (!isValidElement(node)) return node;
  const props = node.props as { children?: ReactNode };
  if (props.children == null) return node;
  return cloneElement(node, undefined, Children.map(props.children, localizeTableText));
}

type Props = {
  headers: string[];
  children: ReactNode;
  title?: string;
  description?: string;
  icon?: LucideIcon;
  placeholder?: string;
  actions?: ReactNode;
  filters?: ReactNode;
  searchable?: boolean;
  hideHeading?: boolean;
  exportable?: boolean;
  exportName?: string;
};

function csvCell(value: string) {
  return `"${value.replace(/"/g, '""').replace(/\r?\n/g, " ")}"`;
}

function rowCells(row: ReactNode) {
  if (!isValidElement(row) || row.type !== "tr") return null;
  const cells = Children.toArray((row.props as { children?: ReactNode }).children);
  return cells.map((cell) => textContent(cell));
}

function isEmptyStateRow(row: ReactNode) {
  if (!isValidElement(row) || row.type !== "tr") return false;
  const cells = Children.toArray((row.props as { children?: ReactNode }).children);
  if (cells.length !== 1 || !isValidElement(cells[0]) || cells[0].type !== "td") return false;
  return Boolean((cells[0].props as { colSpan?: number }).colSpan);
}

function tableActionIcon(label: string): LucideIcon | null {
  const normalized = label.toLocaleLowerCase();
  if (normalized.includes("editar") || normalized.includes("modificar")) return Pencil;
  if (normalized.includes("eliminar") || normalized.includes("purgar")) return Trash2;
  if (normalized.includes("archivar")) return Archive;
  if (normalized.includes("activar") || normalized.includes("restaurar")) return ArchiveRestore;
  if (normalized.includes("aprobar") || normalized.includes("verificar") || normalized.includes("aceptar") || normalized.includes("cumplido")) return Check;
  if (normalized.includes("cancelar") || normalized.includes("rechazar") || normalized.includes("cerrar")) return X;
  if (normalized.includes("siguiente") || normalized.includes("avanzar") || normalized.includes("resolver") || normalized.includes("investigar") || normalized.includes("implementar") || normalized.includes("publicar")) return ArrowRight;
  return null;
}

/**
 * Las tablas ISO se alimentan desde módulos distintos. Normalizar aquí sus
 * botones evita que cada módulo invente tamaños, tooltips o alineaciones.
 */
function decorateTableActions(node: ReactNode): ReactNode {
  if (!isValidElement(node)) return node;
  const props = node.props as { children?: ReactNode; className?: string; title?: string };
  if (node.type === "button") {
    const label = textContent(props.children).trim() || "Acción";
    const children = Children.toArray(props.children);
    const hasVisualChild = children.some(isValidElement);
    const Icon = hasVisualChild ? null : tableActionIcon(label);
    return cloneElement(node, {
      className: [props.className, "nf-table-action"].filter(Boolean).join(" "),
      title: props.title ?? label,
      children: Icon ? [<Icon key="nf-table-action-icon" size={14} aria-hidden />, ...children] : props.children,
    });
  }
  if (props.children == null) return node;
  return cloneElement(node, undefined, Children.map(props.children, decorateTableActions));
}

function inferHeading(headers: string[]) {
  const label = headers.find((header) => header && !["Código", "#", "Acciones", "Acción"].includes(header));
  return label ? `Registro de ${label.toLocaleLowerCase()}` : "Registros";
}

function inferDescription(headers: string[]) {
  const signature = headers.join(" ").toLocaleLowerCase();
  if (signature.includes("ciclo de vida") && signature.includes("impacto")) {
    return "Relaciona actividades, condiciones operativas e impactos ambientales para evaluar su significancia y controles.";
  }
  if (signature.includes("obligación") && signature.includes("fuente") && (signature.includes("últ. resultado") || signature.includes("próx. revisión"))) {
    return "Registra requisitos legales aplicables, su fuente normativa, resultado de evaluación y próxima revisión.";
  }
  if (signature.includes("residuo") || signature.includes("clasificación")) {
    return "Controla los flujos de residuos, su clasificación, cantidades, gestor y disposición final.";
  }
  if (signature.includes("ecosistema") || signature.includes("especie/hábitat")) {
    return "Documenta sitios, ecosistemas, especies o hábitats y el seguimiento de los impactos sobre la biodiversidad.";
  }
  if (signature.includes("simulacro") || signature.includes("escenario")) {
    return "Gestiona escenarios de emergencia, responsables, simulacros realizados y próximas actividades de preparación.";
  }
  if (signature.includes("fuente") && signature.includes("emisión")) {
    return "Define las fuentes y usos de energía, sus unidades, factores de emisión, costes y estado operativo.";
  }
  if (signature.includes("enpi") || signature.includes("desviación")) {
    return "Consulta indicadores de desempeño, valores de referencia, desviaciones y estado de seguimiento energético.";
  }
  if (signature.includes("dispositivo") || signature.includes("familia")) {
    return "Controla dispositivos médicos, familias, estado, documentación asociada y acciones de seguimiento.";
  }
  if (signature.includes("producto") && signature.includes("categoría")) {
    return "Administra productos alimentarios, categorías, alérgenos y vida útil para mantener el catálogo actualizado.";
  }
  if (signature.includes("materia prima")) {
    return "Registra materias primas, proveedores y alérgenos asociados para asegurar el control de insumos.";
  }
  if (signature.includes("flujo") && signature.includes("etapa")) {
    return "Documenta el flujo del proceso, sus etapas, secuencia, parámetros críticos y estado de aprobación.";
  }
  if (signature.includes("peligro") || signature.includes("severidad")) {
    return "Identifica y evalúa peligros, niveles de riesgo, decisiones de control, responsables y estado de aprobación.";
  }
  if (signature.includes("pcc") || signature.includes("límite crítico")) {
    return "Define puntos críticos de control, límites aceptables, monitoreo y acciones ante desviaciones.";
  }
  if (signature.includes("lote") || signature.includes("trazabilidad")) {
    return "Mantiene la trazabilidad de lotes, movimientos, liberaciones y registros necesarios para investigar productos o procesos.";
  }
  if (signature.includes("queja") || signature.includes("evento adverso") || signature.includes("vigilancia")) {
    return "Registra la vigilancia poscomercialización, quejas o eventos, con su evaluación, seguimiento y decisiones de seguridad.";
  }
  if (signature.includes("validación") || signature.includes("verificación") || signature.includes("calibración")) {
    return "Documenta verificaciones, validaciones, resultados, responsables y evidencias para demostrar la conformidad del proceso.";
  }
  if (signature.includes("epp") || signature.includes("accidente") || signature.includes("incidente de trabajo")) {
    return "Gestiona controles de seguridad y salud, responsables, evidencias, incidentes y acciones de prevención asociadas.";
  }
  if (signature.includes("dataset") || signature.includes("conjunto de datos") || signature.includes("linaje")) {
    return "Documenta conjuntos de datos, procedencia, clasificación, calidad, derechos de uso y trazabilidad de transformaciones.";
  }
  if (signature.includes("modelo") || signature.includes("sistema de ia") || signature.includes("algoritmo")) {
    return "Mantiene el inventario y evaluación de sistemas o modelos de IA, incluyendo propósito, supervisión humana y estado operativo.";
  }
  if (signature.includes("evaluación de impacto") || signature.includes("impacto ia")) {
    return "Consolida la evaluación de impactos en derechos, seguridad, privacidad, sesgos, transparencia y supervisión humana.";
  }
  if (signature.includes("denuncia") || signature.includes("canal ético") || signature.includes("conflicto de interés")) {
    return "Gestiona declaraciones y casos protegidos de compliance, preservando la trazabilidad, confidencialidad y decisiones de tratamiento.";
  }
  if (signature.includes("parte interesada") || signature.includes("contexto") || signature.includes("objetivo integrado")) {
    return "Centraliza elementos del sistema integrado: partes interesadas, objetivos, responsables, seguimiento y acciones relacionadas.";
  }
  if (signature.includes("servicio") && signature.includes("criticidad")) {
    return "Mantiene el catálogo de servicios, su criticidad, estado operativo y responsables de gestión.";
  }
  if (signature.includes("sla") || signature.includes("ola")) {
    return "Gestiona acuerdos de servicio, objetivos comprometidos, responsables y cumplimiento de los niveles acordados.";
  }
  if (signature.includes("riesgo") && signature.includes("acept")) {
    return "Evalúa riesgos, controles, nivel residual, decisión de aceptación y seguimiento de las medidas definidas.";
  }
  if (signature.includes("sistema") && signature.includes("propósito")) {
    return "Inventaría sistemas de inteligencia artificial, sus casos de uso, propósito, clasificación y estado operativo.";
  }
  if (signature.includes("obligación") || signature.includes("jurisdicción")) {
    return "Consulta obligaciones, jurisdicciones, responsables, aplicabilidad y evidencias relacionadas con compliance.";
  }
  if (signature.includes("auditoría") || signature.includes("hallazgo")) {
    return "Da seguimiento a auditorías, hallazgos, responsables, fechas y acciones de tratamiento.";
  }
  if (signature.includes("bia") || signature.includes("mtpd") || signature.includes("rto")) {
    return "Analiza actividades críticas, objetivos de recuperación, prioridades y resultados de continuidad de negocio.";
  }
  return "Consulta y gestiona los registros de esta sección, incluyendo sus responsables, estado y acciones relacionadas.";
}

function inferEmptyState(headers: string[]) {
  const signature = headers.join(" ").toLocaleLowerCase();
  if (signature.includes("medidor")) return "Sin medidores registrados.";
  if (signature.includes("lectura")) return "Sin lecturas registradas.";
  if (signature.includes("objetivo")) return "Sin objetivos registrados.";
  if (signature.includes("fuente") && signature.includes("energía")) return "Sin fuentes de energía registradas.";
  if (signature.includes("residuo") || signature.includes("clasificación")) return "Sin flujos de residuos registrados.";
  if (signature.includes("obligación")) return "Sin obligaciones registradas.";
  if (signature.includes("aspecto") || signature.includes("impacto")) return "Sin aspectos ambientales registrados.";
  if (signature.includes("producto") && signature.includes("categoría")) return "Sin productos registrados.";
  if (signature.includes("materia prima")) return "Sin materias primas registradas.";
  if (signature.includes("peligro")) return "Sin peligros registrados.";
  if (signature.includes("servicio")) return "Sin servicios registrados.";
  if (signature.includes("dispositivo")) return "Sin dispositivos médicos registrados.";
  if (signature.includes("riesgo")) return "Sin riesgos registrados.";
  if (signature.includes("auditoría") || signature.includes("hallazgo")) return "Sin auditorías registradas.";
  return "No hay registros en esta tabla.";
}

/** Tabla ISO con búsqueda local y una cabecera de herramientas consistente. */
export default function IsoTableCard({
  headers,
  children,
  title,
  description,
  icon: Icon = Table2,
  placeholder = "Buscar en esta tabla…",
  actions,
  filters,
  searchable = true,
  hideHeading = false,
  exportable = true,
  exportName = "registros-iso",
}: Props) {
  const [query, setQuery] = useState("");
  // Ordenación y paginación: la tabla ISO no tenía ninguna de las dos y
  // renderizaba todas las filas de golpe.
  const [sort, setSort] = useState<{ index: number; dir: "asc" | "desc" } | null>(null);
  const [page, setPage] = useState(0);
  const tableChildren = useMemo(() => Children.toArray(children), [children]);
  const suppliedHead = tableChildren.find((child) => isValidElement(child) && child.type === "thead");
  const suppliedBody = tableChildren.find((child) => isValidElement(child) && child.type === "tbody");
  const rows = useMemo(() => {
    if (isValidElement(suppliedBody)) return Children.toArray((suppliedBody.props as { children?: ReactNode }).children);
    return tableChildren;
  }, [suppliedBody, tableChildren]);
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const visibleRows = normalizedQuery
    ? rows.filter((row) => textContent(row).toLocaleLowerCase().includes(normalizedQuery))
    : rows;
  const emptyStateRow = visibleRows.find(isEmptyStateRow);
  const dataRows = visibleRows.filter((row) => !isEmptyStateRow(row));
  const sortedRows = useMemo(() => {
    if (!sort) return dataRows;
    const factor = sort.dir === "asc" ? 1 : -1;
    return [...dataRows].sort((a, b) => {
      const va = rowCells(a)?.[sort.index] ?? "";
      const vb = rowCells(b)?.[sort.index] ?? "";
      // `numeric` ordena "REG-2" antes que "REG-10"; los vacíos van al final.
      if (!va && !vb) return 0;
      if (!va) return 1;
      if (!vb) return -1;
      return va.localeCompare(vb, undefined, { numeric: true, sensitivity: "base" }) * factor;
    });
  }, [dataRows, sort]);

  const pageSize = 25;
  const totalPages = Math.max(1, Math.ceil(sortedRows.length / pageSize));
  const safePage = Math.min(page, totalPages - 1);
  const pagedRows = sortedRows.length > pageSize
    ? sortedRows.slice(safePage * pageSize, safePage * pageSize + pageSize)
    : sortedRows;

  const emptyStateText = emptyStateRow ? textContent(emptyStateRow) : "";
  const resolvedEmptyStateText = emptyStateText || (!normalizedQuery && dataRows.length === 0 ? inferEmptyState(headers) : "");
  const heading = title ?? inferHeading(headers);
  const headingDescription = description ?? inferDescription(headers);

  function downloadCsv() {
    const csvRows = dataRows.map(rowCells).filter((row): row is string[] => Boolean(row));
    const csv = [headers, ...csvRows].map((row) => row.map(csvCell).join(",")).join("\r\n");
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${exportName}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  const exportControl = exportable && <button type="button" className="nf-app-btn-ghost nf-app-btn-sm nf-iso-table-export" onClick={downloadCsv} title="Descargar la vista actual en CSV">
    <Download size={14} aria-hidden /> CSV
  </button>;
  const searchControl = searchable && <label className="nf-iso-table-search">
    <Search size={15} aria-hidden />
    <span className="nf-sr-only">Buscar en la tabla</span>
    <input
      className="nf-app-input nf-app-input--toolbar"
      value={query}
      onChange={(event) => setQuery(event.target.value)}
      placeholder={placeholder}
    />
    {query && (
      <button type="button" className="nf-iso-table-search-clear" onClick={() => setQuery("")} aria-label="Limpiar búsqueda">
        <X size={14} aria-hidden />
      </button>
    )}
  </label>;

  return (
    <section className="nf-iso-table-card">
      {!hideHeading && <div className="nf-iso-table-card-toolbar">
        <div className="nf-iso-table-card-heading">
            <div className="nf-iso-table-card-title-row">
              <span className="nf-iso-table-card-mark" aria-hidden="true">
                <Icon size={16} strokeWidth={1.9} />
              </span>
              <h3>{heading}</h3>
              <span className="nf-iso-table-card-info" tabIndex={0} aria-label="Ver descripción">
                <Info size={13} strokeWidth={2} aria-hidden="true" />
                <span className="nf-iso-table-card-tooltip" role="tooltip">{headingDescription}</span>
              </span>
            </div>
          </div>
        <div className="nf-iso-table-card-tools">
          {actions}
          {exportControl}
          {searchControl}
        </div>
      </div>}
      {hideHeading && (filters || actions || exportControl || searchControl) && <div className="nf-iso-table-card-filters nf-iso-table-card-filters--inline-tools">
        {exportControl}
        {actions}
        {filters}
        {searchControl}
      </div>}
      {!hideHeading && filters && <div className="nf-iso-table-card-filters">{filters}</div>}
      <div className="nf-iso-table-scroll">
        <table className="nf-data-table nf-iso-data-table">
          {isValidElement(suppliedHead) ? suppliedHead : (
            <thead>
              <tr>
                {headers.map((header, index) => {
                  const active = sort?.index === index;
                  // La columna de acciones no se ordena.
                  const sortable = header.trim() !== "" && !/^acciones$/i.test(header.trim());
                  return (
                    <th
                      key={header || index}
                      scope="col"
                      aria-sort={active ? (sort!.dir === "asc" ? "ascending" : "descending") : sortable ? "none" : undefined}
                    >
                      {sortable ? (
                        <button
                          type="button"
                          className="nf-iso-th-sort"
                          onClick={() => setSort((current) =>
                            current?.index !== index
                              ? { index, dir: "asc" }
                              : current.dir === "asc"
                                ? { index, dir: "desc" }
                                : null,
                          )}
                        >
                          {header}
                          <span aria-hidden>{active ? (sort!.dir === "asc" ? "\u2191" : "\u2193") : "\u21C5"}</span>
                        </button>
                      ) : header}
                    </th>
                  );
                })}
              </tr>
            </thead>
          )}
          <tbody>{pagedRows.map((row) => decorateTableActions(localizeTableText(row)))}</tbody>
        </table>
        {resolvedEmptyStateText && <div className="nf-iso-table-empty-state">{resolvedEmptyStateText}</div>}
      </div>
      {sortedRows.length > pageSize && (
        <nav className="nf-iso-table-pagination" aria-label="Paginación">
          <span className="nf-tabular">
            {safePage * pageSize + 1}–{Math.min((safePage + 1) * pageSize, sortedRows.length)} de {sortedRows.length}
          </span>
          <span className="nf-iso-table-pagination-controls">
            <button type="button" className="nf-app-btn-outline nf-app-btn-sm" disabled={safePage === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>Anterior</button>
            <button type="button" className="nf-app-btn-outline nf-app-btn-sm" disabled={safePage >= totalPages - 1} onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}>Siguiente</button>
          </span>
        </nav>
      )}
      {normalizedQuery && dataRows.length === 0 && !emptyStateText && <div className="nf-iso-table-filter-empty">No hay registros que coincidan con “{query}”.</div>}
    </section>
  );
}
