import type { PatientGoalInput } from '../types/patientGoals';

export interface GasGoalTemplate {
  id: string;
  category: string;
  label: string;
  description: string;
  /** Días sugeridos para la fecha meta (ej. revaloración post-toxina) */
  suggestedDays: number;
  form: Omit<PatientGoalInput, 'target_date'>;
}

/**
 * Plantillas basadas en escenarios frecuentes de toxina botulínica.
 * El nivel 0 (gas_zero) es la meta esperada; los demás niveles describen
 * resultados observables acordados con el paciente.
 */
export const GAS_GOAL_TEMPLATES: GasGoalTemplate[] = [
  {
    id: 'espasticidad-msi-funcion',
    category: 'Espasticidad',
    label: 'Mano espástica — agarrar objetos',
    description: 'Paciente adulto con espasticidad de muñeca/dedos que limita prensión.',
    suggestedDays: 28,
    form: {
      title: 'Mejorar apertura de mano para agarrar objetos cotidianos',
      smart_specific:
        'Lograr extensión activa de dedos y muñeca del miembro superior afectado para tomar un vaso o cubiertos.',
      smart_measurable:
        'Escala de Ashworth ≤1 en flexores de dedos; capacidad de sujetar vaso de 200 ml sin ayuda.',
      smart_achievable:
        'Meta realista con toxina en flexores de dedos y muñeca según dosis aprobada.',
      smart_relevant:
        'Permite alimentación autónoma y reduce dependencia del cuidador.',
      smart_timebound: 'Evaluar a las 4 semanas post-inyección (pico de efecto).',
      gas_minus2: 'Sin cambio en apertura de mano; no puede sujetar objetos; espasticidad igual o peor.',
      gas_minus1: 'Apertura parcial; solo sujeta objetos muy ligeros con ayuda de la otra mano.',
      gas_zero: 'Abre la mano lo suficiente para sujetar un vaso o cubiertos de forma independiente.',
      gas_plus1: 'Sujeta objetos con firmeza moderada; realiza tareas bimanuales simples.',
      gas_plus2: 'Prensión funcional casi normal; realiza actividades de la vida diaria sin limitación notable.',
    },
  },
  {
    id: 'espasticidad-mii-marcha',
    category: 'Espasticidad',
    label: 'Pie equino — marcha',
    description: 'Adulto con espasticidad de tríceps sural que dificulta el apoyo plantar.',
    suggestedDays: 28,
    form: {
      title: 'Mejorar apoyo plantar y estabilidad al caminar',
      smart_specific:
        'Reducir equino dinámico para lograr contacto inicial del talón al caminar 10 metros en superficie plana.',
      smart_measurable:
        'Ashworth de gemelos ≤1; talón contacta el suelo al inicio de la zancada (observación clínica o video).',
      smart_achievable: 'Alcanzable con toxina en gastrocnemio/sóleo dentro del límite por extremidad.',
      smart_relevant: 'Mejora marcha, reduce caídas y fatiga al caminar distancias cortas.',
      smart_timebound: 'Revalorar a las 4–6 semanas post-inyección.',
      gas_minus2: 'No hay contacto de talón; marcha igual o empeora; requiere más apoyo.',
      gas_minus1: 'Contacto intermitente de talón; camina con apoyo ocasional o más lento.',
      gas_zero: 'Talón contacta el suelo de forma consistente al caminar 10 m con su dispositivo habitual.',
      gas_plus1: 'Marcha más fluida; reduce uso de bastón o camina distancias mayores sin pausa.',
      gas_plus2: 'Marcha casi normal en distancias cortas; ya no requiere dispositivo de apoyo.',
    },
  },
  {
    id: 'hombro-doloroso',
    category: 'Espasticidad',
    label: 'Hombro doloroso espástico',
    description: 'Paciente post-EVC con hombro subluxado/doloroso y espasticidad de aductores/rotadores.',
    suggestedDays: 28,
    form: {
      title: 'Reducir dolor de hombro y mejorar movilidad para vestirse',
      smart_specific:
        'Disminuir dolor en hombro afectado y lograr abducción pasiva ≥45° para colocarse la camisa.',
      smart_measurable: 'EVA de dolor ≤3/10 en reposo; abducción pasiva ≥45° sin llanto/reflejo de retirada.',
      smart_achievable: 'Combinación de toxina en músculos espásticos del hombro y rehabilitación.',
      smart_relevant: 'Mejora higiene personal, sueño y participación en terapia.',
      smart_timebound: 'Evaluar a las 4 semanas post-inyección.',
      gas_minus2: 'Dolor igual o peor (EVA >6); no tolera movilización del hombro.',
      gas_minus1: 'Dolor leve-moderado persistente; abducción <30°; vestido aún muy difícil.',
      gas_zero: 'EVA ≤3/10; abducción pasiva ≥45°; puede vestirse la parte superior con mínima ayuda.',
      gas_plus1: 'EVA 0–2/10; abducción ≥60°; vestido casi independiente.',
      gas_plus2: 'Sin dolor en reposo; movilidad suficiente para actividades bimanuales ligeras.',
    },
  },
  {
    id: 'blefaroespasmo',
    category: 'Movimientos involuntarios',
    label: 'Blefaroespasmo — visión y lectura',
    description: 'Cierre involuntario de párpados que interfiere actividades visuales.',
    suggestedDays: 42,
    form: {
      title: 'Reducir cierre involuntario de párpados para leer y conducir',
      smart_specific:
        'Disminuir episodios de cierre espasmódico que impiden mantener los ojos abiertos >30 segundos.',
      smart_measurable:
        'Escala de gravedad de blefaroespasmo (Jankovic) mejora ≥1 punto; lectura continua ≥5 min.',
      smart_achievable: 'Respuesta típica a toxina periorbitaria con re-inyección cada 3 meses.',
      smart_relevant: 'Recupera lectura, uso de pantallas y conducción segura (si aplica).',
      smart_timebound: 'Evaluar entre semana 2 y 6 post-inyección.',
      gas_minus2: 'Espasmos iguales o más frecuentes; no puede leer ni usar pantallas.',
      gas_minus1: 'Mejora leve; aún interrumpe lectura cada 1–2 minutos por cierre ocular.',
      gas_zero: 'Mantiene ojos abiertos para leer ≥5 min; realiza actividades visuales cotidianas.',
      gas_plus1: 'Lectura prolongada sin interrupciones; conduce con comodidad (si antes podía).',
      gas_plus2: 'Prácticamente libre de espasmos en actividades diarias; mínima necesidad de parpadear forzado.',
    },
  },
  {
    id: 'migrana-cronica',
    category: 'Cefalea',
    label: 'Migraña crónica — frecuencia',
    description: 'Paciente con ≥15 días de cefalea al mes candidato a toxina profiláctica.',
    suggestedDays: 84,
    form: {
      title: 'Reducir días de migraña al mes',
      smart_specific: 'Disminuir días con cefalea moderada-grave que limitan actividades.',
      smart_measurable: 'Reducción ≥50% en días de migraña vs. línea base (calendario de cefalea).',
      smart_achievable: 'Meta alineada con respuesta PREEMPT (≥50% reducción en ~50% de pacientes).',
      smart_relevant: 'Menos ausencias laborales/escolares y mejor calidad de vida familiar.',
      smart_timebound: 'Comparar mes 2 vs. mes previo al tratamiento (2 ciclos de toxina).',
      gas_minus2: 'Sin reducción o aumento de días de migraña; igual dependencia de analgésicos.',
      gas_minus1: 'Reducción <25% de días de migraña; mejoría mínima en funcionalidad.',
      gas_zero: 'Reducción ≥50% de días de migraña; uso de triptanes/analgésicos a la mitad.',
      gas_plus1: 'Reducción 50–75%; retoma actividades sociales y laborales con pocas limitaciones.',
      gas_plus2: 'Reducción >75% o ≤4 días de cefalea al mes; calidad de vida claramente restaurada.',
    },
  },
  {
    id: 'cervical-distonia',
    category: 'Movimientos involuntarios',
    label: 'Distonía cervical — postura y dolor',
    description: 'Tortícolis espasmódica con postura anormal y dolor cervical.',
    suggestedDays: 28,
    form: {
      title: 'Corregir postura cervical anormal y reducir dolor',
      smart_specific:
        'Reducir desviación/rotación cervical involuntaria para mantener cabeza en posición neutra ≥15 min.',
      smart_measurable:
        'Escala TWSTRS (severidad) mejora ≥5 puntos; EVA cervical ≤3/10 en reposo.',
      smart_achievable: 'Respuesta esperada con toxina en SCM, trapecio y músculos accesorios.',
      smart_relevant: 'Mejora conducción, conversación cara a cara y sueño.',
      smart_timebound: 'Evaluar a las 4 semanas post-inyección.',
      gas_minus2: 'Postura igual o peor; EVA >6/10; no tolera posición neutra.',
      gas_minus1: 'Mejora leve de postura; EVA 4–5/10; posición neutra <5 min.',
      gas_zero: 'Cabeza en posición neutra ≥15 min; EVA ≤3/10; realiza actividades sentado con comodidad.',
      gas_plus1: 'Postura casi normal gran parte del día; EVA 0–2/10.',
      gas_plus2: 'Postura normal sostenida; sin dolor cervical significativo; retoma actividades previas.',
    },
  },
  {
    id: 'espasticidad-pediatrica-cuidado',
    category: 'Pediatría',
    label: 'Espasticidad pediátrica — higiene',
    description: 'Niño con PC y espasticidad de MSI que dificulta aseo y vestido.',
    suggestedDays: 28,
    form: {
      title: 'Facilitar higiene y vestido del miembro superior',
      smart_specific:
        'Reducir espasticidad de codo/muñeca para que el cuidador pueda vestir la camisa sin dolor al niño.',
      smart_measurable:
        'Ashworth de flexores de codo ≤1+; tiempo de vestido ≤5 min sin llanto por dolor.',
      smart_achievable: 'Dosis por peso (U/kg) dentro de guías pediátricas aprobadas.',
      smart_relevant: 'Menos estrés familiar en rutina diaria; mejor participación en escuela.',
      smart_timebound: 'Evaluar a las 4 semanas post-inyección.',
      gas_minus2: 'Vestido igual de difícil; niño con dolor o llanto frecuente durante aseo.',
      gas_minus1: 'Mejora leve; vestido aún requiere >8 min y molestias moderadas.',
      gas_zero: 'Vestido en ≤5 min con mínima resistencia; niño tolera movilización sin llanto.',
      gas_plus1: 'Cuidador realiza aseo con facilidad; niño coopera activamente.',
      gas_plus2: 'Niño participa en vestido con un brazo; espasticidad mínima en actividades guiadas.',
    },
  },
  {
    id: 'sialorrea',
    category: 'Otros',
    label: 'Sialorrea — control de saliva',
    description: 'Drooling significativo en paciente neurológico.',
    suggestedDays: 28,
    form: {
      title: 'Reducir sialorrea para higiene oral y social',
      smart_specific:
        'Disminuir escape de saliva visible que mancha ropa y requiere cambio de pañuelo cada hora.',
      smart_measurable:
        'Escala de gravedad de sialorrea (DS-FG) mejora ≥2 puntos; cambio de ropa ≤2 veces/día.',
      smart_achievable: 'Respuesta a toxina en glándulas salivales según protocolo.',
      smart_relevant: 'Mejora interacción social, higiene y confort del cuidador.',
      smart_timebound: 'Evaluar a las 4 semanas post-inyección.',
      gas_minus2: 'Sialorrea igual o peor; necesita cambio de ropa >6 veces/día.',
      gas_minus1: 'Reducción leve; aún cambia ropa 4–5 veces/día.',
      gas_zero: 'Saliva controlada; cambio de ropa/pañuelo ≤2 veces/día; rostro seco en reposo.',
      gas_plus1: 'Sialorrea mínima; solo en comidas; mejora notable en interacción social.',
      gas_plus2: 'Prácticamente sin sialorrea en reposo; no requiere pañuelo durante el día.',
    },
  },
  {
    id: 'estetica-frontal',
    category: 'Estética',
    label: 'Arrugas frontales — expresión natural',
    description: 'Paciente estético que busca suavizar frente sin aspecto congelado.',
    suggestedDays: 14,
    form: {
      title: 'Suavizar arrugas frontales manteniendo expresión natural',
      smart_specific:
        'Reducir líneas horizontales de la frente al elevar cejas, sin abolir completamente el movimiento.',
      smart_measurable:
        'Escala de Merz ≤2 en reposo y ≤1 en movimiento; paciente puede fruncir levemente sin líneas profundas.',
      smart_achievable: 'Dosis conservadora en músculo frontal según evaluación dinámica.',
      smart_relevant: 'Resultado natural que mantiene confianza en imagen personal y expresividad.',
      smart_timebound: 'Evaluar a los 14 días post-inyección (pico estético).',
      gas_minus2: 'Sin cambio visible en arrugas; paciente insatisfecho.',
      gas_minus1: 'Mejora leve; arrugas aún visibles en movimiento; expresión conservada.',
      gas_zero: 'Arrugas suavizadas en reposo; movimiento de cejas natural y simétrico.',
      gas_plus1: 'Piel lisa en reposo; movimiento expresivo conservado; alta satisfacción.',
      gas_plus2: 'Resultado excelente según expectativa del paciente; sin complicaciones (ptosis, asimetría).',
    },
  },
];

export const GAS_TEMPLATE_CATEGORIES = [
  ...new Set(GAS_GOAL_TEMPLATES.map((t) => t.category)),
];

export function applyGasTemplate(template: GasGoalTemplate): PatientGoalInput {
  const target = new Date();
  target.setDate(target.getDate() + template.suggestedDays);
  return {
    ...template.form,
    target_date: target.toISOString().slice(0, 10),
  };
}

export function formatSuggestedDate(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
}
