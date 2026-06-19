/**
 * App stacking order (low → high).
 * Modals always sit above sidebar, topbar and AI panel.
 */
export const Z_INDEX = {
  topbar: 50,
  sidebar: 100,
  sidebarBackdrop: 150,
  aiPanel: 900,
  /** Portal layer — entire modal stack lives here */
  modalPortal: 5000,
  modalStep: 10,
  toast: 6000,
} as const;
