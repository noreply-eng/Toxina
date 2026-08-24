/**
 * Body Anatomy Definition and Mapping for Interactive SVG Selection
 * 
 * Maps anatomical body regions to specific muscles in the database,
 * providing rich biomechanical context and quick selection helpers.
 * 
 * @module bodyAnatomyData
 */

import { MuscleData, getMuscleById } from './muscleData';

export type BodyRegionKey =
  | 'cabeza'
  | 'cuello'
  | 'trapecio'
  | 'hombros'
  | 'pecho'
  | 'dorsales'
  | 'brazos'
  | 'triceps'
  | 'antebrazos'
  | 'abdomen'
  | 'pelvis'
  | 'gluteos'
  | 'cuadriceps'
  | 'isquiotibiales'
  | 'pantorrillas';

export type AnatomyView = 'front' | 'back';

export interface BodyRegionInfo {
  key: BodyRegionKey;
  views: AnatomyView[];
  shortLabel: string;
  tag: string;
  title: string;
  subtitle: string;
  desc: string;
  icon: string;
  muscleIds: string[];
  clinicalFocus: string[];
}

export const bodyRegionsDatabase: Record<BodyRegionKey, BodyRegionInfo> = {
  cabeza: {
    key: 'cabeza',
    views: ['front', 'back'],
    shortLabel: 'Cabeza y Cara',
    tag: 'Cabeza y Cara',
    title: 'Complejo Craneofacial',
    subtitle: 'Mímica facial, masticación y cefaleas',
    desc: 'Músculos estriados encargados de la expresión facial, masticación, oclusión palpebral y puntos de inyección para migraña crónica.',
    icon: 'face',
    muscleIds: [
      'frontalis',
      'corrugator',
      'procerus',
      'depressor-supercilii',
      'orbicularis-oculi',
      'masseter',
      'temporalis',
      'medial-pterygoid',
      'lateral-pterygoid',
      'nasalis',
      'zygomaticus-major',
      'zygomaticus-minor',
      'levator-labii-superioris',
      'levator-labii-superioris-alaeque-nasi',
      'levator-anguli-oris',
      'risorius',
      'buccinator',
      'orbicularis-oris',
      'depressor-anguli-oris',
      'depressor-labii-inferioris',
      'mentalis'
    ],
    clinicalFocus: [
      'Protocolo PREEMPT para Migraña Crónica',
      'Distonía Craneofacial / Blefaroespasmo / Espasmo Hemifacial',
      'Bruxismo e Hipertrofia Maseterina',
      'Tratamiento de Mímica y Asimetrías Faciales'
    ]
  },
  cuello: {
    key: 'cuello',
    views: ['front', 'back'],
    shortLabel: 'Cuello',
    tag: 'Zona Cervical',
    title: 'Músculos del Cuello',
    subtitle: 'Control axial y rotación cefálica',
    desc: 'Soporte postural axial cefálico, flexión, extensión, inclinación y rotación. Esenciales en el abordaje de la distonía cervical.',
    icon: 'accessibility',
    muscleIds: [
      'sternocleidomastoid',
      'platysma',
      'splenius-capitis',
      'cervical-paraspinals',
      'levator-scapulae'
    ],
    clinicalFocus: [
      'Distonía Cervical (Tortícolis, Laterócolis, Retrocolis, Anterocolis)',
      'Espasticidad Cervical y Dolor Miofascial',
      'Cefalea Tensional / Migraña'
    ]
  },
  trapecio: {
    key: 'trapecio',
    views: ['back'],
    shortLabel: 'Trapecio',
    tag: 'Espalda Alta y Cintura Escapular',
    title: 'Trapecio y Estabilizadores Escapulares',
    subtitle: 'Soporte de carga escapulotorácica',
    desc: 'Estructura triangular de gran superficie que estabiliza la cintura escapular, eleva y retrae las escápulas.',
    icon: 'accessibility_new',
    muscleIds: [
      'trapezius',
      'levator-scapulae',
      'romboides'
    ],
    clinicalFocus: [
      'Migraña Crónica (Puntos trapeciales PREEMPT)',
      'Síndrome de Dolor Miofascial Cervicotorácico',
      'Distonía Cervical con elevación de hombro'
    ]
  },
  hombros: {
    key: 'hombros',
    views: ['front', 'back'],
    shortLabel: 'Hombros',
    tag: 'Cintura Escapular',
    title: 'Deltoides y Manguito Rotador',
    subtitle: 'Abducción y rotación glenohumeral',
    desc: 'Proporciona movilidad multidireccional, abducción humeral y coaptación articular de la cabeza del húmero.',
    icon: 'sports_gymnastics',
    muscleIds: [
      'deltoides',
      'supraespinoso',
      'infraespinoso',
      'subscapularis',
      'redondo-menor',
      'redondo-mayor'
    ],
    clinicalFocus: [
      'Espasticidad del Hombro y Hombro Doloroso Hemipléjico',
      'Patrón de Rotación Interna / Aducción de Hombro',
      'Capsulitis Adhesiva y Dolor Articular'
    ]
  },
  pecho: {
    key: 'pecho',
    views: ['front'],
    shortLabel: 'Pectorales',
    tag: 'Tórax Anterior',
    title: 'Pectorales y Serrato Anterior',
    subtitle: 'Aducción braquial y fijación costal',
    desc: 'Grupo de empuje y aducción horizontal del tren superior. Cruciales en el patrón de hombro en aducción y rotación interna espástica.',
    icon: 'fitness_center',
    muscleIds: [
      'pectoral-mayor',
      'pectoral-menor',
      'serrato-anterior'
    ],
    clinicalFocus: [
      'Espasticidad en Patrón de Hombro Aductor / Rotador Interno',
      'Hombro Congelado Espástico en Ictus',
      'Distonía Ocupacional del Miembro Superior'
    ]
  },
  dorsales: {
    key: 'dorsales',
    views: ['back'],
    shortLabel: 'Dorsales',
    tag: 'Espalda Media y Lumbar',
    title: 'Dorsal Ancho y Paraespinales',
    subtitle: 'Tracción, extensión espinal y tronco',
    desc: 'El músculo más amplio del torso; genera tracción, rotación interna humeral y mantiene la postura erecta vertebral.',
    icon: 'accessibility_new',
    muscleIds: [
      'dorsal-ancho',
      'cuadrado-lumbar',
      'romboides'
    ],
    clinicalFocus: [
      'Espasticidad Truncal y Asimetrías de Tronco',
      'Dolor Lumbar Miofascial Crónico y Síndrome Cuadrado Lumbar',
      'Patrón de Retracción Escapular'
    ]
  },
  brazos: {
    key: 'brazos',
    views: ['front'],
    shortLabel: 'Bíceps y Brazo',
    tag: 'Brazo Anterior',
    title: 'Bíceps Braquial y Flexores de Codo',
    subtitle: 'Flexión de codo y supinación',
    desc: 'Flexores principales de la articulación del codo. Clave en el patrón flexor del miembro superior en espasticidad.',
    icon: 'pan_tool_alt',
    muscleIds: [
      'biceps-brachii',
      'brachialis',
      'coracobrachialis',
      'brachioradialis'
    ],
    clinicalFocus: [
      'Patrón de Codo Flexionado en Espasticidad (Ictus, TEC, PC)',
      'Distonía Braquial',
      'Guiado USG / Puntos Motores para Inyección Segura'
    ]
  },
  triceps: {
    key: 'triceps',
    views: ['back'],
    shortLabel: 'Tríceps',
    tag: 'Brazo Posterior',
    title: 'Tríceps Braquial',
    subtitle: 'Extensión articular de codo',
    desc: 'Extensor principal del codo, antagonista del bíceps, abarca la mayor masa muscular de la cara dorsal del brazo.',
    icon: 'sports_martial_arts',
    muscleIds: [
      'triceps-brachii'
    ],
    clinicalFocus: [
      'Coconsumo Espástico y Co-contracción Agonista/Antagonista',
      'Distonía de Miembro Superior',
      'Bloqueos Analgésicos y Espasticidad'
    ]
  },
  antebrazos: {
    key: 'antebrazos',
    views: ['front', 'back'],
    shortLabel: 'Antebrazo y Mano',
    tag: 'Extremidad Distal',
    title: 'Antebrazo, Muñeca y Mano',
    subtitle: 'Flexoextensión y prensión manual',
    desc: 'Complejo de alta densidad tendinosa y muscular responsable de la pronosupinación, flexión/extensión de muñeca y motricidad fina de los dedos.',
    icon: 'back_hand',
    muscleIds: [
      'flexor-carpi-radialis',
      'flexor-carpi-ulnar',
      'flexor-digitorum-superficialis',
      'flexor-digitorum-profundus',
      'flexor-pollicis-longus',
      'pronator-teres',
      'pronator-quadratus',
      'supinador',
      'extensor-carpi-radialis-longus',
      'extensor-carpi-radialis-brevis',
      'extensor-carpi-ulnar',
      'extensor-digitorum-communis',
      'extensor-indicis',
      'extensor-digiti-minimi',
      'extensor-pollicis-longus',
      'extensor-pollicis-brevis',
      'abductor-pollicis-longus',
      'adductor-pollicis'
    ],
    clinicalFocus: [
      'Patrón de Muñeca y Dedos Flexionados (Puño Cerrado)',
      'Pulgar Incluido en Palma (Thumb-in-palm)',
      'Calambre del Escribiente / Distonía Focal de la Mano',
      'Puntos Motores con Guía Ecográfica (USG)'
    ]
  },
  abdomen: {
    key: 'abdomen',
    views: ['front'],
    shortLabel: 'Abdomen y Core',
    tag: 'Núcleo / Core',
    title: 'Pared Abdominal y Lumbar',
    subtitle: 'Presión intraabdominal y flexión de tronco',
    desc: 'Cilindro muscular de contención visceral y control postural. Transfiere fuerzas entre tren superior e inferior.',
    icon: 'grid_view',
    muscleIds: [
      'cuadrado-lumbar'
    ],
    clinicalFocus: [
      'Distonía Truncal / Camptocormia / Pleurotótonos',
      'Dolor Lumbar Refractario Miofascial'
    ]
  },
  pelvis: {
    key: 'pelvis',
    views: ['front'],
    shortLabel: 'Pelvis y Cadera',
    tag: 'Transición Lumbo-Pélvica',
    title: 'Flexores Profundos de Cadera y Aductores',
    subtitle: 'Flexión de cadera y aproximación',
    desc: 'Conexión biomecánica entre el raquis y los miembros inferiores. Primordiales en el control de la zancada y marcha.',
    icon: 'directions_walk',
    muscleIds: [
      'psoas-mayor',
      'iliaco',
      'pectineus',
      'adductor-longus',
      'adductor-magnus',
      'gracilis'
    ],
    clinicalFocus: [
      'Patrón de Cadera Flexionada / Aducción Espástica (Tijera)',
      'Parálisis Cerebral Infantil y Marcha Espástica',
      'Guiado USG Profundo'
    ]
  },
  gluteos: {
    key: 'gluteos',
    views: ['back'],
    shortLabel: 'Glúteos',
    tag: 'Pelvis Posterior',
    title: 'Complejo Glúteo y Pelvitrocantéreos',
    subtitle: 'Extensión y abducción de cadera',
    desc: 'Mayor generador de potencia para la bipedestación erecta, propulsión en marcha y estabilidad monopodal.',
    icon: 'airline_seat_recline_normal',
    muscleIds: [
      'gluteo-medio'
    ],
    clinicalFocus: [
      'Marcha de Trendelenburg / Inestabilidad Pélvica',
      'Síndrome Piriforme y Ciatalgia',
      'Espasticidad de Cadera'
    ]
  },
  cuadriceps: {
    key: 'cuadriceps',
    views: ['front'],
    shortLabel: 'Cuádriceps',
    tag: 'Muslo Anterior',
    title: 'Cuádriceps Femoral',
    subtitle: 'Extensión de rodilla y soporte antigravitatorio',
    desc: 'Masa muscular más voluminosa del muslo. Soporta el impacto y extiende la articulación femorotibial en la marcha.',
    icon: 'airline_seat_legroom_extra',
    muscleIds: [
      'rectus-femoris',
      'vastos-cuadriceps'
    ],
    clinicalFocus: [
      'Marcha con Rodilla Rígida (Stiff Knee Gait)',
      'Espasticidad Extensora de Rodilla',
      'Coconsumo en Parálisis Cerebral'
    ]
  },
  isquiotibiales: {
    key: 'isquiotibiales',
    views: ['back'],
    shortLabel: 'Isquiosurales',
    tag: 'Muslo Posterior',
    title: 'Isquiosurales (Femoral)',
    subtitle: 'Flexión de rodilla y deceleración',
    desc: 'Cadena posterior encargada de la deceleración en fase de oscilación de la marcha y flexión activa de rodilla.',
    icon: 'directions_walk',
    muscleIds: [
      'biceps-femoris',
      'semitendinosus',
      'semimembranosus',
      'popliteus'
    ],
    clinicalFocus: [
      'Patrón de Rodilla Flexionada (Crouch Gait)',
      'Espasticidad Flexora de Rodilla en Lesión Medular / Ictus',
      'Equilibrio Agonista-Antagonista Femorotibial'
    ]
  },
  pantorrillas: {
    key: 'pantorrillas',
    views: ['front', 'back'],
    shortLabel: 'Pantorrilla y Pie',
    tag: 'Pierna y Pie',
    title: 'Tríceps Sural, Tibiales y Pie',
    subtitle: 'Flexión plantar, dorsiflexión y apoyo',
    desc: 'Propulsión elástica mediante el tendón de Aquiles, dorsiflexión para despeje del pie y control del arco plantar.',
    icon: 'steps',
    muscleIds: [
      'gastrocnemio-medial',
      'gastrocnemio-lateral',
      'soleus',
      'tibialis-anterior',
      'tibialis-posterior',
      'peroneus-longus',
      'peroneus-brevis',
      'peroneus-tertius',
      'extensor-digitorum-longus',
      'extensor-hallucis-longus',
      'flexor-digitorum-longus',
      'flexor-hallucis-longus',
      'flexor-digitorum-brevis',
      'flexor-hallucis-brevis',
      'abductor-hallucis'
    ],
    clinicalFocus: [
      'Patrón de Pie Equinovaro / Pie Equino Espástico',
      'Dedos en Garra / Hiperextensión de Hallux (Striatal Toe)',
      'Marcha en Punta de Pies en Parálisis Cerebral',
      'Inyección Selectiva USG de Sóleo vs Gastrocnemios'
    ]
  }
};

/**
 * Obtiene la información de una región anatómica por su clave.
 */
export const getBodyRegionByKey = (key: BodyRegionKey | string): BodyRegionInfo | undefined => {
  return bodyRegionsDatabase[key as BodyRegionKey];
};

/**
 * Retorna la lista de regiones según la vista anatómica ('front' | 'back').
 */
export const getBodyRegionsByView = (view: AnatomyView): BodyRegionInfo[] => {
  return Object.values(bodyRegionsDatabase).filter((r) => r.views.includes(view));
};

/**
 * Retorna todas las regiones registradas.
 */
export const getAllBodyRegions = (): BodyRegionInfo[] => {
  return Object.values(bodyRegionsDatabase);
};

/**
 * Resuelve los objetos MuscleData asociados a una región anatómica.
 */
export const getMusclesForRegion = (regionKey: BodyRegionKey | string): MuscleData[] => {
  const info = getBodyRegionByKey(regionKey);
  if (!info) return [];

  const found: MuscleData[] = [];
  const seenIds = new Set<string>();

  info.muscleIds.forEach((id) => {
    const m = getMuscleById(id);
    if (m && !seenIds.has(m.id)) {
      seenIds.add(m.id);
      found.push(m);
    }
  });

  return found;
};

/**
 * Encuentra qué región anatómica contiene un músculo específico.
 */
export const findRegionForMuscleId = (muscleId: string): BodyRegionInfo | undefined => {
  return Object.values(bodyRegionsDatabase).find((r) => r.muscleIds.includes(muscleId));
};
