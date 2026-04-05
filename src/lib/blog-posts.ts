export type BlogPost = {
  slug: string;
  title: string;
  category: string;
  excerpt: string;
  date: string;
  readTime: string;
  body: string[];
};

export const BLOG_POSTS: BlogPost[] = [
  {
    slug: "gap-assessment-primeros-pasos-iso-9001",
    title: "GAP assessment: primeros pasos hacia ISO 9001",
    category: "Implementación",
    excerpt: "Cómo estructurar una evaluación de brechas que sirva de verdad para el plan de proyecto, no solo para el informe.",
    date: "2026-03-12",
    readTime: "6 min",
    body: [
      "Un GAP assessment bien hecho responde a una pregunta simple: ¿dónde estamos frente a la norma y qué falta para llegar?",
      "Empieza por delimitar el alcance (sitios, procesos y exclusiones permitidas). Sin eso, la evaluación mezcla lo esencial con el ruido.",
      "Agrupa el trabajo por cláusula y asigna un único responsable por bloque. NormaFlow mantiene el hilo entre respuestas, evidencias y acciones.",
      "Cierra cada brecha con una acción medible: responsable, fecha y criterio de verificación. Así el GAP deja de ser un PDF y pasa a ser un plan vivo.",
    ],
  },
  {
    slug: "iso-27001-evidencias-auditoria",
    title: "ISO 27001: evidencias que los auditores esperan ver",
    category: "ISO 27001",
    excerpt: "Más allá de políticas: qué demuestra que los controles del Anexo A están implementados y funcionan.",
    date: "2026-02-28",
    readTime: "8 min",
    body: [
      "Los auditores buscan trazabilidad: política → procedimiento → registro → revisión. Si falta un eslabón, aparece la observación.",
      "Prioriza los activos y los controles que mitigan los riesgos que tú mismo has puntuado como altos. Ahí se centrará la muestra.",
      "Las capturas de pantalla ayudan, pero no sustituyen registros (logs, informes de backup, actas de revisión). Vincúlalos en un repositorio único.",
      "Un calendario de revisiones internas anticipa lo que el auditor externo pedirá y reduce sorpresas de última hora.",
    ],
  },
  {
    slug: "indicadores-revision-direccion",
    title: "Indicadores que la dirección sí va a usar",
    category: "Mejora continua",
    excerpt: "Menos tablas, más decisiones: cómo elegir KPIs alineados con el riesgo y el cliente.",
    date: "2026-01-15",
    readTime: "5 min",
    body: [
      "Si un indicador no puede cambiar una decisión en la revisión por la dirección, probablemente sobra en el tablero ejecutivo.",
      "Liga cada KPI a un proceso y a un riesgo o requisito normativo. Así se explica por qué importa cuando se sale de objetivo.",
      "Define frecuencia y fuente de datos antes del nombre bonito del ratio. Sin fuente clara, el indicador muere en tres meses.",
      "NormaFlow conserva histórico y semáforo para que la conversación sea sobre tendencia, no sobre discusiones de cifras aisladas.",
    ],
  },
];
