import { useEffect, useState } from "react";

/**
 * Imagem resiliente do site público.
 *
 * - imagem PRINCIPAL (`fallback` = true, padrão): se falhar, mostra a moldura
 *   "7D" no lugar, preservando o layout;
 * - imagem SECUNDÁRIA/hover (`fallback` = false): se falhar, simplesmente não
 *   é renderizada — nunca sobrepõe a foto principal com o fallback.
 */
export function SafeImage({
  src,
  alt,
  hidden,
  className,
  fallback = true,
  width,
  height,
}: {
  src: string;
  alt: string;
  hidden?: boolean;
  className: string;
  fallback?: boolean;
  width?: number;
  height?: number;
}) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);

  if (!src || failed) {
    if (!fallback) return null;
    return (
      <div
        aria-hidden="true"
        data-testid="image-fallback"
        className="absolute inset-0 flex items-center justify-center bg-[color:var(--cream-deep)]"
      >
        <span className="font-display text-[11px] tracking-luxe uppercase text-[color:var(--forest-deep)]/35">
          7D
        </span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={hidden ? "" : alt}
      aria-hidden={hidden ? "true" : undefined}
      width={width}
      height={height}
      loading="lazy"
      decoding="async"
      draggable={false}
      onError={() => setFailed(true)}
      className={className}
    />
  );
}
