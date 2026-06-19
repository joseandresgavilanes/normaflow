/**
 * Catálogo controlado para categorías de proveedor/contratista.
 * ISO 9001 §8.4 (procesos, productos y servicios suministrados externamente)
 * exige evaluar, seleccionar, monitorizar y reevaluar proveedores;
 * clasificarlos por tipo facilita la evaluación por criticidad y auditoría.
 */

export const SUPPLIER_CATEGORIES = [
  "Materias primas / componentes",
  "Subcontratación / manufactura",
  "Servicios TI / tecnología",
  "Servicios profesionales / consultoría",
  "Logística / transporte",
  "Mantenimiento / instalaciones",
  "Calibración / ensayos / laboratorio",
  "Limpieza / facility management",
  "Recursos humanos / temporal",
  "Seguros / legal / financiero",
  "Marketing / comunicación",
  "Otros servicios",
] as const;

export type SupplierCategory = (typeof SUPPLIER_CATEGORIES)[number];

export const DEFAULT_SUPPLIER_CATEGORY: SupplierCategory = "Servicios profesionales / consultoría";

/** Incluye valor histórico al editar registros creados antes del catálogo. */
export function supplierCategoryOptions(current?: string): string[] {
  if (current && !SUPPLIER_CATEGORIES.includes(current as SupplierCategory)) {
    return [current, ...SUPPLIER_CATEGORIES];
  }
  return [...SUPPLIER_CATEGORIES];
}
