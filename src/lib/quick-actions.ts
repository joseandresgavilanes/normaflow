import type { LucideIcon } from "lucide-react";
import {
  ClipboardCheck,
  CircleOff,
  FileText,
  GraduationCap,
  Paperclip,
  RefreshCw,
  Zap,
} from "lucide-react";

export type QuickCreateAction = {
  href: string;
  label: string;
  description: string;
  Icon: LucideIcon;
};

export const QUICK_CREATE_ACTIONS: QuickCreateAction[] = [
  {
    href: "/app/actions",
    label: "Plan de acción (ACPM)",
    description: "Correctiva, preventiva o mejora",
    Icon: Zap,
  },
  {
    href: "/app/nonconformities",
    label: "No conformidad",
    description: "Registrar una NC",
    Icon: CircleOff,
  },
  {
    href: "/app/audits",
    label: "Auditoría",
    description: "Programar o registrar auditoría",
    Icon: ClipboardCheck,
  },
  {
    href: "/app/changes",
    label: "Solicitud de cambio",
    description: "Control de cambios documental",
    Icon: RefreshCw,
  },
  {
    href: "/app/documents",
    label: "Documento",
    description: "Nuevo documento controlado",
    Icon: FileText,
  },
  {
    href: "/app/evidence",
    label: "Evidencia",
    description: "Subir evidencia de cumplimiento",
    Icon: Paperclip,
  },
  {
    href: "/app/training",
    label: "Asignación de capacitación",
    description: "Asignar curso a personal",
    Icon: GraduationCap,
  },
];
