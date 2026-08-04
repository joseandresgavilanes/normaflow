# Checklist de implementación — ISO 22000

Guía de onboarding para el cliente que activa `PACK_ISO_22000` en
NormaFlow, de la activación al primer ciclo de auditoría interna. No
sustituye la certificación ni el juicio de un equipo de inocuidad
alimentaria calificado; es la lista de qué configurar en la plataforma y
en qué orden.

## 1. Activación y contexto (día 1)

- [ ] Activar ISO 22000 desde `/app/standards` (requiere entitlement —
      contacta a soporte si ves un aviso de plan).
- [ ] Definir el contexto y el alcance del sistema de gestión de la
      inocuidad de los alimentos.
- [ ] Redactar la política de inocuidad alimentaria.
- [ ] Constituir el equipo de inocuidad alimentaria (líder + miembros con
      competencias documentadas).

## 2. Productos y materias primas (semana 1)

- [ ] Registrar cada producto terminado (`/app/food-safety` → Productos y
      MP): categoría, vida útil, condiciones de almacenamiento, alérgenos.
- [ ] Registrar cada materia prima con su proveedor y especificación.
- [ ] Documentar el uso previsto de cada producto: grupo de consumidores,
      método de preparación, si hay consumidores vulnerables.

## 3. Diagramas de flujo y peligros (semana 1-2)

- [ ] Crear el diagrama de flujo de cada producto (`/app/food-safety` →
      Flujos), con sus etapas en secuencia.
- [ ] Verificar in situ cada diagrama antes de aprobarlo — el flujo pasa
      por `DRAFT → IN_REVIEW → APPROVED`, sin saltos.
- [ ] Identificar los peligros biológicos, químicos, físicos y alérgenos
      relevantes por etapa (`/app/food-safety` → Peligros).
- [ ] Evaluar cada peligro por severidad y probabilidad (1-5); el sistema
      calcula el puntaje y sugiere la decisión de control (PRP/OPRP/CCP).

## 4. PRP, OPRP y CCP (semana 2-3)

- [ ] Documentar los programas de prerrequisitos (PRP) aplicables, con
      responsable asignado.
- [ ] Establecer los PRP operacionales (OPRP) para peligros significativos
      sin un CCP asociado.
- [ ] Establecer los puntos críticos de control (CCP) para peligros que lo
      requieran, con sus límites críticos (valor, rango o umbral).
- [ ] Registrar la validación de cada CCP (evidencia de que el límite
      controla efectivamente el peligro) y planificar su verificación
      periódica.

## 5. Monitoreo (continuo desde la activación)

- [ ] Crear el plan de monitoreo de cada CCP/OPRP: parámetro, método,
      frecuencia, responsable.
- [ ] Registrar cada lectura de monitoreo (`/app/food-safety` →
      Monitoreo); decidir si las lecturas fuera de límite deben abrir
      desviación automáticamente.
- [ ] Revisar periódicamente las desviaciones abiertas y llevarlas a
      corrección y verificación.

## 6. Trazabilidad (antes de operar en producción)

- [ ] Registrar cada lote con sus lotes de entrada (`previousLotIds`):
      materia prima → intermedio → terminado → distribuido.
- [ ] Ejecutar una prueba de trazabilidad hacia atrás y hacia adelante
      sobre un lote real antes de depender del sistema en una auditoría o
      un incidente real.

## 7. Retiro, recall y emergencias

- [ ] Simular al menos un ejercicio de retiro/recall: verificar que la
      expansión de lotes afectados cubre toda la cadena, hacia atrás y
      hacia adelante.
- [ ] Documentar el procedimiento de emergencias que puedan afectar la
      inocuidad (contaminación, incidente de proveedor, evento externo).
- [ ] Configurar la comunicación de cadena con proveedores, clientes y
      autoridades (`/app/food-safety` → Comunicación de cadena).

## 8. Auditoría interna y revisión por la dirección

- [ ] Planificar y ejecutar la primera auditoría interna con alcance ISO
      22000 (`/app/audit-program`, `/app/audits`).
- [ ] Realizar la primera revisión por la dirección con entradas de
      desempeño del sistema, resultados de verificación, retiros y
      desviaciones (`/app/management-review`).

## Antes de la auditoría de certificación

- [ ] Exportar el paquete de auditoría HACCP completo
      (`fsms-audit-package`) y revisarlo de punta a punta.
- [ ] Confirmar que cada CCP activo tiene su límite crítico, validación y
      plan de monitoreo documentados.
- [ ] Confirmar que no quedan desviaciones abiertas sin corrección, ni
      correcciones sin verificar.
- [ ] Ejecutar de nuevo la prueba de trazabilidad extremo a extremo sobre
      al menos un producto de cada línea.

---

Soporte durante la implementación: [runbooks/iso-22000-support.md](runbooks/iso-22000-support.md).
