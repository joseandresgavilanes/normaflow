/** Relative z-index within #nf-modal-root (portal is at Z_INDEX.modalPortal). */
let depth = 0;

export function pushModalLayer(): number {
  depth += 1;
  return depth;
}

export function popModalLayer(): void {
  depth = Math.max(0, depth - 1);
}

export function modalLayerDepth(): number {
  return depth;
}
