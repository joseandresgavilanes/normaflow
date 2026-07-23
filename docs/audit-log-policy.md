# NormaFlow AuditLog

Cada mutación de negocio que cambie el estado de un recurso debe escribir su evento en `audit_logs` dentro de la misma transacción que la mutación. El registro incluye organización, actor, acción, módulo, identificador del recurso, snapshots `before`/`after`, IP, user-agent y fecha UTC cuando están disponibles.

`audit_logs` es append-only en producción: la migración `20260723160000_p1_report_workers_billing_audit` instala un trigger PostgreSQL que rechaza `UPDATE` y `DELETE`. Las aplicaciones no deben ofrecer acciones ordinarias para editar o borrar eventos. Los exportes de auditoría deben estar sujetos a los permisos de actividad/exportación y a las mismas reglas de tenant.

La retención operativa debe configurarse por entorno y respaldarse con backup/retención de la base de datos. Este trail aporta trazabilidad técnica y operativa; no equivale automáticamente a una firma electrónica cualificada, sello de tiempo certificado ni evidencia legal certificada. Para esos usos se requiere un proveedor y un procedimiento legal/compliance específico.
