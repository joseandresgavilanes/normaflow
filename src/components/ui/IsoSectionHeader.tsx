import { useId, type ReactNode } from "react";
import { Info, type LucideIcon } from "lucide-react";

type IsoSectionHeaderProps = {
  icon: LucideIcon;
  title: ReactNode;
  description?: string;
  action?: ReactNode;
};

export default function IsoSectionHeader({ icon: Icon, title, description, action }: IsoSectionHeaderProps) {
  const tooltipId = useId();

  return (
    <header className="nf-iso-subsection-header">
      <div className="nf-iso-subsection-heading">
        <span className="nf-iso-subsection-mark" aria-hidden="true">
          <Icon size={16} strokeWidth={1.9} />
        </span>
        <div className="nf-iso-subsection-copy">
          <h2 className="nf-iso-subsection-title">{title}</h2>
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
