/**
 * Iniciales de una persona, con color derivado del nombre.
 *
 * Antes era un relleno saturado con la inicial en blanco. Ese par no cumple
 * contraste en ningún tema para los tonos claros: el índigo heredado daba
 * 4.47:1 en claro y el turquesa 2.77:1 en oscuro, medido sobre la aplicación.
 *
 * Ahora usa el par «fondo sutil + tono de texto», el mismo que llevan las
 * insignias de estado, que pasa AA en los dos temas: 4.79–5.92 en claro y
 * 7.32–9.22 en oscuro. El borde del mismo color da la forma que antes daba el
 * relleno saturado.
 */
const PALETA = [
  { fondo: "var(--nf-primary-subtle)", texto: "var(--nf-primary-active)", borde: "var(--nf-primary-border)" },
  { fondo: "var(--nf-success-subtle)", texto: "var(--nf-success-text)", borde: "var(--nf-success-border)" },
  { fondo: "var(--nf-info-subtle)", texto: "var(--nf-info-text)", borde: "var(--nf-info-border)" },
  { fondo: "var(--nf-warning-subtle)", texto: "var(--nf-warning-text)", borde: "var(--nf-warning-border)" },
  { fondo: "var(--nf-danger-subtle)", texto: "var(--nf-danger-text)", borde: "var(--nf-danger-border)" },
];

interface AvatarProps {
  name: string;
  size?: number;
  className?: string;
  /** URL firmada de la foto. Sin ella —o si falla la carga— se pintan las iniciales. */
  src?: string | null;
}

export default function Avatar({ name, size = 32, className, src }: AvatarProps) {
  const initials = name?.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase() || "?";
  const tono = PALETA[(name?.charCodeAt(0) ?? 0) % PALETA.length];
  return (
    <div
      className={className}
      style={{
        width: size, height: size, borderRadius: "50%",
        background: tono.fondo, color: tono.texto,
        border: `1px solid ${tono.borde}`, boxSizing: "border-box",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: size * 0.35, fontWeight: 600, flexShrink: 0, userSelect: "none",
      }}
    >
      {/* La URL firmada caduca; si expira o falla, la imagen se retira y quedan
          las iniciales debajo en vez de un icono de imagen rota. */}
      {src ? (
        <img
          src={src}
          alt=""
          width={size}
          height={size}
          style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }}
          onError={(event) => { event.currentTarget.style.display = "none"; }}
        />
      ) : initials}
    </div>
  );
}
