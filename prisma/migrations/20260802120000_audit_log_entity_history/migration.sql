-- Historial por entidad: la página de detalle consulta audit_logs por
-- (organizationId, module, recordId) ordenado por fecha. Sin índice es un
-- recorrido secuencial sobre la tabla que más crece del sistema.
--
-- CONCURRENTLY para no bloquear escrituras: audit_logs recibe inserciones de
-- los webhooks de Stripe y de cada mutación del producto.
CREATE INDEX IF NOT EXISTS "audit_logs_org_module_record_created_idx"
  ON "audit_logs" ("organizationId", "module", "recordId", "createdAt");

CREATE INDEX IF NOT EXISTS "audit_logs_org_created_idx"
  ON "audit_logs" ("organizationId", "createdAt");
