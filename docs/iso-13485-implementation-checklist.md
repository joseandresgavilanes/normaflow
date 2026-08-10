# Checklist de implementación — ISO 13485

Guía de onboarding para el cliente que activa `PACK_ISO_13485` en
NormaFlow, de la activación al primer ciclo de auditoría interna. No
sustituye la certificación ni los requisitos regulatorios nacionales
aplicables (MDR, FDA QSR/QMSR, MDSAP u otros); es la lista de qué
configurar en la plataforma y en qué orden.

## 1. Activación y contexto (día 1)

- [ ] Activar ISO 13485 desde `/app/standards` (requiere entitlement —
      contacta a soporte si ves un aviso de plan).
- [ ] Definir el contexto y el alcance del sistema de gestión de la
      calidad de dispositivos médicos.
- [ ] Redactar la política de calidad.
- [ ] Asignar responsabilidades: quien aprueba expedientes
      (`medical-devices:approve`), quien tiene acceso a vigilancia
      sensible (`md-sensitive:read/create`).
- [ ] Configurar la retención de quejas y eventos adversos
      (`/app/medical-devices` → Vigilancia → "Configurar retención";
      por defecto 15 años) según la jurisdicción del fabricante.

## 2. Expediente del dispositivo (semana 1)

- [ ] Registrar cada familia de dispositivos y cada dispositivo médico,
      con clasificación y UDI-DI.
- [ ] Crear el expediente maestro (DMR) de cada dispositivo y llevarlo
      a `APPROVED` con atribución.

## 3. Diseño y desarrollo (semana 1-3)

- [ ] Crear el historial de diseño (DHF) por dispositivo.
- [ ] Registrar los inputs de diseño y los outputs que los cubren —
      revisar la cobertura inputs→outputs antes de avanzar.
- [ ] Registrar revisiones de diseño, verificación y validación con
      resultado y evaluador atribuidos.
- [ ] Documentar la transferencia a producción con checklist y sede
      receptora.
- [ ] Crear el archivo de riesgos del dispositivo, enlazando riesgos
      corporativos existentes cuando aplique.

## 4. Proveedores y validación de procesos (semana 2-4)

- [ ] Registrar los proveedores críticos y su cualificación, con
      próxima revisión programada.
- [ ] Validar los procesos de producción relevantes (IQ/OQ/PQ).
- [ ] Validar los métodos de esterilización cuando el dispositivo lo
      requiera, con nivel de garantía de esterilidad (SAL).

## 5. Producción, lotes y trazabilidad (continuo desde la activación)

- [ ] Registrar cada lote de producción con su validación de proceso
      asociada.
- [ ] Registrar la trazabilidad de cada lote — componente, proveedor,
      distribución — usando referencias opacas de cliente, nunca datos
      identificables de paciente.

## 6. Vigilancia post-comercialización (continuo)

- [ ] Registrar cada queja con referencia opaca de sujeto, sin datos
      clínicos personales.
- [ ] Registrar cada evento adverso, evaluando si es reportable a
      autoridad.
- [ ] Planificar y completar los ciclos de vigilancia post-comercialización
      (PMS) por dispositivo.
- [ ] Ante un hallazgo que lo requiera, iniciar una acción de seguridad
      en campo (FSCA) o un retiro de producto, confirmando los lotes
      afectados.
- [ ] Purgar quejas y eventos adversos cerrados solo una vez vencido su
      plazo de retención — la plataforma lo impide antes de esa fecha.

## 7. Requisitos regulatorios (configurable)

- [ ] Registrar los requisitos regulatorios aplicables por jurisdicción
      y marco (MDR, FDA, u otro).
- [ ] Registrar las presentaciones regulatorias realizadas por
      dispositivo y jurisdicción.

## 8. Auditoría interna y revisión por la dirección

- [ ] Planificar y ejecutar la primera auditoría interna con alcance
      ISO 13485 (`/app/audit-program`, `/app/audits`).
- [ ] Realizar la primera revisión por la dirección con entradas de
      quejas, eventos adversos, PMS, retiros y desempeño de proveedores
      (`/app/management-review`).

## Antes de la auditoría de certificación

- [ ] Exportar el paquete de auditoría de dispositivos médicos
      (`md-audit-package`) y revisarlo de punta a punta — recuerda que
      no incluye quejas/PMS/eventos/retiros por diseño (expórtalos por
      separado con `md-sensitive:read`).
- [ ] Confirmar que cada DMR activo está `APPROVED` y que no quedan
      inputs de diseño sin output que los cubra.
- [ ] Confirmar que no quedan quejas o eventos adversos abiertos sin
      seguimiento, ni retiros iniciados sin cerrar.

---

Soporte durante la implementación: [runbooks/iso-13485-support.md](runbooks/iso-13485-support.md).
