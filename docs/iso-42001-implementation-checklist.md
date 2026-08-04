# Checklist de implementación — ISO/IEC 42001

Guía para el cliente que activa `PACK_ISO_42001` en NormaFlow, de la
activación al primer ciclo de auditoría interna. No sustituye asesoría de un
consultor certificador; es la lista de qué configurar en la plataforma y en
qué orden.

## 1. Activación y roles (día 1)

- [ ] Activar ISO/IEC 42001 desde `/app/standards` (requiere entitlement —
      contacta a soporte si ves un aviso de plan).
- [ ] Definir alcance del sistema de gestión de IA.
- [ ] Asignar responsable de gobernanza de IA (rol `MANAGER` o
      `COMPLIANCE_MANAGER`).
- [ ] Confirmar quién tiene el permiso `aims:approve` — debe ser un rol de
      gestión, nunca la misma persona que registra o envía a revisión
      (separación de funciones).

## 2. Inventario de sistemas de IA (semana 1-2)

- [ ] Registrar cada sistema de IA en uso o previsto (`/app/aims` →
      Inventario IA): propósito, propietario, proveedor, criticidad,
      autonomía de decisión.
- [ ] Registrar los casos de uso de cada sistema: qué decisiones apoya, a
      quién afecta, usos prohibidos.
- [ ] Nota: el asistente de IA general del producto se autoregistra en el
      inventario (`IA-ASSISTANT`) la primera vez que se usa — revisarlo y
      completar su ficha.

## 3. Evaluación de impacto (semana 2-3)

- [ ] Por cada sistema, completar la evaluación de impacto en las siete
      dimensiones (derechos, seguridad, privacidad, sesgo, transparencia,
      explicabilidad, supervisión).
- [ ] Enviar la evaluación a revisión humana y conseguir su aprobación —
      es un prerrequisito para aprobar el sistema.

## 4. Datos: procedencia, calidad y sesgo (semana 3-4)

- [ ] Registrar cada dataset de entrenamiento con su clasificación, si
      contiene datos personales y su base legal.
- [ ] Declarar las fuentes de datos (procedencia) de cada dataset.
- [ ] Registrar los pasos de linaje (ingesta, limpieza, transformación,
      etiquetado…) — sin huecos, empezando por la ingesta.
- [ ] Completar la revisión de sesgo de cada dataset antes de usarlo para
      entrenar.

## 5. Riesgos de IA (semana 4)

- [ ] Registrar los riesgos identificados (sesgo, privacidad, seguridad,
      robustez, mal uso…) con probabilidad e impacto.
- [ ] Para riesgos no aceptables, definir tratamiento; si se acepta un
      riesgo residual, documentar la justificación — siempre atribuida a
      una persona.

## 6. Modelos y supervisión humana (semana 5-6)

- [ ] Registrar cada versión de modelo con su algoritmo, dataset de
      entrenamiento y técnica de explicabilidad.
- [ ] Evaluar el modelo (exactitud, equidad, sesgo, robustez) antes de
      enviarlo a revisión.
- [ ] Definir al menos un control de supervisión humana por sistema de
      riesgo alto, con capacidad real de anular la decisión o detener el
      sistema.
- [ ] Aprobar el sistema para producción (requiere evaluación de impacto
      aprobada y, si es de riesgo alto, un control de supervisión activo).
- [ ] Promover el modelo a producción solo tras aprobación humana y
      evaluación superada.

## 7. Transparencia

- [ ] Publicar el aviso de transparencia para cada audiencia relevante
      (usuarios finales, personas afectadas, reguladores) declarando el uso
      de IA.

## 8. Monitoreo continuo e incidentes

- [ ] Configurar el registro periódico de métricas de monitoreo (exactitud,
      deriva, tasa de anulación humana…) por sistema.
- [ ] Familiarizar al equipo con el flujo de reporte de incidentes de IA y
      sus ocho etapas obligatorias.

## 9. Auditoría interna y revisión por la dirección

- [ ] Planificar y ejecutar la primera auditoría interna con alcance
      ISO/IEC 42001 (`/app/audit-program`, `/app/audits`).
- [ ] Confirmar la independencia: el auditor asignado no puede ser responsable
      del proceso auditado ni figurar como auditado en esa misma auditoría;
      NormaFlow bloquea ambas combinaciones.
- [ ] Realizar la primera revisión por la dirección con entradas de
      inventario, riesgos, incidentes y desempeño de los sistemas de IA
      (`/app/management-review`).

## Antes de la auditoría de certificación

- [ ] Exportar el paquete de auditoría de IA completo (`ai-audit-package`) y
      revisarlo de punta a punta.
- [ ] Confirmar que las **violaciones de la regla humana** en el Panel de
      `/app/aims` están en cero — ninguna salida de IA debe tener una
      decisión sin revisor, sin fecha, o promovida sin aprobación.
- [ ] Confirmar que no quedan sistemas de riesgo alto sin control de
      supervisión activo ni evaluaciones de impacto pendientes de revisión.

---

Soporte durante la implementación: [runbooks/iso-42001-support.md](runbooks/iso-42001-support.md).
