/**
 * Interfaces para el manejo de protocolos clínicos de Toxina Botulínica.
 * Basado en compendios clínicos (2024-2025) y guías de dosificación de marcas líderes.
 */

import { dosisData } from '../constants/toxinData';

export type ProtocolVariant = 'A' | 'B' | 'C';

export interface PathologyProtocol {
  muscle?: string;           // Nombre común del músculo
  muscleName?: string;       // Identificador interno para cálculos (clave en toxinData)
  dose: string;              // Texto descriptivo de la dosis
  bilateral: boolean;        // Indica si es tratamiento bilateral
  notes?: string;            // Instrucciones específicas
  /** Variante de protocolo (p. ej. hombro A/B/C). Sin valor = incluido en carga por defecto. */
  protocolVariant?: ProtocolVariant;
}

export interface PathologyData {
  id: string;
  title: string;
  subtitle: string;
  category: 'neurological' | 'autonomic' | 'urological' | 'aesthetic';
  description: string;
  suggestedToxin: string;    // Marca o tipo de toxina recomendada
  conversionNotes?: string;  // Notas sobre ratios de conversión
  protocols: PathologyProtocol[];
  frequency?: string;
  maxDose?: string;
  additionalInfo?: string[];
  references: string[];      // Bibliografía con links
  image: string;
}

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://qwhrdmllpznvqrxygytp.supabase.co';

export const pathologiesData: PathologyData[] = [
  {
    id: 'blefaroespasmo',
    title: 'Blefaroespasmo',
    subtitle: 'Espasmo del Orbicular de los Ojos',
    category: 'neurological',
    description: 'Contracción involuntaria bilateral del músculo orbicularis oculi. Tratamiento de primera línea con toxina botulínica en 3 sitios por ojo.',
    suggestedToxin: 'Botox, Xeomin o Dysport',
    conversionNotes: 'Botox:Xeomin ratio 1:1. Dysport ratio aproximado 2.5:1.',
    protocols: [
      { muscle: 'Orbicular de los ojos', muscleName: 'Orbicularis oculi', dose: '1.25-2.5 U por sitio', bilateral: true, notes: '3 sitios por ojo (lateral, central, medial del párpado superior e inferior)' },
    ],
    frequency: 'Cada 3-4 meses',
    maxDose: '200 U total (Botox) en 30 días',
    additionalInfo: [
      'Iniciar con dosis bajas (1.25 U) en pacientes sin tratamiento previo.',
      'Evitar inyecciones cerca del canto medial para prevenir diplopía.',
      'El efecto se observa en 3-4 días, máximo en 1-2 semanas.',
      'IncobotulinumtoxinA: 25 U por ojo recomendado.'
    ],
    references: [
      'AbbVie Inc. (2023). Blepharospasm - Dosing and Administration. BOTOX ONE. https://www.botoxone.com/blepharospasm/dosing',
      'Anwar, M. S., & Zafar, H. (2013). Efficacy of botulinum toxin in benign essential Blepharospasm. Pakistan Journal of Medical Sciences. https://pmc.ncbi.nlm.nih.gov/articles/PMC3905398/'
    ],
    image: `${supabaseUrl}/storage/v1/object/public/PortadasPatologias/blefaroespasmo.jpeg`,
  },
  {
    id: 'espasticidad-pediatrica',
    title: 'Espasticidad Pediátrica',
    subtitle: 'Parálisis Cerebral Infantil',
    category: 'neurological',
    description: 'Tratamiento de la espasticidad en niños con parálisis cerebral. La dosificación es estrictamente basada en peso corporal (U/kg).',
    suggestedToxin: 'Botox o Xeomin',
    conversionNotes: 'Dosificación pediátrica basada en peso corporal. No intercambiar marcas sin recalcular dosis.',
    protocols: [
      { muscle: 'Gastrocnemio', muscleName: 'Gastrocnemio (cabeza medial)', dose: '3-6 U/kg', bilateral: true, notes: 'Máximo 200 U totales (miembro superior) o 300 U (miembro inferior)' },
      { muscle: 'Sóleo', muscleName: 'Sóleo', dose: '2-4 U/kg', bilateral: true },
      { muscle: 'Tibial Posterior', muscleName: 'Tibialis posterior', dose: '2-4 U/kg', bilateral: true },
    ],
    frequency: 'Cada 12-16 semanas',
    maxDose: '300 U (miembro inferior) / 200 U (miembro superior) - OnabotulinumtoxinA',
    additionalInfo: [
      'Miembro superior: 3-6 U/kg (máx 200 U).',
      'Miembro inferior: 4-8 U/kg (máx 300 U).',
      'IncobotulinumtoxinA: gastrocnemio 6-9 U/kg.',
      'Considerar sedación o anestesia local en niños pequeños.',
    ],
    references: [
      'AbbVie Inc. (2023). Pediatric Spasticity - Dosing and Administration. BOTOX ONE. https://www.botoxone.com/pediatric-spasticity/dosing',
      'AbbVie Inc. (2024). Highlights of prescribing information: BOTOX. https://www.rxabbvie.com/pdf/botox_pi.pdf'
    ],
    image: `${supabaseUrl}/storage/v1/object/public/PortadasPatologias/espasticidad.jpeg`,
  },
  {
    id: 'espasticidad-superior',
    title: 'Espasticidad de Miembros Superiores',
    subtitle: 'Post-ACV y Lesiones Neurológicas',
    category: 'neurological',
    description: 'Manejo de la espasticidad focal del miembro superior (codo, muñeca, dedos) para mejorar la función y reducir el dolor.',
    suggestedToxin: 'Botox, Xeomin o Dysport',
    conversionNotes: 'Dosis total hasta 400 U (OnabotulinumtoxinA o IncobotulinumtoxinA). Dysport ratio 1:3.',
    protocols: [
      { muscle: 'Bíceps braquial', muscleName: 'Biceps brachii', dose: '100-200 U', bilateral: false, notes: 'Dividir en 4 sitios' },
      { muscle: 'Flexor radial del carpo', muscleName: 'Flexor carpi radialis', dose: '12.5-50 U', bilateral: false },
      { muscle: 'Flexor profundo de los dedos', muscleName: 'Flexor digitorum profundus', dose: '30-50 U', bilateral: false },
      { muscle: 'Flexor superficial de los dedos', muscleName: 'Flexor digitorum superficialis', dose: '30-50 U', bilateral: false },
    ],
    frequency: 'Cada 12-16 semanas',
    maxDose: '400 U (Botox/Xeomin) / 1000 U (Dysport)',
    additionalInfo: [
      'Guía por electroestimulación o ultrasonido mejora precisión.',
      'IncobotulinumtoxinA: bíceps 50-200 U, flexor radial del carpo 25-100 U.',
      'Ajustar según escala de Ashworth modificada.',
      'Combinar con terapia física para mejores resultados.',
    ],
    references: [
      'AbbVie Inc. (2024). Highlights of prescribing information: BOTOX. https://www.rxabbvie.com/pdf/botox_pi.pdf',
      'Allergan, Inc. (2011). BOTOX prescribing information. U.S. FDA. https://www.accessdata.fda.gov/drugsatfda_docs/label/2011/103000s5236lbl.pdf'
    ],
    image: `${supabaseUrl}/storage/v1/object/public/PortadasPatologias/espasticidadevc.jpeg`,
  },
  {
    id: 'hombro-doloroso-espastico',
    title: 'Hombro Doloroso Espástico',
    subtitle: 'Post-EVC / Hemiplejia',
    category: 'neurological',
    description:
      'Complicación frecuente tras enfermedad vascular cerebral: hombro en aducción y rotación interna con dolor que limita la rehabilitación. La toxina botulínica reduce el tono de los aductores/rotadores internos, alivia el dolor (EVA) y mejora el rango de movimiento pasivo de rotación externa. Abordaje habitualmente off-label en músculos proximales; requiere USG/EMG en músculos profundos.',
    suggestedToxin: 'Botox, Xeomin o Dysport',
    conversionNotes:
      'Botox:Xeomin 1:1. Dysport:Botox ~2,5–3:1 (no usar ratios >3:1). Dosis de hombro se suman al límite del miembro superior (hasta 400 U Botox/Xeomin por extremidad en espasticidad adulta).',
    protocols: [
      {
        muscle: 'Pectoral mayor',
        muscleName: 'Pectoral mayor',
        dose: '75-100 U (Botox/Xeomin)',
        bilateral: false,
        notes:
          '[Protocolo A – patrón aducción/RI] 3-4 sitios (fascículos clavicular y esternocostal). Músculo más frecuentemente tratado en encuestas clínicas.',
        protocolVariant: 'A',
      },
      {
        muscle: 'Subescapular',
        muscleName: 'Subscapularis',
        dose: '50-80 U (Botox/Xeomin)',
        bilateral: false,
        notes:
          '[Protocolo A] 2-4 sitios. Rotador interno principal; USG/EMG recomendados. Dosis media ~60 U en práctica clínica.',
        protocolVariant: 'A',
      },
      {
        muscle: 'Dorsal ancho',
        muscleName: 'Dorsal ancho',
        dose: '60-80 U (Botox/Xeomin)',
        bilateral: false,
        notes: '[Protocolo A] 2 sitios posterolaterales. Precaución pleural; preferir USG.',
        protocolVariant: 'A',
      },
      {
        muscle: 'Redondo mayor',
        muscleName: 'Redondo mayor',
        dose: '30-50 U (Botox/Xeomin)',
        bilateral: false,
        notes: '[Protocolo A] 1-2 sitios en axila posterior.',
        protocolVariant: 'A',
      },
      {
        muscle: 'Subescapular (enfoque Yelnik)',
        muscleName: 'Subscapularis',
        dose: '100 U (Botox/Xeomin)',
        bilateral: false,
        notes:
          '[Protocolo B – subescapular dominante] Dosis fija del ECA de Yelnik et al. para dolor espástico de hombro; no combinar con la dosis completa del Protocolo A en el mismo músculo.',
        protocolVariant: 'B',
      },
      {
        muscle: 'Pectoral mayor (refuerzo opcional)',
        muscleName: 'Pectoral mayor',
        dose: '50-75 U (Botox/Xeomin)',
        bilateral: false,
        notes:
          '[Protocolo B – opcional] Añadir solo si persiste aducción marcada tras enfoque subescapular o en ensayos combinados (p. ej. 100 U subescapular + 50-75 U pectoral).',
        protocolVariant: 'B',
      },
      {
        muscle: 'Infraespinoso',
        muscleName: 'Infraespinoso',
        dose: '50-60 U (Botox/Xeomin)',
        bilateral: false,
        notes:
          '[Protocolo B – variante clínica] Incluido en estudios con subescapular + pectoral para dolor post-ictus (p. ej. Lincoln et al.). Rotador externo; valorar si hay componente de dolor capsular.',
        protocolVariant: 'B',
      },
      {
        muscle: 'Deltoides (fibras posteriores)',
        muscleName: 'Deltoides',
        dose: '40-60 U (Botox/Xeomin)',
        bilateral: false,
        notes:
          '[Protocolo C – extensión patológica] Solo si el patrón incluye extensión espástica del hombro; no usar junto con dosis altas en tríceps sin planificar el total del miembro.',
        protocolVariant: 'C',
      },
      {
        muscle: 'Tríceps braquial (cabeza larga)',
        muscleName: 'Triceps brachii',
        dose: '50-75 U (Botox/Xeomin)',
        bilateral: false,
        notes: '[Protocolo C – extensión patológica] 2-3 sitios en vientre posterior del brazo; evitar surco radial.',
        protocolVariant: 'C',
      }
    ],
    frequency: 'Cada 12-16 semanas (repetir según respuesta clínica)',
    maxDose:
      'Hombro aislado: ~220-280 U (Botox/Xeomin) típico Protocolo A. Total miembro superior: máx. 400 U (Botox/Xeomin) / ~1000 U (Dysport) incluyendo codo/mano si se tratan en la misma sesión.',
    additionalInfo: [
      'Protocolo A (estándar): pectoral + subescapular + dorsal ancho + redondo mayor — patrón clásico aducción/RI post-EVC (encuesta nacional Pinho et al. y guías de hombro espástico).',
      'Protocolo B (alternativo): subescapular 100 U (Yelnik) ± pectoral 50-75 U ± infraespinoso 50-60 U — prioriza alivio del dolor y rotación externa pasiva; no duplicar dosis plenas del Protocolo A.',
      'Protocolo C (complementario): deltoides posterior + tríceps — solo para extensión espástica del hombro (Wissel / práctica clínica).',
      'Dilución habitual: 100 U en 1-2 mL SSF 0,9% sin preservantes. Anticoagulados: diluir en 1 mL y minimizar puntos.',
      'Iniciar rehabilitación (estiramiento pasivo lento, posicionamiento, fortalecimiento de antagonistas) en los primeros 3-7 días post-inyección.',
      'Eficacia en dolor: reducción media ~1,6 puntos EVA a 3-6 meses vs. placebo (Cochrane); mejoría de rotación externa pasiva ~17° al mes 1.',
      'Considerar bloqueo del nervio supraescapular para analgesia temprana; la toxina intramuscular suele ser superior a medio plazo (4-24 semanas).'
    ],
    references: [
      'Pinho, S., et al. (2023). Shoulder spasticity treatment with botulinum toxin: A nationwide cross-sectional survey. Cureus. https://pmc.ncbi.nlm.nih.gov/articles/PMC10704847/',
      'Yelnik, A. P., et al. (2007). Treatment of shoulder pain in spastic hemiplegia by reducing spasticity of the subscapular muscle. J Neurol Neurosurg Psychiatry. https://pmc.ncbi.nlm.nih.gov/articles/PMC2117719/',
      'Cochrane (2019). Botulinum toxin for shoulder pain. https://www.cochrane.org/es/evidence/CD008271_botulinum-toxin-shoulder-pain',
      'Wissel, J., et al. (2022). A practical guide to botulinum neurotoxin treatment of shoulder spasticity 2. Front Neurol. https://pmc.ncbi.nlm.nih.gov/articles/PMC9768330/',
      'Lincoln et al. / Stroke (2007). Intramuscular Botulinum Toxin-A Reduces Hemiplegic Shoulder Pain. https://www.ahajournals.org/doi/10.1161/strokeaha.107.484048',
      'Dressler, D., et al. (2021). Consensus guidelines for botulinum toxin therapy. J Neural Transm. https://pmc.ncbi.nlm.nih.gov/articles/PMC7969540/'
    ],
    image: `${supabaseUrl}/storage/v1/object/public/PortadasPatologias/espasticidadevc.jpeg`,
  },
  {
    id: 'sincinesias-faciales',
    title: 'Sincinesias Faciales',
    subtitle: 'Secuelas de Parálisis Facial',
    category: 'neurological',
    description: 'Movimientos involuntarios asociados tras parálisis facial. Tratamiento con dosis bajas dirigidas a músculos específicos.',
    suggestedToxin: 'Botox o Dysport',
    conversionNotes: 'Dosis muy bajas. Botox:Dysport aproximado 1:2.5.',
    protocols: [
      { muscle: 'Orbicular de los ojos', muscleName: 'Orbicularis oculi', dose: '4 U', bilateral: false, notes: 'Lado afectado únicamente' },
      { muscle: 'Platisma', muscleName: 'Platysma', dose: '2 U por punto', bilateral: false, notes: 'Total 9-10 U distribuidos' },
    ],
    frequency: 'Cada 3-4 meses',
    maxDose: '~15-20 U total por sesión',
    additionalInfo: [
      'Dosis típica total: 15.68 U por sesión.',
      'Requiere alta precisión en la localización.',
      'Combinar con rehabilitación neuromuscular.',
      'Guía por electromiografía recomendada.',
    ],
    references: [
      'Bonali, M., et al. (2025). Rehabilitation of facial nerve palsy combining neuromuscular retraining and botulinum toxin A injection. European Archives of Oto-Rhino-Laryngology. https://pmc.ncbi.nlm.nih.gov/articles/PMC12321944/',
      'Carré, F., et al. (2024). Botulinum toxin injections to manage sequelae of peripheral facial palsy. Toxins. https://pmc.ncbi.nlm.nih.gov/articles/PMC10974143/'
    ],
    image: `${supabaseUrl}/storage/v1/object/public/PortadasPatologias/paralisisfacial.jpeg`,
  },
  {
    id: 'migrana-cronica',
    title: 'Migraña Crónica',
    subtitle: 'Protocolo PREEMPT',
    category: 'neurological',
    description: 'Tratamiento preventivo para adultos con ≥15 días de cefalea al mes. El protocolo PREEMPT establece 31 sitios de inyección fijos en 7 grupos musculares.',
    suggestedToxin: 'Botox (OnabotulinumtoxinA)',
    conversionNotes: 'Dosis estándar de 155 U. No se recomienda el intercambio por otras marcas para este protocolo específico.',
    protocols: [
      { muscle: 'Frontal', muscleName: 'Frontalis', dose: '20 U', bilateral: true, notes: '4 sitios (5 U por sitio)' },
      { muscle: 'Corrugador', muscleName: 'Corrugator', dose: '10 U', bilateral: true, notes: '2 sitios (5 U por sitio)' },
      { muscle: 'Prócer', muscleName: 'Procerus', dose: '5 U', bilateral: false, notes: '1 sitio en línea media' },
      { muscle: 'Occipital', muscleName: 'Occipitalis', dose: '30 U', bilateral: true, notes: '6 sitios (5 U por sitio)' },
      { muscle: 'Temporal', muscleName: 'Temporalis', dose: '40 U', bilateral: true, notes: '8 sitios (5 U por sitio)' },
      { muscle: 'Trapecio', muscleName: 'Trapezius', dose: '30 U', bilateral: true, notes: '6 sitios (5 U por sitio)' },
      { muscle: 'Paraespinales cervicales', muscleName: 'Cervical Paraspinals', dose: '20 U', bilateral: true, notes: '4 sitios (5 U por sitio)' },
    ],
    frequency: 'Cada 12 semanas',
    maxDose: '195 U (incluyendo técnica Follow-the-Pain)',
    additionalInfo: [
      'Utilizar aguja 30G de 0.5 pulgadas.',
      'La estrategia "seguir el dolor" permite añadir 40 U en temporales, occipitales o trapecios.',
      'Eficacia evaluada tras 2-3 ciclos de tratamiento.'
    ],
    references: [
      'Ahmed, F., et al. (2025). Real-World Safety and Efficacy of 156 U–195 U OnabotulinumtoxinA. BMC Neurology. https://pmc.ncbi.nlm.nih.gov/articles/PMC12053858/',
      'AbbVie (2024). Botox Prescribing Information (VHB). https://www.rxabbvie.com/pdf/botox_pi.pdf',
      'Dodick, D. W., et al. (2010). PREEMPT 2 trial results. Cephalalgia. https://pubmed.ncbi.nlm.nih.gov/20647171/'
    ],
    image: `${supabaseUrl}/storage/v1/object/public/PortadasPatologias/migrania.jpeg`,
  },
  {
    id: 'estetica-facial',
    title: 'Estética Facial',
    subtitle: 'Glabela, Frente, Patas de Gallo',
    category: 'aesthetic',
    description: 'Tratamiento cosmético para reducir arrugas dinámicas faciales mediante la aplicación de toxina botulínica en músculos específicos de expresión facial.',
    suggestedToxin: 'Botox, Dysport o Xeomin',
    conversionNotes: 'Ratio aproximado Botox:Dysport 1:2.5-3. Xeomin equivalente a Botox.',
    protocols: [
      { muscle: 'Corrugador', muscleName: 'Corrugator', dose: '10 U', bilateral: true, notes: 'Glabela' },
      { muscle: 'Prócer', muscleName: 'Procerus', dose: '5 U', bilateral: false, notes: 'Glabela, línea media' },
      { muscle: 'Frontal', muscleName: 'Frontalis', dose: '10-20 U', bilateral: true, notes: '4-8 puntos, ajustar según fuerza muscular' },
      { muscle: 'Orbicular de los ojos', muscleName: 'Orbicularis oculi', dose: '12-24 U', bilateral: true, notes: 'Patas de gallo, 3-6 puntos por lado' },
    ],
    frequency: '3-4 meses',
    maxDose: '50-60 U por sesión (zona superior facial)',
    additionalInfo: [
      'Efectos visibles en 3-7 días',
      'Máximo efecto a las 2 semanas',
      'Duración promedio: 3-4 meses',
      'Técnica de inyección: intramuscular superficial',
    ],
    references: [
      'Carruthers, J., et al. (2004). Consensus recommendations on the use of botulinum toxin type a in facial aesthetics. Plastic and Reconstructive Surgery, 114(6 Suppl), 1S–22S.',
      'AbbVie Inc. (2024). Highlights of prescribing information: BOTOX (onabotulinumtoxinA).',
    ],
    image: `${supabaseUrl}/storage/v1/object/public/PortadasPatologias/esteticafacial.jpeg`,
  },
  {
    id: 'espasticidad-adulta',
    title: 'Espasticidad (Adultos)',
    subtitle: 'Manejo de Miembros Inferiores',
    category: 'neurological',
    description: 'Tratamiento de la espasticidad focal en miembros inferiores (pie equinovaro, flexión de dedos) para mejorar la marcha y reducir el dolor.',
    suggestedToxin: 'Dysport (AbobotulinumtoxinA)',
    conversionNotes: 'Dysport permite dosis volumétricas mayores. Ratio ONA:ABO 1:3.',
    protocols: [
      { muscle: 'Gastrocnemio (Medial)', muscleName: 'Gastrocnemio (cabeza medial)', dose: '100-450 U', bilateral: true, notes: 'Dividir en 2 sitios por cabeza' },
      { muscle: 'Gastrocnemio (Lateral)', muscleName: 'Gastrocnemio (cabeza lateral)', dose: '100-450 U', bilateral: true },
      { muscle: 'Sóleo', muscleName: 'Sóleo', dose: '300-550 U', bilateral: true },
      { muscle: 'Tibial Posterior', muscleName: 'Tibialis posterior', dose: '100-250 U', bilateral: true },
    ],
    frequency: 'Cada 12-16 semanas',
    maxDose: '1500 U (Dysport) / 400 U (Botox/Xeomin)',
    additionalInfo: [
      'Guía por ultrasonido (US) mejora significativamente el alcance de metas (GAS).',
      'La dosificación debe ajustarse según la escala de Ashworth modificada.'
    ],
    references: [
      'Zorowitz, R. D., et al. (2025). Muscle selection and dosing with abobotulinumtoxinA for LLS. JRM. https://pmc.ncbi.nlm.nih.gov/articles/PMC11836465/',
      'Dressler, D., et al. (2021). Consensus guidelines for botulinum toxin therapy. J Neural Transm. https://pmc.ncbi.nlm.nih.gov/articles/PMC7969540/'
    ],
    image: `${supabaseUrl}/storage/v1/object/public/PortadasPatologias/espasticidadinferiores.jpeg`,
  },
  {
    id: 'distonia-cervical',
    title: 'Distonía Cervical',
    subtitle: 'Tortícolis y Postura Anormal',
    category: 'neurological',
    description: 'Trastorno caracterizado por contracciones musculares involuntarias del cuello. La toxina es el tratamiento de primera línea.',
    suggestedToxin: 'Xeomin, Botox o Dysport',
    conversionNotes: 'Xeomin y Botox ratio 1:1. Xeomin es libre de proteínas complejas (150 kDa).',
    protocols: [
      { muscle: 'Esplenio de la cabeza', muscleName: 'Esplenio de la cabeza', dose: '50-100 U', bilateral: true, notes: 'Músculo más frecuentemente tratado (75% casos)' },
      { muscle: 'Esternocleidomastoideo', muscleName: 'Esternocleidomastoideo', dose: '25-50 U', bilateral: true, notes: 'Limitar a <100 U para evitar disfagia' },
      { muscle: 'Elevador de la escápula', muscleName: 'Elevador de la escápula', dose: '25-50 U', bilateral: true },
    ],
    frequency: 'Cada 12 semanas',
    maxDose: '400 U (Botox/Xeomin) / 1000 U (Dysport)',
    additionalInfo: [
      'El esplenio de la cabeza es el músculo más comúnmente involucrado.',
      'Evitar dosis altas en esternocleidomastoideo para prevenir disfagia.',
      'Considerar guía por EMG o ultrasonido para mayor precisión.'
    ],
    references: [
      'Evidente, V. G., et al. (2014). The Science of Dosing in Cervical Dystonia. https://pmc.ncbi.nlm.nih.gov/articles/PMC4233211/',
      'Merz Pharmaceuticals (2023). XEOMIN Dosing & Administration Guide. https://hcp.xeomin.com/',
      'Spiegel, L. L., et al. (2020). FDA Approvals and Consensus Guidelines. Toxins. https://doi.org/10.3390/toxins12050332'
    ],
    image: `${supabaseUrl}/storage/v1/object/public/PortadasPatologias/distoniacervical.jpeg`,
  },
  {
    id: 'hiperhidrosis',
    title: 'Hiperhidrosis Axilar',
    subtitle: 'Tratamiento Primario',
    category: 'autonomic',
    description: 'Tratamiento de la sudoración excesiva axilar mediante inyecciones intradérmicas de toxina botulínica que bloquean la liberación de acetilcolina en glándulas sudoríparas.',
    suggestedToxin: 'Botox (OnabotulinumtoxinA)',
    protocols: [
      { muscle: 'Axila', dose: '50 U', bilateral: true, notes: '10-15 sitios de inyección por axila' },
    ],
    frequency: 'Cada 4-7 meses (según respuesta individual)',
    maxDose: '100 U total (50 U por axila) - OnabotulinumtoxinA',
    additionalInfo: [
      'Inyecciones intradérmicas separadas por 1-2 cm',
      'Técnica de cuadrícula recomendada',
      'Efecto visible en 2-4 días',
      'Duración promedio: 4-7 meses',
      'Prueba de Minor (yodo-almidón) puede guiar sitios de inyección',
    ],
    references: [
      'AbbVie Inc. (2024). Highlights of prescribing information: BOTOX (onabotulinumtoxinA).',
      'Eilertsen, T., et al. (2024). Botulinum toxin A and B for palmoplantar hyperhidrosis. Dermatology and Therapy, 14(3), 805–811.',
      'Ito, K., et al. (2011). Therapeutic effectiveness of botulinum toxin type A based on severity of palmar hyperhidrosis. The Journal of Dermatology, 38(9), 859–863.',
    ],
    image: `${supabaseUrl}/storage/v1/object/public/PortadasPatologias/hiperhidrosisaxilar.jpeg`,
  },
  {
    id: 'vejiga-hiperactiva',
    title: 'Vejiga Hiperactiva (OAB)',
    subtitle: 'Inyección en el Detrusor',
    category: 'urological',
    description: 'Tratamiento de la urgencia urinaria severa mediante inyección cistoscópica.',
    suggestedToxin: 'Botox (OnabotulinumtoxinA)',
    protocols: [
      { muscle: 'Detrusor (Idiopática)', dose: '100 U', bilateral: false, notes: '20 sitios de 0.5 mL (5 U), evitando el trígono' },
      { muscle: 'Detrusor (Neurogénica)', dose: '200 U', bilateral: false, notes: '30 sitios de 1.0 mL (~6.7 U)' },
    ],
    frequency: '6 a 9 meses',
    maxDose: '200 U',
    additionalInfo: [
      'Reducir de 20 a 5 sitios mejora el dolor post-procedimiento sin perder eficacia.',
      'Informar sobre el riesgo de infección urinaria (UTI) y retención.'
    ],
    references: [
      'Enemchukwu, E., et al. (2025). Injection Paradigms for iOAB. Toxins. https://pmc.ncbi.nlm.nih.gov/articles/PMC12115849/',
      'Chen, A., et al. (2025). Optimizing the Injection Schema (Higher Doses). Neurourology. https://pubmed.ncbi.nlm.nih.gov/40836399/',
      'Santos-Silva, A., et al. (2013). Botulinum toxin for bladder dysfunction. Int J Urol. https://pubmed.ncbi.nlm.nih.gov/23634720/'
    ],
    image: `${supabaseUrl}/storage/v1/object/public/PortadasPatologias/vejiga.jpeg`,
  },
  {
    id: 'sialorrea',
    title: 'Sialorrea Crónica',
    subtitle: 'Glándulas Salivales',
    category: 'autonomic',
    description: 'Hipersalivación debilitante en pacientes con trastornos neurológicos (Parkinson, ELA).',
    suggestedToxin: 'Myobloc (RimabotulinumtoxinB)',
    conversionNotes: 'Myobloc (Tipo B) tiene alta afinidad por glándulas autonómicas. Ratio 1:25-30 respecto a Tipo A.',
    protocols: [
      { muscle: 'Glándula Parótida', dose: '500-1500 U (B)', bilateral: true, notes: 'Localización por ultrasonido recomendada' },
      { muscle: 'Glándula Submandibular', dose: '250 U (B)', bilateral: true, notes: 'Inyectar bilateralmente' },
    ],
    frequency: 'Cada 12 semanas',
    maxDose: '3500 U (Myobloc) / 100 U (Xeomin)',
    additionalInfo: [
      'Myobloc (Tipo B) es preferido sobre Tipo A para glándulas salivales.',
      'Guía por ultrasonido aumenta la precisión y seguridad.',
      'Mejoría significativa en calidad de vida reportada en estudios clínicos.'
    ],
    references: [
      'Dashtipour, K., et al. (2017). RimabotulinumtoxinB in sialorrhea. J Clin Mov Disord. https://pmc.ncbi.nlm.nih.gov/articles/PMC5460542/',
      'Jost, W. H., et al. (2019). Therapy of Sialorrhea with BoNT. Neurology. https://pmc.ncbi.nlm.nih.gov/articles/PMC6858891/',
      'Song, T., et al. (2024). RimabotulinumtoxinB Update. Dermatol Surg. https://pubmed.ncbi.nlm.nih.gov/39196834/'
    ],
    image: `${supabaseUrl}/storage/v1/object/public/PortadasPatologias/sialorrea.jpeg`,
  }
];

/**
 * Funciones auxiliares para la gestión de datos.
 */
export const getPathologyById = (id: string): PathologyData | undefined => {
  return pathologiesData.find(p => p.id === id);
};

/** Patologías con protocolos A/B/C (p. ej. hombro doloroso espástico). */
export const getPathologyProtocolVariants = (pathologyId: string): ProtocolVariant[] => {
  const pathology = getPathologyById(pathologyId);
  if (!pathology) return [];
  const variants = new Set(
    pathology.protocols.map((p) => p.protocolVariant).filter(Boolean) as ProtocolVariant[]
  );
  return Array.from(variants).sort();
};

/** Extrae rango o dosis fija en unidades Ona/Xeomin desde texto del protocolo. */
export const parseProtocolDoseOna = (doseText: string): { min?: number; max?: number; fixed?: number } => {
  const normalized = doseText.replace(/,/g, '.');
  const rangeMatch = normalized.match(/(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)/);
  if (rangeMatch) {
    return { min: parseFloat(rangeMatch[1]), max: parseFloat(rangeMatch[2]) };
  }
  const fixedMatch = normalized.match(/(\d+(?:\.\d+)?)\s*U/i);
  if (fixedMatch) {
    return { fixed: parseFloat(fixedMatch[1]) };
  }
  return {};
};

const ONA_TO_DYSPORT_RATIO = 2.5;

export type ToxinBrand = 'Botox' | 'Dysport' | 'Xeomin';

/** Convierte dosis del protocolo (Ona) a U sugeridas para la marca seleccionada. */
export const resolveProtocolSuggestedDose = (
  protocol: PathologyProtocol,
  brand: ToxinBrand
): { customDose: number; doseOption: 'min' | 'max' } => {
  const muscleKey = protocol.muscleName || protocol.muscle || '';
  const parsed = parseProtocolDoseOna(protocol.dose);
  const onaMin = parsed.min;
  const onaMax = parsed.max;
  const onaFixed = parsed.fixed;

  const brandRange = muscleKey ? dosisData[brand]?.[muscleKey] : undefined;

  if (brand === 'Dysport') {
    if (onaFixed !== undefined) {
      return { customDose: Math.round(onaFixed * ONA_TO_DYSPORT_RATIO), doseOption: 'min' };
    }
    if (onaMin !== undefined && onaMax !== undefined) {
      const midOna = (onaMin + onaMax) / 2;
      return { customDose: Math.round(midOna * ONA_TO_DYSPORT_RATIO), doseOption: 'min' };
    }
    if (brandRange) {
      return { customDose: brandRange.min, doseOption: 'min' };
    }
    return { customDose: 0, doseOption: 'min' };
  }

  if (onaFixed !== undefined) {
    return { customDose: Math.round(onaFixed), doseOption: 'min' };
  }
  if (onaMin !== undefined && onaMax !== undefined) {
    return { customDose: Math.round((onaMin + onaMax) / 2), doseOption: 'min' };
  }
  if (brandRange) {
    return { customDose: brandRange.min, doseOption: 'min' };
  }
  return { customDose: 0, doseOption: 'min' };
};

export const getPathologyTemplate = (
  pathologyId: string,
  variant: ProtocolVariant = 'A'
) => {
  const pathology = getPathologyById(pathologyId);
  if (!pathology) return null;

  const hasVariants = pathology.protocols.some((p) => p.protocolVariant);

  return {
    pathology,
    variant,
    muscles: pathology.protocols
      .filter((p) => p.muscleName || p.muscle)
      .filter((p) => {
        if (!hasVariants) return true;
        return (p.protocolVariant || 'A') === variant;
      })
      .map((p) => ({
        muscleName: p.muscleName || p.muscle!,
        bilateral: p.bilateral,
        displayName: p.muscle || p.muscleName!,
        dose: p.dose,
        notes: p.notes,
        protocol: p,
      })),
  };
};

export const getPathologiesByCategory = (category: PathologyData['category']): PathologyData[] => {
  return pathologiesData.filter((p) => p.category === category);
};
