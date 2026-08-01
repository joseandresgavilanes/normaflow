import type { LucideIcon } from "lucide-react";
import {
  Activity,
  AlertTriangle,
  Archive,
  BadgeCheck,
  BarChart3,
  Bell,
  BrainCircuit,
  Briefcase,
  Boxes,
  Bug,
  Building2,
  CalendarRange,
  ClipboardCheck,
  CreditCard,
  Cross,
  DraftingCompass,
  Factory,
  FileCheck2,
  FileText,
  FolderTree,
  Gauge,
  Gavel,
  GraduationCap,
  Handshake,
  HardHat,
  Layers,
  Leaf,
  Library,
  Lightbulb,
  LayoutDashboard,
  LockKeyhole,
  MapPin,
  Milestone,
  Paperclip,
  Plug,
  RefreshCw,
  Scale,
  ScrollText,
  Server,
  Shield,
  ShieldAlert,
  ShieldBan,
  Siren,
  Target,
  Timer,
  UserCircle,
  Users,
  UtensilsCrossed,
  Workflow,
  Zap,
  CircleOff,
} from "lucide-react";
import type { MessageKey } from "@/lib/i18n/messages";

/**
 * Arquitectura de información de la navegación privada.
 *
 * Antes: 35 enlaces planos + 11 grupos de norma con hasta 15 subitems cada uno
 * + 3 grupos de administración ≈ 180 destinos en una sola columna.
 *
 * Dos correcciones estructurales:
 *
 *  1. Los 35 enlaces planos se agrupan en 8 secciones semánticas.
 *  2. Cada norma pasa a ser UN destino. Los ~143 subitems `?section=` se
 *     eliminan porque eran enlaces muertos: ningún cliente de norma lee el
 *     parámetro (`useSearchParams` = 0 en los 11), así que todos renderizaban
 *     el panel y el sidebar resaltaba una sección que nunca se abría. La
 *     navegación intra-norma es responsabilidad de las pestañas de la página.
 */

export type NavSection = {
  /** Valor de `?section=` que consume `useModuleSection`. */
  section: string;
  label: string;
};

export type NavItem = {
  /** Ruta destino. Es también la clave de fijado. */
  href: string;
  Icon: LucideIcon;
  /** Clave del catálogo i18n. Preferente sobre `label`. */
  labelKey?: MessageKey;
  /** Literal traducido en runtime con `tx()` cuando no hay clave. */
  label?: string;
  /** Permiso requerido para mostrar el elemento. */
  permission?: string;
  /** Segmento de módulo usado por el gating de plan (`planHasModule`). */
  module?: string;
  /**
   * Secciones internas del módulo. Solo se despliegan cuando esa ruta es la
   * activa, de modo que como mucho hay un juego de secciones visible en vez de
   * los ~143 subitems que antes convivían en la misma columna.
   */
  sections?: NavSection[];
};

export type NavGroup = {
  id: string;
  labelKey: MessageKey;
  items: NavItem[];
};

/** Deriva el segmento de módulo (`/app/<módulo>/...`) usado por el plan. */
export function moduleForPath(href: string): string | null {
  return /^\/app\/([^/?]+)/.exec(href)?.[1] ?? null;
}

const s = (section: string, label: string): NavSection => ({ section, label });

/**
 * Secciones por norma. Alimentan `?section=`, que `useModuleSection` lee para
 * cambiar la vista del módulo — no son anclas decorativas.
 */
const SECTIONS: Record<string, NavSection[]> = {
  "/app/continuity": [
    s("panel", "Panel"), s("plans", "Planes"), s("bia", "BIA y actividades"),
    s("dependencies", "Dependencias y recursos"), s("strategies", "Estrategias"),
    s("crisis", "Equipos de crisis"), s("tests", "Simulacros"), s("gaps", "Brechas"),
  ],
  "/app/environment": [
    s("panel", "Panel"), s("matrix", "Aspectos e impactos"), s("compliance", "Cumplimiento legal"),
    s("objectives", "Objetivos"), s("trends", "Indicadores"), s("waste", "Residuos"),
    s("emergencies", "Emergencias"), s("biodiversity", "Biodiversidad"),
  ],
  "/app/energy": [
    s("panel", "Panel"), s("sources", "Fuentes y usos"), s("review", "Revisión energética"),
    s("seu", "Usos significativos"), s("baseline", "Línea base"), s("enpi", "EnPI"),
    s("meters", "Medidores y lecturas"), s("variables", "Variables y factores"),
    s("opportunities", "Oportunidades"), s("actions", "Acciones"), s("savings", "Ahorros"),
    s("procurement", "Compras"), s("design", "Diseño"),
  ],
  "/app/food-safety": [
    s("panel", "Panel"), s("products", "Productos y MP"), s("flows", "Flujos"),
    s("hazards", "Peligros"), s("prp", "PRP / OPRP"), s("ccp", "PCC"),
    s("monitoring", "Monitoreo"), s("deviations", "Desviaciones"),
    s("traceability", "Trazabilidad"), s("recalls", "Retiros"), s("allergens", "Alérgenos"),
    s("emergencies", "Emergencias"), s("communications", "Comunicación de cadena"),
  ],
  "/app/itsm": [
    s("panel", "Panel"), s("catalog", "Catálogo"), s("sla", "SLA / OLA"),
    s("requests", "Solicitudes"), s("incidents", "Incidentes"), s("problems", "Problemas"),
    s("changes", "Cambios / Releases"), s("cmdb", "CMDB"),
    s("availability", "Disp. / Cap. / Cont."), s("suppliers", "Proveedores"),
    s("knowledge", "Conocimiento"),
  ],
  "/app/medical-devices": [
    s("panel", "Panel"), s("devices", "Dispositivos"), s("dmr", "Expediente maestro"),
    s("design", "Diseño (DHF)"), s("risks", "Riesgos"), s("suppliers", "Proveedores"),
    s("validations", "Validaciones"), s("batches", "Lotes / traza"),
    s("vigilance", "Vigilancia"), s("regulatory", "Regulatorio"),
  ],
  "/app/safety": [
    s("panel", "Panel"), s("hazards", "Peligros y riesgos"),
    s("consultations", "Consulta trabajadores"), s("incidents", "Incidentes"),
    s("inspections", "Inspecciones"), s("ppe", "EPP"), s("permits", "Permisos"),
    s("drills", "Emergencias"), s("contractors", "Contratistas"), s("health", "Vigilancia salud"),
  ],
  "/app/aims": [
    s("panel", "Panel"), s("systems", "Inventario IA"), s("outputs", "Revisión humana"),
    s("impact", "Evaluación de impacto"), s("risks", "Riesgos"), s("datasets", "Datos"),
    s("models", "Modelos"), s("oversight", "Supervisión"), s("transparency", "Transparencia"),
    s("incidents", "Incidentes"), s("suppliers", "Proveedores"), s("changes", "Cambios"),
    s("monitoring", "Monitoreo"),
  ],
  "/app/compliance": [
    s("panel", "Panel"), s("obligations", "Obligaciones"), s("sources", "Fuentes y jurisdicciones"),
    s("risks", "Riesgos"), s("controls", "Controles"), s("evaluations", "Evaluaciones"),
    s("calendar", "Calendario"), s("changes", "Cambios regulatorios"),
    s("conflicts", "Conflictos de interés"), s("channel", "Canal de denuncias"),
    s("investigations", "Investigaciones"), s("breaches", "Incumplimientos"),
    s("remediation", "Remediación"), s("training", "Formación"), s("board", "Órgano de gobierno"),
  ],
  "/app/antibribery": [
    s("panel", "Panel"), s("risks", "Riesgo de soborno"), s("associates", "Socios de negocio"),
    s("due-diligence", "Debida diligencia"), s("owners", "Beneficiarios"), s("gifts", "Regalos"),
    s("donations", "Donaciones"), s("conflicts", "Conflictos"), s("facilitation", "Facilitación"),
    s("controls", "Controles"), s("approvals", "Aprobaciones"), s("commitments", "Compromisos"),
    s("investigations", "Investigaciones"),
  ],
  "/app/integrated": [
    s("panel", "Panel integrado"), s("scope", "Alcance y política"),
    s("parties", "Partes interesadas"), s("objectives", "Objetivos"),
    s("crosswalk", "Matriz de correspondencia"), s("audit", "Auditoría integrada"),
    s("shared", "Elementos compartidos"),
  ],
};

/** Adjunta las secciones declaradas arriba al elemento de navegación. */
function withSections(item: NavItem): NavItem {
  const sections = SECTIONS[item.href];
  return sections ? { ...item, sections } : item;
}

export const NAV_GROUPS: NavGroup[] = [
  {
    id: "home",
    labelKey: "nav.group.home",
    items: [
      { href: "/app/dashboard", Icon: LayoutDashboard, labelKey: "nav.home" },
      { href: "/app/setup", Icon: Milestone, labelKey: "nav.setup" },
      { href: "/app/notifications", Icon: Bell, labelKey: "nav.notifications" },
      { href: "/app/activity", Icon: Activity, labelKey: "nav.activity" },
    ],
  },
  {
    id: "system",
    labelKey: "nav.group.system",
    items: [
      { href: "/app/context", Icon: Users, labelKey: "nav.context" },
      { href: "/app/processes", Icon: Workflow, labelKey: "nav.processes" },
      { href: "/app/documents", Icon: FileText, labelKey: "nav.documents" },
      { href: "/app/records", Icon: Archive, labelKey: "nav.records" },
      { href: "/app/evidence", Icon: Paperclip, labelKey: "nav.evidence" },
      { href: "/app/changes", Icon: RefreshCw, labelKey: "nav.changes" },
      { href: "/app/quality-ops", Icon: Briefcase, labelKey: "nav.qualityOps" },
      { href: "/app/design-dev", Icon: FolderTree, labelKey: "nav.designDev" },
    ],
  },
  {
    id: "risk",
    labelKey: "nav.group.risk",
    items: [
      { href: "/app/risks", Icon: AlertTriangle, labelKey: "nav.risks" },
      { href: "/app/opportunities", Icon: Lightbulb, labelKey: "nav.opportunities" },
      { href: "/app/risk-treatment", Icon: ShieldAlert, labelKey: "nav.riskTreatment" },
      { href: "/app/security-controls", Icon: LockKeyhole, labelKey: "nav.securityControls" },
      { href: "/app/soa", Icon: FileCheck2, labelKey: "nav.soa" },
      { href: "/app/assets", Icon: Boxes, labelKey: "nav.assets" },
      { href: "/app/incidents", Icon: Siren, labelKey: "nav.incidents" },
      { href: "/app/vulnerabilities", Icon: Bug, labelKey: "nav.vulnerabilities" },
    ],
  },
  {
    id: "evaluation",
    labelKey: "nav.group.evaluation",
    items: [
      { href: "/app/gap", Icon: Target, labelKey: "nav.gap" },
      { href: "/app/audit-program", Icon: CalendarRange, labelKey: "nav.auditProgram" },
      { href: "/app/audits", Icon: ClipboardCheck, labelKey: "nav.audits" },
      { href: "/app/indicators", Icon: BarChart3, labelKey: "nav.indicators" },
      { href: "/app/management-review", Icon: Gavel, labelKey: "nav.managementReview" },
      { href: "/app/reporting", Icon: ScrollText, labelKey: "nav.reporting" },
    ],
  },
  {
    id: "improvement",
    labelKey: "nav.group.improvement",
    items: [
      { href: "/app/nonconformities", Icon: CircleOff, labelKey: "nav.nonconformities" },
      { href: "/app/actions", Icon: Zap, labelKey: "nav.actions" },
    ],
  },
  {
    id: "people",
    labelKey: "nav.group.people",
    items: [
      { href: "/app/info/personnel", Icon: Users, labelKey: "nav.personnel" },
      { href: "/app/info/positions", Icon: Briefcase, labelKey: "nav.positions" },
      { href: "/app/training", Icon: GraduationCap, labelKey: "nav.training" },
      { href: "/app/suppliers", Icon: Factory, labelKey: "nav.suppliers" },
      { href: "/app/suppliers/security", Icon: Handshake, labelKey: "nav.supplierSecurity" },
    ],
  },
  {
    id: "standards",
    labelKey: "nav.group.standards",
    items: ([
      { href: "/app/standards", Icon: Library, labelKey: "nav.standards" },
      { href: "/app/integrated", Icon: Layers, labelKey: "nav.integrated", permission: "integrated:read" },
      { href: "/app/environment", Icon: Leaf, labelKey: "nav.environment", permission: "environment:read" },
      { href: "/app/safety", Icon: HardHat, labelKey: "nav.safety", permission: "safety:read" },
      { href: "/app/continuity", Icon: ShieldBan, labelKey: "nav.continuity", permission: "continuity:read" },
      { href: "/app/aims", Icon: BrainCircuit, labelKey: "nav.aims", permission: "aims:read" },
      { href: "/app/compliance", Icon: Scale, labelKey: "nav.compliance", permission: "compliance:read" },
      { href: "/app/antibribery", Icon: Gavel, labelKey: "nav.antibribery", permission: "antibribery:read" },
      { href: "/app/energy", Icon: Gauge, labelKey: "nav.energy", permission: "energy:read" },
      { href: "/app/food-safety", Icon: UtensilsCrossed, labelKey: "nav.foodSafety", permission: "food-safety:read" },
      { href: "/app/itsm", Icon: Server, labelKey: "nav.itsm", permission: "itsm:read" },
      { href: "/app/medical-devices", Icon: Cross, labelKey: "nav.medicalDevices", permission: "medical-devices:read" },
    ] satisfies NavItem[]).map(withSections),
  },
  {
    id: "admin",
    labelKey: "nav.group.admin",
    items: [
      { href: "/app/settings/organization", Icon: Building2, labelKey: "nav.orgSettings" },
      { href: "/app/settings/users", Icon: Users, labelKey: "nav.usersRoles" },
      { href: "/app/settings/groups", Icon: Shield, labelKey: "nav.groupsPermissions" },
      { href: "/app/settings/catalogs", Icon: ClipboardCheck, labelKey: "nav.catalogs" },
      { href: "/app/catalogs/locations", Icon: MapPin, labelKey: "nav.locations" },
      { href: "/app/catalogs/retention", Icon: Timer, labelKey: "nav.retention" },
      { href: "/app/catalogs/disposition", Icon: Archive, labelKey: "nav.disposition" },
      { href: "/app/catalogs/archive-method", Icon: FolderTree, labelKey: "nav.archiveMethod" },
      { href: "/app/catalogs/record-type", Icon: FileText, labelKey: "nav.recordType" },
      { href: "/app/integrations", Icon: Plug, labelKey: "nav.integrations" },
      { href: "/app/billing", Icon: CreditCard, labelKey: "nav.billing" },
      { href: "/app/settings", Icon: UserCircle, labelKey: "nav.settings" },
    ],
  },
];

/**
 * Rutas visibles para el rol CONTRIBUTOR. Se conserva exactamente el conjunto
 * que ya aplicaba el sidebar anterior para no ampliar superficie por accidente.
 */
export const CONTRIBUTOR_ROUTES: ReadonlySet<string> = new Set([
  "/app/dashboard",
  "/app/documents",
  "/app/records",
  "/app/training",
  "/app/changes",
  "/app/processes",
  "/app/risks",
  "/app/opportunities",
  "/app/suppliers",
  "/app/audits",
  "/app/nonconformities",
  "/app/actions",
  "/app/indicators",
  "/app/evidence",
  "/app/notifications",
  "/app/settings",
]);

/** Índice plano href → { grupo, item } para breadcrumbs y paleta de comandos. */
export const NAV_INDEX: ReadonlyMap<string, { group: NavGroup; item: NavItem }> = new Map(
  NAV_GROUPS.flatMap((group) => group.items.map((item) => [item.href, { group, item }] as const)),
);

/** Grupo que contiene la ruta activa, para abrirlo por defecto. */
export function groupIdForPath(pathname: string): string | null {
  for (const group of NAV_GROUPS) {
    if (group.items.some((item) => isRouteActive(pathname, item.href))) return group.id;
  }
  return null;
}

/**
 * Un elemento está activo si la ruta coincide exactamente o si es un
 * ancestro real (segmento completo), para que `/app/suppliers/security` no
 * active también `/app/suppliers`.
 */
export function isRouteActive(pathname: string, href: string): boolean {
  if (pathname === href) return true;
  // `/app/suppliers` no debe activarse desde `/app/suppliers/security`:
  // solo se considera ancestro si no existe un elemento más específico.
  return pathname.startsWith(`${href}/`) && !NAV_INDEX.has(pathname);
}
