# Checklist de implementación — ISO 45001

Guía para el cliente que activa `PACK_ISO_45001` en NormaFlow, de la
activación al primer ciclo de auditoría interna. No sustituye asesoría de un
consultor certificador; es la lista de qué configurar en la plataforma y en
qué orden.

## 1. Activación y roles (día 1)

- [ ] Activar ISO 45001 desde `/app/standards` (requiere entitlement —
      contacta a soporte si ves un aviso de plan).
- [ ] Definir alcance (`OrganizationStandard.scope`) y excepciones.
- [ ] Asignar responsable de SST (rol `MANAGER` o `COMPLIANCE_MANAGER`).
- [ ] Identificar quién debe tener acceso a vigilancia de la salud
      (`safety-sensitive:*`) — por defecto solo roles de gestión y auditor
      en solo lectura.
- [ ] Cargar la política de SST como documento (`/app/documents`, tipo
      Política) y aprobarla.

## 2. Contexto y participación (semana 1)

- [ ] Registrar partes interesadas relevantes en `/app/context` (trabajadores,
      autoridades laborales, contratistas, sindicato si aplica).
- [ ] Registrar mecanismos de consulta y participación de trabajadores en
      `/app/safety` → Consulta.

## 3. Peligros y riesgos (semana 1-2)

- [ ] Definir/confirmar la metodología de evaluación de riesgo (W.T. Fine)
      vigente en `/app/safety` → Panel.
- [ ] Levantar la matriz de peligros por actividad/proceso.
- [ ] Evaluar cada peligro (probabilidad × consecuencia × exposición) y
      registrar controles existentes según la jerarquía de controles.
- [ ] Revisar los riesgos NOT_ACCEPTABLE — deben tener plan de acción o
      control adicional antes de continuar operando la actividad.

## 4. Requisitos legales (semana 2-3)

- [ ] Cargar el registro de requisitos legales de SST aplicables.
- [ ] Definir frecuencia de revisión por requisito.
- [ ] Ejecutar la primera evaluación de cumplimiento.

## 5. Control operacional (semana 3-4)

- [ ] Configurar tipos de permiso de trabajo requeridos (trabajo en caliente,
      espacios confinados, alturas, eléctrico, etc.) en `/app/safety` →
      Permisos.
- [ ] Cargar el catálogo de EPP y asignaciones por rol/actividad.
- [ ] Registrar contratistas relevantes y su evaluación de seguridad
      (`ContractorSafetyAssessment`).
- [ ] Vincular gestión del cambio a `/app/processes` cuando un cambio
      operacional pueda introducir nuevos peligros.

## 6. Vigilancia de la salud (semana 4)

- [ ] Confirmar `HEALTH_DATA_ENCRYPTION_KEY` configurada en el entorno antes
      de cargar el primer registro (coordinar con soporte si no está lista).
- [ ] Registrar el primer ciclo de vigilancia de la salud para el personal
      expuesto a peligros significativos.
- [ ] Confirmar que solo los roles previstos ven estos registros
      (`/app/safety` → Vigilancia debería mostrar "Acceso restringido" para
      roles operativos).

## 7. Emergencias

- [ ] Registrar escenarios de emergencia razonablemente previsibles con plan
      de respuesta y programar el primer simulacro.

## 8. Competencia y comunicación

- [ ] Asignar formación relevante en `/app/training` al personal expuesto a
      peligros significativos.
- [ ] Registrar comunicaciones de SST internas/externas relevantes en
      `/app/quality-ops`.

## 9. Auditoría interna y revisión por la dirección

- [ ] Planificar y ejecutar la primera auditoría interna con alcance ISO
      45001 (`/app/audit-program`, `/app/audits`).
- [ ] Convertir hallazgos en CAPA cuando corresponda.
- [ ] Realizar la primera revisión por la dirección con entradas de
      desempeño de SST, incidentes y estado de objetivos
      (`/app/management-review`).

## 10. Antes de la auditoría de certificación

- [ ] Exportar el paquete SST completo (`safety-audit-package`) — recuerda
      que no incluye vigilancia de la salud por diseño; exporta ese reporte
      por separado si aplica.
- [ ] Confirmar que todo incidente abierto tiene investigación completa
      hasta su cierre condicionado (sin etapas saltadas).
- [ ] Confirmar que todos los permisos de trabajo activos están vigentes y
      que no quedan riesgos NOT_ACCEPTABLE sin acción.

---

Soporte durante la implementación: [runbooks/iso-45001-support.md](runbooks/iso-45001-support.md).
