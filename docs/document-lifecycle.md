# Lifecycle de documentos controlados

1. **Borrador:** se crea el registro y las versiones permanecen `DRAFT`.
2. **Nueva versión:** se valida extensión, MIME, firma binaria y cuota antes de subir a Storage bajo `org-{tenant}/documents/{documento}`.
3. **Revisión:** la versión objetivo pasa a `PENDING`; se crean aprobaciones asignadas y el documento pasa a `IN_REVIEW` dentro de la misma transacción.
4. **Aprobación:** cada aprobador asignado decide una vez. Solo se publica cuando no queda ninguna aprobación pendiente ni rechazada. La versión objetivo queda `APPROVED` y el documento actualiza su versión vigente.
5. **Rechazo:** la versión objetivo queda `REJECTED` y el documento vuelve al estado anterior documentado.
6. **Obsolescencia/reemplazo:** nunca borra el histórico aprobado; marca el documento `OBSOLETE` y registra el vínculo de reemplazo si aplica.

Cada hito crea AuditLog: creación, carga/nueva versión, envío a revisión, aprobación, publicación, rechazo y obsolescencia.

## Consistencia Storage ↔ Prisma

La subida primero valida y escribe el objeto. La posterior transacción Prisma crea la versión, el estado de revisión y las aprobaciones. Si cualquier escritura de Prisma falla, NormaFlow borra el objeto con la ruta del tenant; si esa limpieza falla, queda detectable como huérfano.

Detecta y reconcilia por organización, siempre en dry-run primero:

```bash
npm run storage:reconcile-documents -- --org=<organizationId>
npm run storage:reconcile-documents -- --org=<organizationId> --apply
```

El modo `--apply` borra únicamente objetos bajo el prefijo explícito del tenant que no estén referenciados por `DocumentVersion`. Las referencias Prisma cuyo objeto no existe se reportan para reparación manual; nunca se elimina una fila automáticamente.
