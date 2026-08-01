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
    items: [
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
    ],
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
