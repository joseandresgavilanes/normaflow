# Checklist de implementación — ISO/IEC 20000

Guía de onboarding para el cliente que activa `PACK_ISO_20000` en
NormaFlow, de la activación al primer ciclo de auditoría interna. No
sustituye la certificación ni el juicio del equipo de servicio; es la
lista de qué configurar en la plataforma y en qué orden.

## 1. Activación y contexto (día 1)

- [ ] Activar ISO/IEC 20000 desde `/app/standards` (requiere entitlement
      — contacta a soporte si ves un aviso de plan).
- [ ] Definir el contexto y el alcance del sistema de gestión de
      servicios de TI.
- [ ] Redactar la política de gestión de servicios.
- [ ] Asignar roles: quien aprueba cambios (`itsm:approve`), quien
      registra incidentes y solicitudes.

## 2. Portafolio y catálogo (semana 1)

- [ ] Registrar cada servicio de TI (`/app/itsm` → Catálogo): nombre,
      categoría, criticidad.
- [ ] Asignar un propietario a cada servicio.
- [ ] Publicar las entradas de catálogo solicitables por los usuarios.

## 3. SLA, OLA y CMDB (semana 1-2)

- [ ] Establecer un SLA por servicio crítico: tiempos de respuesta y
      resolución, disponibilidad objetivo.
- [ ] Definir los OLA con los equipos internos que sostienen cada SLA.
- [ ] Dar de alta los elementos de configuración (CI) y sus relaciones
      (depende de, corre sobre…) en la CMDB.

## 4. Resolución: solicitudes, incidentes, problemas (continuo desde la
   activación)

- [ ] Registrar cada solicitud de servicio con su catálogo y SLA
      asociado.
- [ ] Registrar cada incidente de servicio (`/app/itsm` → Incidentes),
      siguiendo NEW → ASSIGNED → INVESTIGATING → RESOLVED → CONFIRMED →
      CLOSED.
- [ ] Nota: un incidente de servicio nunca sustituye a un incidente de
      seguridad, de IA o laboral — si están relacionados, usar el
      vínculo cruzado en vez de mezclar el registro.
- [ ] Cuando un incidente recurrente sugiera una causa común, abrir un
      problema y documentar la causa raíz.
- [ ] Convertir el problema en error conocido con su workaround cuando
      corresponda.

## 5. Cambios, releases y despliegues

- [ ] Registrar cada cambio de servicio con su tipo (estándar, normal,
      emergencia) y nivel de riesgo.
- [ ] Exigir evaluación y aprobación antes de programar o implementar
      cualquier cambio.
- [ ] Agrupar los cambios relacionados en un release y registrar sus
      despliegues por entorno.

## 6. Aseguramiento del servicio (mensual)

- [ ] Establecer un plan de disponibilidad por servicio crítico, con
      objetivo y downtime acordado.
- [ ] Establecer un plan de capacidad con métrica, capacidad actual y
      pronóstico.
- [ ] Establecer un plan de continuidad de servicio (RTO/RPO), enlazado
      al BCP corporativo si existe.
- [ ] Revisar periódicamente a los proveedores críticos del servicio.

## 7. Conocimiento y desempeño

- [ ] Publicar artículos de conocimiento a partir de incidentes y
      errores conocidos resueltos.
- [ ] Generar el informe de desempeño del servicio periódicamente
      (SLA, MTTR, disponibilidad).

## 8. Auditoría interna y revisión por la dirección

- [ ] Planificar y ejecutar la primera auditoría interna con alcance
      ISO/IEC 20000 (`/app/audit-program`, `/app/audits`).
- [ ] Realizar la primera revisión por la dirección con entradas de
      desempeño del servicio, incidentes, cambios y proveedores
      (`/app/management-review`).

## Antes de la auditoría de certificación

- [ ] Exportar el paquete de auditoría de servicios TI completo
      (`itsm-audit-package`) y revisarlo de punta a punta.
- [ ] Confirmar que no quedan cambios aprobados sin implementar ni
      incidentes cerrados sin confirmación.
- [ ] Confirmar que los incidentes relacionados con otros dominios
      (seguridad, IA, laboral) están vinculados, no duplicados.

---

Soporte durante la implementación: [runbooks/iso-20000-support.md](runbooks/iso-20000-support.md).
