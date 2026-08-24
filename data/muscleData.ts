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
    relatedMuscles: ['occipitalis', 'masseter', 'medial-pterygoid', 'lateral-pterygoid']
  },
  {
    id: 'occipitalis',
    name: 'Occipital',
    latinName: 'Occipitalis',
    category: 'face',
    region: 'Occipucio',
    anatomy: {
      function: 'Retrae el cuero cabelludo hacia atrás y tensa la galea aponeurótica',
      innervation: 'Nervio facial (rama auricular posterior)',
      origin: 'Línea nucal superior del occipital',
      insertion: 'Galea aponeurótica'
    },
    motorPoint: {
      description: 'Región occipital, aproximadamente a la altura de la línea nucal superior, a 1–2 cm lateral a la línea media',
      techniqueNotes: [
        'Inyecciones subcutáneas/superficiales en puntos bilaterales (protocolo PREEMPT)',
        'Evitar inyección demasiado profunda hacia la nuca',
        'Distribuir en varios sitios por lado'
      ]
    },
    dosing: {
      botox: dosisData.Botox['Occipitalis'],
      dysport: dosisData.Dysport['Occipitalis'],
      xeomin: dosisData.Botox['Occipitalis']
    },
    indications: ['Migraña Crónica'],
    relatedMuscles: ['temporalis', 'trapezius', 'cervical-paraspinals']
  },
  {
    id: 'masseter',
    name: 'Masetero',
    latinName: 'Masseter',
    category: 'face',
    region: 'Mandíbula',
    anatomy: {
      function: 'Elevación de la mandíbula (masticación); contribuye a la protrusión mandibular',
      innervation: 'Nervio mandibular (rama del trigémino)',
      origin: 'Arco cigomático',
      insertion: 'Ángulo y rama de la mandíbula (tuberosidad maseterina)'
    },
    motorPoint: {
      description: 'Vientre más prominente del masetero, ~1–1.5 cm por delante del ángulo mandibular',
      techniqueNotes: [
        'Inyectar en el tercio inferior del músculo (zona más segura)',
        'Profundidad intramuscular; evitar inyección demasiado anterior (riesgo de sonrisa asimétrica)',
        'Distribuir en 2–3 puntos por lado según hipertrofia'
      ]
    },
    dosing: {
      botox: dosisData.Botox['Masseter'],
      dysport: dosisData.Dysport['Masseter'],
      xeomin: dosisData.Botox['Masseter']
    },
    indications: ['Bruxismo', 'Hipertrofia Maseterina', 'Disfunción ATM'],
    relatedMuscles: ['temporalis', 'medial-pterygoid', 'lateral-pterygoid']
  },
  {
    id: 'medial-pterygoid',
    name: 'Pterigoideo Medial',
    latinName: 'Medial pterygoid',
    category: 'face',
    region: 'Mandíbula',
    anatomy: {
      function: 'Elevación y protrusión de la mandíbula; contribuye a la masticación',
      innervation: 'Nervio mandibular (rama del trigémino)',
      origin: 'Fosa pterigoidea y tuberosidad maxilar',
      insertion: 'Cara medial del ángulo y rama de la mandíbula'
    },
    motorPoint: {
      description: 'Ángulo mandibular interno (abordaje intraoral) o extraoral guiado hacia el vientre medial',
      techniqueNotes: [
        'Preferir guía por USG o EMG',
        '1–2 puntos; evitar vasos y glándula parótida',
        'Complementa masetero y temporal en bruxismo/ATM'
      ]
    },
    dosing: {
      botox: dosisData.Botox['Medial pterygoid'],
      dysport: dosisData.Dysport['Medial pterygoid'],
      xeomin: dosisData.Botox['Medial pterygoid']
    },
    indications: ['Bruxismo', 'Disfunción ATM', 'Distonía Oroomandibular'],
    relatedMuscles: ['masseter', 'temporalis', 'lateral-pterygoid']
  },
  {
    id: 'lateral-pterygoid',
    name: 'Pterigoideo Lateral',
    latinName: 'Lateral pterygoid',
    category: 'face',
    region: 'Mandíbula',
    anatomy: {
      function: 'Protrusión y apertura de la mandíbula; estabiliza el disco articular',
      innervation: 'Nervio mandibular (rama del trigémino)',
      origin: 'Ala mayor del esfenoides y lámina lateral de la pterigoides',
      insertion: 'Cuello del cóndilo mandibular y disco de la ATM'
    },
    motorPoint: {
      description: 'Fosa infratemporal: ~1–1.5 cm por delante del trago y ~1 cm bajo el arco cigomático (extraoral guiado)',
      techniqueNotes: [
        'Solo con guía (USG/EMG); dosis bajas',
        'Riesgo de hemorragia y alteración de la ATM',
        'Confirmar con protrusión mandibular'
      ]
    },
    dosing: {
      botox: dosisData.Botox['Lateral pterygoid'],
      dysport: dosisData.Dysport['Lateral pterygoid'],
      xeomin: dosisData.Botox['Lateral pterygoid']
    },
    indications: ['Disfunción ATM', 'Distonía Oroomandibular', 'Bruxismo'],
    relatedMuscles: ['medial-pterygoid', 'masseter', 'temporalis']
  },
  {
    id: 'platysma',
    name: 'Platisma',
    latinName: 'Platysma',
    category: 'face',
    region: 'Cuello / tercio inferior',
    anatomy: {
      function: 'Tensa la piel del cuello, deprime la mandíbula y tira hacia abajo de la comisura labial',
      innervation: 'Nervio facial (rama cervical)',
      origin: 'Fascia del tórax superior y deltoides',
      insertion: 'Mandíbula, piel y tejido subcutáneo de la cara inferior'
    },
    motorPoint: {
      description: 'Bandas platismales verticales visibles en contracción; puntos a lo largo de cada banda',
      techniqueNotes: [
        'Inyección superficial subcutánea en puntos múltiples',
        'Técnica Nefertiti: puntos a lo largo del borde mandibular y bandas',
        'Dosis bajas por punto para evitar debilidad de deglución'
      ]
    },
    dosing: {
      botox: dosisData.Botox['Platysma'],
      dysport: dosisData.Dysport['Platysma'],
      xeomin: dosisData.Botox['Platysma']
    },
    indications: ['Estética Facial (bandas platismales)', 'Sincinesias Faciales'],
    relatedMuscles: ['depressor-anguli-oris', 'mentalis']
  },
  {
    id: 'orbicularis-oris',
    name: 'Orbicular de los Labios',
    latinName: 'Orbicularis oris',
    category: 'face',
    region: 'Perioral',
    anatomy: {
      function: 'Cierre y protrusión de los labios; forma el esfínter oral',
      innervation: 'Nervio facial (ramas bucales)',
      origin: 'Fibras de músculos faciales adyacentes y maxilar/mandíbula',
      insertion: 'Piel y mucosa de los labios'
    },
    motorPoint: {
      description: 'Puntos superficiales a 1–2 mm del borde bermellón, en labio superior e inferior',
      techniqueNotes: [
        'Inyección muy superficial; dosis bajas',
        'Evitar exceso (riesgo de incompetencia labial y dificultad para silbar/beber)',
        'Útil para líneas verticales periorales (“código de barras”)'
      ]
    },
    dosing: {
      botox: dosisData.Botox['Orbicularis oris'],
      dysport: dosisData.Dysport['Orbicularis oris'],
      xeomin: dosisData.Botox['Orbicularis oris']
    },
    indications: ['Estética Facial (líneas periorales)', 'Sincinesias Faciales'],
    relatedMuscles: ['mentalis', 'depressor-anguli-oris']
  },
  {
    id: 'mentalis',
    name: 'Mentoniano',
    latinName: 'Mentalis',
    category: 'face',
    region: 'Mentón',
    anatomy: {
      function: 'Eleva y protruye el labio inferior; arruga la piel del mentón',
      innervation: 'Nervio facial (rama marginal mandibular)',
      origin: 'Fosa del mentón (mandíbula)',
      insertion: 'Piel del mentón'
    },
    motorPoint: {
      description: 'Línea media del mentón, ~1 cm por encima del borde inferior mandibular',
      techniqueNotes: [
        'Inyección intramuscular profunda en el vientre del mentoniano',
        '1–2 puntos en línea media o ligeramente paramedianos',
        'Útil en mentón “adoquinado” o pechin'
      ]
    },
    dosing: {
      botox: dosisData.Botox['Mentalis'],
      dysport: dosisData.Dysport['Mentalis'],
      xeomin: dosisData.Botox['Mentalis']
    },
    indications: ['Estética Facial (mentón adoquinado)', 'Sincinesias Faciales'],
    relatedMuscles: ['orbicularis-oris', 'depressor-anguli-oris']
  },
  {
    id: 'depressor-anguli-oris',
    name: 'Depresor del Ángulo de la Boca',
    latinName: 'Depressor anguli oris',
    category: 'face',
    region: 'Perioral',
    anatomy: {
      function: 'Deprime la comisura labial (gesto de tristeza)',
      innervation: 'Nervio facial (rama marginal mandibular)',
      origin: 'Línea oblicua de la mandíbula',
      insertion: 'Modiolo (ángulo de la boca)'
    },
    motorPoint: {
      description: 'Aproximadamente 1 cm lateral y 1 cm inferior a la comisura labial',
      techniqueNotes: [
        'Inyección superficial a moderada',
        'Evitar inyección demasiado medial (riesgo de afectar depresor del labio inferior)',
        'Útil para comisuras caídas y líneas de marioneta'
      ]
    },
    dosing: {
      botox: dosisData.Botox['Depressor anguli oris'],
      dysport: dosisData.Dysport['Depressor anguli oris'],
      xeomin: dosisData.Botox['Depressor anguli oris']
    },
    indications: ['Estética Facial (comisuras caídas)', 'Sincinesias Faciales'],
    relatedMuscles: ['platysma', 'mentalis', 'risorius']
  },
  {
    id: 'nasalis',
    name: 'Nasal',
    latinName: 'Nasalis',
    category: 'face',
    region: 'Nariz',
    anatomy: {
      function: 'Comprime y dilata las narinas; forma arrugas transversales en el dorso nasal',
      innervation: 'Nervio facial (rama bucal)',
      origin: 'Maxilar',
      insertion: 'Aponeurosis nasal y cartílago alar'
    },
    motorPoint: {
      description: 'Puntos laterales al dorso nasal sobre el vientre transversal del nasal',
      techniqueNotes: [
        'Inyección superficial bilateral',
        'Indicación clásica: bunny lines',
        'Dosis bajas; evitar exceso que altere dinámica nasal'
      ]
    },
    dosing: {
      botox: dosisData.Botox['Nasalis'],
      dysport: dosisData.Dysport['Nasalis'],
      xeomin: dosisData.Botox['Nasalis']
    },
    indications: ['Estética Facial (bunny lines)'],
    relatedMuscles: ['procerus', 'levator-labii-superioris-alaeque-nasi']
  },
  {
    id: 'levator-labii-superioris-alaeque-nasi',
    name: 'Elevador del Labio Superior y del Ala Nasal',
    latinName: 'Levator labii superioris alaeque nasi',
    category: 'face',
    region: 'Tercio medio',
    anatomy: {
      function: 'Eleva el labio superior y dilata el ala nasal; contribuye a la sonrisa gingival',
      innervation: 'Nervio facial (rama cigomática/bucal)',
      origin: 'Proceso frontal del maxilar',
      insertion: 'Piel del labio superior y cartílago alar'
    },
    motorPoint: {
      description: 'Surco nasogeniano superior, cerca del ala nasal',
      techniqueNotes: [
        'Inyección superficial; dosis muy bajas',
        'Indicación principal: sonrisa gingival',
        'Evitar exceso (puede aplanar el labio superior)'
      ]
    },
    dosing: {
      botox: dosisData.Botox['Levator labii superioris alaeque nasi'],
      dysport: dosisData.Dysport['Levator labii superioris alaeque nasi'],
      xeomin: dosisData.Botox['Levator labii superioris alaeque nasi']
    },
    indications: ['Estética Facial (sonrisa gingival)'],
    relatedMuscles: ['levator-labii-superioris', 'nasalis']
  },
  {
    id: 'levator-labii-superioris',
    name: 'Elevador del Labio Superior',
    latinName: 'Levator labii superioris',
    category: 'face',
    region: 'Tercio medio',
    anatomy: {
      function: 'Eleva el labio superior y contribuye a la exposición gingival al sonreír',
      innervation: 'Nervio facial (rama cigomática/bucal)',
      origin: 'Maxilar, por encima del foramen infraorbitario',
      insertion: 'Piel del labio superior'
    },
    motorPoint: {
      description: 'Punto en el tercio medio del surco nasogeniano, sobre el vientre muscular',
      techniqueNotes: [
        'Inyección superficial a moderada',
        'Combinar con LLSAN según patrón de sonrisa gingival',
        'Dosis conservadoras para preservar sonrisa natural'
      ]
    },
    dosing: {
      botox: dosisData.Botox['Levator labii superioris'],
      dysport: dosisData.Dysport['Levator labii superioris'],
      xeomin: dosisData.Botox['Levator labii superioris']
    },
    indications: ['Estética Facial (sonrisa gingival)', 'Sincinesias Faciales'],
    relatedMuscles: ['levator-labii-superioris-alaeque-nasi', 'zygomaticus-minor']
  },
  {
    id: 'depressor-labii-inferioris',
    name: 'Depresor del Labio Inferior',
    latinName: 'Depressor labii inferioris',
    category: 'face',
    region: 'Perioral',
    anatomy: {
      function: 'Deprime y eversión del labio inferior',
      innervation: 'Nervio facial (rama marginal mandibular)',
      origin: 'Línea oblicua de la mandíbula',
      insertion: 'Piel y mucosa del labio inferior'
    },
    motorPoint: {
      description: 'Punto paramediano del labio inferior, ~1 cm lateral a la línea media',
      techniqueNotes: [
        'Inyección superficial; dosis bajas',
        'Útil en asimetrías y sincinesias postparálisis facial',
        'Evitar bilateral simétrico excesivo (puede dificultar el habla)'
      ]
    },
    dosing: {
      botox: dosisData.Botox['Depressor labii inferioris'],
      dysport: dosisData.Dysport['Depressor labii inferioris'],
      xeomin: dosisData.Botox['Depressor labii inferioris']
    },
    indications: ['Sincinesias Faciales', 'Asimetrías Faciales'],
    relatedMuscles: ['depressor-anguli-oris', 'mentalis']
  },
  {
    id: 'zygomaticus-major',
    name: 'Cigomático Mayor',
    latinName: 'Zygomaticus major',
    category: 'face',
    region: 'Tercio medio',
    anatomy: {
      function: 'Eleva y lateraliza la comisura labial (sonrisa)',
      innervation: 'Nervio facial (rama cigomática)',
      origin: 'Hueso cigomático',
      insertion: 'Modiolo (ángulo de la boca)'
    },
    motorPoint: {
      description: 'Trayecto desde el cigoma hacia la comisura; punto a mitad del vientre muscular',
      techniqueNotes: [
        'Dosis muy bajas; alto impacto en la sonrisa',
        'Principalmente para asimetrías o sincinesias, no estética rutinaria',
        'Confirmar lado hiperactivo antes de inyectar'
      ]
    },
    dosing: {
      botox: dosisData.Botox['Zygomaticus major'],
      dysport: dosisData.Dysport['Zygomaticus major'],
      xeomin: dosisData.Botox['Zygomaticus major']
    },
    indications: ['Sincinesias Faciales', 'Asimetrías Faciales'],
    relatedMuscles: ['zygomaticus-minor', 'risorius', 'levator-anguli-oris']
  },
  {
    id: 'zygomaticus-minor',
    name: 'Cigomático Menor',
    latinName: 'Zygomaticus minor',
    category: 'face',
    region: 'Tercio medio',
    anatomy: {
      function: 'Eleva el labio superior y profundiza el surco nasogeniano',
      innervation: 'Nervio facial (rama cigomática)',
      origin: 'Hueso cigomático',
      insertion: 'Piel del labio superior'
    },
    motorPoint: {
      description: 'Entre el cigoma y el labio superior, medial al cigomático mayor',
      techniqueNotes: [
        'Inyección superficial; dosis mínimas',
        'Usar con precaución por efecto en sonrisa y surco nasogeniano',
        'Más frecuente en protocolos de sincinesias'
      ]
    },
    dosing: {
      botox: dosisData.Botox['Zygomaticus minor'],
      dysport: dosisData.Dysport['Zygomaticus minor'],
      xeomin: dosisData.Botox['Zygomaticus minor']
    },
    indications: ['Sincinesias Faciales', 'Asimetrías Faciales'],
    relatedMuscles: ['zygomaticus-major', 'levator-labii-superioris']
  },
  {
    id: 'risorius',
    name: 'Risorio',
    latinName: 'Risorius',
    category: 'face',
    region: 'Perioral',
    anatomy: {
      function: 'Retrae lateralmente la comisura labial (sonrisa amplia)',
      innervation: 'Nervio facial (rama bucal)',
      origin: 'Fascia parotídea / tejido subcutáneo',
      insertion: 'Modiolo (ángulo de la boca)'
    },
    motorPoint: {
      description: 'Lateral a la comisura, en el trayecto horizontal hacia la mejilla',
      techniqueNotes: [
        'Inyección superficial; dosis muy bajas',
        'Útil en asimetrías laterales de sonrisa',
        'Evitar difusión hacia masetero o DAO'
      ]
    },
    dosing: {
      botox: dosisData.Botox['Risorius'],
      dysport: dosisData.Dysport['Risorius'],
      xeomin: dosisData.Botox['Risorius']
    },
    indications: ['Sincinesias Faciales', 'Asimetrías Faciales'],
    relatedMuscles: ['zygomaticus-major', 'depressor-anguli-oris']
  },
  {
    id: 'depressor-supercilii',
    name: 'Depresor de la Ceja',
    latinName: 'Depressor supercilii',
    category: 'face',
    region: 'Glabela',
    anatomy: {
      function: 'Deprime la porción medial de la ceja; contribuye al ceño fruncido',
      innervation: 'Nervio facial (rama temporal)',
      origin: 'Hueso frontal / región medial orbitaria',
      insertion: 'Piel de la ceja medial'
    },
    motorPoint: {
      description: 'Porción medial de la ceja, ligeramente inferior al corrugador',
      techniqueNotes: [
        'A menudo tratado junto con corrugador y prócer',
        'Inyección intramuscular medial',
        'Evitar exceso lateral (riesgo de ptosis)'
      ]
    },
    dosing: {
      botox: dosisData.Botox['Depressor supercilii'],
      dysport: dosisData.Dysport['Depressor supercilii'],
      xeomin: dosisData.Botox['Depressor supercilii']
    },
    indications: ['Estética Facial (líneas glabelares)', 'Migraña Crónica'],
    relatedMuscles: ['corrugator', 'procerus']
  },
  {
    id: 'buccinator',
    name: 'Buccinador',
    latinName: 'Buccinator',
    category: 'face',
    region: 'Mejilla',
    anatomy: {
      function: 'Comprime la mejilla contra los dientes; ayuda a la masticación y soplido',
      innervation: 'Nervio facial (rama bucal)',
      origin: 'Procesos alveolares de maxilar y mandíbula; rafe pterigomandibular',
      insertion: 'Modiolo y fibras del orbicular de los labios'
    },
    motorPoint: {
      description: 'Mejilla, lateral a la comisura, a nivel del plano oclusal',
      techniqueNotes: [
        'Usado principalmente en sincinesias faciales',
        'Inyección intramuscular con dosis moderadas',
        'Evitar exceso (puede afectar competencia oral)'
      ]
    },
    dosing: {
      botox: dosisData.Botox['Buccinator'],
      dysport: dosisData.Dysport['Buccinator'],
      xeomin: dosisData.Botox['Buccinator']
    },
    indications: ['Sincinesias Faciales'],
    relatedMuscles: ['orbicularis-oris', 'risorius']
  },
  {
    id: 'levator-anguli-oris',
    name: 'Elevador del Ángulo de la Boca',
    latinName: 'Levator anguli oris',
    category: 'face',
    region: 'Tercio medio',
    anatomy: {
      function: 'Eleva la comisura labial',
      innervation: 'Nervio facial (rama bucal)',
      origin: 'Fosa canina del maxilar',
      insertion: 'Modiolo (ángulo de la boca)'
    },
    motorPoint: {
      description: 'Sobre la fosa canina, superior a la comisura labial',
      techniqueNotes: [
        'Inyección superficial a moderada; dosis bajas',
        'Indicación principal: asimetrías de comisura',
        'Valorar impacto en la sonrisa antes de tratar'
      ]
    },
    dosing: {
      botox: dosisData.Botox['Levator anguli oris'],
      dysport: dosisData.Dysport['Levator anguli oris'],
      xeomin: dosisData.Botox['Levator anguli oris']
    },
    indications: ['Sincinesias Faciales', 'Asimetrías Faciales'],
    relatedMuscles: ['zygomaticus-major', 'depressor-anguli-oris']
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
    relatedMuscles: ['cervical-paraspinals', 'splenius-capitis', 'levator-scapulae']
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
    relatedMuscles: ['trapezius', 'occipitalis', 'splenius-capitis']
  },
  {
    id: 'sternocleidomastoid',
    name: 'Esternocleidomastoideo',
    latinName: 'Sternocleidomastoid',
    category: 'neck',
    region: 'Cuello anterolateral',
    anatomy: {
      function: 'Rotación contralateral y flexión ipsilateral de la cabeza; flexión cervical bilateral',
      innervation: 'Nervio accesorio (XI) y ramas de C2–C3',
      origin: 'Manubrio esternal y tercio medial de la clavícula',
      insertion: 'Apófisis mastoides y línea nucal superior'
    },
    motorPoint: {
      description: 'Tercio medio del vientre muscular (porciones esternal y/o clavicular según patrón)',
      techniqueNotes: [
        'Limitar dosis por lado; evitar dosis altas bilaterales (disfagia)',
        '2–3 puntos a lo largo del vientre',
        'EMG o USG útiles en tortícolis complejas'
      ]
    },
    usgGuidance: {
      transducerType: 'Lineal 10–12 MHz',
      view: 'Transversal',
      landmarks: ['Vientre del ECM', 'Vasos carotídeos medialmente', 'Escalenos profundos'],
      approach: 'In-plane, superficial a vasos',
      precautions: ['No inyectar medial profundo hacia carótida', 'Riesgo de disfagia con difusión']
    },
    dosing: {
      botox: dosisData.Botox['Esternocleidomastoideo'],
      dysport: dosisData.Dysport['Esternocleidomastoideo'],
      xeomin: dosisData.Botox['Esternocleidomastoideo']
    },
    indications: ['Distonía Cervical', 'Tortícolis'],
    relatedMuscles: ['splenius-capitis', 'levator-scapulae', 'trapezius', 'platysma']
  },
  {
    id: 'splenius-capitis',
    name: 'Esplenio de la Cabeza',
    latinName: 'Splenius capitis',
    category: 'neck',
    region: 'Cuello posterior',
    anatomy: {
      function: 'Extensión, flexión lateral y rotación ipsilateral de la cabeza',
      innervation: 'Ramas dorsales de nervios espinales cervicales medios',
      origin: 'Ligamento nucal y procesos espinosos C7–T3',
      insertion: 'Apófisis mastoides y línea nucal superior'
    },
    motorPoint: {
      description: 'Cuello posterolateral a nivel C2–C4, ~2–4 cm lateral a la línea media, bajo el trapecio superior',
      techniqueNotes: [
        'Músculo más frecuentemente tratado en distonía cervical',
        '2–3 puntos por lado según hipertrofia',
        'Evitar inyección excesivamente profunda'
      ]
    },
    dosing: {
      botox: dosisData.Botox['Esplenio de la cabeza'],
      dysport: dosisData.Dysport['Esplenio de la cabeza'],
      xeomin: dosisData.Botox['Esplenio de la cabeza']
    },
    indications: ['Distonía Cervical', 'Migraña Crónica'],
    relatedMuscles: ['sternocleidomastoid', 'trapezius', 'cervical-paraspinals', 'levator-scapulae']
  },
  {
    id: 'levator-scapulae',
    name: 'Elevador de la Escápula',
    latinName: 'Levator scapulae',
    category: 'neck',
    region: 'Cuello y hombro',
    anatomy: {
      function: 'Elevación y rotación inferior de la escápula; contribuye a la inclinación ipsilateral del cuello',
      innervation: 'Nervio dorsal de la escápula (C4–C5) y ramas de C3–C4',
      origin: 'Apófisis transversas de C1–C4',
      insertion: 'Ángulo superior y borde medial de la escápula'
    },
    motorPoint: {
      description: '2–3 cm medial al ángulo superior de la escápula, en el vientre bajo el trapecio superior',
      techniqueNotes: [
        'USG o EMG recomendados (proximidad a plexo)',
        '1–3 puntos según patrón de elevación escapular',
        'Frecuente en tortícolis con hombro elevado'
      ]
    },
    usgGuidance: {
      transducerType: 'Lineal 10–12 MHz',
      view: 'Transversal',
      landmarks: ['Ángulo superior escapular', 'Trapecio superficial', 'Elevador profundo'],
      approach: 'In-plane de superficial a profundo',
      precautions: ['Evitar plexo braquial y vasos cervicales transversos']
    },
    dosing: {
      botox: dosisData.Botox['Elevador de la escápula'],
      dysport: dosisData.Dysport['Elevador de la escápula'],
      xeomin: dosisData.Botox['Elevador de la escápula']
    },
    indications: ['Distonía Cervical', 'Espasticidad', 'Hombro Elevado Espástico'],
    relatedMuscles: ['trapezius', 'sternocleidomastoid', 'splenius-capitis', 'romboides']
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
    indications: ['Espasticidad de Miembros Superiores', 'Espasticidad Pediátrica', 'Hombro Doloroso Espástico (extensión)'],
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
      botox: dosisData.Botox['Abductor pollicis longus'],
      dysport: dosisData.Dysport['Abductor pollicis longus'],
      xeomin: dosisData.Botox['Abductor pollicis longus']
    },
    indications: ['Espasticidad de Miembros Superiores'],
    relatedMuscles: ['extensor-pollicis-brevis', 'extensor-pollicis-longus', 'adductor-pollicis']
  },
  {
    id: 'adductor-pollicis',
    name: 'Aductor del Pulgar',
    latinName: 'Adductor pollicis',
    category: 'upper-limb',
    region: 'Mano',
    anatomy: {
      function: 'Aducción del pulgar hacia el índice (patrón thumb-in-palm)',
      innervation: 'Nervio cubital (rama profunda)',
      origin: 'Cabeza oblicua: base del 2.º–3.er metacarpiano y hueso grande; cabeza transversa: 3.er metacarpiano',
      insertion: 'Base de la falange proximal del pulgar (lado cubital)'
    },
    motorPoint: {
      description: 'Espacio intermetacarpiano I–II, profundo al primer interóseo dorsal / eminencia tenar profunda',
      techniqueNotes: [
        'Clave en patrón thumb-in-palm',
        '1–2 puntos; profundizar bajo el primer interóseo dorsal',
        'USG útil para separar de intrínsecos vecinos'
      ]
    },
    dosing: {
      botox: dosisData.Botox['Adductor pollicis'],
      dysport: dosisData.Dysport['Adductor pollicis'],
      xeomin: dosisData.Botox['Adductor pollicis']
    },
    indications: ['Espasticidad de Miembros Superiores', 'Pulgar en Palma'],
    relatedMuscles: ['flexor-pollicis-longus', 'abductor-pollicis-longus']
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
    indications: ['Espasticidad de Miembros Superiores', 'Espasticidad Pediátrica', 'Hombro Doloroso Espástico'],
    relatedMuscles: ['subscapularis', 'deltoides', 'coracobrachialis']
  },
  {
    id: 'subscapularis',
    name: 'Subescapular',
    latinName: 'Subscapularis',
    category: 'upper-limb',
    region: 'Hombro (fosa subescapular)',
    anatomy: {
      function: 'Rotación interna del hombro; estabilizador anterior de la glenohumeral',
      innervation: 'Nervio subescapular (C5–C6)',
      origin: 'Fosa subescapular de la escápula',
      insertion: 'Tubérculo menor del húmero'
    },
    motorPoint: {
      description:
        'Decúbito prono, brazo en abducción ~90° y codo flexionado 90°: fosa subescapular, 2–3 cm lateral al ángulo inferior de la escápula',
      techniqueNotes: [
        'Músculo profundo: USG o EMG casi obligatorios',
        '2–4 sitios de inyección según volumen',
        'Objetivo principal en hombro doloroso espástico post-EVC (patrón de rotación interna)',
        'Riesgo de punción pleural si el abordaje es demasiado caudal o medial sin guía'
      ]
    },
    usgGuidance: {
      transducerType: 'Lineal 10–12 MHz',
      view: 'Transversal',
      landmarks: ['Escápula anterior', 'Subescapular en fosa', 'Cabeza humeral', 'Deltoide anterior superficial'],
      approach: 'In-plane posterior a anterior (decúbito prono o lateral)',
      precautions: [
        'No avanzar aguja hacia pleura sin visualización',
        'Confirmar contracción con rotación interna activa o EMG'
      ]
    },
    dosing: {
      botox: dosisData.Botox['Subscapularis'],
      dysport: dosisData.Dysport['Subscapularis'],
      xeomin: dosisData.Botox['Subscapularis']
    },
    indications: ['Hombro Doloroso Espástico', 'Espasticidad de Miembros Superiores'],
    relatedMuscles: ['pectoral-mayor', 'redondo-mayor', 'dorsal-ancho']
  },
  {
    id: 'dorsal-ancho',
    name: 'Dorsal Ancho',
    latinName: 'Latissimus dorsi',
    category: 'upper-limb',
    region: 'Tórax posterolateral / hombro',
    anatomy: {
      function: 'Aducción, extensión y rotación interna del hombro',
      innervation: 'Nervio toracodorsal',
      origin: 'Apófisis espinosas T7–L5, cresta ilíaca posterior y fascia toracolumbar',
      insertion: 'Surco intertubercular del húmero (frente al teres major)'
    },
    motorPoint: {
      description:
        'Región posterolateral del tórax (~nivel 9.ª costilla), 6–8 cm lateral a la línea de apófisis espinosas, con brazo en aducción y ligera RI',
      techniqueNotes: [
        '2 sitios habituales en el vientre muscular',
        'USG recomendado por riesgo de pleura en abordajes altos o profundos',
        'Confirmar con aducción/extensión de hombro contra resistencia'
      ]
    },
    usgGuidance: {
      transducerType: 'Lineal 10–12 MHz',
      view: 'Transversal',
      landmarks: ['Dorsal ancho superficial', 'Costillas', 'Serrato anterior profundo', 'Pleura (límite profundo)'],
      approach: 'In-plane',
      precautions: ['Evitar penetración pleural en región axilar posterior alta']
    },
    dosing: {
      botox: dosisData.Botox['Dorsal ancho'],
      dysport: dosisData.Dysport['Dorsal ancho'],
      xeomin: dosisData.Botox['Dorsal ancho']
    },
    indications: ['Hombro Doloroso Espástico', 'Espasticidad de Miembros Superiores'],
    relatedMuscles: ['redondo-mayor', 'pectoral-mayor', 'subscapularis']
  },
  {
    id: 'redondo-mayor',
    name: 'Redondo Mayor',
    latinName: 'Teres major',
    category: 'upper-limb',
    region: 'Axila posterior',
    anatomy: {
      function: 'Aducción, extensión y rotación interna del hombro (sinergia con dorsal ancho)',
      innervation: 'Nervio subescapular inferior',
      origin: 'Borde lateral inferior de la escápula',
      insertion: 'Surco intertubercular del húmero (medial al dorsal ancho)'
    },
    motorPoint: {
      description:
        'Axila posterior, 5–6 cm distal al ángulo inferior de la escápula, con brazo en aducción y rotación interna',
      techniqueNotes: [
        '1–2 puntos de inyección',
        'Músculo de volumen medio; dosis menor que pectoral o dorsal ancho',
        'Palpar entre dorsal ancho y borde escapular'
      ]
    },
    dosing: {
      botox: dosisData.Botox['Redondo mayor'],
      dysport: dosisData.Dysport['Redondo mayor'],
      xeomin: dosisData.Botox['Redondo mayor']
    },
    indications: ['Hombro Doloroso Espástico', 'Espasticidad de Miembros Superiores'],
    relatedMuscles: ['dorsal-ancho', 'subscapularis', 'redondo-menor']
  },
  {
    id: 'redondo-menor',
    name: 'Redondo Menor',
    latinName: 'Teres minor',
    category: 'upper-limb',
    region: 'Hombro posterior',
    anatomy: {
      function: 'Rotación externa del hombro; estabilizador de la glenohumeral',
      innervation: 'Nervio axilar',
      origin: 'Borde lateral superior de la escápula',
      insertion: 'Tubérculo mayor del húmero (faceta inferior)'
    },
    motorPoint: {
      description: '2–3 cm inferior al borde lateral de la espina escapular, lateral a la fosa infraespinosa',
      techniqueNotes: [
        '1–2 puntos; sinergia con infraespinoso',
        'Confirmar con rotación externa de hombro',
        'USG útil para separar de infraespinoso'
      ]
    },
    dosing: {
      botox: dosisData.Botox['Redondo menor'],
      dysport: dosisData.Dysport['Redondo menor'],
      xeomin: dosisData.Botox['Redondo menor']
    },
    indications: ['Hombro Doloroso Espástico', 'Espasticidad de Miembros Superiores'],
    relatedMuscles: ['infraespinoso', 'subscapularis', 'redondo-mayor']
  },
  {
    id: 'supraespinoso',
    name: 'Supraespinoso',
    latinName: 'Supraspinatus',
    category: 'upper-limb',
    region: 'Hombro (fosa supraespinosa)',
    anatomy: {
      function: 'Inicia la abducción del hombro (primeros ~15°) y estabiliza la cabeza humeral',
      innervation: 'Nervio supraescapular',
      origin: 'Fosa supraespinosa de la escápula',
      insertion: 'Tubérculo mayor del húmero (faceta superior)'
    },
    motorPoint: {
      description: 'Punto medio de la fosa supraespinosa, entre acromion y ángulo superior escapular',
      techniqueNotes: [
        'Abordaje posterior; profundidad moderada',
        '1–2 puntos',
        'Evitar nervio supraescapular en la escotadura'
      ]
    },
    dosing: {
      botox: dosisData.Botox['Supraespinoso'],
      dysport: dosisData.Dysport['Supraespinoso'],
      xeomin: dosisData.Botox['Supraespinoso']
    },
    indications: ['Hombro Doloroso Espástico', 'Espasticidad de Miembros Superiores'],
    relatedMuscles: ['infraespinoso', 'deltoides', 'subscapularis']
  },
  {
    id: 'infraespinoso',
    name: 'Infraespinoso',
    latinName: 'Infraspinatus',
    category: 'upper-limb',
    region: 'Hombro (fosa infraespinosa)',
    anatomy: {
      function: 'Rotación externa del hombro; estabilizador posterior de la glenohumeral',
      innervation: 'Nervio supraescapular',
      origin: 'Fosa infraespinosa de la escápula',
      insertion: 'Tubérculo mayor del húmero (faceta media)'
    },
    motorPoint: {
      description: 'Fosa infraespinosa, 2–3 cm inferior al borde lateral de la espina escapular',
      techniqueNotes: [
        '2 puntos habituales en el vientre',
        'Confirmar con rotación externa (codo pegado al tronco)',
        'Útil en patrones de rotación interna espástica como sinergista a tratar selectivamente'
      ]
    },
    dosing: {
      botox: dosisData.Botox['Infraespinoso'],
      dysport: dosisData.Dysport['Infraespinoso'],
      xeomin: dosisData.Botox['Infraespinoso']
    },
    indications: ['Hombro Doloroso Espástico', 'Espasticidad de Miembros Superiores'],
    relatedMuscles: ['supraespinoso', 'redondo-menor', 'subscapularis']
  },
  {
    id: 'romboides',
    name: 'Romboides',
    latinName: 'Rhomboids',
    category: 'upper-limb',
    region: 'Espalda medial / escápula',
    anatomy: {
      function: 'Retracción y rotación inferior de la escápula; estabiliza el borde medial',
      innervation: 'Nervio dorsal de la escápula',
      origin: 'Procesos espinosos C7–T5 (menor y mayor)',
      insertion: 'Borde medial de la escápula'
    },
    motorPoint: {
      description: 'Entre apófisis espinosas T2–T5 y borde medial de la escápula',
      techniqueNotes: [
        '2–3 puntos a lo largo del vientre',
        'Profundidad moderada bajo el trapecio',
        'Confirmar con retracción escapular'
      ]
    },
    dosing: {
      botox: dosisData.Botox['Romboides'],
      dysport: dosisData.Dysport['Romboides'],
      xeomin: dosisData.Botox['Romboides']
    },
    indications: ['Espasticidad de Miembros Superiores', 'Distonía Cervical'],
    relatedMuscles: ['trapezius', 'levator-scapulae', 'serrato-anterior']
  },
  {
    id: 'serrato-anterior',
    name: 'Serrato Anterior',
    latinName: 'Serratus anterior',
    category: 'upper-limb',
    region: 'Tórax lateral',
    anatomy: {
      function: 'Protracción y rotación superior de la escápula; mantiene la escápula contra el tórax',
      innervation: 'Nervio torácico largo',
      origin: 'Caras laterales de las costillas 1–8/9',
      insertion: 'Borde medial de la escápula (cara anterior)'
    },
    motorPoint: {
      description: 'Cara lateral del tórax a nivel axilar, sobre costillas 2–5',
      techniqueNotes: [
        'USG recomendado (proximidad a pleura)',
        '2–3 puntos en digitaciones medias',
        'Confirmar con protracción escapular'
      ]
    },
    usgGuidance: {
      transducerType: 'Lineal 10–12 MHz',
      view: 'Transversal',
      landmarks: ['Digitaciones del serrato', 'Costillas', 'Pleura profunda'],
      approach: 'In-plane superficial a pleura',
      precautions: ['Riesgo de neumotórax si se profundiza entre costillas']
    },
    dosing: {
      botox: dosisData.Botox['Serrato anterior'],
      dysport: dosisData.Dysport['Serrato anterior'],
      xeomin: dosisData.Botox['Serrato anterior']
    },
    indications: ['Espasticidad de Miembros Superiores', 'Hombro Doloroso Espástico'],
    relatedMuscles: ['pectoral-mayor', 'pectoral-menor', 'romboides']
  },
  {
    id: 'pectoral-menor',
    name: 'Pectoral Menor',
    latinName: 'Pectoralis minor',
    category: 'upper-limb',
    region: 'Tórax anterior',
    anatomy: {
      function: 'Depresión, protracción y rotación inferior de la escápula; eleva las costillas en inspiración forzada',
      innervation: 'Nervio pectoral medial',
      origin: 'Costillas 3–5 cerca de los cartílagos',
      insertion: 'Apófisis coracoides de la escápula'
    },
    motorPoint: {
      description: 'Región infraclavicular, 2–3 cm medial a la coracoides, entre 2.ª–3.ª costilla',
      techniqueNotes: [
        'USG casi obligatorio (plexo braquial y vasos)',
        '1–2 puntos',
        'Útil en patrón de hombro anteriorizado'
      ]
    },
    dosing: {
      botox: dosisData.Botox['Pectoralis minor'],
      dysport: dosisData.Dysport['Pectoralis minor'],
      xeomin: dosisData.Botox['Pectoralis minor']
    },
    indications: ['Hombro Doloroso Espástico', 'Espasticidad de Miembros Superiores'],
    relatedMuscles: ['pectoral-mayor', 'serrato-anterior', 'subscapularis']
  },
  {
    id: 'supinador',
    name: 'Supinador',
    latinName: 'Supinator',
    category: 'upper-limb',
    region: 'Antebrazo',
    anatomy: {
      function: 'Supinación del antebrazo',
      innervation: 'Nervio radial (rama profunda / interóseo posterior)',
      origin: 'Epicóndilo lateral, ligamento anular y cresta del supinador del cúbito',
      insertion: 'Cara proximal lateral del radio'
    },
    motorPoint: {
      description: 'Antebrazo proximal-lateral, 5–6 cm distal al epicóndilo lateral, anterior al ECRL',
      techniqueNotes: [
        'USG o EMG recomendados (nervio interóseo posterior atraviesa el músculo)',
        '1–2 puntos',
        'Confirmar con supinación contra resistencia'
      ]
    },
    dosing: {
      botox: dosisData.Botox['Supinador'],
      dysport: dosisData.Dysport['Supinador'],
      xeomin: dosisData.Botox['Supinador']
    },
    indications: ['Espasticidad de Miembros Superiores'],
    relatedMuscles: ['biceps-brachii', 'pronator-teres', 'brachioradialis']
  },
  {
    id: 'extensor-digiti-minimi',
    name: 'Extensor del Meñique',
    latinName: 'Extensor digiti minimi',
    category: 'upper-limb',
    region: 'Antebrazo',
    anatomy: {
      function: 'Extensión del 5.º dedo; contribuye a la extensión de muñeca',
      innervation: 'Nervio radial (rama profunda)',
      origin: 'Epicóndilo lateral del húmero (origen común de extensores)',
      insertion: 'Expansión extensora del 5.º dedo'
    },
    motorPoint: {
      description: 'Compartimento posterior, ~6–7 cm distal al epicóndilo lateral, en línea con el meñique',
      techniqueNotes: [
        '1–2 puntos',
        'Separar de EDC con USG si es posible',
        'Confirmar con extensión aislada del 5.º dedo'
      ]
    },
    dosing: {
      botox: dosisData.Botox['Extensor digiti minimi'],
      dysport: dosisData.Dysport['Extensor digiti minimi'],
      xeomin: dosisData.Botox['Extensor digiti minimi']
    },
    indications: ['Espasticidad de Miembros Superiores'],
    relatedMuscles: ['extensor-digitorum-communis', 'extensor-carpi-ulnar']
  },

  // ========== TRUNK MUSCLES ==========
  {
    id: 'cuadrado-lumbar',
    name: 'Cuadrado Lumbar',
    latinName: 'Quadratus lumborum',
    category: 'trunk',
    region: 'Lumbar',
    anatomy: {
      function: 'Flexión lateral de la columna lumbar e hiperextensión; fija la 12.ª costilla',
      innervation: 'Nervios espinales T12–L4',
      origin: 'Cresta ilíaca y ligamento iliolumbar',
      insertion: '12.ª costilla y procesos transversos L1–L4'
    },
    motorPoint: {
      description: 'Región lumbar posterior, entre cresta ilíaca y 12.ª costilla, ~3–4 cm lateral a L4',
      techniqueNotes: [
        'USG o fluoroscopia recomendados',
        '2–3 puntos a lo largo del vientre',
        'Riesgo renal/pleural en abordajes altos'
      ]
    },
    usgGuidance: {
      transducerType: 'Curvo 2–5 MHz o lineal según complexión',
      view: 'Transversal',
      landmarks: ['Apófisis transversas', 'Cuadrado lumbar', 'Psoas medial', 'Riñón'],
      approach: 'In-plane lateral a medial',
      precautions: ['Evitar riñón y peritoneo']
    },
    dosing: {
      botox: dosisData.Botox['Cuadrado lumbar'],
      dysport: dosisData.Dysport['Cuadrado lumbar'],
      xeomin: dosisData.Botox['Cuadrado lumbar']
    },
    indications: ['Espasticidad', 'Dolor Lumbar Miofascial'],
    relatedMuscles: ['psoas-mayor', 'iliaco']
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
    relatedMuscles: ['iliaco', 'rectus-femoris', 'gluteo-medio', 'pectineus']
  },
  {
    id: 'iliaco',
    name: 'Ilíaco',
    latinName: 'Iliacus',
    category: 'lower-limb',
    region: 'Pelvis y muslo proximal',
    anatomy: {
      function: 'Flexión de cadera (componente del iliopsoas)',
      innervation: 'Nervio femoral',
      origin: 'Fosa ilíaca',
      insertion: 'Trocánter menor del fémur (tendón común con psoas)'
    },
    motorPoint: {
      description: 'Fosa ilíaca / región inguinal profunda, entre cresta ilíaca y EIAS',
      techniqueNotes: [
        'Solo con guía (USG); riesgo vascular y de nervio femoral',
        'Complementa al psoas en flexión de cadera espástica',
        '1–2 puntos profundos'
      ]
    },
    dosing: {
      botox: dosisData.Botox['Ilíaco'],
      dysport: dosisData.Dysport['Ilíaco'],
      xeomin: dosisData.Botox['Ilíaco']
    },
    indications: ['Espasticidad de Miembros Inferiores', 'Flexión de Cadera Espástica'],
    relatedMuscles: ['psoas-mayor', 'rectus-femoris', 'pectineus']
  },
  {
    id: 'pectineus',
    name: 'Pectíneo',
    latinName: 'Pectineus',
    category: 'lower-limb',
    region: 'Muslo medial proximal',
    anatomy: {
      function: 'Aducción y flexión de cadera; rotación medial ligera',
      innervation: 'Nervio femoral (a veces obturador)',
      origin: 'Pecten del pubis',
      insertion: 'Línea pectínea del fémur'
    },
    motorPoint: {
      description: 'Muslo proximal-medial, 5–6 cm distal a la sínfisis púbica, inferior al pecten del pubis',
      techniqueNotes: [
        '1–2 puntos',
        'USG útil cerca del triángulo femoral',
        'Confirmar con flexión-aducción de cadera'
      ]
    },
    dosing: {
      botox: dosisData.Botox['Pectineus'],
      dysport: dosisData.Dysport['Pectineus'],
      xeomin: dosisData.Botox['Pectineus']
    },
    indications: ['Espasticidad de Miembros Inferiores', 'Marcha en Tijera'],
    relatedMuscles: ['adductor-longus', 'adductor-magnus', 'iliaco', 'psoas-mayor']
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
    relatedMuscles: ['flexor-hallucis-longus', 'flexor-hallucis-brevis', 'flexor-digitorum-brevis']
  },
  {
    id: 'flexor-digitorum-brevis',
    name: 'Flexor Corto de los Dedos',
    latinName: 'Flexor digitorum brevis',
    category: 'lower-limb',
    region: 'Pie plantar',
    anatomy: {
      function: 'Flexión de las falanges medias de los dedos 2–5',
      innervation: 'Nervio medial plantar',
      origin: 'Tuberosidad del calcáneo y aponeurosis plantar',
      insertion: 'Falanges medias de los dedos 2–5'
    },
    motorPoint: {
      description: 'Planta media del pie, bajo los metatarsos centrales (2–4)',
      techniqueNotes: [
        '1–2 puntos superficiales-moderados',
        'Útil en garra de dedos',
        'Evitar pedículos vasculares plantares'
      ]
    },
    dosing: {
      botox: dosisData.Botox['Flexor digitorum brevis'],
      dysport: dosisData.Dysport['Flexor digitorum brevis'],
      xeomin: dosisData.Botox['Flexor digitorum brevis']
    },
    indications: ['Espasticidad de Miembros Inferiores', 'Garra de Dedos'],
    relatedMuscles: ['flexor-digitorum-longus', 'abductor-hallucis', 'flexor-hallucis-brevis']
  },
  {
    id: 'flexor-hallucis-brevis',
    name: 'Flexor Corto del Hallux',
    latinName: 'Flexor hallucis brevis',
    category: 'lower-limb',
    region: 'Pie medial',
    anatomy: {
      function: 'Flexión de la articulación metatarsofalángica del hallux',
      innervation: 'Nervio medial plantar',
      origin: 'Cuboides y cuneiformes laterales',
      insertion: 'Base de la falange proximal del hallux (ambos lados)'
    },
    motorPoint: {
      description: 'Planta medial del antepié, distal a la MTF del hallux / eminencia tenar del hallux',
      techniqueNotes: [
        '1–2 puntos',
        'Complementa FHL en garra del hallux',
        'Evitar sesamoideos y pedículo medial'
      ]
    },
    dosing: {
      botox: dosisData.Botox['Flexor hallucis brevis'],
      dysport: dosisData.Dysport['Flexor hallucis brevis'],
      xeomin: dosisData.Botox['Flexor hallucis brevis']
    },
    indications: ['Espasticidad de Miembros Inferiores', 'Garra del Hallux'],
    relatedMuscles: ['flexor-hallucis-longus', 'abductor-hallucis']
  },
  {
    id: 'popliteus',
    name: 'Poplíteo',
    latinName: 'Popliteus',
    category: 'lower-limb',
    region: 'Rodilla posterior',
    anatomy: {
      function: 'Desbloquea la rodilla en extensión (rotación interna de la tibia); flexión inicial de rodilla',
      innervation: 'Nervio tibial',
      origin: 'Cóndilo femoral lateral y menisco lateral',
      insertion: 'Cara posterior proximal de la tibia'
    },
    motorPoint: {
      description: 'Fosa poplítea, posterior al epicóndilo femoral lateral, entre gastrocnemio lateral y bíceps femoral',
      techniqueNotes: [
        'USG obligatorio (proximidad a vasos poplíteos)',
        '1 punto; dosis bajas-moderadas',
        'Confirmar con rotación interna tibial'
      ]
    },
    dosing: {
      botox: dosisData.Botox['Popliteus'],
      dysport: dosisData.Dysport['Popliteus'],
      xeomin: dosisData.Botox['Popliteus']
    },
    indications: ['Espasticidad de Miembros Inferiores'],
    relatedMuscles: ['gastrocnemio-lateral', 'biceps-femoris']
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
    relatedMuscles: ['vastos-cuadriceps', 'tibialis-anterior', 'iliaco']
  }
];

/**
 * Helper functions for muscle data retrieval
 */
export const getMuscleById = (id: string): MuscleData | undefined => {
  return musclesData.find(m => m.id === id);
};

/** Resolve calculator / dosisData muscle names to MuscleData (latin or Spanish). */
export const findMuscleForCalculatorName = (calculatorName: string): MuscleData | undefined => {
  const n = calculatorName.trim().toLowerCase();
  if (!n) return undefined;

  const exact =
    musclesData.find((m) => m.latinName.toLowerCase() === n) ||
    musclesData.find((m) => m.name.toLowerCase() === n) ||
    musclesData.find((m) => m.id === n || m.id === n.replace(/\s+/g, '-'));
  if (exact) return exact;

  const aliases: Record<string, string> = {
    'gastrocnemio (cabeza medial)': 'gastrocnemio-medial',
    'gastrocnemio (cabeza lateral)': 'gastrocnemio-lateral',
    deltoides: 'deltoides',
    'dorsal ancho': 'dorsal-ancho',
    'glúteo medio': 'gluteo-medio',
    'gluteo medio': 'gluteo-medio',
    'pectoral mayor': 'pectoral-mayor',
    'pectoral menor': 'pectoral-menor',
    'pectoralis minor': 'pectoral-menor',
    'psoas mayor': 'psoas-mayor',
    sóleo: 'soleus',
    soleo: 'soleus',
    esternocleidomastoideo: 'sternocleidomastoid',
    sternocleidomastoid: 'sternocleidomastoid',
    'esplenio de la cabeza': 'splenius-capitis',
    'elevador de la escápula': 'levator-scapulae',
    'elevador de la escapula': 'levator-scapulae',
    'pterigoideo medial': 'medial-pterygoid',
    'pterigoideo lateral': 'lateral-pterygoid',
    'aductor del pulgar': 'adductor-pollicis',
    'adductor pollicis': 'adductor-pollicis',
    'cuadrado lumbar': 'cuadrado-lumbar',
    ilíaco: 'iliaco',
    iliaco: 'iliaco',
    pectíneo: 'pectineus',
    pectineo: 'pectineus',
    poplíteo: 'popliteus',
    popliteo: 'popliteus',
    supraespinoso: 'supraespinoso',
    infraespinoso: 'infraespinoso',
    romboides: 'romboides',
    'serrato anterior': 'serrato-anterior',
    'redondo menor': 'redondo-menor',
    'redondo mayor': 'redondo-mayor',
  };
  const aliasId = aliases[n];
  if (aliasId) {
    const byAlias = getMuscleById(aliasId);
    if (byAlias) return byAlias;
  }

  return musclesData.find(
    (m) =>
      m.latinName.toLowerCase().includes(n) ||
      n.includes(m.latinName.toLowerCase()) ||
      m.name.toLowerCase().includes(n)
  );
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

/**
 * Retorna el ícono Material Symbols representativo de una categoría anatómica.
 */
export const getCategoryIcon = (category: MuscleData['category']): string => {
  const iconMap: Record<MuscleData['category'], string> = {
    'face': 'face',
    'neck': 'accessibility',
    'upper-limb': 'back_hand',
    'lower-limb': 'directions_walk',
    'trunk': 'accessibility_new'
  };
  return iconMap[category] || 'accessibility_new';
};

/**
 * Determina el ícono Material Symbols más específico e intuitivo para cada músculo
 * según su región anatómica precisa (mano, pie, periocular, brazo, hombro, muslo, etc.).
 */
export const getMuscleIcon = (muscle: Pick<MuscleData, 'id' | 'name' | 'category' | 'region'>): string => {
  const name = (muscle.name || '').toLowerCase();
  const id = (muscle.id || '').toLowerCase();
  const reg = (muscle.region || '').toLowerCase();
  const cat = muscle.category;

  // 1. MANO Y DEDOS DE LA MANO (Mano / Pulgar / Meñique / Lumbricales / Interóseos)
  if (
    reg.includes('mano') ||
    name.includes('pulgar') ||
    name.includes('meñique') ||
    name.includes('palmar corto') ||
    name.includes('oponente') ||
    name.includes('interóseo dorsal') ||
    name.includes('interoseo dorsal') ||
    name.includes('interóseo palmar') ||
    name.includes('interoseo palmar') ||
    id.includes('pollicis') ||
    id.includes('digiti-minimi') ||
    id.includes('palmaris-brevis') ||
    (cat === 'upper-limb' && (name.includes('lumbrical') || name.includes('interóseo') || name.includes('interoseo')))
  ) {
    return 'back_hand';
  }

  // 2. PIE, DEDOS DEL PIE Y PLANTA (Foot, toes, plantar, hallux)
  if (
    /\bpie\b|\bplanta\b|\bpedio\b|\bhallux\b/i.test(reg) ||
    name.includes('hallux') ||
    name.includes('pedio') ||
    name.includes('dedo gordo') ||
    name.includes('dedos del pie') ||
    id.includes('hallucis') ||
    id.includes('pedis') ||
    id.includes('plantaris') ||
    (cat === 'lower-limb' && (name.includes('hallux') || name.includes('plantar')))
  ) {
    return 'footprint';
  }

  // 3. ANTEBRAZO Y MUÑECA (Pronadores, Supinadores, Flexores y Extensores de muñeca)
  if (
    reg.includes('antebrazo') ||
    name.includes('pronador') ||
    name.includes('supinador') ||
    name.includes('radial') ||
    name.includes('cubital') ||
    name.includes('ulnar') ||
    name.includes('braquiorradial') ||
    name.includes('flexor digital') ||
    name.includes('extensor digital') ||
    name.includes('flexor profundo') ||
    name.includes('flexor superficial') ||
    name.includes('flexor de los dedos') ||
    name.includes('extensor de los dedos') ||
    name.includes('extensor del índice') ||
    id.includes('pronator') ||
    id.includes('supinator') ||
    id.includes('carpi') ||
    id.includes('brachioradialis') ||
    id.includes('digitorum-profundus') ||
    id.includes('digitorum-superficialis') ||
    id.includes('indicis')
  ) {
    return 'front_hand';
  }

  // 4. BRAZO Y CODO (Bíceps, Tríceps, Braquial anterior, Coracobraquial)
  if (
    reg.includes('brazo') ||
    name.includes('bíceps braquial') ||
    name.includes('biceps braquial') ||
    name.includes('tríceps braquial') ||
    name.includes('triceps braquial') ||
    name.includes('braquial') ||
    name.includes('coracobraquial') ||
    name.includes('ancóneo') ||
    id.includes('biceps-brachii') ||
    id.includes('triceps-brachii') ||
    id.includes('brachialis') ||
    id.includes('coracobrachialis') ||
    id.includes('anconeus')
  ) {
    return 'arm_flex';
  }

  // 5. HOMBRO Y CINTURA ESCAPULAR (Deltoides, Supraespinoso, Infraespinoso, Subescapular, Redondos, Romboides)
  if (
    reg.includes('hombro') ||
    reg.includes('escapul') ||
    reg.includes('axila') ||
    name.includes('deltoides') ||
    name.includes('supraespinoso') ||
    name.includes('infraespinoso') ||
    name.includes('subescapular') ||
    name.includes('redondo mayor') ||
    name.includes('redondo menor') ||
    name.includes('pectoral mayor') ||
    name.includes('romboides') ||
    name.includes('elevador de la escápula') ||
    id.includes('deltoid') ||
    id.includes('supraspinatus') ||
    id.includes('infraspinatus') ||
    id.includes('subscapularis') ||
    id.includes('teres-') ||
    id.includes('rhomboideus')
  ) {
    return 'sports_gymnastics';
  }

  // 6. MUSLO, ISQUIOTIBIALES, CUÁDRICEPS, CADERA Y GLÚTEOS (Cuádriceps, Isquiotibiales, Aductores, Psoas, Glúteos)
  if (
    reg.includes('muslo') ||
    reg.includes('cadera') ||
    reg.includes('pelvis') ||
    reg.includes('rodilla') ||
    name.includes('cuádriceps') ||
    name.includes('cuadriceps') ||
    name.includes('vasto') ||
    name.includes('recto femoral') ||
    name.includes('bíceps femoral') ||
    name.includes('biceps femoral') ||
    name.includes('semitendinoso') ||
    name.includes('semimembranoso') ||
    name.includes('glúteo') ||
    name.includes('gluteo') ||
    name.includes('aductor') ||
    name.includes('psoas') ||
    name.includes('ilíaco') ||
    name.includes('iliaco') ||
    name.includes('tensor de la fascia') ||
    name.includes('grácil') ||
    name.includes('gracil') ||
    name.includes('sartorio') ||
    name.includes('piriforme') ||
    name.includes('poplíteo') ||
    name.includes('pectíneo') ||
    id.includes('femur') ||
    id.includes('femoris') ||
    id.includes('gluteus') ||
    id.includes('adductor') ||
    id.includes('vastus') ||
    id.includes('semitendinosus') ||
    id.includes('semimembranosus') ||
    id.includes('popliteus')
  ) {
    return 'directions_run';
  }

  // 7. PIERNA, PANTORRILLA Y TOBILLO (Gastrocnemios, Sóleo, Tibiales, Peroneos)
  if (
    reg.includes('pierna') ||
    name.includes('gastrocnemio') ||
    name.includes('gemelos') ||
    name.includes('sóleo') ||
    name.includes('soleo') ||
    name.includes('tibial') ||
    name.includes('peroneo') ||
    name.includes('fibular') ||
    id.includes('gastrocnemius') ||
    id.includes('soleus') ||
    id.includes('tibialis') ||
    id.includes('peroneus') ||
    id.includes('fibularis')
  ) {
    return 'directions_walk';
  }

  // 8. CARA - OJOS / PERIOCULAR / FRENTE / GLABELA (Orbicular de los ojos, Corrugador, Prócer, Frontal)
  if (
    reg.includes('periocular') ||
    reg.includes('frente') ||
    reg.includes('glabela') ||
    name.includes('orbicular de los ojos') ||
    name.includes('corrugador') ||
    name.includes('prócer') ||
    name.includes('procer') ||
    name.includes('frontal') ||
    name.includes('ceja') ||
    id.includes('oculi') ||
    id.includes('frontalis') ||
    id.includes('corrugator') ||
    id.includes('procerus')
  ) {
    return 'visibility';
  }

  // 9. CARA - BOCA / MANDÍBULA / MASTICACIÓN / MEJILLA / NARIZ
  if (
    cat === 'face' ||
    reg.includes('mandíbula') ||
    reg.includes('perioral') ||
    reg.includes('mentón') ||
    reg.includes('mejilla') ||
    reg.includes('sien') ||
    reg.includes('nariz') ||
    reg.includes('tercio medio') ||
    name.includes('masetero') ||
    name.includes('temporal') ||
    name.includes('pterigoideo') ||
    name.includes('buccinador') ||
    name.includes('orbicular de los labios') ||
    name.includes('mentoniano') ||
    name.includes('cigomático') ||
    name.includes('risorio') ||
    name.includes('depresor') ||
    name.includes('elevador') ||
    name.includes('nasal')
  ) {
    return 'face';
  }

  // 10. CUELLO (ECM, Esplenio, Escalenos, Trapecio superior, Semiespinoso, Paraespinales)
  if (
    cat === 'neck' ||
    reg.includes('cuello') ||
    name.includes('esternocleidomastoideo') ||
    name.includes('ecm') ||
    name.includes('esplenio') ||
    name.includes('escaleno') ||
    name.includes('trapecio') ||
    name.includes('semiespinoso') ||
    name.includes('platisma')
  ) {
    return 'accessibility';
  }

  // 11. TRONCO / ESPALDA / TÓRAX (Pectoral, Dorsal, Abdominales, Lumbar, Serrato)
  if (
    cat === 'trunk' ||
    reg.includes('tórax') ||
    reg.includes('lumbar') ||
    reg.includes('espalda') ||
    name.includes('pectoral') ||
    name.includes('recto abdominal') ||
    name.includes('oblicuo') ||
    name.includes('serrato') ||
    name.includes('paravertebral') ||
    name.includes('cuadrado lumbar') ||
    name.includes('dorsal ancho')
  ) {
    return 'accessibility_new';
  }

  return 'accessibility_new';
};
