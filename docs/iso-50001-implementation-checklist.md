# Checklist de implementación — ISO 50001

Guía de onboarding para el cliente que activa `PACK_ISO_50001` en NormaFlow,
de la activación al primer ciclo de auditoría interna. No sustituye la
auditoría energética de un profesional certificado ni asesoría de un
consultor certificador; es la lista de qué configurar en la plataforma y en
qué orden.

## 1. Activación y contexto (día 1)

- [ ] Activar ISO 50001 desde `/app/standards` (requiere entitlement —
      contacta a soporte si ves un aviso de plan).
- [ ] Definir el contexto energético y el alcance del sistema de gestión
      de la energía (instalaciones, procesos, límites físicos).
- [ ] Redactar la política energética.
- [ ] Asignar roles: responsable del sistema, quien registra lecturas,
      quien aprueba revisiones (`energy:approve`).

## 2. Fuentes, usos y consumos (semana 1-2)

- [ ] Registrar cada fuente de energía en uso (`/app/energy` → Fuentes y
      usos): tipo, unidad, factor de emisión, coste por unidad, % renovable.
- [ ] Registrar cada uso de energía por proceso, sede o equipo, con su
      estimación anual.
- [ ] Instalar o dar de alta los medidores existentes, vinculados a su
      fuente.

## 3. Revisión energética y usos significativos (semana 2-3)

- [ ] Realizar la primera revisión energética (`/app/energy` → Revisión
      energética): alcance, metodología, hallazgos.
- [ ] Identificar los usos significativos de energía (SEU) por
      participación en el consumo o potencial de mejora — el criterio
      automático es orientativo, la decisión final queda documentada.
- [ ] Enviar la revisión a aprobación.

## 4. Líneas base y EnPI (semana 3-4)

- [ ] Establecer la línea base de consumo de cada SEU relevante, con su
      periodo y método de normalización si aplica.
- [ ] Definir variables relevantes (producción, ocupación, grados-día…) y
      factores estáticos (superficie, capacidad…) que expliquen el consumo.
- [ ] Crear los EnPI necesarios con la fórmula adecuada (consumo,
      intensidad, comparación con línea base…) y su objetivo.
- [ ] Nota: cambiar la fórmula o los datos de una línea base o un EnPI ya
      existente, usando el mismo código, crea una nueva versión — la
      anterior queda como histórico, nunca se pierde.

## 5. Medición continua (continuo desde la activación)

- [ ] Establecer la frecuencia de lectura de cada medidor y registrar las
      lecturas (`/app/energy` → Medidores y lecturas), reales o estimadas.
- [ ] Revisar periódicamente que el coste y las emisiones se calculan
      correctamente (dependen de que la fuente tenga configurado
      `costPerUnit`/`emissionFactor`).
- [ ] Programar la calibración de los medidores y renovarla antes de que
      venza.

## 6. Oportunidades, objetivos y planes (mensual)

- [ ] Registrar las oportunidades de mejora identificadas, con ahorro y
      coste estimados.
- [ ] Definir objetivos y metas energéticas coherentes con la política.
- [ ] Convertir las oportunidades priorizadas en planes de acción con
      responsable y fecha.

## 7. Compras y diseño

- [ ] Evaluar a los proveedores de energía y equipos energéticamente
      relevantes con criterios ponderados antes de contratar.
- [ ] Documentar la revisión del desempeño energético en el diseño de
      instalaciones o equipos nuevos, o en modificaciones significativas.

## 8. Verificación de ahorros

- [ ] Al completar un plan de acción, registrar la verificación de ahorro
      con el método de cálculo (absoluto, normalizado) y sus fórmulas.
- [ ] Confirmar el cierre de la verificación con una persona distinta de
      quien ejecutó la acción, cuando sea posible.

## 9. Auditoría interna y revisión por la dirección

- [ ] Planificar y ejecutar la primera auditoría interna con alcance ISO
      50001 (`/app/audit-program`, `/app/audits`).
- [ ] Realizar la primera revisión por la dirección con entradas de
      desempeño energético, EnPI, oportunidades y objetivos
      (`/app/management-review`).

## Antes de la auditoría de certificación

- [ ] Exportar el paquete de auditoría energética completo
      (`enms-audit-package`) y revisarlo de punta a punta.
- [ ] Confirmar que cada EnPI activo tiene su línea base asociada y su
      fórmula documentada con versión.
- [ ] Confirmar que no quedan oportunidades de alta prioridad sin plan de
      acción, ni planes completados sin verificación de ahorro.

---

Soporte durante la implementación: [runbooks/iso-50001-support.md](runbooks/iso-50001-support.md).
