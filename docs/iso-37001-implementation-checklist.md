# Checklist de implementación — ISO 37001

Guía de onboarding para el cliente que activa `PACK_ISO_37001` en
NormaFlow, de la activación al primer ciclo de auditoría interna. No
sustituye la certificación ni el juicio de la función de cumplimiento
antisoborno; es la lista de qué configurar en la plataforma y en qué
orden. Requiere `PACK_ISO_37301` activo — este pack extiende el SGC, no
funciona de forma aislada.

## 1. Activación y contexto (día 1)

- [ ] Activar ISO 37001 desde `/app/standards` (requiere entitlement —
      contacta a soporte si ves un aviso de plan; confirma que
      `compliance`, `speakup` y `antibribery` están todos en tu plan).
- [ ] Definir el contexto y el alcance del sistema de gestión
      antisoborno.
- [ ] Redactar la política antisoborno.
- [ ] Asignar responsabilidades: quien tiene `compliance:approve`
      (función de cumplimiento antisoborno) y quien tiene
      `antibribery-sensitive:read/create` (acceso a beneficiario final).

## 2. Riesgo de soborno (semana 1)

- [ ] Registrar la primera evaluación de riesgo de soborno
      (`/app/antibribery` → Riesgo de soborno), con factores de país,
      sector, funcionario público y terceros.
- [ ] Definir el tratamiento (evitar, mitigar, transferir, aceptar) y
      aprobarla.

## 3. Terceros y debida diligencia (semana 1-3)

- [ ] Registrar cada socio de negocio relevante (agentes,
      intermediarios, distribuidores, joint ventures) con su nivel de
      riesgo.
- [ ] Iniciar la debida diligencia de cada socio de riesgo alto/crítico
      — la revisión reforzada es obligatoria para PEP, funcionario
      público o riesgo alto/crítico.
- [ ] Identificar y registrar el beneficiario final (UBO) de los
      terceros de mayor riesgo, marcando la condición PEP cuando
      aplique.

## 4. Regalos, hospitalidad y donaciones (continuo desde la activación)

- [ ] Definir el umbral de política para regalos y hospitalidad.
- [ ] Registrar cada regalo, hospitalidad, donación o patrocinio — los
      que superen el umbral o involucren a un funcionario público pasan
      obligatoriamente por revisión de compliance.

## 5. Controles y compromisos (mensual)

- [ ] Probar periódicamente los controles financieros antisoborno
      (doble firma, límites de aprobación) y no financieros (compras,
      contratación, viajes).
- [ ] Recoger el compromiso antisoborno de empleados expuestos, del
      consejo y de socios de negocio críticos.
- [ ] Registrar las declaraciones de conflicto de interés (ABMS) del
      personal expuesto a decisiones sobre terceros.

## 6. Operaciones de alto riesgo (según ocurran)

- [ ] Solicitar aprobación explícita antes de ejecutar comisiones de
      agente, pagos en efectivo, transferencias internacionales u otras
      operaciones de alto riesgo — quien solicita nunca puede aprobar.
- [ ] Registrar cualquier pago de facilitación reportado, indicando si
      hubo coacción.

## 7. Preocupaciones e investigación

- [ ] Confirmar que el canal de denuncias del SGC está operativo para
      alegaciones de soborno (no se duplica un canal aparte).
- [ ] Ante una alegación de soborno, vincularla a la investigación
      correspondiente del SGC (`/app/antibribery` → Investigaciones) con
      su tipología, y cerrarla con resultado documentado.

## 8. Auditoría interna y revisión por la dirección

- [ ] Planificar y ejecutar la primera auditoría interna con alcance
      ISO 37001 (`/app/audit-program`, `/app/audits`).
- [ ] Realizar la revisión por la dirección y por la función de
      cumplimiento antisoborno, con entradas de riesgo, debida
      diligencia, regalos y operaciones de alto riesgo
      (`/app/management-review`).

## Antes de la auditoría de certificación

- [ ] Exportar el paquete de auditoría antisoborno (`abms-audit-package`)
      y revisarlo de punta a punta — recuerda que no incluye
      beneficiarios finales por diseño (expórtalos por separado con
      `antibribery-sensitive:read`).
- [ ] Confirmar que no quedan debidas diligencias abiertas sin decisión
      en terceros de riesgo alto/crítico.
- [ ] Confirmar que no quedan operaciones de alto riesgo ni regalos
      pendientes de decisión.

---

Soporte durante la implementación: [runbooks/iso-37001-support.md](runbooks/iso-37001-support.md).
