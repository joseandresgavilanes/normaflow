"use client";

import Link from "next/link";
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { Loader2, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Botón único del producto.
 *
 * Sustituye a diez sistemas paralelos (`nf-app-btn-*` ×8 más los ad-hoc
 * `nf-table-action`, `nf-icon-btn`, `nf-topbar-icon-btn`, `nf-acpm-*-btn`),
 * cada uno con su propia geometría, sus propios estados y su propio criterio
 * de foco.
 *
 * Reglas que aplica:
 *  · Una sola acción `primary` por pantalla.
 *  · Lo destructivo usa `danger` y se separa visualmente de la acción primaria.
 *  · En carga se deshabilita y lo anuncia con `aria-busy`; el ancho no cambia,
 *    para que el botón no salte bajo el cursor.
 *  · Un botón de solo icono EXIGE `aria-label`: en TypeScript, no en una
 *    convención que nadie revisa.
 */

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "success";
export type ButtonSize = "sm" | "md";

type CommonProps = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: LucideIcon;
  iconRight?: LucideIcon;
  /** Ocupa todo el ancho disponible (útil en móvil y en pies de modal). */
  block?: boolean;
  className?: string;
  children?: ReactNode;
};

/** Un botón de solo icono no tiene texto, así que el nombre accesible es obligatorio. */
type IconOnlyProps =
  | { iconOnly: true; "aria-label": string; children?: never }
  | { iconOnly?: false };

type ButtonAsButton = CommonProps &
  IconOnlyProps &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className" | "children"> & { href?: never };

type ButtonAsLink = CommonProps &
  IconOnlyProps & {
    href: string;
    /** Enlace externo: abre en pestaña nueva con rel de seguridad. */
    external?: boolean;
    onClick?: () => void;
    disabled?: never;
    type?: never;
  };

export type ButtonProps = ButtonAsButton | ButtonAsLink;

function classes({
  variant = "primary",
  size = "md",
  block,
  iconOnly,
  className,
}: CommonProps & { iconOnly?: boolean }) {
  return cn(
    "nf-button",
    `nf-button--${variant}`,
    `nf-button--${size}`,
    block && "nf-button--block",
    iconOnly && "nf-button--icon",
    className,
  );
}

const Button = forwardRef<HTMLButtonElement | HTMLAnchorElement, ButtonProps>(function Button(
  props,
  ref,
) {
  const {
    variant = "primary",
    size = "md",
    loading = false,
    icon: Icon,
    iconRight: IconRight,
    block,
    className,
    children,
    ...rest
  } = props as CommonProps & Record<string, unknown>;

  const iconOnly = Boolean((props as { iconOnly?: boolean }).iconOnly);
  const iconSize = size === "sm" ? 14 : 16;

  const content = (
    <>
      {loading ? (
        <Loader2 className="nf-button__spinner" size={iconSize} strokeWidth={2.2} aria-hidden />
      ) : (
        Icon && <Icon size={iconSize} strokeWidth={2} aria-hidden />
      )}
      {!iconOnly && children != null && <span className="nf-button__label">{children}</span>}
      {!loading && IconRight && <IconRight size={iconSize} strokeWidth={2} aria-hidden />}
    </>
  );

  const shared = {
    className: classes({ variant, size, block, iconOnly, className }),
    "data-loading": loading || undefined,
  };

  if ("href" in props && props.href) {
    const { href, external, iconOnly: _io, ...anchorRest } = rest as Record<string, unknown> & {
      href: string;
      external?: boolean;
    };
    return (
      <Link
        {...(anchorRest as Record<string, unknown>)}
        ref={ref as React.Ref<HTMLAnchorElement>}
        href={href}
        {...shared}
        {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      >
        {content}
      </Link>
    );
  }

  const { iconOnly: _iconOnly, ...buttonRest } = rest as Record<string, unknown>;
  const disabled = Boolean((props as ButtonAsButton).disabled) || loading;

  return (
    <button
      {...(buttonRest as ButtonHTMLAttributes<HTMLButtonElement>)}
      ref={ref as React.Ref<HTMLButtonElement>}
      type={(props as ButtonAsButton).type ?? "button"}
      disabled={disabled}
      aria-busy={loading || undefined}
      {...shared}
    >
      {content}
    </button>
  );
});

export default Button;

/**
 * Grupo de acciones. Separa la acción destructiva del resto para que no quede
 * pegada a la primaria.
 */
export function ButtonGroup({
  children,
  align = "end",
  className,
}: {
  children: ReactNode;
  align?: "start" | "end" | "between";
  className?: string;
}) {
  return <div className={cn("nf-button-group", `nf-button-group--${align}`, className)}>{children}</div>;
}
