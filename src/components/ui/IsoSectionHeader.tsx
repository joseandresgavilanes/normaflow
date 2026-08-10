import { useId, type ReactNode } from "react";
import { Info, type LucideIcon } from "lucide-react";

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
  const tooltipId = useId();

  return (
    <header className="nf-iso-subsection-header">
      <div className="nf-iso-subsection-heading">
        <span className="nf-iso-subsection-mark" aria-hidden="true">
          <Icon size={16} strokeWidth={1.9} />
        </span>
        <div className="nf-iso-subsection-copy">
          <Heading className="nf-iso-subsection-title">{title}</Heading>
        </div>
        {description && (
          <span className="nf-iso-subsection-info" tabIndex={0} aria-label="Ver descripción" aria-describedby={tooltipId}>
            <Info size={14} strokeWidth={2} aria-hidden="true" />
            <span id={tooltipId} className="nf-iso-subsection-tooltip" role="tooltip">{description}</span>
          </span>
        )}
      </div>
      {action && <div className="nf-iso-subsection-action">{action}</div>}
    </header>
  );
}
