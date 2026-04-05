export const MARKETING_CASES = [
  {
    slug: "tecnoserv-industrial",
    company: "Tecnoserv Industrial S.A.",
    industry: "Manufactura",
    normas: "ISO 9001 + ISO 27001",
    employees: "420 empleados",
    result: "Reducción del 70% en tiempo de preparación de auditoría",
    quote:
      "NormaFlow nos permitió pasar de la certificación puntual al mantenimiento continuo del SGC. Ahora somos proactivos, no reactivos.",
    person: "María Torres",
    role: "Directora de Calidad",
    initials: "MT",
    color: "#123C66",
    challenge:
      "Documentación dispersa en carpetas de red y correo. Cada auditoría suponía semanas de búsqueda de evidencias.",
    solution:
      "Centralización en NormaFlow: documentos versionados, GAP anual y plan de acción vinculado a NC y riesgos.",
    metrics: [
      { label: "Tiempo preparación auditoría", before: "18 días", after: "5 días" },
      { label: "NC mayores (último ciclo)", before: "2", after: "0" },
    ],
  },
  {
    slug: "logistica-norte",
    company: "Grupo Logística Norte",
    industry: "Logística y distribución",
    normas: "ISO 9001",
    employees: "180 empleados",
    result: "Cero no conformidades mayores en última auditoría externa",
    quote: "El GAP Assessment nos dio claridad total sobre dónde estábamos y qué necesitábamos hacer. En 6 meses teníamos todo bajo control.",
    person: "Carlos Méndez",
    role: "Responsable de Calidad",
    initials: "CM",
    color: "#2E8B57",
    challenge: "Primera certificación ISO 9001 con equipo reducido y procesos en varias delegaciones.",
    solution: "Plantillas por cláusula, indicadores compartidos y auditorías internas con checklist único.",
    metrics: [
      { label: "Documentos aprobados a tiempo", before: "62%", after: "94%" },
      { label: "Hallazgos mayores", before: "—", after: "0" },
    ],
  },
  {
    slug: "sistemas-iberica-tech",
    company: "Sistemas Ibérica Tech",
    industry: "Tecnología",
    normas: "ISO 27001",
    employees: "95 empleados",
    result: "Implementación completa en 4 meses vs. 12 esperados",
    quote:
      "Gestionar el Anexo A con NormaFlow es exponencialmente más sencillo que con hojas de cálculo. Los controles, las evidencias y los riesgos, todo vinculado.",
    person: "Ana García",
    role: "CISO y DPO",
    initials: "AG",
    color: "#D68A1A",
    challenge: "Cumplir prescripciones de clientes enterprise y preparar certificación ISO 27001 sin ampliar plantilla.",
    solution: "Registro de riesgos con controles del Anexo A, evidencias por control y auditorías internas semestrales.",
    metrics: [
      { label: "Controles con evidencia", before: "41%", after: "88%" },
      { label: "Tiempo a certificación", before: "12 meses (estimado)", after: "4 meses" },
    ],
  },
] as const;
