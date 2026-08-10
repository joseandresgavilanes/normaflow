# Checklist de implementación — ISO 37301

Guía para el cliente que activa `PACK_ISO_37301` en NormaFlow, de la
activación al primer ciclo de auditoría interna. No sustituye asesoría de un
consultor certificador; es la lista de qué configurar en la plataforma y en
qué orden.

## 1. Activación y roles (día 1)

- [ ] Activar ISO 37301 desde `/app/standards` (requiere entitlement —
      contacta a soporte si ves un aviso de plan).
- [ ] Definir alcance del sistema de gestión de compliance.
- [ ] Asignar responsable de la función de compliance (rol
      `COMPLIANCE_MANAGER` — es el único rol que opera el canal de
      denuncias por defecto).
- [ ] Configurar el canal de denuncias (`/app/compliance` → Canal de
      denuncias → Configurar canal): modos admitidos (identificada,
      confidencial, anónima), plazos de acuse y respuesta, receptor titular
      y suplente, retención del expediente.
- [ ] Confirmar quién tiene `compliance:approve` — debe ser distinto de
      quien registra riesgos y evaluaciones (separación de funciones).

## 2. Obligaciones, fuentes y jurisdicciones (semana 1-2)

- [ ] Registrar las jurisdicciones aplicables, con su motivo documentado.
- [ ] Registrar las fuentes regulatorias vigiladas (leyes, reglamentos,
      contratos, códigos de conducta) y su frecuencia de vigilancia.
- [ ] Registrar el catálogo de obligaciones de compliance: tipo, categoría,
      criticidad, responsable, sanción máxima si se incumple.
- [ ] Evaluar la aplicabilidad de cada obligación por jurisdicción, con
      motivo documentado.

## 3. Riesgos y controles (semana 2-3)

- [ ] Registrar los riesgos de compliance asociados a las obligaciones
      aplicables, con probabilidad e impacto.
- [ ] Definir controles preventivos, detectivos o correctivos por riesgo u
      obligación; probarlos y registrar diseño/operación.
- [ ] Aceptar formalmente el riesgo residual no aceptable que no vaya a
      tratarse de otro modo — siempre con motivo y persona responsable.

## 4. Calendario y evaluaciones (semana 3-4)

- [ ] Cargar el calendario de vencimientos regulatorios (presentaciones,
      renovaciones, plazos) con aviso previo por criticidad.
- [ ] Planificar evaluaciones periódicas de cumplimiento por obligación;
      solo una evaluación aprobada mueve el estado de cumplimiento.

## 5. Conflictos de interés y formación (semana 4)

- [ ] Solicitar la declaración periódica de conflicto de interés a
      personas clave; nadie revisa su propia declaración.
- [ ] Programar la formación obligatoria (código de conducta, canal de
      denuncias, antisoborno…) y registrar su cobertura real.

## 6. Canal de denuncias (continuo desde la activación)

- [ ] Comunicar el canal a toda la organización, incluida la declaración
      de protección frente a represalias.
- [ ] Formar a los receptores en el flujo: acuse → triaje → admisibilidad
      → investigación → cierre → retención.
- [ ] Confirmar que cada investigador asignado es independiente de la
      persona señalada — la base lo exige, pero conviene revisarlo antes.
- [ ] No purgar ningún caso antes de que venza su plazo de retención.

## 7. Incumplimientos y remediación

- [ ] Registrar todo incumplimiento confirmado, con causa raíz.
- [ ] Decidir y documentar si corresponde notificación a la autoridad, y
      cumplir el plazo.
- [ ] Aprobar cada plan de remediación con responsable y fecha objetivo;
      verificar su eficacia con una persona distinta de quien lo ejecutó.

## 8. Auditoría interna y revisión por la dirección

- [ ] Planificar y ejecutar la primera auditoría interna con alcance ISO
      37301 (`/app/audit-program`, `/app/audits`).
- [ ] Preparar el primer informe al órgano de gobierno
      (`/app/compliance` → Órgano de gobierno) y registrar su acuse y las
      decisiones tomadas.
- [ ] Realizar la primera revisión por la dirección con entradas de
      obligaciones, riesgos, canal (agregado) e incumplimientos
      (`/app/management-review`).

## Antes de la auditoría de certificación

- [ ] Exportar el paquete de auditoría de compliance completo
      (`compliance-audit-package`) y revisarlo de punta a punta.
- [ ] Confirmar que no quedan obligaciones aplicables sin control ni sin
      evaluar.
- [ ] Confirmar que todo caso cerrado del canal tiene resultado, resumen y,
      si aplica, medidas de protección registradas.
- [ ] Confirmar que no quedan incumplimientos con notificación a la
      autoridad pendiente fuera de plazo.

---

Soporte durante la implementación: [runbooks/iso-37301-support.md](runbooks/iso-37301-support.md).
