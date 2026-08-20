import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import InfoTip from "@/components/ui/InfoTip";

type IsoSectionHeaderProps = {
  icon: LucideIcon;
  title: ReactNode;
  description?: string;
  action?: ReactNode;
  /**
   * Nivel del encabezado. Cuando este componente encabeza la PÁGINA debe ser 1:
   * seis módulos normativos no declaraban ningún `<h1>` porque aquí siempre se
   * pintaba un `<h2>`, así que su jerarquía de documento empezaba en el nivel 2.
   */
  headingLevel?: 1 | 2 | 3;
};

export default function IsoSectionHeader({ icon: Icon, title, description, action, headingLevel = 2 }: IsoSectionHeaderProps) {
  const Heading = `h${headingLevel}` as "h1" | "h2" | "h3";

  return (
    <header className="nf-iso-subsection-header">
      <div className="nf-iso-subsection-heading">
        <span className="nf-iso-subsection-mark" aria-hidden="true">
          <Icon size={16} strokeWidth={1.9} />
        </span>
        <div className="nf-iso-subsection-copy">
          <Heading className="nf-iso-subsection-title">{title}</Heading>
        </div>
        {/* La descripción ya vivía tras un icono, pero era un `span` con
            `:hover` en CSS: sin teclado, sin toque y recortado por el primer
            contenedor con overflow. `InfoTip` es el mismo gesto bien hecho. */}
        {description && <InfoTip text={description} label={typeof title === "string" ? title : undefined} />}
      </div>
      {action && <div className="nf-iso-subsection-action">{action}</div>}
    </header>
  );
}
