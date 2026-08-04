# Checklist de implementación — ISO 22301

Guía para el cliente que activa `PACK_ISO_22301` en NormaFlow, de la
activación al primer ciclo de auditoría interna. No sustituye asesoría de un
consultor certificador; es la lista de qué configurar en la plataforma y en
qué orden.

## 1. Activación y roles (día 1)

- [ ] Activar ISO 22301 desde `/app/standards` (requiere entitlement —
      contacta a soporte si ves un aviso de plan).
- [ ] Definir alcance (`OrganizationStandard.scope`) y excepciones.
- [ ] Asignar responsable de continuidad (rol `MANAGER` o
      `COMPLIANCE_MANAGER`).
- [ ] Cargar la política de continuidad como documento (`/app/documents`,
      tipo Política) y aprobarla.

## 2. Contexto y partes interesadas (semana 1)

- [ ] Registrar partes interesadas relevantes en `/app/context` (clientes,
      autoridades, proveedores críticos, empleados).
- [ ] Registrar riesgos que puedan derivar en interrupción de negocio en
      `/app/risks`.

## 3. Análisis de Impacto en el Negocio — BIA (semana 1-3)

- [ ] Crear el BIA (`/app/continuity` → BIA y actividades) con metodología y
      alcance.
- [ ] Registrar las actividades críticas, vinculándolas a un proceso cuando
      exista, con MTPD, RTO, RPO y nivel mínimo aceptable (MBCO) de cada una.
- [ ] Registrar los productos/servicios prioritarios con su % de ingresos y
      clientes afectados.
- [ ] Aprobar el BIA una vez validado — queda como línea base para las
      estrategias.

## 4. Dependencias y recursos (semana 3-4)

- [ ] Por cada actividad crítica, registrar sus dependencias (personas,
      instalaciones, tecnología, datos, proveedores) y marcar los puntos
      únicos de fallo.
- [ ] Registrar los recursos mínimos necesarios frente a los normales
      (personal, equipos, capacidad) y sus alternativas.

## 5. Estrategias y procedimientos (semana 4-5)

- [ ] Definir una estrategia de continuidad por cada actividad crítica sin
      cobertura, indicando el RTO/RPO real que logra.
- [ ] Aprobar las estrategias viables y marcarlas implementadas cuando estén
      operativas.
- [ ] Documentar los procedimientos de recuperación paso a paso.

## 6. Planes de continuidad (semana 5-6)

- [ ] Crear el/los BCP con su alcance, RTO/RPO objetivo y proceso(s)
      críticos vinculados.
- [ ] Crear el DRP asociado si aplica (recuperación técnica/tecnológica).
- [ ] Versionar el plan y aprobarlo.

## 7. Equipos de crisis y comunicación (semana 6)

- [ ] Crear el equipo de crisis con líder, suplente y regla de activación.
- [ ] Registrar los contactos con su orden de escalado.
- [ ] Definir el árbol de comunicación (a quién se avisa, por qué canal, en
      qué plazo máximo).

## 8. Simulacros (semana 7-8)

- [ ] Planificar el primer simulacro (tabletop, walkthrough, simulación o
      failover) sobre un escenario realista.
- [ ] Ejecutarlo y registrar el resultado (RTO/RPO logrado frente al
      objetivo).
- [ ] Registrar y hacer seguimiento de las acciones de mejora derivadas.

## 9. Auditoría interna y revisión por la dirección

- [ ] Planificar y ejecutar la primera auditoría interna con alcance ISO
      22301 (`/app/audit-program`, `/app/audits`).
- [ ] Realizar la primera revisión por la dirección con entradas de
      preparación, brechas y resultados de simulacros
      (`/app/management-review`).

## Antes de la auditoría de certificación

- [ ] Exportar el paquete de auditoría de continuidad completo
      (`bcm-audit-package`) y revisarlo de punta a punta.
- [ ] Confirmar el grado de preparación (Panel, `/app/continuity`) y que no
      quedan brechas críticas (SPOF sin alternativa, RTO > MTPD, actividades
      nunca ejercitadas).
- [ ] Confirmar que el plan vigente está aprobado (no en borrador) y que el
      equipo de crisis conoce su rol.

---

Soporte durante la implementación: [runbooks/iso-22301-support.md](runbooks/iso-22301-support.md).
