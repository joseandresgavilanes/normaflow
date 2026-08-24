-- El offboarding de un tenant (docs/data-governance.md) borra la organización y
-- deja que la cascada se lleve sus filas, audit_logs incluido. El trigger
-- instalado en 20260723160000_p1_report_workers_billing_audit rechazaba ese
-- DELETE sin excepción posible, así que la ruta documentada ("the AuditLog is
-- append-only during operation but is removed with the org on hard-delete") no
-- se podía ejecutar en ningún entorno.
--
-- Ahora el DELETE pasa solo si la sesión declara el propósito con
--   SET LOCAL normaflow.audit_log_purge = 'on';
-- que únicamente hace scripts/org-offboarding.ts dentro de su transacción de
-- borrado. El UPDATE sigue prohibido siempre, sin excepción.
--
-- El escape no afecta al tráfico de la aplicación: el rol `authenticated` está
-- bloqueado por las políticas RESTRICTIVE nf_audit_logs_mutation_block y
-- nf_audit_logs_delete_block, que son independientes de este trigger. El flag
-- solo abre la puerta al rol dueño de la tabla, que es el que usan los scripts.
--
-- Rollback: reinstalar la función tal cual está en
-- 20260723160000_p1_report_workers_billing_audit/migration.sql (copia literal
-- de la definición vigente antes de esta migración en
-- backups/ddl/audit_logs_append_only_pre_2026-08-24.sql, que no se versiona).

CREATE OR REPLACE FUNCTION public.nf_audit_log_append_only()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' AND current_setting('normaflow.audit_log_purge', true) = 'on' THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'audit_logs is append-only; UPDATE and DELETE are prohibited';
END;
$$;
