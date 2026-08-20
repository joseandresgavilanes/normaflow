"use client";
import { useState } from "react";
import { CalendarRange, FileDown, FileStack, Sparkles } from "lucide-react";
import Card from "@/components/ui/Card";
import SectionTitle from "@/components/ui/SectionTitle";
import { useWorkspace } from "@/context/WorkspaceStore";
import { useDemoPermission } from "@/hooks/useDemoPermission";
import { AUDIT_ACTIONS, createAuditEvent } from "@/lib/domain/audit-event";
import { downloadReportExport, exportReport, getReportExportStatus } from "@/lib/actions/reporting";
import type { ReportFilters } from "@/lib/reporting-contract";
import type { ReportingPayload } from "@/lib/server-queries";
import { formatDateTime } from "@/lib/format/datetime";
import Picker from "@/components/ui/Picker";
import DateField from "@/components/ui/DateField";

const REPORTS = [
  { id: "gap", title: "Informe GAP Assessment", desc: "Brechas, score y estado por cláusula ISO.", accent: "var(--nf-primary)", formats: ["PDF", "EXCEL"] },
  { id: "documents", title: "Matriz documental", desc: "Documentos, versiones, responsables y estado.", accent: "var(--nf-success)", formats: ["PDF", "EXCEL"] },
  { id: "risks", title: "Matriz de riesgos", desc: "Probabilidad, impacto, tratamiento y vencimientos.", accent: "var(--nf-danger)", formats: ["PDF", "EXCEL"] },
  { id: "audit-program", title: "Programa anual de auditorías", desc: "Auditorías planificadas por proceso y norma.", accent: "var(--nf-primary-active)", formats: ["PDF", "EXCEL"] },
  { id: "audit", title: "Informe de auditoría interna", desc: "Auditorías, checklist, hallazgos e informe.", accent: "var(--nf-primary)", formats: ["PDF", "EXCEL"] },
  { id: "capa", title: "Matriz de NC y CAPA", desc: "No conformidades, etapas, responsables y eficacia.", accent: "var(--nf-danger)", formats: ["PDF", "EXCEL"] },
  { id: "actions", title: "Plan de acción", desc: "Acciones derivadas, prioridades y avances.", accent: "var(--nf-warning)", formats: ["PDF", "EXCEL"] },
  { id: "indicators", title: "Matriz de indicadores / KPIs", desc: "Objetivos, tendencia reciente y estado.", accent: "var(--nf-success)", formats: ["PDF", "EXCEL"] },
  { id: "evidence", title: "Índice de evidencias", desc: "Evidencias, responsables, vigencia y cláusulas.", accent: "var(--nf-primary-active)", formats: ["PDF", "EXCEL"] },
  { id: "management-review", title: "Acta de revisión por la dirección", desc: "Entradas, decisiones, acciones y conclusiones.", accent: "var(--nf-primary)", formats: ["PDF"] },
  { id: "audit-package", title: "Paquete completo de auditoría", desc: "Compendio GAP, documentos, riesgos, auditoría, CAPA, KPIs y evidencias.", accent: "var(--nf-info-text)", formats: ["PDF", "EXCEL"] },
  // ISO 14001 — Gestión ambiental
  { id: "env-aspects-impacts", title: "Matriz de aspectos e impactos", desc: "Aspectos ambientales, impactos y valoración de significancia.", accent: "var(--nf-primary-active)", formats: ["PDF", "EXCEL"] },
  { id: "env-compliance-evaluation", title: "Evaluación del cumplimiento legal", desc: "Obligaciones legales ambientales y su evaluación.", accent: "var(--nf-primary-active)", formats: ["PDF", "EXCEL"] },
  { id: "env-biodiversity", title: "Biodiversidad", desc: "Sitios, ecosistemas, áreas protegidas y cadencia de monitoreo.", accent: "var(--nf-primary-active)", formats: ["PDF", "EXCEL"] },
  { id: "env-audit-package", title: "Paquete ambiental completo", desc: "Compendio ISO 14001: aspectos, legal, objetivos, residuos, emergencias y biodiversidad.", accent: "var(--nf-primary-active)", formats: ["PDF", "EXCEL"] },
  // ISO 45001 — Seguridad y salud en el trabajo
  { id: "safety-hazard-matrix", title: "Matriz de peligros y riesgos", desc: "Peligros identificados, valoración y controles.", accent: "var(--nf-warning)", formats: ["PDF", "EXCEL"] },
  { id: "safety-incidents", title: "Registro de incidentes", desc: "Incidentes, investigación, causas y estado.", accent: "var(--nf-warning)", formats: ["PDF", "EXCEL"] },
  { id: "safety-surveillance", title: "Vigilancia de la salud", desc: "Información médica sensible — acceso restringido a roles de gestión y auditor.", accent: "var(--nf-warning)", formats: ["PDF", "EXCEL"] },
  { id: "safety-audit-package", title: "Paquete de SST completo", desc: "Compendio ISO 45001: peligros, inspecciones, EPP, permisos e incidentes (sin datos de vigilancia de salud).", accent: "var(--nf-warning)", formats: ["PDF", "EXCEL"] },
  // Sistema Integrado de Gestión
  { id: "sig-crosswalk", title: "Matriz integrada de requisitos", desc: "Correspondencia 9001/14001/45001: equivalente, parcialmente equivalente, específico y compartible/no compartible.", accent: "var(--nf-info-text)", formats: ["PDF", "EXCEL"] },
  { id: "sig-compliance-by-standard", title: "Cumplimiento por norma", desc: "Puntaje GAP, requisitos evaluados y evidencia por cada norma activa del sistema.", accent: "var(--nf-info-text)", formats: ["PDF", "EXCEL"] },
  { id: "sig-common-requirements", title: "Requisitos comunes", desc: "Solo los requisitos equivalentes o parcialmente equivalentes — lo que no hay que duplicar.", accent: "var(--nf-success)", formats: ["PDF", "EXCEL"] },
  { id: "sig-scope-policy", title: "Alcance y política integrados", desc: "Alcance, exclusiones, límites y política del sistema integrado.", accent: "var(--nf-info-text)", formats: ["PDF"] },
  { id: "sig-shared-elements", title: "Elementos compartidos", desc: "Documentos y evidencias que cubren varias normas sin duplicarse.", accent: "var(--nf-success)", formats: ["PDF", "EXCEL"] },
  { id: "sig-integrated-audit", title: "Auditoría integrada", desc: "Auditorías multi-norma con hallazgos y normas afectadas.", accent: "var(--nf-info-text)", formats: ["PDF", "EXCEL"] },
  { id: "sig-integrated-capa", title: "CAPA integrada", desc: "Acciones correctivas comunes a varias normas.", accent: "var(--nf-danger)", formats: ["PDF", "EXCEL"] },
  { id: "sig-management-review", title: "Revisión por la dirección integrada", desc: "Revisiones que cubren todas las normas del sistema.", accent: "var(--nf-primary)", formats: ["PDF", "EXCEL"] },
  { id: "sig-system-package", title: "Paquete completo del sistema integrado", desc: "Alcance, política, partes interesadas, objetivos, matriz, cumplimiento por norma, requisitos comunes, auditoría y CAPA.", accent: "var(--nf-info-text)", formats: ["PDF", "EXCEL"] },
  // ISO 22301 — Continuidad del negocio
  { id: "bcm-bia", title: "Análisis de Impacto en el Negocio", desc: "BIA con alcance, metodología, versión y aprobación.", accent: "var(--nf-info)", formats: ["PDF", "EXCEL"] },
  { id: "bcm-critical-processes", title: "Procesos críticos priorizados", desc: "Actividades críticas con impacto por categoría y criticidad.", accent: "var(--nf-info)", formats: ["PDF", "EXCEL"] },
  { id: "bcm-rto-rpo", title: "Matriz MTPD / RTO / RPO", desc: "Objetivos de recuperación y validación RTO ≤ MTPD.", accent: "var(--nf-info)", formats: ["PDF", "EXCEL"] },
  { id: "bcm-dependencies", title: "Dependencias y recursos", desc: "Personas, instalaciones, tecnología, proveedores, datos y recursos alternos.", accent: "var(--nf-info)", formats: ["PDF", "EXCEL"] },
  { id: "bcm-priority-products", title: "Priorización de productos y servicios", desc: "Productos/servicios prioritarios con MTPD, RTO, ingresos y clientes afectados.", accent: "var(--nf-info)", formats: ["PDF", "EXCEL"] },
  { id: "bcm-strategies", title: "Estrategias de continuidad", desc: "Estrategias, capacidad de recuperación, coste y aprobación.", accent: "var(--nf-info)", formats: ["PDF", "EXCEL"] },
  { id: "bcm-plans", title: "Planes de continuidad", desc: "Planes con versión, aprobación, activación y nivel mínimo.", accent: "var(--nf-info)", formats: ["PDF", "EXCEL"] },
  { id: "bcm-plan-versions", title: "Historial de versiones de planes", desc: "Versionado y aprobación de cada plan de continuidad.", accent: "var(--nf-info)", formats: ["PDF", "EXCEL"] },
  { id: "bcm-crisis-teams", title: "Equipos de crisis y contactos", desc: "Composición, líder, suplente, regla de activación y cascada de contactos.", accent: "var(--nf-info)", formats: ["PDF", "EXCEL"] },
  { id: "bcm-activations", title: "Activaciones e interrupciones reales", desc: "Historial de activación de planes, resultado y lecciones aprendidas.", accent: "var(--nf-danger)", formats: ["PDF", "EXCEL"] },
  { id: "bcm-exercises", title: "Simulacros y resultados", desc: "Ejercicios, objetivos, RTO/RPO logrado y acciones de mejora.", accent: "var(--nf-info)", formats: ["PDF", "EXCEL"] },
  { id: "bcm-gaps", title: "Brechas de continuidad", desc: "Actividades sin estrategia, procedimiento, objetivos o con SPOF.", accent: "var(--nf-danger)", formats: ["PDF", "EXCEL"] },
  { id: "bcm-audit-package", title: "Auditoría de continuidad", desc: "Paquete completo ISO 22301: BIA, procesos, RTO/RPO, productos prioritarios, dependencias, estrategias, planes, versiones, equipos de crisis, activaciones, simulacros y brechas.", accent: "var(--nf-info)", formats: ["PDF", "EXCEL"] },
  // ISO/IEC 42001 — Gestión de inteligencia artificial
  { id: "ai-inventory", title: "Inventario de sistemas de IA", desc: "Sistemas con propietario, propósito, criticidad, clasificación y salvaguardas.", accent: "var(--nf-info-text)", formats: ["PDF", "EXCEL"] },
  { id: "ai-impact-assessment", title: "Evaluación de impacto de IA", desc: "Derechos, seguridad, privacidad, sesgo, transparencia, explicabilidad y supervisión.", accent: "var(--nf-info-text)", formats: ["PDF", "EXCEL"] },
  { id: "ai-risks", title: "Riesgos de IA", desc: "Riesgo inherente y residual, tratamiento y aceptación documentada.", accent: "var(--nf-danger)", formats: ["PDF", "EXCEL"] },
  { id: "ai-datasets", title: "Datasets, procedencia y sesgo", desc: "Fuentes, licencias, linaje, calidad de datos, sesgo y privacidad.", accent: "var(--nf-info-text)", formats: ["PDF", "EXCEL"] },
  { id: "ai-models", title: "Modelos y evaluaciones", desc: "Versiones, etapa, desempeño, equidad, robustez y explicabilidad.", accent: "var(--nf-info-text)", formats: ["PDF", "EXCEL"] },
  { id: "ai-controls", title: "Controles de supervisión humana", desc: "Quién supervisa, si puede anular o detener y su eficacia verificada.", accent: "var(--nf-success)", formats: ["PDF", "EXCEL"] },
  { id: "ai-incidents", title: "Incidentes de IA", desc: "Tipo, afectados, causa raíz, notificación y cierre.", accent: "var(--nf-danger)", formats: ["PDF", "EXCEL"] },
  { id: "ai-transparency", title: "Transparencia de IA", desc: "Qué se informa, a quién, por qué canal y desde cuándo.", accent: "var(--nf-info-text)", formats: ["PDF", "EXCEL"] },
  { id: "ai-human-review", title: "Revisión humana de salidas de IA", desc: "Prompt, modelo, versión, salida, usuario, aprobación, fecha y cambios humanos.", accent: "var(--nf-info-text)", formats: ["PDF", "EXCEL"] },
  { id: "ai-audit-package", title: "Auditoría de IA (ISO/IEC 42001)", desc: "Paquete completo: inventario, impacto, riesgos, datos, modelos, controles, transparencia, incidentes y revisión humana.", accent: "var(--nf-info-text)", formats: ["PDF", "EXCEL"] },
  // ISO 37301 — Gestión de compliance
  { id: "compliance-obligations", title: "Obligaciones de compliance", desc: "Registro con jurisdicción, fuente, aplicabilidad, responsable y estado de cumplimiento.", accent: "var(--nf-danger-text)", formats: ["PDF", "EXCEL"] },
  { id: "compliance-risks", title: "Riesgos de compliance", desc: "Riesgo inherente y residual, controles, aceptabilidad y exposición a sanción.", accent: "var(--nf-danger)", formats: ["PDF", "EXCEL"] },
  { id: "compliance-evaluations", title: "Evaluaciones de cumplimiento", desc: "Resultado por obligación, periodo, revisor y decisión humana.", accent: "var(--nf-danger-text)", formats: ["PDF", "EXCEL"] },
  { id: "compliance-calendar", title: "Calendario de obligaciones", desc: "Vencimientos, recurrencia, alertas, retrasos y evidencia de presentación.", accent: "var(--nf-warning)", formats: ["PDF", "EXCEL"] },
  { id: "compliance-speak-up", title: "Canal de denuncias (agregado)", desc: "Volúmenes por categoría, modo y estado. Sin identidades ni relatos.", accent: "var(--nf-danger-text)", formats: ["PDF", "EXCEL"] },
  { id: "compliance-investigations", title: "Investigaciones", desc: "Estado, independencia, conflictos y plazos. Sin datos del informante.", accent: "var(--nf-danger-text)", formats: ["PDF", "EXCEL"] },
  { id: "compliance-breaches", title: "Incumplimientos", desc: "Severidad, causa raíz, notificación a la autoridad y exposición.", accent: "var(--nf-danger)", formats: ["PDF", "EXCEL"] },
  { id: "compliance-remediation", title: "Planes de remediación", desc: "Avance, aprobación y verificación de eficacia por un tercero interno.", accent: "var(--nf-success)", formats: ["PDF", "EXCEL"] },
  { id: "compliance-management-review", title: "Revisión de dirección (compliance)", desc: "Digest al órgano de gobierno: obligaciones, riesgos, canal agregado, incumplimientos y escalaciones.", accent: "var(--nf-danger-text)", formats: ["PDF", "EXCEL"] },
  { id: "compliance-audit-package", title: "Paquete de auditoría de compliance", desc: "Las nueve secciones de compliance combinadas en un solo export, listo para una auditoría de certificación.", accent: "var(--nf-danger-text)", formats: ["PDF", "EXCEL"] },
  { id: "abms-risk-map", title: "Mapa de riesgo de soborno", desc: "Evaluaciones con factores de país, sector, funcionario público y residual.", accent: "var(--nf-danger-text)", formats: ["PDF", "EXCEL"] },
  { id: "abms-third-parties", title: "Socios de negocio", desc: "Terceros con riesgo, screening, PEPs y conteo de UBO / debida diligencia.", accent: "var(--nf-danger-text)", formats: ["PDF", "EXCEL"] },
  { id: "abms-due-diligence", title: "Debidas diligencias", desc: "Expedientes DRAFT→APPROVED/REJECTED→PERIODIC_REVIEW con screening y decisión.", accent: "var(--nf-danger-text)", formats: ["PDF", "EXCEL"] },
  { id: "abms-beneficial-owners", title: "Beneficiarios finales", desc: "UBO por socio, porcentaje, control y condición PEP (acceso sensible).", accent: "var(--nf-danger)", formats: ["PDF", "EXCEL"] },
  { id: "abms-gifts", title: "Regalos y hospitalidad", desc: "Registros con umbral, funcionario público y decisión de compliance.", accent: "var(--nf-danger-text)", formats: ["PDF", "EXCEL"] },
  { id: "abms-donations", title: "Donaciones y patrocinios", desc: "Donaciones, patrocinios y contribuciones políticas con estado.", accent: "var(--nf-danger-text)", formats: ["PDF", "EXCEL"] },
  { id: "abms-conflicts", title: "Conflictos antisoborno", desc: "Declaraciones ABMS (naturaleza, abstención, revisión).", accent: "var(--nf-danger-text)", formats: ["PDF", "EXCEL"] },
  { id: "abms-high-risk-ops", title: "Operaciones de alto riesgo", desc: "Aprobaciones de transacciones sensibles con segregación solicitante/aprobador.", accent: "var(--nf-danger)", formats: ["PDF", "EXCEL"] },
  { id: "abms-controls", title: "Controles antisoborno", desc: "Pruebas financieras y no financieras: diseño, operación y excepciones.", accent: "var(--nf-danger-text)", formats: ["PDF", "EXCEL"] },
  { id: "abms-investigations", title: "Investigaciones de soborno", desc: "Puentes a Investigation del SGC con tipología, denuncia y remediación.", accent: "var(--nf-danger-text)", formats: ["PDF", "EXCEL"] },
  { id: "abms-audit-package", title: "Auditoría antisoborno (ISO 37001)", desc: "Paquete: riesgo, terceros, debida diligencia, regalos, donaciones, conflictos, alto riesgo, controles e investigaciones. No incluye beneficiarios finales (antibribery-sensitive, exportable por separado).", accent: "var(--nf-danger-text)", formats: ["PDF", "EXCEL"] },
  { id: "enms-energy-review", title: "Revisión energética", desc: "Revisiones con periodo, alcance, estado y SEU asociados.", accent: "var(--nf-warning)", formats: ["PDF", "EXCEL"] },
  { id: "enms-significant-uses", title: "Usos significativos de energía", desc: "SEU con participación, potencial de mejora y justificación.", accent: "var(--nf-warning)", formats: ["PDF", "EXCEL"] },
  { id: "enms-baseline", title: "Línea base energética", desc: "Baselines versionados con método de normalización.", accent: "var(--nf-warning)", formats: ["PDF", "EXCEL"] },
  { id: "enms-enpi", title: "EnPI", desc: "Indicadores con fórmula, versión, valor actual, meta y desviación.", accent: "var(--nf-warning)", formats: ["PDF", "EXCEL"] },
  { id: "enms-consumption", title: "Consumos energéticos", desc: "Lecturas de medidores con coste y emisiones asociadas.", accent: "var(--nf-warning)", formats: ["PDF", "EXCEL"] },
  { id: "enms-opportunities", title: "Oportunidades energéticas", desc: "Ahorro estimado, coste, payback y estado.", accent: "var(--nf-warning)", formats: ["PDF", "EXCEL"] },
  { id: "enms-actions", title: "Planes de acción energética", desc: "Avance, vencimiento y vínculo a CAPA cuando aplica.", accent: "var(--nf-warning)", formats: ["PDF", "EXCEL"] },
  { id: "enms-savings", title: "Verificación de ahorros", desc: "Ahorro absoluto/normalizado, coste y emisiones evitadas.", accent: "var(--nf-success)", formats: ["PDF", "EXCEL"] },
  { id: "enms-audit-package", title: "Auditoría energética (ISO 50001)", desc: "Paquete: revisión, SEU, línea base, EnPI, consumos, oportunidades, acciones y ahorros.", accent: "var(--nf-warning)", formats: ["PDF", "EXCEL"] },
  { id: "fsms-hazard-analysis", title: "Análisis de peligros", desc: "Evaluaciones HACCP con severidad, probabilidad, significancia y decisión PRP/OPRP/PCC.", accent: "var(--nf-info-text)", formats: ["PDF", "EXCEL"] },
  { id: "fsms-prp", title: "Programas de prerrequisitos (PRP)", desc: "PRP por categoría con frecuencia y evidencias.", accent: "var(--nf-info-text)", formats: ["PDF", "EXCEL"] },
  { id: "fsms-oprp", title: "PRP operativos (OPRP)", desc: "OPRP vinculados a evaluación, paso y monitoreo.", accent: "var(--nf-info-text)", formats: ["PDF", "EXCEL"] },
  { id: "fsms-ccp", title: "Puntos de control crítico (PCC)", desc: "PCC con límites críticos y justificación.", accent: "var(--nf-info-text)", formats: ["PDF", "EXCEL"] },
  { id: "fsms-monitoring", title: "Monitoreo CCP/OPRP", desc: "Registros de monitoreo y cumplimiento de límites.", accent: "var(--nf-info-text)", formats: ["PDF", "EXCEL"] },
  { id: "fsms-deviations", title: "Desviaciones de inocuidad", desc: "Desviaciones, retención de producto, lotes y correcciones.", accent: "var(--nf-danger)", formats: ["PDF", "EXCEL"] },
  { id: "fsms-traceability", title: "Trazabilidad", desc: "Lotes con proveedor, previos, cliente/distribución y nodos adelante/atrás.", accent: "var(--nf-info-text)", formats: ["PDF", "EXCEL"] },
  { id: "fsms-recalls", title: "Retiros / recalls", desc: "Retiros con lotes afectados, notificaciones y estado.", accent: "var(--nf-danger)", formats: ["PDF", "EXCEL"] },
  { id: "fsms-allergens", title: "Alérgenos", desc: "Catálogo de alérgenos y presencia en productos/materias primas.", accent: "var(--nf-info-text)", formats: ["PDF", "EXCEL"] },
  { id: "fsms-audit-package", title: "Auditoría de inocuidad (ISO 22000)", desc: "Paquete: peligros, PRP, OPRP, PCC, monitoreo, desviaciones, trazabilidad, retiros y alérgenos.", accent: "var(--nf-info-text)", formats: ["PDF", "EXCEL"] },
  { id: "itsm-sla", title: "SLA de servicio", desc: "Acuerdos de nivel de servicio con tiempos de respuesta/resolución y disponibilidad objetivo.", accent: "var(--nf-primary-active)", formats: ["PDF", "EXCEL"] },
  { id: "itsm-incidents", title: "Incidentes de servicio (ITSM)", desc: "Incidentes ITSM con prioridad, estado, CI y cumplimiento de SLA (distintos de seguridad).", accent: "var(--nf-primary-active)", formats: ["PDF", "EXCEL"] },
  { id: "itsm-problems", title: "Problemas y errores conocidos", desc: "Problemas con causa raíz, workaround e incidentes asociados.", accent: "var(--nf-primary-active)", formats: ["PDF", "EXCEL"] },
  { id: "itsm-changes", title: "Cambios ITSM", desc: "Cambios de servicio con tipo, riesgo, aprobación e implementación.", accent: "var(--nf-primary-active)", formats: ["PDF", "EXCEL"] },
  { id: "itsm-availability", title: "Disponibilidad del servicio", desc: "Planes de disponibilidad con objetivo y disponibilidad real.", accent: "var(--nf-primary-active)", formats: ["PDF", "EXCEL"] },
  { id: "itsm-capacity", title: "Capacidad del servicio", desc: "Planes de capacidad con métrica, actual, pronóstico y umbral.", accent: "var(--nf-primary-active)", formats: ["PDF", "EXCEL"] },
  { id: "itsm-continuity", title: "Continuidad del servicio", desc: "Planes de continuidad de servicio (RTO/RPO), distintos del BCP corporativo.", accent: "var(--nf-primary-active)", formats: ["PDF", "EXCEL"] },
  { id: "itsm-suppliers", title: "Proveedores de servicio", desc: "Proveedores ITSM con criticidad, contrato y estado de revisión.", accent: "var(--nf-primary-active)", formats: ["PDF", "EXCEL"] },
  { id: "itsm-service-performance", title: "Desempeño del servicio", desc: "Vista por servicio: SLA, incidentes abiertos, MTTR y disponibilidad.", accent: "var(--nf-success)", formats: ["PDF", "EXCEL"] },
  { id: "itsm-audit-package", title: "Auditoría de servicios TI (ISO 20000)", desc: "Paquete: SLA, incidentes, problemas, cambios, disponibilidad, capacidad, continuidad y proveedores.", accent: "var(--nf-primary-active)", formats: ["PDF", "EXCEL"] },
  { id: "md-design-history", title: "Historial de diseño (DHF)", desc: "Expedientes DHF con conteo de inputs, outputs, revisiones, verificación y validación.", accent: "var(--nf-info)", formats: ["PDF", "EXCEL"] },
  { id: "md-master-record", title: "Expediente maestro (DMR)", desc: "Registros maestros de dispositivo versionados y estado de aprobación.", accent: "var(--nf-info)", formats: ["PDF", "EXCEL"] },
  { id: "md-risks", title: "Riesgos de dispositivo", desc: "Archivos de riesgo con metodología, residual y estado.", accent: "var(--nf-info)", formats: ["PDF", "EXCEL"] },
  { id: "md-validations", title: "Validaciones", desc: "Proceso, esterilización, verificación y validación de diseño.", accent: "var(--nf-info)", formats: ["PDF", "EXCEL"] },
  { id: "md-suppliers", title: "Proveedores críticos", desc: "Proveedores críticos y estado de cualificación.", accent: "var(--nf-info)", formats: ["PDF", "EXCEL"] },
  { id: "md-batches", title: "Lotes de producción", desc: "Lotes con cantidad, fechas, estado y trazas asociadas.", accent: "var(--nf-info)", formats: ["PDF", "EXCEL"] },
  { id: "md-complaints", title: "Quejas de producto", desc: "Quejas con referencia opaca de sujeto (sin PII clínica).", accent: "var(--nf-danger)", formats: ["PDF", "EXCEL"] },
  { id: "md-surveillance", title: "Vigilancia post-comercialización", desc: "Planes PMS por dispositivo y periodo (acceso sensible).", accent: "var(--nf-danger)", formats: ["PDF", "EXCEL"] },
  { id: "md-events", title: "Eventos adversos", desc: "Eventos adversos con severidad y reportabilidad (acceso sensible).", accent: "var(--nf-danger)", formats: ["PDF", "EXCEL"] },
  { id: "md-recalls", title: "Retiros y acciones de campo", desc: "ProductRecall y FieldSafetyAction con lotes afectados (acceso sensible).", accent: "var(--nf-danger)", formats: ["PDF", "EXCEL"] },
  { id: "md-audit-package", title: "Auditoría dispositivos médicos (ISO 13485)", desc: "Paquete: DHF, DMR, riesgos, validaciones, proveedores y lotes. No incluye quejas/PMS/eventos/retiros (md-sensitive, exportables por separado). No sustituye requisitos regulatorios nacionales.", accent: "var(--nf-info)", formats: ["PDF", "EXCEL"] },
];

function today() { return new Date().toISOString().slice(0, 10); }
function yearStart() { return `${new Date().getUTCFullYear()}-01-01`; }

export default function ReportingModule({ liveData }: { liveData?: ReportingPayload }) {
  const { state, dispatch, showToast } = useWorkspace();
  const perm = useDemoPermission();
  const [from, setFrom] = useState(yearStart);
  const [to, setTo] = useState(today);
  const [standardCode, setStandardCode] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const live = liveData !== undefined;

  if (!live && !perm.reporting.use) {
    return (
      <Card style={{ padding: 32, textAlign: "center" }}>
        <p className="nf-app-help" style={{ margin: 0, fontWeight: 600 }}>
          Su rol no incluye acceso a informes. Solicite permiso a administración.
        </p>
      </Card>
    );
  }

  function download(url: string, fileName: string) {
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName;
    anchor.click();
  }

  async function waitForArtifact(id: string) {
    for (let attempt = 0; attempt < 60; attempt += 1) {
      const status = await getReportExportStatus(id);
      if (status.status === "COMPLETED") {
        const artifact = await downloadReportExport(id);
        download(artifact.url, artifact.fileName);
        return artifact;
      }
      if (status.status === "FAILED") throw new Error(status.error ?? "El worker no pudo generar el informe.");
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    throw new Error("El informe sigue en cola. Puedes descargarlo desde el historial cuando termine.");
  }

  function runExport(reportId: string, title: string, format: "PDF" | "EXCEL") {
    if (live) {
      setBusy(`${reportId}-${format}`);
      const filters: ReportFilters = { from, to, standardCode: standardCode || undefined, status: status || undefined };
      void exportReport({ reportId, title, format, filters }).then(async result => {
        if (result.status === "COMPLETED") {
          const artifact = await downloadReportExport(result.id);
          download(artifact.url, artifact.fileName);
          showToast(`Informe descargado · ${artifact.rowCount} filas`);
          return;
        }
        showToast("Informe en cola. Se descargará cuando finalice el worker.");
        const artifact = await waitForArtifact(result.id);
        showToast(`Informe descargado · ${artifact.rowCount} filas`);
      }).catch(error => showToast(error instanceof Error ? error.message : "No se pudo generar el informe")).finally(() => setBusy(null));
      return;
    }
    setBusy(reportId);
    setTimeout(() => {
      dispatch({
        type: "appendAudit",
        event: createAuditEvent({
          ts: new Date().toISOString(),
          actorName: state.session.name,
          actorEmail: state.session.email,
          action: AUDIT_ACTIONS.REPORT_EXPORTED,
          entityType: "REPORT",
          entityId: reportId,
          entityLabel: title,
          reason: `Rango ${from} — ${to} · Norma ${standardCode || "todas"} · Estado ${status || "todos"} · Exportación demo (${format})`,
        }),
      });
      showToast(`Generado: ${title} (${format}, demo)`);
      setBusy(null);
    }, 900);
  }

  return (
    <div>
      <SectionTitle title="Informes y paquetes de auditoría" sub="Exportaciones trazables · listas para comité o auditor externo" />

      <div className="nf-kpi-summary" style={{ marginBottom: 18 }}>
        <div className="nf-kpi-summary-cell">
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: "var(--nf-app-accent-soft)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--nf-primary-active)",
            }}
          >
            <FileStack size={22} strokeWidth={2.25} aria-hidden />
          </div>
          <div>
            <div style={{ fontSize: 26, fontWeight: 600, color: "var(--nf-primary-active)", letterSpacing: "-0.03em", lineHeight: 1 }}>{REPORTS.length}</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--nf-ink-3)", marginTop: 2 }}>Plantillas de informe</div>
          </div>
        </div>
        <div className="nf-kpi-summary-cell">
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: "var(--nf-success-subtle)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--nf-success-text)",
            }}
          >
            <CalendarRange size={22} strokeWidth={2.25} aria-hidden />
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: "var(--nf-ink)", letterSpacing: "-0.02em", lineHeight: 1.2 }}>{from}</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--nf-ink-3)", marginTop: 4 }}>Fecha desde</div>
          </div>
        </div>
        <div className="nf-kpi-summary-cell">
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: "var(--nf-warning-subtle)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--nf-warning-text)",
            }}
          >
            <CalendarRange size={22} strokeWidth={2.25} aria-hidden />
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: "var(--nf-ink)", letterSpacing: "-0.02em", lineHeight: 1.2 }}>{to}</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--nf-ink-3)", marginTop: 4 }}>Fecha hasta</div>
          </div>
        </div>
        <div className="nf-kpi-summary-cell">
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: "var(--nf-surface-selected)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--nf-primary-active)",
            }}
          >
            <Sparkles size={22} strokeWidth={2.25} aria-hidden />
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, color: "var(--nf-ink-2)", letterSpacing: "-0.02em", lineHeight: 1.2 }}>PDF / XLSX</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--nf-ink-3)", marginTop: 2 }}>{live ? "Exportación real" : "Modo demo"}</div>
          </div>
        </div>
      </div>

      <Card style={{ marginBottom: 22, padding: "18px 20px" }}>
        <div className="nf-grid-2" style={{ gap: 16, alignItems: "flex-end" }}>
          <label style={{ display: "block" }}>
            <span className="nf-filter-label" style={{ display: "block", marginBottom: 8 }}>
              Desde
            </span>
            <DateField className="nf-app-input" value={from} onChange={e => setFrom(e.target.value)} style={{ width: "100%", boxSizing: "border-box" }} />
          </label>
          {live && <label style={{ display: "block" }}><span className="nf-filter-label" style={{ display: "block", marginBottom: 8 }}>Norma</span><Picker aria-label="Norma" className="nf-app-input" value={standardCode} onChange={e => setStandardCode(e.target.value)} style={{ width: "100%", boxSizing: "border-box" }}><option value="">Todas las normas</option>{liveData.standards.map(item => <option key={item.standard.code} value={item.standard.code}>{item.standard.code} · {item.standard.name}</option>)}</Picker></label>}
          {live && <label style={{ display: "block" }}><span className="nf-filter-label" style={{ display: "block", marginBottom: 8 }}>Estado</span><Picker aria-label="Estado" className="nf-app-input" value={status} onChange={e => setStatus(e.target.value)} style={{ width: "100%", boxSizing: "border-box" }}><option value="">Todos los estados</option><option value="COMPLETED">Completado</option><option value="IN_PROGRESS">En curso</option><option value="PENDING">Pendiente</option><option value="OPEN">Abierto</option><option value="APPROVED">Aprobado</option></Picker></label>}
          <label style={{ display: "block" }}>
            <span className="nf-filter-label" style={{ display: "block", marginBottom: 8 }}>
              Hasta
            </span>
            <DateField className="nf-app-input" value={to} onChange={e => setTo(e.target.value)} style={{ width: "100%", boxSizing: "border-box" }} />
          </label>
        </div>
        <p className="nf-app-help" style={{ margin: "14px 0 0", lineHeight: 1.55 }}>
          {live ? "Cada exportación consulta datos del tenant, descarga el archivo y registra quién la generó en la trazabilidad." : "Las descargas se simulan únicamente en el espacio demo."}
        </p>
      </Card>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 280px), 1fr))", gap: 16 }}>
        {REPORTS.map(r => (
          <Card key={r.id} style={{ padding: 0, overflow: "hidden", borderRadius: 14, border: "1px solid var(--nf-line)", boxShadow: "none" }}>
            
            <div style={{ padding: "16px 18px 18px" }}>
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 10,
                  background: `${r.accent}18`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: r.accent,
                  marginBottom: 12,
                }}
              >
                <FileDown size={20} strokeWidth={2.25} aria-hidden />
              </div>
              <h3 style={{ margin: "0 0 8px", fontSize: 16, fontWeight: 600, color: "var(--nf-ink)", letterSpacing: "-0.02em", lineHeight: 1.25 }}>{r.title}</h3>
              <p className="nf-app-help" style={{ margin: "0 0 16px", lineHeight: 1.5 }}>
                {r.desc}
              </p>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {live && !liveData.canExport ? <span className="nf-app-help">Sin permiso de exportación</span> : <button
                  type="button"
                  disabled={!!busy}
                  onClick={() => runExport(r.id, r.title, "PDF")}
                  style={{
                    padding: "9px 14px",
                    borderRadius: 10,
                    border: "none",
                    background: "var(--nf-app-accent)",
                    color: "var(--nf-text-on-primary)",
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: busy ? "wait" : "pointer",
                    opacity: busy ? 0.7 : 1,
                    boxShadow: "0 1px 2px rgba(15, 50, 85, 0.2)",
                  }}
                >
                  {busy === `${r.id}-PDF` || busy === r.id ? "Generando…" : "Exportar PDF"}
                </button>}
                {r.formats.includes("EXCEL") && <button type="button" disabled={!!busy || (live && !liveData.canExport)} className="nf-app-btn-outline" onClick={() => runExport(r.id, r.title, "EXCEL")}>XLSX</button>}
              </div>
            </div>
          </Card>
        ))}
      </div>

      {live && <div style={{ marginTop: 26 }}>
        <h3 style={{ fontSize: 16, marginBottom: 12, fontWeight: 600, color: "var(--nf-ink)", letterSpacing: "-0.02em" }}>Historial de exportaciones</h3>
        <Card style={{ padding: 0, overflow: "hidden" }} className="nf-export-history">
          {liveData.exports.length ? liveData.exports.map((item, index) => (
            <div
              key={item.id}
              className="nf-export-history-row"
              style={{
                padding: "12px 16px",
                borderBottom: index < liveData.exports.length - 1 ? "1px solid var(--nf-line)" : "none",
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
                flexWrap: "wrap",
                alignItems: "center",
              }}
            >
              <div style={{ minWidth: 0 }}>
                <strong style={{ display: "block", color: "var(--nf-ink)", fontWeight: 700, fontSize: 14, wordBreak: "break-all" }}>{item.fileName}</strong>
                <div className="nf-app-help" style={{ marginTop: 4, color: "var(--nf-ink-2)" }}>{item.generatedBy} · {formatDateTime(item.createdAt)}</div>
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}><span className="nf-chip nf-chip--on">{item.format} · {item.rowCount} filas · {item.status}</span>{item.hasContent && <button type="button" className="nf-app-btn-ghost nf-app-btn-sm" onClick={() => { setBusy(`download-${item.id}`); void downloadReportExport(item.id).then(result => download(result.url, result.fileName)).catch(error => showToast(error instanceof Error ? error.message : "No se pudo descargar el informe")).finally(() => setBusy(null)); }}>{busy === `download-${item.id}` ? "Descargando…" : "Descargar"}</button>}</div>
              {item.status === "FAILED" && item.error && <p style={{ margin: 0, color: "var(--nf-danger)", fontSize: 12 }}>Error: {item.error}</p>}
            </div>
          )) : <p className="nf-app-help" style={{ padding: 18, margin: 0, color: "var(--nf-ink-2)" }}>Todavía no se generaron informes.</p>}
        </Card>
      </div>}
    </div>
  );
}
