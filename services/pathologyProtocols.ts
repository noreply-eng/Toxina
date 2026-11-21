import { supabase } from '../supabaseClient';
import {
  applyPathologyOverrides,
  getDefaultPathologyById,
  PATHOLOGIES_UPDATED_EVENT,
  PATHOLOGY_OVERRIDES_STORAGE_KEY,
  type PathologyData,
  type PathologyProtocol,
  type PathologyTimeline,
  type PathologyVideo,
  type SpasticityPattern,
} from '../data/pathologyData';
import type { ClinicalProtocolRecord } from './premiumContent';

const MEDIA_BUCKET = 'medical-media';

interface StoredPathologyExtraMeta {
  conversionNotes?: string;
  frequency?: string;
  maxDose?: string;
  timeline?: PathologyTimeline;
  patterns?: SpasticityPattern[];
  videos?: PathologyVideo[];
  image?: string;
  additionalInfo?: string[];
  contraindications?: string[];
  adverseEffects?: string[];
}

export function getCachedPathologyOverrides(): Record<string, PathologyData> {
  try {
    const raw = localStorage.getItem(PATHOLOGY_OVERRIDES_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, PathologyData>) : {};
  } catch {
    return {};
  }
}

function setCachedPathologyOverrides(map: Record<string, PathologyData>): void {
  try {
    localStorage.setItem(PATHOLOGY_OVERRIDES_STORAGE_KEY, JSON.stringify(map));
  } catch {
    // ignore storage quota errors
  }
  applyPathologyOverrides(map);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(PATHOLOGIES_UPDATED_EVENT));
  }
}

const VALID_CATEGORIES: PathologyData['category'][] = [
  'neurological',
  'autonomic',
  'urological',
  'aesthetic',
];

export function recordToPathologyData(record: ClinicalProtocolRecord): PathologyData {
  const base = getDefaultPathologyById(record.slug);
  const meta = (record.max_session_dose_json || {}) as unknown as StoredPathologyExtraMeta;
  const rawCategory = record.specialty_category as PathologyData['category'];
  const category: PathologyData['category'] = VALID_CATEGORIES.includes(rawCategory)
    ? rawCategory
    : base?.category || 'neurological';

  const protocols: PathologyProtocol[] = Array.isArray(record.muscles_payload)
    ? (record.muscles_payload as PathologyProtocol[])
    : base?.protocols || [];

  const references: string[] = Array.isArray(record.references_list)
    ? (record.references_list as string[])
    : base?.references || [];

  const additionalInfo: string[] = Array.isArray(meta.additionalInfo)
    ? meta.additionalInfo
    : Array.isArray(record.safety_precautions)
    ? (record.safety_precautions as string[])
    : base?.additionalInfo || [];

  const contraindications: string[] = Array.isArray(meta.contraindications)
    ? meta.contraindications
    : base?.contraindications || [];

  const adverseEffects: string[] = Array.isArray(meta.adverseEffects)
    ? meta.adverseEffects
    : base?.adverseEffects || [];

  return {
    id: record.slug,
    title: record.title || base?.title || record.slug,
    subtitle: record.subtitle ?? base?.subtitle ?? '',
    category,
    description: record.clinical_notes ?? base?.description ?? '',
    suggestedToxin: record.suggested_brand ?? base?.suggestedToxin ?? 'Botox, Xeomin o Dysport',
    conversionNotes: meta.conversionNotes ?? base?.conversionNotes,
    protocols,
    patterns: Array.isArray(meta.patterns) ? meta.patterns : base?.patterns,
    videos: Array.isArray(meta.videos) ? meta.videos : base?.videos || [],
    frequency: meta.frequency ?? base?.frequency,
    maxDose: meta.maxDose ?? base?.maxDose,
    timeline: meta.timeline ?? base?.timeline,
    additionalInfo,
    contraindications,
    adverseEffects,
    references,
    image:
      meta.image ||
      base?.image ||
      `${import.meta.env.VITE_SUPABASE_URL || 'https://qwhrdmllpznvqrxygytp.supabase.co'}/storage/v1/object/public/PortadasPatologias/espasticidad.jpeg`,
  };
}

export function pathologyDataToRecordPayload(
  pathology: PathologyData,
  updatedBy?: string
): Record<string, unknown> {
  const meta: StoredPathologyExtraMeta = {
    conversionNotes: pathology.conversionNotes,
    frequency: pathology.frequency,
    maxDose: pathology.maxDose,
    timeline: pathology.timeline,
    patterns: pathology.patterns,
    videos: pathology.videos ?? [],
    image: pathology.image,
    additionalInfo: pathology.additionalInfo ?? [],
    contraindications: pathology.contraindications ?? [],
    adverseEffects: pathology.adverseEffects ?? [],
  };

  return {
    slug: pathology.id,
    title: pathology.title.trim(),
    subtitle: pathology.subtitle?.trim() || null,
    specialty_category: pathology.category,
    suggested_brand: pathology.suggestedToxin?.trim() || null,
    clinical_notes: pathology.description?.trim() || null,
    muscles_payload: pathology.protocols ?? [],
    max_session_dose_json: meta,
    safety_precautions: pathology.additionalInfo ?? [],
    references_list: pathology.references ?? [],
    required_tier: 'free',
    is_published: true,
    ...(updatedBy ? { updated_by: updatedBy } : {}),
    updated_at: new Date().toISOString(),
  };
}

let inFlightFetch: Promise<Record<string, PathologyData>> | null = null;

/**
 * Carga todos los protocolos personalizados desde Supabase (`clinical_protocols`),
 * sincroniza el caché local y actualiza `pathologiesData` en memoria.
 */
export async function fetchAllPathologyOverrides(
  force = false
): Promise<Record<string, PathologyData>> {
  if (inFlightFetch && !force) return inFlightFetch;

  inFlightFetch = (async () => {
    const localMap = getCachedPathologyOverrides();
    try {
      const { data, error } = await supabase
        .from('clinical_protocols')
        .select('*')
        .eq('is_published', true);

      if (error) {
        // Si la tabla aún no existe o estamos offline, mantenemos el caché local
        applyPathologyOverrides(localMap);
        return localMap;
      }

      const remoteMap: Record<string, PathologyData> = {};
      (data ?? []).forEach((row) => {
        const record = row as ClinicalProtocolRecord;
        if (record.slug) {
          remoteMap[record.slug] = recordToPathologyData(record);
        }
      });

      const mergedMap = { ...localMap, ...remoteMap };
      setCachedPathologyOverrides(mergedMap);
      return mergedMap;
    } catch {
      applyPathologyOverrides(localMap);
      return localMap;
    } finally {
      inFlightFetch = null;
    }
  })();

  return inFlightFetch;
}

/**
 * Guarda o actualiza el protocolo completo de una patología (Admin).
 */
export async function savePathologyProtocol(
  pathology: PathologyData,
  updatedBy?: string
): Promise<{ pathology: PathologyData; syncedToCloud: boolean; cloudWarning?: string }> {
  const currentMap = getCachedPathologyOverrides();
  const nextMap = { ...currentMap, [pathology.id]: pathology };
  setCachedPathologyOverrides(nextMap);

  const payload = pathologyDataToRecordPayload(pathology, updatedBy);
  const { data, error } = await supabase
    .from('clinical_protocols')
    .upsert(payload, { onConflict: 'slug' })
    .select('*')
    .single();

  if (error) {
    console.warn('No se pudo sincronizar clinical_protocols en Supabase (guardado local activo):', error);
    return {
      pathology,
      syncedToCloud: false,
      cloudWarning: error.message,
    };
  }

  const saved = recordToPathologyData(data as ClinicalProtocolRecord);
  const syncedMap = { ...getCachedPathologyOverrides(), [saved.id]: saved };
  setCachedPathologyOverrides(syncedMap);

  return { pathology: saved, syncedToCloud: true };
}

/**
 * Restablece una patología a sus valores por defecto (o elimina una patología personalizada).
 */
export async function resetPathologyProtocol(pathologyId: string): Promise<void> {
  const currentMap = { ...getCachedPathologyOverrides() };
  delete currentMap[pathologyId];
  setCachedPathologyOverrides(currentMap);

  const { error } = await supabase
    .from('clinical_protocols')
    .delete()
    .eq('slug', pathologyId);

  if (error) {
    console.warn('Error eliminando override en clinical_protocols:', error);
  }
}

function fileExtension(file: File): string {
  const fromName = file.name.split('.').pop();
  if (fromName && fromName.length <= 5) return fromName.toLowerCase();
  const fromType = file.type.split('/').pop();
  return (fromType || 'jpg').toLowerCase();
}

/**
 * Sube una imagen de portada para una patología al bucket `medical-media`.
 */
export async function uploadPathologyCoverImage(
  file: File,
  pathologyId: string
): Promise<string> {
  const ext = fileExtension(file);
  const safeId = pathologyId.replace(/[^a-z0-9-_]/gi, '-').toLowerCase() || 'pathology';
  const path = `pathologies/${safeId}/cover-${Date.now()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from(MEDIA_BUCKET)
    .upload(path, file, {
      cacheControl: '3600',
      upsert: true,
      contentType: file.type || undefined,
    });

  if (uploadError) throw uploadError;

  const { data } = supabase.storage.from(MEDIA_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
