/**
 * Comprehensive muscle database with anatomical details, motor points, 
 * USG guidance, and dosing information for botulinum toxin treatments.
 * 
 * @module muscleData
 * @version 1.0.0
 */

import { dosisData } from '../constants/toxinData';

export interface MuscleAnatomy {
  function: string;        // Primary function in Spanish
  innervation: string;     // Nerve supply
  origin: string;          // Anatomical origin
  insertion: string;       // Anatomical insertion
}

export interface MotorPoint {
  description: string;     // Landmark-based location
  coordinates?: {          // Optional precise coordinates  
    x: number;             // Percentage from reference (0-100)
    y: number;             // Percentage from reference (0-100)
  };
  techniqueNotes: string[];// Injection technique tips
}

export interface USGGuidance {
  transducerType: string;  // e.g., "Lineal 10-14 MHz"
  view: 'Transversal' | 'Longitudinal' | 'Ambas';
  landmarks: string[];     // Visual landmarks on USG
  approach: string;        // In-plane vs out-of-plane
  precautions: string[];   // Safety warnings
  imageUrl?: string;       // USG illustration URL
}

export interface MuscleDosing {
  botox: { min: number; max: number };
  dysport: { min: number; max: number };
  xeomin: { min: number; max: number };
}

export interface MuscleData {
  id: string;
  name: string;              // Spanish name
  latinName: string;         // Latin anatomical name
  category: 'upper-limb' | 'lower-limb' | 'neck' | 'trunk' | 'face';
  region: string;            // Subcategory (e.g., "Antebrazo", "Pierna")
  
  anatomy: MuscleAnatomy;
  motorPoint: MotorPoint;
  usgGuidance?: USGGuidance;
  dosing: MuscleDosing;
  
  indications: string[];     // Common pathologies treated
  relatedMuscles?: string[]; // Synergistic muscles (IDs)
}

export const musclesData: MuscleData[] = [
  // ========== FACE MUSCLES ==========
  {
    id: 'frontalis',
    name: 'Frontal',
    latinName: 'Frontalis',
    category: 'face',
    region: 'Frente',
    anatomy: {
      function: 'Elevación de las cejas y formación de arrugas horizontales en la frente',
      innervation: 'Nervio facial (rama temporal)',
      origin: 'Galea aponeurótica',
      insertion: 'Piel de la frente y cejas'
    },
    motorPoint: {
      description: '2-3 cm por encima de la ceja, en línea con el centro pupilar',
      coordinates: { x: 50, y: 25 },
      techniqueNotes: [
        'Inyección superficial (intradérmica o subcutánea superficial)',
        'Evitar inyectar por debajo de la línea supraorbitaria',
        'Distribuir en 4-8 puntos según zona a tratar'
      ]
    },
    dosing: {
      botox: dosisData.Botox['Frontalis'],
      dysport: dosisData.Dysport['Frontalis'],
      xeomin: dosisData.Botox['Frontalis'] // Xeomin same ratio as Botox
    },
    indications: ['Migraña Crónica', 'Estética Facial (arrugas frontales)'],
    relatedMuscles: ['corrugator', 'procerus']
  },
  {
    id: 'corrugator',
    name: 'Corrugador',
    latinName: 'Corrugator supercilii',
    category: 'face',
    region: 'Glabela',
    anatomy: {
      function: 'Aproximación de las cejas hacia medial y abajo (gesto de ceño fruncido)',
      innervation: 'Nervio facial (rama temporal)',
      origin: 'Hueso frontal (extremo medial del arco superciliar)',
      insertion: 'Piel de la ceja (porción media)'
    },
    motorPoint: {
      description: 'Tercio medial de la ceja, justo por encima del reborde orbitario',
      coordinates: { x: 30, y: 35 },
      techniqueNotes: [
        'Inyección perpendicular al hueso frontal',
        'Profundidad moderada (intramuscular)',
        'Evitar área supraorbitaria lateral (riesgo de ptosis palpebral)'
      ]
    },
    dosing: {
      botox: dosisData.Botox['Corrugator'],
      dysport: dosisData.Dysport['Corrugator'],
      xeomin: dosisData.Botox['Corrugator']
    },
    indications: ['Migraña Crónica', 'Estética Facial (líneas glabelares)'],
    relatedMuscles: ['procerus', 'frontalis']
  },
  {
    id: 'procerus',
    name: 'Prócer',
    latinName: 'Procerus',
    category: 'face',
    region: 'Glabela',
    anatomy: {
      function: 'Depresión de la porción medial de las cejas y formación de arrugas transversales en la raíz nasal',
      innervation: 'Nervio facial (rama temporal)',
      origin: 'Hueso nasal y cartílago nasal lateral',
      insertion: 'Piel del entrecejo (glabela)'
    },
    motorPoint: {
      description: 'Línea media, justo por encima de la raíz nasal',
      coordinates: { x: 50, y: 50 },
      techniqueNotes: [
        'Inyección única en línea media',
        'Superficial a moderada',
        'Punto más inferior de la glabela'
      ]
    },
    dosing: {
      botox: dosisData.Botox['Procerus'],
      dysport: dosisData.Dysport['Procerus'],
      xeomin: dosisData.Botox['Procerus']
    },
    indications: ['Migraña Crónica', 'Estética Facial (líneas del entrecejo)'],
    relatedMuscles: ['corrugator']
  },
  {
    id: 'orbicularis-oculi',
    name: 'Orbicular de los Ojos',
    latinName: 'Orbicularis oculi',
    category: 'face',
    region: 'Región periocular',
    anatomy: {
      function: 'Cierre de los párpados, protección ocular, y expresión facial',
      innervation: 'Nervio facial (ramas temporal y cigomática)',
      origin: 'Proceso frontal del maxilar, hueso frontal, ligamento palpebral medial',
      insertion: 'Comisura lateral palpebral y piel periocular'
    },
    motorPoint: {
      description: '3 puntos: lateral, central y medial del párpado (superior e inferior)',
      techniqueNotes: [
        'Inyección superficial (subcutánea)',
        'Evitar canto medial (riesgo de diplopía)',
        'Distribuir uniformemente para prevenir asimetrías'
      ]
    },
    dosing: {
      botox: dosisData.Botox['Orbicularis oculi'],
      dysport: dosisData.Dysport['Orbicularis oculi'],
      xeomin: dosisData.Botox['Orbicularis oculi']
    },
    indications: ['Blefaroespasmo', 'Estética Facial (patas de gallo)', 'Sincinesias Faciales'],
    relatedMuscles: ['frontalis', 'corrugator']
  },
  {
    id: 'temporalis',
    name: 'Temporal',
    latinName: 'Temporalis',
    category: 'face',
    region: 'Sien',
    anatomy: {
      function: 'Elevación y retracción de la mandíbula (masticación)',
      innervation: 'Nervio mandibular (rama del trigémino)',
      origin: 'Fosa temporal del cráneo',
      insertion: 'Apófisis coronoides de la mandíbula'
    },
    motorPoint: {
      description: 'Zona temporal, 2-3 cm por encima y por delante del pabellón auricular',
      techniqueNotes: [
        'Inyecciones en 4 puntos distribuidos en la región temporal',
        'Profundidad moderada (intramuscular)',
        'Evitar ramas superficiales de la arteria temporal'
      ]
    },
    dosing: {
      botox: dosisData.Botox['Temporalis'],
      dysport: dosisData.Dysport['Temporalis'],
      xeomin: dosisData.Botox['Temporalis']
    },
    indications: ['Migraña Crónica', 'Bruxismo'],
    relatedMuscles: ['occipitalis']
  },

  // ========== NECK MUSCLES ==========
  {
    id: 'trapezius',
    name: 'Trapecio',
    latinName: 'Trapezius',
    category: 'neck',
    region: 'Cuello y hombro',
    anatomy: {
      function: 'Elevación, retracción y rotación de la escápula; extensión y rotación del cuello',
      innervation: 'Nervio accesorio (XI par craneal)',
      origin: 'Protuberancia occipital externa, ligamento nucal, procesos espinosos C7-T12',
      insertion: 'Clavícula lateral, acromion, espina escapular'
    },
    motorPoint: {
      description: 'Porción descendente: punto medio entre acromion y C7',
      techniqueNotes: [
        'Inyección intramuscular profunda',
        'Distribuir en 3 sitios por lado (superior, medio, inferior)',
        'Evitar área cercana al nervio accesorio'
      ]
    },
    usgGuidance: {
      transducerType: 'Lineal 10-12 MHz',
      view: 'Transversal',
      landmarks: ['Músculo trapecio como estructura triangular superficial', 'Aponeurosis profunda'],
      approach: 'In-plane de lateral a medial',
      precautions: ['Evitar inyección demasiado profunda (riesgo de neumotor']
    },
    dosing: {
      botox: dosisData.Botox['Trapezius'],
      dysport: dosisData.Dysport['Trapezius'],
      xeomin: dosisData.Botox['Trapezius']
    },
    indications: ['Migraña Crónica', 'Distonía Cervical', 'Espasticidad'],
    relatedMuscles: ['cervical-paraspinals']
  },
  {
    id: 'cervical-paraspinals',
    name: 'Paraespinales Cervicales',
    latinName: 'Cervical Paraspinals',
    category: 'neck',
    region: 'Cuello posterior',
    anatomy: {
      function: 'Extensión, flexión lateral y rotación del cuello',
      innervation: 'Ramas dorsales de nervios espinales cervicales',
      origin: 'Procesos espinosos y transversos de vértebras cervicales',
      insertion: 'Vértebras cervicales adyacentes y cráneo'
    },
    motorPoint: {
      description: '2-3 cm lateral a línea media, a nivel C2-C6',
      techniqueNotes: [
        'Inyección bilateral en 2 sitios por lado',
        'Profundidad moderada',
        'Evitar inyección demasiado profunda (riesgo vascular)'
      ]
    },
    dosing: {
      botox: dosisData.Botox['Cervical Paraspinals'],
      dysport: dosisData.Dysport['Cervical Paraspinals'],
      xeomin: dosisData.Botox['Cervical Paraspinals']
    },
    indications: ['Migraña Crónica', 'Distonía Cervical'],
    relatedMuscles: ['trapezius', 'occipitalis']
  },

  // ========== UPPER LIMB MUSCLES ==========
  {
    id: 'biceps-brachii',
    name: 'Bíceps Braquial',
    latinName: 'Biceps brachii',
    category: 'upper-limb',
    region: 'Brazo',
    anatomy: {
      function: 'Flexión del codo y supinación del antebrazo',
      innervation: 'Nervio musculocutáneo',
      origin: 'Tubérculo supraglenoideo (cabeza larga) y apófisis coracoides (cabeza corta)',
      insertion: 'Tuberosidad del radio'
    },
    motorPoint: {
      description: 'Tercio medio del brazo, cara anterior',
      coordinates: { x: 50, y: 50 },
      techniqueNotes: [
        'Distribuir en 2-4 sitios a lo largo del vientre muscular',
        'Inyección intramuscular moderada a profunda',
        'Guía por palpación o electroestimulación recomendada'
      ]
    },
    usgGuidance: {
      transducerType: 'Lineal 10-14 MHz',
      view: 'Transversal',
      landmarks: ['Húmero profundo', 'Fascia del bíceps', 'Arteria braquial medial'],
      approach: 'In-plane de lateral a medial',
      precautions: ['Evitar paquete neurovascular medial (arteria y nervio mediano)']
    },
    dosing: {
      botox: dosisData.Botox['Biceps brachii'],
      dysport: dosisData.Dysport['Biceps brachii'],
      xeomin: dosisData.Botox['Biceps brachii']
    },
    indications: ['Espasticidad de Miembros Superiores', 'Espasticidad Pediátrica'],
    relatedMuscles: ['brachialis', 'flexor-carpi-radialis']
  },
  {
    id: 'flexor-carpi-radialis',
    name: 'Flexor Radial del Carpo',
    latinName: 'Flexor carpi radialis',
    category: 'upper-limb',
    region: 'Antebrazo',
    anatomy: {
      function: 'Flexión y abducción radial de la muñeca',
      innervation: 'Nervio mediano',
      origin: 'Epicóndilo medial del húmero',
      insertion: 'Base del 2° metacarpiano'
    },
    motorPoint: {
      description: 'Tercio proximal del antebrazo, cara anterior, línea media-medial',
      techniqueNotes: [
        'Inyección guiada por palpación del tendón',
        'Profundidad moderada',
        'Evitar inyección tendinosa'
      ]
    },
    usgGuidance: {
      transducerType: 'Lineal 10-14 MHz',
      view: 'Transversal',
      landmarks: ['Tendón del flexor radial del carpo', 'Arteria radial lateral'],
      approach: 'In-plane',
      precautions: ['Evitar arteria radial que corre lateralmente']
    },
    dosing: {
      botox: dosisData.Botox['Flexor carpi radialis'],
      dysport: dosisData.Dysport['Flexor carpi radialis'],
      xeomin: dosisData.Botox['Flexor carpi radialis']
    },
    indications: ['Espasticidad de Miembros Superiores'],
    relatedMuscles: ['flexor-digitorum-superficialis', 'pronator-teres']
  },
  {
    id: 'flexor-digitorum-profundus',
    name: 'Flexor Profundo de los Dedos',
    latinName: 'Flexor digitorum profundus',
    category: 'upper-limb',
    region: 'Antebrazo',
    anatomy: {
      function: 'Flexión de las articulaciones interfalángicas distales de los dedos 2-5',
      innervation: 'Nervio mediano (dedos 2-3) y nervio ulnar (dedos 4-5)',
      origin: 'Cúbito (cara anterior y medial) y membrana interósea',
      insertion: 'Base de las falanges distales de los dedos 2-5'
    },
    motorPoint: {
      description: 'Tercio medio del antebrazo, cara anterior, profundo',
      techniqueNotes: [
        'Inyección profunda guiada por USG o electroestimulación',
        'Músculo profundo bajo el flexor superficial',
        'Distribuir en 2-3 sitios'
      ]
    },
    usgGuidance: {
      transducerType: 'Lineal 10-14 MHz',
      view: 'Transversal',
      landmarks: ['Flexor superficial (superficial)', 'Cúbito y radio (profundos)', 'Membrana interósea'],
      approach: 'In-plane',
      precautions: ['Evitar vasos interóseos', 'Confirmar profundidad antes de inyectar']
    },
    dosing: {
      botox: dosisData.Botox['Flexor digitorum profundus'],
      dysport: dosisData.Dysport['Flexor digitorum profundus'],
      xeomin: dosisData.Botox['Flexor digitorum profundus']
    },
    indications: ['Espasticidad de Miembros Superiores'],
    relatedMuscles: ['flexor-digitorum-superficialis']
  },
  {
    id: 'flexor-digitorum-superficialis',
    name: 'Flexor Superficial de los Dedos',
    latinName: 'Flexor digitorum superficialis',
    category: 'upper-limb',
    region: 'Antebrazo',
    anatomy: {
      function: 'Flexión de las articulaciones interfalángicas proximales de los dedos 2-5',
      innervation: 'Nervio mediano',
      origin: 'Epicóndilo medial del húmero, apófisis coronoides del cúbito, radio',
      insertion: 'Falanges medias de los dedos 2-5'
    },
    motorPoint: {
      description: 'Tercio proximal-medio del antebrazo, cara anterior',
      techniqueNotes: [
        'Más superficial que el flexor profundo',
        'Distribuir en 2-3 sitios',
        'Guía por palpación de vientres musculares individuales'
      ]
    },
    dosing: {
      botox: dosisData.Botox['Flexor digitorum superficialis'],
      dysport: dosisData.Dysport['Flexor digitorum superficialis'],
      xeomin: dosisData.Botox['Flexor digitorum superficialis']
    },
    indications: ['Espasticidad de Miembros Supernores'],
    relatedMuscles: ['flexor-digitorum-profundus', 'flexor-carpi-radialis']
  },

  // ========== LOWER LIMB MUSCLES ==========
  {
    id: 'gastrocnemio-medial',
    name: 'Gastrocnemio (Cabeza Medial)',
    latinName: 'Gastrocnemius (medial head)',
    category: 'lower-limb',
    region: 'Pierna posterior',
    anatomy: {
      function: 'Flexión plantar del pie, flexión de rodilla (componente menor)',
      innervation: 'Nervio tibial',
      origin: 'Cóndilo femoral medial y cápsula articular',
      insertion: 'Tendón calcáneo (Aquiles) → calcáneo'
    },
    motorPoint: {
      description: 'Tercio proximal de la pierna, cara medial posterior',
      techniqueNotes: [
        'Inyección en 2-3 sitios distribuidos en el vientre muscular',
        'Profundidad moderada',
        'Evitar región poplítea profunda'
      ]
    },
    usgGuidance: {
      transducerType: 'Lineal 10-14 MHz',
      view: 'Transversal',
      landmarks: ['Aponeurosis superficial', 'Músculo gastrocnemio (hipoecóico)', 'Sóleo profundo'],
      approach: 'In-plane de lateral a medial',
      precautions: [
        'Evitar paquete neurovascular poplíteo (profundo y medial)',
        'Realizar aspiración previa'
      ]
    },
    dosing: {
      botox: dosisData.Botox['Gastrocnemio (cabeza medial)'] || { min: 50, max: 120 },
      dysport: dosisData.Dysport['Gastrocnemio (cabeza medial)'],
      xeomin: dosisData.Botox['Gastrocnemio (cabeza medial)'] || { min: 50, max: 120 }
    },
    indications: ['Espasticidad de Miembros Inferiores', 'Espasticidad Pediátrica', 'Pie Equinovaro'],
    relatedMuscles: ['gastrocnemio-lateral', 'soleus']
  },
  {
    id: 'gastrocnemio-lateral',
    name: 'Gastrocnemio (Cabeza Lateral)',
    latinName: 'Gastrocnemius (lateral head)',
    category: 'lower-limb',
    region: 'Pierna posterior',
    anatomy: {
      function: 'Flexión plantar del pie, flexión de rodilla (componente menor)',
      innervation: 'Nervio tibial',
      origin: 'Cóndilo femoral lateral y cápsula articular',
      insertion: 'Tendón calcáneo (Aquiles) → calcáneo'
    },
    motorPoint: {
      description: 'Tercio proximal de la pierna, cara lateral posterior',
      techniqueNotes: [
        'Similar a cabeza medial',
        'Distribuir en 2-3 sitios',
        'Menos volumen que cabeza medial típicamente'
      ]
    },
    usgGuidance: {
      transducerType: 'Lineal 10-14 MHz',
      view: 'Transversal',
      landmarks: ['Músculo gastrocnemio lateral', 'Nervio peroneo común (evitar, lateral y superficial)'],
      approach: 'In-plane',
      precautions: ['Evitar nervio peroneo común que cruza lateral al cuello del peroné']
    },
    dosing: {
      botox: dosisData.Botox['Gastrocnemio (cabeza lateral)'] || { min: 50, max: 120 },
      dysport: dosisData.Dysport['Gastrocnemio (cabeza lateral)'],
      xeomin: dosisData.Botox['Gastrocnemio (cabeza lateral)'] || { min: 50, max: 120 }
    },
    indications: ['Espasticidad de Miembros Inferiores', 'Espasticidad Pediátrica'],
    relatedMuscles: ['gastrocnemio-medial', 'soleus']
  },
  {
    id: 'soleus',
    name: 'Sóleo',
    latinName: 'Soleus',
    category: 'lower-limb',
    region: 'Pierna posterior profunda',
    anatomy: {
      function: 'Flexión plantar del pie (músculo postural principal)',
      innervation: 'Nervio tibial',
      origin: 'Cara posterior de tibia y peroné, arco tendinoso del sóleo',
      insertion: 'Tendón calcáneo (Aquiles) → calcáneo'
    },
    motorPoint: {
      description: 'Tercio medio de la pierna, profundo al gastrocnemio',
      techniqueNotes: [
        'Inyección guiada por USG recomendada (músculo profundo)',
        'Distribuir en 2-4 sitios',
        'Mayor volumen de toxina que gastrocnemio'
      ]
    },
    usgGuidance: {
      transducerType: 'Lineal 10-14 MHz',
      view: 'Transversal',
      landmarks: ['Gastrocnemio superficial', 'Sóleo profundo (grosor significativo)', 'Vasos tibiales posteriores (profundos)'],
      approach: 'In-plane',
      precautions: ['Evitar vasos tibiales posteriores profundamente', 'Confirmar profundidad con USG']
    },
    dosing: {
      botox: dosisData.Botox['Sóleo'],
      dysport: dosisData.Dysport['Sóleo'],
      xeomin: dosisData.Botox['Sóleo']
    },
    indications: ['Espasticidad de Miembros Inferiores', 'Espasticidad Pediátrica'],
    relatedMuscles: ['gastrocnemio-medial', 'gastrocnemio-lateral', 'tibialis-posterior']
  },
  {
    id: 'tibialis-posterior',
    name: 'Tibial Posterior',
    latinName: 'Tibialis posterior',
    category: 'lower-limb',
    region: 'Pierna posterior profunda',
    anatomy: {
      function: 'Flexión plantar e inversión del pie',
      innervation: 'Nervio tibial',
      origin: 'Cara posterior de tibia, peroné y membrana interósea',
      insertion: 'Tubérculo del navicular y huesos del tarso'
    },
    motorPoint: {
      description: 'Tercio medio de la pierna, profundo, medial',
      techniqueNotes: [
        'Inyección OBLIGATORIAMENTE guiada por USG (muy profundo)',
        'Músculo de difícil acceso',
        '1-2 sitios de inyección'
      ]
    },
    usgGuidance: {
      transducerType: 'Lineal 10-14 MHz',
      view: 'Transversal',
      landmarks: ['Tibia medial', 'Sóleo superficial', 'Tibial posterior profundo (adyacente a tibia)', 'Arteria y nervio tibiales posteriores'],
      approach: 'In-plane de medial a lateral',
      precautions: ['Alto riesgo vascular - arteria tibial posterior adyacente', 'Confirmar músculo con USG antes de inyectar']
    },
    dosing: {
      botox: dosisData.Botox['Tibialis posterior'],
      dysport: dosisData.Dysport['Tibialis posterior'],
      xeomin: dosisData.Botox['Tibialis posterior']
    },
    indications: ['Espasticidad de Miembros Inferiores', 'Espasticidad Pediátrica', 'Pie Varo Dinámico'],
    relatedMuscles: ['soleus', 'flexor-hallucis-longus']
  },
  {
    id: 'flexor-hallucis-longus',
    name: 'Flexor Largo del Dedo Gordo',
    latinName: 'Flexor hallucis longus',
    category: 'lower-limb',
    region: 'Pierna posterior profunda',
    anatomy: {
      function: 'Flexión del dedo gordo del pie, soporte del arco longitudinal',
      innervation: 'Nervio tibial',
      origin: 'Cara posterior del peroné y membrana interósea',
      insertion: 'Base de la falange distal del hallux'
    },
    motorPoint: {
      description: 'Tercio medio de la pierna, lateral y profundo',
      techniqueNotes: [
        'Guía por USG esencial',
        'Músculo profundo lateral',
        'Inyección cuidadosa por proximidad vascular'
      ]
    },
    dosing: {
      botox: dosisData.Botox['Flexor hallucis longus'],
      dysport: dosisData.Dysport['Flexor hallucis longus'],
      xeomin: dosisData.Botox['Flexor hallucis longus']
    },
    indications: ['Espasticidad de Miembros Inferiores', 'Garra del Hallux'],
    relatedMuscles: ['flexor-digitorum-longus', 'tibialis-posterior']
  },
  {
    id: 'rectus-femoris',
    name: 'Recto Femoral',
    latinName: 'Rectus femoris',
    category: 'lower-limb',
    region: 'Muslo anterior',
    anatomy: {
      function: 'Extensión de rodilla y flexión de cadera',
      innervation: 'Nervio femoral',
      origin: 'Espina ilíaca anteroinferior y borde superior del acetábulo',
      insertion: 'Patela (vía tendón del cuádriceps) → tuberosidad tibial'
    },
    motorPoint: {
      description: 'Tercio medio del muslo, cara anterior, línea media',
      techniqueNotes: [
        'Distribuir en 2-3 sitios a lo largo del músculo',
        'Profundidad moderada a profunda',
        'Músculo superficial y fácilmente palpable'
      ]
    },
    dosing: {
      botox: dosisData.Botox['Rectus femoris (cuádriceps anterior)'],
      dysport: dosisData.Dysport['Rectus femoris (cuádriceps anterior)'],
      xeomin: dosisData.Botox['Rectus femoris (cuádriceps anterior)']
    },
    indications: ['Espasticidad en Extensión (Rodilla Rígida)', 'Espasticidad Pediátrica'],
    relatedMuscles: []
  }
];

/**
 * Helper functions for muscle data retrieval
 */
export const getMuscleById = (id: string): MuscleData | undefined => {
  return musclesData.find(m => m.id === id);
};

export const getMusclesByCategory = (category: MuscleData['category']): MuscleData[] => {
  return musclesData.filter(m => m.category === category);
};

export const getMusclesByRegion = (region: string): MuscleData[] => {
  return musclesData.filter(m => m.region.toLowerCase().includes(region.toLowerCase()));
};

export const searchMuscles = (query: string): MuscleData[] => {
  const lowerQuery = query.toLowerCase();
  return musclesData.filter(m => 
    m.name.toLowerCase().includes(lowerQuery) ||
    m.latinName.toLowerCase().includes(lowerQuery) ||
    m.region.toLowerCase().includes(lowerQuery)
  );
};

export const getMusclesByIndication = (indication: string): MuscleData[] => {
  const lowerIndication = indication.toLowerCase();
  return musclesData.filter(m =>
    m.indications.some(ind => ind.toLowerCase().includes(lowerIndication))
  );
};
