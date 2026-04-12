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
  /** Ilustración del punto motor / técnica (opcional) */
  imageUrl?: string;
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
      precautions: ['Evitar inyección demasiado profunda (riesgo de neumotórax)']
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
    indications: ['Espasticidad de Miembros Superiores'],
    relatedMuscles: ['flexor-digitorum-profundus', 'flexor-carpi-radialis']
  },
  {
    id: 'brachialis',
    name: 'Braquial',
    latinName: 'Brachialis',
    category: 'upper-limb',
    region: 'Brazo',
    anatomy: {
      function: 'Flexión del codo (principal flexor con el antebrazo en pronación)',
      innervation: 'Nervio musculocutáneo',
      origin: 'Cara anterior del húmero (mitad distal)',
      insertion: 'Tuberosidad coronoides del cúbito'
    },
    motorPoint: {
      description: 'Tercio medio del brazo, cara anterior, inmediatamente medial al bíceps braquial',
      coordinates: { x: 48, y: 52 },
      techniqueNotes: [
        'Profundo al bíceps; USG o EMG recomendados si hay duda',
        '1–3 puntos a lo largo del vientre muscular',
        'Evitar el surco braquial medial (neurovascular)'
      ]
    },
    usgGuidance: {
      transducerType: 'Lineal 10–14 MHz',
      view: 'Transversal',
      landmarks: ['Bíceps braquial superficial', 'Braquial profundo', 'Húmero anterior'],
      approach: 'In-plane lateral a medial',
      precautions: ['No inyectar en el surco bicipital medial (arteria braquial y nervio mediano)']
    },
    dosing: {
      botox: dosisData.Botox['Brachialis'],
      dysport: dosisData.Dysport['Brachialis'],
      xeomin: dosisData.Botox['Brachialis']
    },
    indications: ['Espasticidad de Miembros Superiores', 'Espasticidad Pediátrica'],
    relatedMuscles: ['biceps-brachii', 'pronator-teres']
  },
  {
    id: 'brachioradialis',
    name: 'Braquiorradial',
    latinName: 'Brachioradialis',
    category: 'upper-limb',
    region: 'Antebrazo',
    anatomy: {
      function: 'Flexión del codo con el antebrazo en posición neutra entre pronación y supinación',
      innervation: 'Nervio radial',
      origin: 'Borde lateral del epicóndilo lateral del húmero',
      insertion: 'Proceso estiloide del radio (distal)'
    },
    motorPoint: {
      description: 'Tercio proximal del antebrazo, cara lateral, sobre el radio',
      coordinates: { x: 55, y: 42 },
      techniqueNotes: [
        'Palpar el vientre más lateral del compartimento flexor superficial',
        '2–3 inyecciones distribuidas',
        'Precaución con la rama superficial del nervio radial'
      ]
    },
    usgGuidance: {
      transducerType: 'Lineal 10–14 MHz',
      view: 'Transversal',
      landmarks: ['Braquiorradial superficial', 'Radio', 'Extensor carpi radialis longus medial'],
      approach: 'In-plane',
      precautions: ['Nervio radial superficial lateral al braquiorradial en tercio distal']
    },
    dosing: {
      botox: dosisData.Botox['Brachioradialis'],
      dysport: dosisData.Dysport['Brachioradialis'],
      xeomin: dosisData.Botox['Brachioradialis']
    },
    indications: ['Espasticidad de Miembros Superiores'],
    relatedMuscles: ['biceps-brachii', 'extensor-carpi-radialis-longus']
  },
  {
    id: 'triceps-brachii',
    name: 'Tríceps Braquial',
    latinName: 'Triceps brachii',
    category: 'upper-limb',
    region: 'Brazo',
    anatomy: {
      function: 'Extensión del codo; cabeza larga también extiende el hombro',
      innervation: 'Nervio radial',
      origin: 'Cabeza larga: escápula; cabeza lateral y medial: húmero',
      insertion: 'Olécranon del cúbito'
    },
    motorPoint: {
      description: 'Cara posterior del brazo: vientres lateral y largo en tercio proximal a medio',
      coordinates: { x: 50, y: 45 },
      techniqueNotes: [
        'Distribuir en cabeza lateral y medial (y larga si se trata codo en flexión)',
        'Profundidad moderada',
        'Evitar surco entre cabeza lateral y húmero (nervio radial)'
      ]
    },
    usgGuidance: {
      transducerType: 'Lineal 10–14 MHz',
      view: 'Transversal',
      landmarks: ['Tríceps superficial', 'Húmero posterior', 'Canal radial profundo'],
      approach: 'In-plane',
      precautions: ['Nervio radial en surco entre tríceps e húmero; aspirar antes de inyectar']
    },
    dosing: {
      botox: dosisData.Botox['Triceps brachii'],
      dysport: dosisData.Dysport['Triceps brachii'],
      xeomin: dosisData.Botox['Triceps brachii']
    },
    indications: ['Espasticidad de Miembros Superiores', 'Espasticidad Pediátrica'],
    relatedMuscles: ['brachialis', 'brachioradialis']
  },
  {
    id: 'pronator-teres',
    name: 'Pronador Redondo',
    latinName: 'Pronator teres',
    category: 'upper-limb',
    region: 'Antebrazo',
    anatomy: {
      function: 'Pronación del antebrazo y flexión débil del codo',
      innervation: 'Nervio mediano',
      origin: 'Epicóndilo medial del húmero y coronoides del cúbito',
      insertion: 'Cara lateral del radio (tercio medio)'
    },
    motorPoint: {
      description: 'Borde medial del antebrazo proximal, justo distal al pliegue del codo',
      coordinates: { x: 42, y: 38 },
      techniqueNotes: [
        'Músculo superficial en cara medial proximal',
        '1–2 puntos',
        'Diferenciar de flexor radial del carpo'
      ]
    },
    usgGuidance: {
      transducerType: 'Lineal 10–14 MHz',
      view: 'Transversal',
      landmarks: ['Pronador redondo', 'Flexor carpi radialis', 'Arteria medial al mediano'],
      approach: 'In-plane lateral a medial',
      precautions: ['Arteria mediana y nervio mediano medial al pronador en el pliegue del codo']
    },
    dosing: {
      botox: dosisData.Botox['Pronator teres'],
      dysport: dosisData.Dysport['Pronator teres'],
      xeomin: dosisData.Botox['Pronator teres']
    },
    indications: ['Espasticidad de Miembros Superiores'],
    relatedMuscles: ['flexor-carpi-radialis', 'brachialis']
  },
  {
    id: 'deltoides',
    name: 'Deltoides',
    latinName: 'Deltoideus',
    category: 'upper-limb',
    region: 'Hombro',
    anatomy: {
      function: 'Abducción del hombro (fibras anteriores: flexión; posteriores: extensión)',
      innervation: 'Nervio axilar',
      origin: 'Clavícula, acromion y espina de la escápula',
      insertion: 'Tuberosidad deltoidea del húmero'
    },
    motorPoint: {
      description: 'Tercio medio del músculo, 2–3 cm distal al acromion (punto más ancho del hombro)',
      coordinates: { x: 50, y: 40 },
      techniqueNotes: [
        'Inyección intramuscular en porción acromial o espinal según patrón espástico',
        'Múltiples puntos si hay gran volumen',
        'Evitar la cara deltoidea muy anterior (proximidad plexo en algunos abordajes profundos)'
      ]
    },
    usgGuidance: {
      transducerType: 'Lineal 10–12 MHz',
      view: 'Transversal',
      landmarks: ['Deltoides superficial', 'Húmero profundo', 'Subdeltoideo bursa (si derrame)'],
      approach: 'In-plane',
      precautions: ['No penetrar demasiado profundo hacia la cabeza humeral sin visualización']
    },
    dosing: {
      botox: dosisData.Botox['Deltoides'],
      dysport: dosisData.Dysport['Deltoides'],
      xeomin: dosisData.Botox['Deltoides']
    },
    indications: ['Espasticidad de Miembros Superiores', 'Espasticidad Pediátrica'],
    relatedMuscles: ['pectoral-mayor', 'triceps-brachii']
  },
  {
    id: 'flexor-carpi-ulnar',
    name: 'Flexor Cubital del Carpo',
    latinName: 'Flexor carpi ulnaris',
    category: 'upper-limb',
    region: 'Antebrazo',
    anatomy: {
      function: 'Flexión y desviación ulnar de la muñeca',
      innervation: 'Nervio ulnar',
      origin: 'Epicóndilo medial del húmero y olécranon',
      insertion: 'Hueso pisiforme, hamato, base del 5.º metacarpiano'
    },
    motorPoint: {
      description: 'Tercio proximal del antebrazo, cara medial-posterior, junto al epicóndilo',
      coordinates: { x: 38, y: 48 },
      techniqueNotes: [
        'Palpar el tendón hacia la muñeca para localizar el vientre',
        '2–3 puntos',
        'Nervio ulnar pasa posterior al epicóndilo: no inyectar ahí'
      ]
    },
    usgGuidance: {
      transducerType: 'Lineal 10–14 MHz',
      view: 'Transversal',
      landmarks: ['FCU superficial medial', 'Nervio ulnar posterior al epicóndilo', 'Cúbito medial'],
      approach: 'In-plane lateral a medial',
      precautions: ['Evitar canal cubital y nervio ulnar en el epicóndilo medial']
    },
    dosing: {
      botox: dosisData.Botox['Flexor carpi ulnaris'],
      dysport: dosisData.Dysport['Flexor carpi ulnaris'],
      xeomin: dosisData.Botox['Flexor carpi ulnaris']
    },
    indications: ['Espasticidad de Miembros Superiores'],
    relatedMuscles: ['flexor-carpi-radialis', 'flexor-digitorum-superficialis']
  },
  {
    id: 'extensor-carpi-radialis-longus',
    name: 'Extensor Radial Largo del Carpo',
    latinName: 'Extensor carpi radialis longus',
    category: 'upper-limb',
    region: 'Antebrazo',
    anatomy: {
      function: 'Extensión y abducción radial de la muñeca',
      innervation: 'Nervio radial',
      origin: 'Borde lateral del epicóndilo lateral del húmero',
      insertion: 'Base del 2.º metacarpiano'
    },
    motorPoint: {
      description: 'Antebrazo proximal anterolateral, inmediatamente proximal al ECRB',
      techniqueNotes: [
        '2 puntos en el vientre muscular',
        'Superficial respecto al braquiorradial en la transición proximal'
      ]
    },
    usgGuidance: {
      transducerType: 'Lineal 10–14 MHz',
      view: 'Transversal',
      landmarks: ['ECRL', 'ECRB', 'Radio'],
      approach: 'In-plane',
      precautions: ['Rama superficial del nervio radial lateral']
    },
    dosing: {
      botox: dosisData.Botox['Extensor carpi radialis longus'],
      dysport: dosisData.Dysport['Extensor carpi radialis longus'],
      xeomin: dosisData.Botox['Extensor carpi radialis longus']
    },
    indications: ['Espasticidad de Miembros Superiores'],
    relatedMuscles: ['extensor-carpi-radialis-brevis', 'brachioradialis']
  },
  {
    id: 'extensor-carpi-radialis-brevis',
    name: 'Extensor Radial Corto del Carpo',
    latinName: 'Extensor carpi radialis brevis',
    category: 'upper-limb',
    region: 'Antebrazo',
    anatomy: {
      function: 'Extensión de muñeca (sinegia con ECRL)',
      innervation: 'Nervio radial (rama profunda)',
      origin: 'Epicóndilo lateral del húmero',
      insertion: 'Base del 3.er metacarpiano'
    },
    motorPoint: {
      description: 'Tercio proximal del antebrazo, cara dorsal, entre ECRL y extensor de los dedos',
      techniqueNotes: [
        'Muy implicado en espasticidad de muñeca en flexión',
        '1–2 puntos'
      ]
    },
    usgGuidance: {
      transducerType: 'Lineal 10–14 MHz',
      view: 'Transversal',
      landmarks: ['ECRB', 'Extensor común de los dedos', 'Radio'],
      approach: 'In-plane',
      precautions: ['Proximidad del tendón común extensor en epicóndilo']
    },
    dosing: {
      botox: dosisData.Botox['Extensor carpi radialis brevis'],
      dysport: dosisData.Dysport['Extensor carpi radialis brevis'],
      xeomin: dosisData.Botox['Extensor carpi radialis brevis']
    },
    indications: ['Espasticidad de Miembros Superiores'],
    relatedMuscles: ['extensor-carpi-radialis-longus', 'extensor-digitorum-communis']
  },
  {
    id: 'extensor-carpi-ulnar',
    name: 'Extensor Cubital del Carpo',
    latinName: 'Extensor carpi ulnaris',
    category: 'upper-limb',
    region: 'Antebrazo',
    anatomy: {
      function: 'Extensión y desviación ulnar de la muñeca',
      innervation: 'Nervio radial',
      origin: 'Epicóndilo lateral del húmero y cara posterior del cúbito',
      insertion: 'Base del 5.º metacarpiano'
    },
    motorPoint: {
      description: 'Tercio medio-proximal del antebrazo, cara dorsal ulnar',
      techniqueNotes: [
        'Lateral al extensor de los dedos en la cara ulnar',
        '2 puntos'
      ]
    },
    usgGuidance: {
      transducerType: 'Lineal 10–14 MHz',
      view: 'Transversal',
      landmarks: ['ECU', 'Extensor común', 'Cúbito dorsal'],
      approach: 'In-plane',
      precautions: ['Nervio ulnar dorsal en rama sensitiva superficial']
    },
    dosing: {
      botox: dosisData.Botox['Extensor carpi ulnaris'],
      dysport: dosisData.Dysport['Extensor carpi ulnaris'],
      xeomin: dosisData.Botox['Extensor carpi ulnaris']
    },
    indications: ['Espasticidad de Miembros Superiores'],
    relatedMuscles: ['extensor-digitorum-communis', 'flexor-carpi-ulnar']
  },
  {
    id: 'extensor-digitorum-communis',
    name: 'Extensor Común de los Dedos',
    latinName: 'Extensor digitorum',
    category: 'upper-limb',
    region: 'Antebrazo',
    anatomy: {
      function: 'Extensión de las falanges medias y distales (dedos 2–5) vía tendinosas',
      innervation: 'Nervio radial (rama profunda)',
      origin: 'Epicóndilo lateral del húmero',
      insertion: 'Aponeurosis extensoras de los dedos 2–5'
    },
    motorPoint: {
      description: 'Tercio medio del antebrazo, cara dorsal, línea central entre radial y ulnar',
      techniqueNotes: [
        '2–4 puntos a lo largo del vientre',
        'Diferenciar de extensores radiales y ECU'
      ]
    },
    usgGuidance: {
      transducerType: 'Lineal 10–14 MHz',
      view: 'Transversal',
      landmarks: ['EDC central dorsal', 'ECRB radial', 'ECU ulnar'],
      approach: 'In-plane',
      precautions: ['Interóssea posterior profunda']
    },
    dosing: {
      botox: dosisData.Botox['Extensor digitorum communis'],
      dysport: dosisData.Dysport['Extensor digitorum communis'],
      xeomin: dosisData.Botox['Extensor digitorum communis']
    },
    indications: ['Espasticidad de Miembros Superiores'],
    relatedMuscles: ['extensor-indicis', 'flexor-digitorum-superficialis']
  },
  {
    id: 'extensor-indicis',
    name: 'Extensor del Índice',
    latinName: 'Extensor indicis',
    category: 'upper-limb',
    region: 'Antebrazo',
    anatomy: {
      function: 'Extensión del dedo índice (sinergia con extensor común)',
      innervation: 'Nervio radial (rama profunda)',
      origin: 'Cara posterior del cúbito y membrana interósea',
      insertion: 'Aponeurosis extensora del índice'
    },
    motorPoint: {
      description: 'Tercio distal del antebrazo, cara dorsal ulnar al extensor común',
      techniqueNotes: [
        'Músculo más delgado; USG útil',
        '1–2 puntos'
      ]
    },
    dosing: {
      botox: dosisData.Botox['Extensor indicis'],
      dysport: dosisData.Dysport['Extensor indicis'],
      xeomin: dosisData.Botox['Extensor indicis']
    },
    indications: ['Espasticidad de Miembros Superiores'],
    relatedMuscles: ['extensor-digitorum-communis']
  },
  {
    id: 'flexor-pollicis-longus',
    name: 'Flexor Largo del Pulgar',
    latinName: 'Flexor pollicis longus',
    category: 'upper-limb',
    region: 'Antebrazo',
    anatomy: {
      function: 'Flexión de la falange distal del pulgar',
      innervation: 'Nervio mediano (rama interósea anterior)',
      origin: 'Cara anterior del radio y membrana interósea',
      insertion: 'Base de la falange distal del pulgar'
    },
    motorPoint: {
      description: 'Tercio medio del antebrazo, cara anterior radial, profundo al flexor superficial',
      techniqueNotes: [
        'Profundo; preferible USG',
        '1–2 puntos'
      ]
    },
    usgGuidance: {
      transducerType: 'Lineal 10–14 MHz',
      view: 'Transversal',
      landmarks: ['FPL profundo radial', 'Radio', 'Flexor superficial'],
      approach: 'In-plane',
      precautions: ['Arteria radial medial al FPL en tercio distal']
    },
    dosing: {
      botox: dosisData.Botox['Flexor pollicis longus'],
      dysport: dosisData.Dysport['Flexor pollicis longus'],
      xeomin: dosisData.Botox['Flexor pollicis longus']
    },
    indications: ['Espasticidad de Miembros Superiores'],
    relatedMuscles: ['flexor-digitorum-profundus', 'pronator-quadratus']
  },
  {
    id: 'pronator-quadratus',
    name: 'Pronador Cuadrado',
    latinName: 'Pronator quadratus',
    category: 'upper-limb',
    region: 'Antebrazo distal',
    anatomy: {
      function: 'Pronación del antebrazo (principalmente distal)',
      innervation: 'Nervio mediano (rama interósea anterior)',
      origin: 'Cara anterior distal del cúbito',
      insertion: 'Cara anterior distal del radio'
    },
    motorPoint: {
      description: 'Región distal del antebrazo, cara anterior, justo proximal a la muñeca',
      techniqueNotes: [
        'Músculo cuadrado profundo; casi siempre USG',
        'Volumen bajo de toxina'
      ]
    },
    dosing: {
      botox: dosisData.Botox['Pronator quadratus'],
      dysport: dosisData.Dysport['Pronator quadratus'],
      xeomin: dosisData.Botox['Pronator quadratus']
    },
    indications: ['Espasticidad de Miembros Superiores'],
    relatedMuscles: ['flexor-pollicis-longus', 'flexor-digitorum-profundus']
  },
  {
    id: 'extensor-pollicis-longus',
    name: 'Extensor Largo del Pulgar',
    latinName: 'Extensor pollicis longus',
    category: 'upper-limb',
    region: 'Antebrazo',
    anatomy: {
      function: 'Extensión de la falange distal del pulgar',
      innervation: 'Nervio radial (rama profunda)',
      origin: 'Cara posterior del cúbito y membrana interósea',
      insertion: 'Base de la falange distal del pulgar'
    },
    motorPoint: {
      description: 'Tercio medio-distal del antebrazo, cara dorsal, entre extensor propio y extensor corto',
      techniqueNotes: ['1–2 puntos', 'USG si hay poco tejido muscular residual']
    },
    dosing: {
      botox: dosisData.Botox['Extensor pollicis longus'],
      dysport: dosisData.Dysport['Extensor pollicis longus'],
      xeomin: dosisData.Botox['Extensor pollicis longus']
    },
    indications: ['Espasticidad de Miembros Superiores'],
    relatedMuscles: ['extensor-pollicis-brevis', 'abductor-pollicis-longus']
  },
  {
    id: 'extensor-pollicis-brevis',
    name: 'Extensor Corto del Pulgar',
    latinName: 'Extensor pollicis brevis',
    category: 'upper-limb',
    region: 'Antebrazo',
    anatomy: {
      function: 'Extensión de la falange proximal del pulgar',
      innervation: 'Nervio radial (rama profunda)',
      origin: 'Cara posterior del radio',
      insertion: 'Base de la falange proximal del pulgar'
    },
    motorPoint: {
      description: 'Cara dorsorradial del antebrazo distal (zona tabaquera anatómica proximal)',
      techniqueNotes: ['1 punto principal', 'Superficial respecto al EPL profundo']
    },
    dosing: {
      botox: dosisData.Botox['Extensor pollicis brevis'],
      dysport: dosisData.Dysport['Extensor pollicis brevis'],
      xeomin: dosisData.Botox['Extensor pollicis brevis']
    },
    indications: ['Espasticidad de Miembros Superiores'],
    relatedMuscles: ['extensor-pollicis-longus', 'abductor-pollicis-longus']
  },
  {
    id: 'abductor-pollicis-longus',
    name: 'Abductor Largo del Pulgar',
    latinName: 'Abductor pollicis longus',
    category: 'upper-limb',
    region: 'Antebrazo',
    anatomy: {
      function: 'Abducción y extensión de la primera falange; extensión de la muñeca',
      innervation: 'Nervio radial (rama profunda)',
      origin: 'Cara posterior del radio y cúbito',
      insertion: 'Base del primer metacarpiano'
    },
    motorPoint: {
      description: 'Cara posterior del antebrazo, tercio medio-lateral (compartimento móvil del pulgar)',
      techniqueNotes: ['2 puntos', 'Confundible con extensores del pulgar sin USG']
    },
    dosing: {
      botox: dosisData.Botox['Adductor pollicis longus'],
      dysport: dosisData.Dysport['Adductor pollicis longus'],
      xeomin: dosisData.Botox['Adductor pollicis longus']
    },
    indications: ['Espasticidad de Miembros Superiores'],
    relatedMuscles: ['extensor-pollicis-brevis', 'extensor-pollicis-longus']
  },
  {
    id: 'coracobrachialis',
    name: 'Coracobraquial',
    latinName: 'Coracobrachialis',
    category: 'upper-limb',
    region: 'Brazo',
    anatomy: {
      function: 'Flexión y aducción del brazo',
      innervation: 'Nervio musculocutáneo',
      origin: 'Apófisis coracoides de la escápula',
      insertion: 'Cara anteromedial del húmero (tercio medio)'
    },
    motorPoint: {
      description: 'Brazo proximal medial, entre pectoral mayor y bíceps corto',
      techniqueNotes: [
        'Profundo a pectoral mayor en región axilar',
        '1–2 puntos; USG recomendable'
      ]
    },
    dosing: {
      botox: dosisData.Botox['Coracobrachialis'],
      dysport: dosisData.Dysport['Coracobrachialis'],
      xeomin: dosisData.Botox['Coracobrachialis']
    },
    indications: ['Espasticidad de Miembros Superiores'],
    relatedMuscles: ['biceps-brachii', 'pectoral-mayor']
  },
  {
    id: 'pectoral-mayor',
    name: 'Pectoral Mayor',
    latinName: 'Pectoralis major',
    category: 'upper-limb',
    region: 'Tórax anterior',
    anatomy: {
      function: 'Aducción, rotación interna y flexión del hombro',
      innervation: 'Nervio pectoral medial y lateral',
      origin: 'Clavícula, esternón, cartilagos costales 1–6',
      insertion: 'Surco intertubercular del húmero'
    },
    motorPoint: {
      description: 'Porción esternocostal: línea hemiclavicular-axilar según patrón (p. ej. aducción espástica)',
      techniqueNotes: [
        'Múltiples puntos en porción clavicular, esternal y abdominal',
        'Evitar inyección demasiado lateral sin control (plexo)'
      ]
    },
    dosing: {
      botox: dosisData.Botox['Pectoral mayor'],
      dysport: dosisData.Dysport['Pectoral mayor'],
      xeomin: dosisData.Botox['Pectoral mayor']
    },
    indications: ['Espasticidad de Miembros Superiores', 'Espasticidad Pediátrica'],
    relatedMuscles: ['deltoides', 'coracobrachialis']
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
      description:
        'Vientre de la cabeza medial: 8–10 cm (unos 4 dedos) distal al pliegue poplíteo, en el tercio proximal de la pantorrilla posterior',
      techniqueNotes: [
        '1–3 sitios de punción por cabeza; habitualmente 2 al tratar cabeza medial',
        'Profundidad 2–4 cm según grosor del vientre muscular',
        'Paciente en decúbito prono; pies al borde de la camilla o sobre rodillo',
        'Evitar la fosa poplítea profunda; aspirar antes de inyectar'
      ],
      imageUrl:
        'https://qwhrdmllpznvqrxygytp.supabase.co/storage/v1/object/public/USG-Musculos/PuntoMotor/GASTROCNEMIOS.png',
    },
    usgGuidance: {
      transducerType: 'Lineal 10–14 MHz',
      view: 'Transversal',
      landmarks: [
        'Grasa subcutánea',
        'Cabeza medial del gastrocnemio (vientre superficial posterior)',
        'Sóleo profundo al gastrocnemio',
        'Flexor largo de los dedos y tibial posterior (plano profundo anterior)',
        'Tibia y vasos tibiales posteriores (referencia medial)'
      ],
      approach: 'TS medial a la tibia en tercio medio de pantorrilla (misma referencia tríceps sural)',
      precautions: [
        'Arteria y venas tibiales posteriores en el compartimento profundo; confirmar con USG',
        'No avanzar hacia la fosa poplítea sin visualización'
      ],
      imageUrl:
        'https://qwhrdmllpznvqrxygytp.supabase.co/storage/v1/object/public/USG-Musculos/USG/triceps%20sural%20USG.png',
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
      description:
        'Vientre de la cabeza lateral: 8–10 cm (unos 4 dedos) distal al pliegue poplíteo, en el tercio proximal de la pantorrilla posterior',
      techniqueNotes: [
        '1–3 sitios de punción por cabeza; habitualmente 2 al tratar cabeza lateral',
        'Profundidad 2–4 cm según grosor del vientre muscular',
        'Paciente en decúbito prono; pies al borde de la camilla o sobre rodillo',
        'Típicamente menor volumen muscular que la cabeza medial; ajustar dosis según guía',
        'Evitar el cuello del peroné y el nervio peroneo común al abordar desde lateral'
      ],
      imageUrl:
        'https://qwhrdmllpznvqrxygytp.supabase.co/storage/v1/object/public/USG-Musculos/PuntoMotor/GASTROCNEMIOS.png',
    },
    usgGuidance: {
      transducerType: 'Lineal 10–14 MHz',
      view: 'Transversal',
      landmarks: [
        'Grasa subcutánea',
        'Cabeza medial y lateral del gastrocnemio (referencia tríceps sural)',
        'Sóleo profundo al gastrocnemio',
        'Flexor largo de los dedos, tibial posterior y eje tibia-peroné en planos profundos'
      ],
      approach: 'TS medial a la tibia o lateral según objetivo; misma placa de referencia del tríceps sural',
      precautions: [
        'Misma imagen de referencia que cabeza medial y sóleo: identificar cabeza lateral respecto al surco intergemelar',
        'Nervio peroneo común proximal-lateral al cuello del peroné: no inyectar ciego en esa zona',
        'Vasos tibiales posteriores profundos: confirmar plano con USG'
      ],
      imageUrl:
        'https://qwhrdmllpznvqrxygytp.supabase.co/storage/v1/object/public/USG-Musculos/USG/triceps%20sural%20USG.png',
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
      description:
        'Tercio inferior de la pierna, por debajo de las cabezas del gastrocnemio, medial y lateral al tendón calcáneo (Aquiles)',
      techniqueNotes: [
        '2–4 sitios de punción; habitualmente 1–2',
        'Profundidad 2–4 cm según grosor muscular',
        'Paciente en decúbito prono; pies colgando del borde de la camilla o apoyados en un rodillo',
        'USG recomendado por profundidad y relación con el tríceps sural',
        'Mayor volumen de toxina que el gastrocnemio cuando el patrón clínico lo requiere'
      ],
      imageUrl:
        'https://qwhrdmllpznvqrxygytp.supabase.co/storage/v1/object/public/USG-Musculos/PuntoMotor/Soleo.png',
    },
    usgGuidance: {
      transducerType: 'Lineal 10–14 MHz',
      view: 'Transversal',
      landmarks: [
        'Grasa subcutánea',
        'Cabeza medial del gastrocnemio (posterior superficial)',
        'Sóleo profundo al gastrocnemio',
        'Flexor largo de los dedos anterior al sóleo',
        'Tibial posterior profundo y adyacente a la tibia',
        'Tibia (anterior, hiperecoica)',
        'Arteria y venas tibiales posteriores (central)',
        'Venas peroneas profundas'
      ],
      approach: 'Transversal, sonda medial a la tibia en tercio medio de pantorrilla (acceso medial posterior)',
      precautions: [
        'Vasos tibiales posteriores entre compartimentos; confirmar plano con USG antes de inyectar',
        'No confundir sóleo con gastrocnemio superficial'
      ],
      imageUrl:
        'https://qwhrdmllpznvqrxygytp.supabase.co/storage/v1/object/public/USG-Musculos/USG/triceps%20sural%20USG.png',
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
      ],
      imageUrl:
        'https://qwhrdmllpznvqrxygytp.supabase.co/storage/v1/object/public/USG-Musculos/PuntoMotor/TIBIAL%20POSTERIOR.png',
    },
    usgGuidance: {
      transducerType: 'Lineal 10-14 MHz',
      view: 'Transversal',
      landmarks: ['Tibia medial', 'Sóleo superficial', 'Tibial posterior profundo (adyacente a tibia)', 'Arteria y nervio tibiales posteriores'],
      approach: 'In-plane de medial a lateral',
      precautions: ['Alto riesgo vascular - arteria tibial posterior adyacente', 'Confirmar músculo con USG antes de inyectar'],
      imageUrl:
        'https://qwhrdmllpznvqrxygytp.supabase.co/storage/v1/object/public/USG-Musculos/USG/TIBIAL%20POSTERIOR%20USG.png',
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
    id: 'tibialis-anterior',
    name: 'Tibial Anterior',
    latinName: 'Tibialis anterior',
    category: 'lower-limb',
    region: 'Pierna anterolateral',
    anatomy: {
      function: 'Dorsiflexión del pie e inversión',
      innervation: 'Nervio peroneo profundo',
      origin: 'Cara lateral de tibia y membrana interósea',
      insertion: 'Huesos cuneiforme medial y base del primer metatarsiano'
    },
    motorPoint: {
      description:
        '7–8 cm por debajo de la tuberosidad tibial y aproximadamente un dedo de ancho lateral a la diáfisis tibial (decúbito supino)',
      techniqueNotes: [
        '1–3 sitios de punción; habitualmente 1–2',
        'Profundidad 15–30 mm según grosor muscular',
        'Músculo superficial; evitar el borde óseo anterior de la tibia (periostio)',
        'Paciente en decúbito supino'
      ],
      imageUrl:
        'https://qwhrdmllpznvqrxygytp.supabase.co/storage/v1/object/public/USG-Musculos/PuntoMotor/TIBIAL%20ANTERIOR.png',
    },
    usgGuidance: {
      transducerType: 'Lineal 10–14 MHz',
      view: 'Transversal',
      landmarks: [
        'Grasa subcutánea superficial',
        'Tibial anterior (compartimento anterolateral)',
        'Extensor largo del hallux lateral al tibial anterior',
        'Tibia (medial, hiperecoica con sombra)',
        'Peroné lateral profundo',
        'Membrana interósea y arteria tibial anterior profunda'
      ],
      approach: 'In-plane lateral a medial (sonda transversal lateral a la tibia)',
      precautions: [
        'Arteria tibial anterior y nervio peroneo profundo en el plano profundo entre tibial anterior y peroné',
        'Confirmar estructuras vasculares antes de inyectar'
      ],
      imageUrl:
        'https://qwhrdmllpznvqrxygytp.supabase.co/storage/v1/object/public/USG-Musculos/USG/TIBIAL%20ANTERIOR%20USG.png',
    },
    dosing: {
      botox: dosisData.Botox['Tibialis anterior'],
      dysport: dosisData.Dysport['Tibialis anterior'],
      xeomin: dosisData.Botox['Tibialis anterior']
    },
    indications: ['Espasticidad de Miembros Inferiores', 'Pie Equinovaro', 'Espasticidad Pediátrica'],
    relatedMuscles: ['extensor-digitorum-longus', 'peroneus-longus']
  },
  {
    id: 'extensor-digitorum-longus',
    name: 'Extensor Largo de los Dedos del Pie',
    latinName: 'Extensor digitorum longus',
    category: 'lower-limb',
    region: 'Pierna anterolateral',
    anatomy: {
      function: 'Extensión de los dedos del pie y dorsiflexión',
      innervation: 'Nervio peroneo profundo',
      origin: 'Cara lateral de tibia y peroné',
      insertion: 'Falanges media y distal de los dedos 2–5'
    },
    motorPoint: {
      description: 'Tercio medio de la pierna, lateral al tibial anterior',
      techniqueNotes: ['2–3 puntos', 'USG útil junto al compartimento lateral']
    },
    usgGuidance: {
      transducerType: 'Lineal 10–14 MHz',
      view: 'Transversal',
      landmarks: ['Tibial anterior', 'EDL lateral', 'Peroné'],
      approach: 'In-plane',
      precautions: ['Nervio peroneo profundo en hendidura anteroexterna de pierna']
    },
    dosing: {
      botox: dosisData.Botox['Extensor digitorum longus'],
      dysport: dosisData.Dysport['Extensor digitorum longus'],
      xeomin: dosisData.Botox['Extensor digitorum longus']
    },
    indications: ['Espasticidad de Miembros Inferiores', 'Espasticidad Pediátrica'],
    relatedMuscles: ['tibialis-anterior', 'extensor-hallucis-longus']
  },
  {
    id: 'extensor-hallucis-longus',
    name: 'Extensor Largo del Hallux',
    latinName: 'Extensor hallucis longus',
    category: 'lower-limb',
    region: 'Pierna anteromedial',
    anatomy: {
      function: 'Extensión del dedo gordo y dorsiflexión del pie',
      innervation: 'Nervio peroneo profundo',
      origin: 'Cara medial de fibula y membrana interósea',
      insertion: 'Base de la falange distal del hallux'
    },
    motorPoint: {
      description: 'Tercio medio-inferior de la pierna, entre tibial anterior y EDL',
      techniqueNotes: ['1–2 puntos', 'Profundidad moderada']
    },
    dosing: {
      botox: dosisData.Botox['Extensor hallucis longus'],
      dysport: dosisData.Dysport['Extensor hallucis longus'],
      xeomin: dosisData.Botox['Extensor hallucis longus']
    },
    indications: ['Espasticidad de Miembros Inferiores'],
    relatedMuscles: ['tibialis-anterior', 'extensor-digitorum-longus']
  },
  {
    id: 'flexor-digitorum-longus',
    name: 'Flexor Largo de los Dedos del Pie',
    latinName: 'Flexor digitorum longus',
    category: 'lower-limb',
    region: 'Pierna posterior profunda',
    anatomy: {
      function: 'Flexión de las falanges distales de los dedos 2–5',
      innervation: 'Nervio tibial',
      origin: 'Cara posterior de tibia',
      insertion: 'Bases de las falanges distales de los dedos 2–5'
    },
    motorPoint: {
      description: 'Tercio medio de la pierna, posterior, medial al peroné (profundo al sóleo)',
      techniqueNotes: ['USG recomendado', '2 puntos', 'Confundible con tibial posterior sin imagen']
    },
    usgGuidance: {
      transducerType: 'Lineal 10–14 MHz',
      view: 'Transversal',
      landmarks: ['Sóleo superficial', 'FDL entre tibia y FHL', 'Tibia medial'],
      approach: 'In-plane medial a lateral',
      precautions: ['Paquete tibial posterior medial']
    },
    dosing: {
      botox: dosisData.Botox['Flexor digitorum longus'],
      dysport: dosisData.Dysport['Flexor digitorum longus'],
      xeomin: dosisData.Botox['Flexor digitorum longus']
    },
    indications: ['Espasticidad de Miembros Inferiores', 'Garra de los Dedos'],
    relatedMuscles: ['tibialis-posterior', 'flexor-hallucis-longus']
  },
  {
    id: 'peroneus-longus',
    name: 'Peroneo Largo',
    latinName: 'Fibularis longus',
    category: 'lower-limb',
    region: 'Pierna lateral',
    anatomy: {
      function: 'Eversión del pie y flexión plantar del primer rayo',
      innervation: 'Nervio peroneo superficial',
      origin: 'Cara lateral de la cabeza del peroné y cuerpo del peroné',
      insertion: 'Base del 1.er metatarsiano y cuneiforme medial'
    },
    motorPoint: {
      description: 'Tercio proximal de la pierna, cara lateral superficial (cabeza del peroné distal)',
      techniqueNotes: ['2–3 puntos', 'Superficial al peroné']
    },
    usgGuidance: {
      transducerType: 'Lineal 10–14 MHz',
      view: 'Transversal',
      landmarks: ['Peroneo largo superficial', 'Peroné', 'Peroneo corto profundo'],
      approach: 'In-plane',
      precautions: ['Nervio peroneo común en cuello del peroné (no inyectar en cuello)']
    },
    dosing: {
      botox: dosisData.Botox['Peroneus longus'],
      dysport: dosisData.Dysport['Peroneus longus'],
      xeomin: dosisData.Botox['Peroneus longus']
    },
    indications: ['Espasticidad de Miembros Inferiores', 'Pie Equinovaro'],
    relatedMuscles: ['peroneus-brevis', 'tibialis-anterior']
  },
  {
    id: 'peroneus-brevis',
    name: 'Peroneo Corto',
    latinName: 'Fibularis brevis',
    category: 'lower-limb',
    region: 'Pierna lateral',
    anatomy: {
      function: 'Eversión del pie',
      innervation: 'Nervio peroneo superficial',
      origin: 'Cara lateral del peroné (tercio distal)',
      insertion: 'Tuberosidad del 5.º metatarsiano'
    },
    motorPoint: {
      description: 'Tercio medio-distal lateral de la pierna, posterior al peroneo largo',
      techniqueNotes: ['1–2 puntos', 'Músculo más delgado que el largo']
    },
    dosing: {
      botox: dosisData.Botox['Peroneus brevis'],
      dysport: dosisData.Dysport['Peroneus brevis'],
      xeomin: dosisData.Botox['Peroneus brevis']
    },
    indications: ['Espasticidad de Miembros Inferiores'],
    relatedMuscles: ['peroneus-longus', 'peroneus-tertius']
  },
  {
    id: 'peroneus-tertius',
    name: 'Peroneo Tercero',
    latinName: 'Fibularis tertius',
    category: 'lower-limb',
    region: 'Pierna anterolateral',
    anatomy: {
      function: 'Dorsiflexión y eversión del pie',
      innervation: 'Nervio peroneo profundo',
      origin: 'Cara medial distal del peroné',
      insertion: 'Base del 5.º metatarsiano (cara dorsal)'
    },
    motorPoint: {
      description: 'Tercio distal anterolateral de la pierna (continuación del EDL)',
      techniqueNotes: ['1 punto', 'Pequeño volumen muscular']
    },
    dosing: {
      botox: dosisData.Botox['Peroneus tertius'],
      dysport: dosisData.Dysport['Peroneus tertius'],
      xeomin: dosisData.Botox['Peroneus tertius']
    },
    indications: ['Espasticidad de Miembros Inferiores'],
    relatedMuscles: ['extensor-digitorum-longus', 'peroneus-brevis']
  },
  {
    id: 'biceps-femoris',
    name: 'Bíceps Femoral',
    latinName: 'Biceps femoris',
    category: 'lower-limb',
    region: 'Muslo / pierna posterior',
    anatomy: {
      function: 'Flexión de rodilla y extensión de cadera (cabeza larga)',
      innervation: 'Nervio ciático (porción común; cabeza corta: peroneo común)',
      origin: 'Cabeza larga: tuberosidad isquiática; cabeza corta: línea áspera del fémur',
      insertion: 'Cabeza de la fibula y condíleo lateral de la tibia'
    },
    motorPoint: {
      description: 'Muslo posterior lateral (cabeza larga) y región posterolateral proximal de la pierna',
      techniqueNotes: [
        'Distribuir en cabeza larga (isquiotibial) y vientre distal lateral',
        '2–4 puntos según volumen'
      ]
    },
    usgGuidance: {
      transducerType: 'Lineal 8–12 MHz',
      view: 'Transversal',
      landmarks: ['Semimembranoso medial', 'Bíceps femoral lateral', 'Ciático profundo entre ellos'],
      approach: 'In-plane',
      precautions: ['Nervio ciático profundo entre isquiotibiales']
    },
    dosing: {
      botox: dosisData.Botox['Biceps femoris'],
      dysport: dosisData.Dysport['Biceps femoris'],
      xeomin: dosisData.Botox['Biceps femoris']
    },
    indications: ['Espasticidad de Miembros Inferiores', 'Espasticidad Pediátrica'],
    relatedMuscles: ['semitendinosus', 'semimembranosus']
  },
  {
    id: 'semitendinosus',
    name: 'Semitendinoso',
    latinName: 'Semitendinosus',
    category: 'lower-limb',
    region: 'Muslo posterior',
    anatomy: {
      function: 'Flexión de rodilla, extensión de cadera y rotación interna de pierna flexionada',
      innervation: 'Nervio tibial (porción tibial del ciático)',
      origin: 'Tuberosidad isquiática',
      insertion: 'Pesa anserina (tibia proximal medial)'
    },
    motorPoint: {
      description: 'Muslo posterior medial, tercio proximal a medio (vientre muscular grueso)',
      techniqueNotes: ['2–3 puntos', 'Diferenciar de semimembranoso más profundo']
    },
    dosing: {
      botox: dosisData.Botox['Semitendinosus'],
      dysport: dosisData.Dysport['Semitendinosus'],
      xeomin: dosisData.Botox['Semitendinosus']
    },
    indications: ['Espasticidad de Miembros Inferiores', 'Espasticidad Pediátrica'],
    relatedMuscles: ['semimembranosus', 'biceps-femoris']
  },
  {
    id: 'semimembranosus',
    name: 'Semimembranoso',
    latinName: 'Semimembranosus',
    category: 'lower-limb',
    region: 'Muslo posterior',
    anatomy: {
      function: 'Flexión de rodilla, extensión de cadera y rotación interna de la tibia',
      innervation: 'Nervio tibial',
      origin: 'Tuberosidad isquiática',
      insertion: 'Condíleo medial de la tibia (posterior)'
    },
    motorPoint: {
      description: 'Muslo posterior medial, profundo al semitendinoso',
      techniqueNotes: ['USG recomendado por profundidad', '2 puntos']
    },
    dosing: {
      botox: dosisData.Botox['Semimembranosus'],
      dysport: dosisData.Dysport['Semimembranosus'],
      xeomin: dosisData.Botox['Semimembranosus']
    },
    indications: ['Espasticidad de Miembros Inferiores'],
    relatedMuscles: ['semitendinosus', 'biceps-femoris']
  },
  {
    id: 'adductor-magnus',
    name: 'Aductor Mayor',
    latinName: 'Adductor magnus',
    category: 'lower-limb',
    region: 'Muslo medial',
    anatomy: {
      function: 'Aducción, extensión y rotación externa de cadera',
      innervation: 'Nervio obturador y nervio tibial (porción isquiática)',
      origin: 'Rama isquiopúbica e isquion',
      insertion: 'Línea áspera del fémur y aductor tubercle'
    },
    motorPoint: {
      description: 'Muslo medial posterior, distal al pubis, a lo largo del vientre aductor',
      techniqueNotes: [
        'Grandes volúmenes: 3–5 puntos',
        'Precaución con ramas del nervio obturador y paquete femoral medial'
      ]
    },
    dosing: {
      botox: dosisData.Botox['Adductor magnus'],
      dysport: dosisData.Dysport['Adductor magnus'],
      xeomin: dosisData.Botox['Adductor magnus']
    },
    indications: ['Espasticidad de Miembros Inferiores', 'Espasticidad Pediátrica', 'Tijera de Piernas'],
    relatedMuscles: ['adductor-longus', 'gracilis']
  },
  {
    id: 'adductor-longus',
    name: 'Aductor Largo',
    latinName: 'Adductor longus',
    category: 'lower-limb',
    region: 'Muslo medial',
    anatomy: {
      function: 'Aducción y flexión de cadera',
      innervation: 'Nervio obturador',
      origin: 'Cara anterior del pubis',
      insertion: 'Línea áspera del fémur (tercio medio)'
    },
    motorPoint: {
      description: 'Muslo medial proximal, entre sartorio y grácil superficialmente',
      techniqueNotes: ['2–3 puntos', 'Más superficial que aductor mayor en región proximal']
    },
    dosing: {
      botox: dosisData.Botox['Adductor longus'],
      dysport: dosisData.Dysport['Adductor longus'],
      xeomin: dosisData.Botox['Adductor longus']
    },
    indications: ['Espasticidad de Miembros Inferiores', 'Tijera de Piernas'],
    relatedMuscles: ['adductor-magnus', 'gracilis']
  },
  {
    id: 'gracilis',
    name: 'Grácil',
    latinName: 'Gracilis',
    category: 'lower-limb',
    region: 'Muslo medial',
    anatomy: {
      function: 'Aducción de cadera, flexión de rodilla y rotación interna',
      innervation: 'Nervio obturador',
      origin: 'Sínfisis púbica y rama inferior del pubis',
      insertion: 'Pesa anserina (tibia)'
    },
    motorPoint: {
      description: 'Muslo medial más superficial, banda delgada subcutánea medial',
      techniqueNotes: ['1–2 puntos a lo largo del vientre', 'Fácil de palpar']
    },
    dosing: {
      botox: dosisData.Botox['Gracilis'],
      dysport: dosisData.Dysport['Gracilis'],
      xeomin: dosisData.Botox['Gracilis']
    },
    indications: ['Espasticidad de Miembros Inferiores', 'Tijera de Piernas'],
    relatedMuscles: ['adductor-longus', 'semitendinosus']
  },
  {
    id: 'vastos-cuadriceps',
    name: 'Vastos (Lateral, Intermedio y Medial)',
    latinName: 'Vastus lateralis, intermedius et medialis',
    category: 'lower-limb',
    region: 'Muslo anterior',
    anatomy: {
      function: 'Extensión de rodilla (componentes del cuádriceps con el recto femoral)',
      innervation: 'Nervio femoral',
      origin: 'Línea áspera, cara anterior del fémur (intermedio profundo)',
      insertion: 'Patela vía tendón del cuádriceps'
    },
    motorPoint: {
      description: 'Vasto lateral: tercio lateral del muslo; vasto medial: tercio medial; intermedio: profundo al recto',
      techniqueNotes: [
        'Tratar según patrón: rodilla rígida en extensión suele requerir vastos + recto',
        'Múltiples puntos en lateral y medial; intermedio con USG'
      ]
    },
    dosing: {
      botox: dosisData.Botox['Vastus lateralis, intermedius y medialis'],
      dysport: dosisData.Dysport['Vastus lateralis, intermedius y medialis'],
      xeomin: dosisData.Botox['Vastus lateralis, intermedius y medialis']
    },
    indications: ['Espasticidad en Extensión (Rodilla Rígida)', 'Espasticidad Pediátrica'],
    relatedMuscles: ['rectus-femoris']
  },
  {
    id: 'gluteo-medio',
    name: 'Glúteo Medio',
    latinName: 'Gluteus medius',
    category: 'lower-limb',
    region: 'Cadera',
    anatomy: {
      function: 'Abducción y rotación interna de cadera; estabilidad de la pelvis en la marcha',
      innervation: 'Nervio glúteo superior',
      origin: 'Cara glútea externa del ilion',
      insertion: 'Trocánter mayor del fémur'
    },
    motorPoint: {
      description: 'Región superolateral del glúteo, sobre y posterior al trocánter mayor',
      techniqueNotes: [
        'Inyección profunda intramuscular',
        '2–4 puntos en abanico sobre el vientre',
        'Evitar borde superior excesivo (subglúteo)'
      ]
    },
    dosing: {
      botox: dosisData.Botox['Glúteo medio'],
      dysport: dosisData.Dysport['Glúteo medio'],
      xeomin: dosisData.Botox['Glúteo medio']
    },
    indications: ['Espasticidad de Miembros Inferiores', 'Marcha en Tijera', 'Espasticidad Pediátrica'],
    relatedMuscles: ['psoas-mayor', 'rectus-femoris']
  },
  {
    id: 'psoas-mayor',
    name: 'Psoas Mayor',
    latinName: 'Psoas major',
    category: 'lower-limb',
    region: 'Pelvis y muslo proximal',
    anatomy: {
      function: 'Flexión de cadera y flexión lateral de tronco',
      innervation: 'Ramas directas de L1–L3 (plexo lumbar)',
      origin: 'Cuerpos y procesos transversos de T12–L5',
      insertion: 'Trocánter menor del fémur (vía iliopsoas)'
    },
    motorPoint: {
      description: 'Abordaje guiado (ecografía o EMG): región retroperitoneal / triángulo femoral profundo — no abordaje ciego superficial',
      techniqueNotes: [
        'Solo personal experto; riesgo vascular y de plexo lumbar',
        'Dosis según guía institucional'
      ]
    },
    dosing: {
      botox: dosisData.Botox['Psoas mayor'],
      dysport: dosisData.Dysport['Psoas mayor'],
      xeomin: dosisData.Botox['Psoas mayor']
    },
    indications: ['Espasticidad de Miembros Inferiores', 'Flexión de Cadera Espástica'],
    relatedMuscles: ['rectus-femoris', 'gluteo-medio']
  },
  {
    id: 'abductor-hallucis',
    name: 'Abductor del Hallux',
    latinName: 'Abductor hallucis',
    category: 'lower-limb',
    region: 'Pie medial',
    anatomy: {
      function: 'Abducción del dedo gordo; sostiene el arco medial longitudinal',
      innervation: 'Nervio medial plantar',
      origin: 'Calcáneo medial y retináculo flexor',
      insertion: 'Base de la falange proximal del hallux'
    },
    motorPoint: {
      description: 'Eminencia medial del pie, vientre muscular superficial del abductor del hallux',
      techniqueNotes: [
        'Inyección superficial a moderada',
        '1–2 puntos',
        'Evitar nervio medial plantar en canal del tarso'
      ]
    },
    dosing: {
      botox: dosisData.Botox['Abductor hallucis'],
      dysport: dosisData.Dysport['Abductor hallucis'],
      xeomin: dosisData.Botox['Abductor hallucis']
    },
    indications: ['Espasticidad de Miembros Inferiores', 'Pie Equinovaro', 'Garra del Hallux'],
    relatedMuscles: ['flexor-hallucis-longus']
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
    relatedMuscles: ['vastos-cuadriceps', 'tibialis-anterior']
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
