# Metodología de implementación — Sistema Integrado de Gestión (SIG)

Guía para el cliente que activa `PACK_SIG_9001_14001_45001` en NormaFlow,
combinando ISO 9001 + ISO 14001 + ISO 45001 en un solo sistema. No sustituye
asesoría de un consultor certificador; es la secuencia recomendada para
integrar tres normas ya activas (o activarlas a la vez) sin duplicar
esfuerzo. Complementa, no reemplaza, los checklists de cada norma
individual ([ISO 14001](iso-14001-implementation-checklist.md),
[ISO 45001](iso-45001-implementation-checklist.md)).

## Fase 0 — Prerrequisito

- [ ] ISO 9001, ISO 14001 e ISO 45001 activas para la organización, cada una
      con su propio entitlement. La integración parte de tres sistemas que
      ya funcionan por separado — no es un atajo para implementarlos desde
      cero más rápido.
- [ ] Activar `PACK_SIG_9001_14001_45001` desde `/app/standards` (requiere
      su propio entitlement — contacta a soporte si ves un aviso de plan).
      Esto instala automáticamente la matriz de correspondencia entre las
      tres normas.

## Fase 1 — Gobierno único (semana 1)

- [ ] Definir el **alcance integrado** en `/app/integrated` → Alcance y
      política: un solo alcance para las tres normas, con exclusiones por
      norma si aplica.
- [ ] Redactar y aprobar la **política integrada**: un documento único que
      declara el compromiso de calidad, ambiente y SST.
- [ ] Configurar cada norma dentro del sistema (`/app/integrated` → Alcance
      y política → normas): disciplina, nota de alcance, exclusiones y
      responsable propios de cada una.
- [ ] Revisar la matriz de correspondencia y confirmar que las
      equivalencias entre 9001/14001/45001 se instalaron correctamente
      (filtro "Todos los tipos" en la pestaña Matriz de correspondencia).

## Fase 2 — Contexto, partes interesadas y objetivos (semana 1-2)

- [ ] Migrar/consolidar las partes interesadas ya registradas por norma
      hacia `/app/integrated` → Partes interesadas, marcando las
      disciplinas a las que aplica cada una (dejar vacío = todas).
- [ ] Revisar los objetivos de cada norma y fusionar los que compartan
      meta en un objetivo **compartido** (varias disciplinas marcadas).

## Fase 3 — Riesgos y documentación multirrequisito (semana 2-3)

- [ ] Revisar los riesgos críticos de cada norma en `/app/integrated` →
      Auditoría integrada → Riesgos, y marcar la(s) disciplina(s) reales de
      cada uno (un riesgo operativo puede ser QUALITY+SAFETY a la vez).
- [ ] Identificar documentos que hoy están duplicados por norma
      (procedimientos, política, control documental — típicamente
      equivalentes o parcialmente equivalentes) y vincularlos a los varios
      requisitos que cubren desde la matriz de correspondencia
      (`RequirementCoverage`), en vez de mantener una copia por norma.
- [ ] Repetir con evidencias: una sola evidencia (acta, registro, foto)
      puede cubrir requisitos de varias normas.
- [ ] Verificar que el **factor de reutilización** (Panel integrado) sube
      por encima de 1 a medida que se vinculan documentos/evidencias.

## Fase 4 — Competencias, proveedores y cambios (semana 3-4)

- [ ] Revisar formaciones en `/app/training` y consolidar las que apliquen
      a más de una disciplina.
- [ ] Evaluar proveedores críticos con criterio integrado
      (`/app/integrated` → Auditoría integrada → Proveedores): una sola
      evaluación con las tres dimensiones (calidad/ambiente/SST) en vez de
      tres evaluaciones separadas.
- [ ] Etiquetar las solicitudes de cambio con impacto en más de una
      disciplina desde la misma pestaña.

## Fase 5 — Ciclo de auditoría integrada (semana 4-6)

- [ ] Planificar la primera **auditoría integrada**: un solo programa,
      checklist y equipo auditor cubriendo las tres normas
      (`/app/integrated` → Auditoría integrada → marcar las normas de la
      auditoría).
- [ ] Etiquetar hallazgos con las normas que afectan cuando correspondan a
      más de una.
- [ ] Convertir hallazgos multinorma en **CAPA única** (una acción
      correctiva que resuelve la causa raíz común, no una CAPA por norma).

## Fase 6 — Revisión por la dirección integrada (semana 6-8)

- [ ] Planificar y ejecutar la primera revisión por la dirección que
      cubre las tres normas en una sola sesión (`/app/integrated` →
      Auditoría integrada → Revisión, o `/app/management-review` marcando
      las tres normas).
- [ ] Confirmar que las entradas incluyen desempeño de calidad, ambiente y
      SST, no tres presentaciones separadas.

## Antes de la auditoría de certificación

- [ ] Exportar el paquete completo del sistema integrado
      (`sig-system-package`) y revisarlo de punta a punta.
- [ ] Confirmar el grado de integración (% de requisitos compartidos) y el
      factor de reutilización en el Panel integrado — son la evidencia
      cuantitativa de que el sistema no duplica esfuerzo.
- [ ] Confirmar que no quedan requisitos "específicos" marcados como
      "no compartibles" que en realidad sí deberían tener evidencia
      vinculada entre normas.
- [ ] Confirmar que la auditoría interna, la revisión por la dirección y al
      menos una CAPA quedaron marcadas como integradas en el ciclo.

---

Soporte durante la implementación: [runbooks/sig-support.md](runbooks/sig-support.md).
