# Checklist de implementación — ISO 14001

Guía para el cliente que activa `PACK_ISO_14001` en NormaFlow, de la
activación al primer ciclo de auditoría interna. No sustituye asesoría de un
consultor certificador; es la lista de qué configurar en la plataforma y en
qué orden.

## 1. Activación y roles (día 1)

- [ ] Activar ISO 14001 desde `/app/standards` (requiere entitlement — contacta
      a soporte si ves un aviso de plan).
- [ ] Definir alcance (`OrganizationStandard.scope`) y excepciones.
- [ ] Asignar responsable ambiental (rol `MANAGER` o `COMPLIANCE_MANAGER`).
- [ ] Cargar la política ambiental como documento (`/app/documents`, tipo
      Política) y aprobarla.

## 2. Contexto (semana 1)

- [ ] Registrar partes interesadas relevantes en `/app/context` (clientes,
      autoridades, comunidad, empleados) con sus necesidades y requisitos.
- [ ] Confirmar que el alcance cubre todas las sedes/procesos con impacto
      ambiental relevante.

## 3. Aspectos, impactos y significancia (semana 1-2)

- [ ] Definir la metodología de significancia (`/app/environment` → Panel):
      fórmula, pesos por factor (severidad/frecuencia/alcance), umbral.
- [ ] Levantar la matriz de aspectos por proceso, marcando condición
      (normal/anormal/emergencia) y etapa de ciclo de vida.
- [ ] Registrar impactos por aspecto; NormaFlow calcula la significancia
      automáticamente con la metodología activa.
- [ ] Revisar los aspectos marcados como significativos — deben tener control
      operacional documentado.

## 4. Cumplimiento legal (semana 2-3)

- [ ] Cargar el registro de obligaciones legales y otras obligaciones
      aplicables (permisos, reglamentos, compromisos voluntarios).
- [ ] Definir frecuencia de revisión por obligación.
- [ ] Ejecutar la primera evaluación de cumplimiento de cada obligación.

## 5. Objetivos, programas e indicadores (semana 3-4)

- [ ] Definir objetivos ambientales medibles con línea base y meta.
- [ ] Crear programas de acción para cada objetivo (actividades, responsable,
      presupuesto si aplica).
- [ ] Comenzar a registrar indicadores periódicos (agua, energía,
      combustible, emisiones, vertidos, residuos, materias primas).

## 6. Emergencias y biodiversidad

- [ ] Registrar escenarios de emergencia ambiental razonablemente previsibles
      con plan de respuesta y programar el primer simulacro.
- [ ] Si aplica, registrar sitios con impacto en biodiversidad: ecosistema,
      área protegida (si corresponde, con nombre), medidas de mitigación y
      cadencia de monitoreo propia.

## 7. Competencia y comunicación

- [ ] Asignar formación relevante en `/app/training` al personal cuyo trabajo
      pueda causar un impacto ambiental significativo.
- [ ] Registrar comunicaciones ambientales internas/externas relevantes en
      `/app/quality-ops`.

## 8. Proveedores y control documental

- [ ] Evaluar proveedores con criterio ambiental cuando aplique
      (`Supplier` / `SupplierEvaluation.environmentScore`).
- [ ] Confirmar que los procedimientos operacionales críticos están
      documentados y con la versión vigente controlada.

## 9. Auditoría interna y revisión por la dirección

- [ ] Planificar y ejecutar la primera auditoría interna con alcance ISO
      14001 (`/app/audit-program`, `/app/audits`).
- [ ] Convertir hallazgos en CAPA cuando corresponda.
- [ ] Realizar la primera revisión por la dirección con entradas de
      desempeño ambiental, cumplimiento y estado de objetivos
      (`/app/management-review`).

## 10. Antes de la auditoría de certificación

- [ ] Exportar el paquete ambiental completo (`env-audit-package`) y
      revisarlo de punta a punta.
- [ ] Confirmar que no quedan obligaciones vencidas ni no conformes sin
      acción derivada.
- [ ] Confirmar que todos los aspectos significativos tienen control
      operacional y, si aplica, objetivo asociado.

---

Soporte durante la implementación: [runbooks/iso-14001-support.md](runbooks/iso-14001-support.md).
