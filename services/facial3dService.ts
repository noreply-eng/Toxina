import { supabase } from '../supabaseClient';
import type { Facial3DModelRecord, InjectionPin3D, MeshMappingEntry } from '../types/facial3d';

const STORAGE_BUCKET = 'anatomy-3d';
const LOCAL_STORAGE_KEY = 'sonotox_admin_facial_3d_models_v1';

export interface SaveFacial3DModelInput {
  id?: string;
  slug: string;
  name: string;
  description?: string | null;
  model_url?: string | null;
  storage_path?: string | null;
  file_size_bytes?: number | null;
  draco_compressed?: boolean;
  is_active?: boolean;
  license_name?: string;
  attribution_text?: string;
  attribution_url?: string | null;
  mesh_mappings: Record<string, MeshMappingEntry>;
  injection_pins: InjectionPin3D[];
}

export interface ListModelsResult {
  models: Facial3DModelRecord[];
  source: 'supabase' | 'local';
  migrationPending: boolean;
}

function isMissingTableError(error: any): boolean {
  const code = error?.code || '';
  const msg = String(error?.message || '').toLowerCase();
  return (
    code === '42P01' ||
    code === 'PGRST205' ||
    msg.includes('facial_3d_models') && (msg.includes('does not exist') || msg.includes('not found') || msg.includes('schema cache'))
  );
}

function readLocalModels(): Facial3DModelRecord[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLocalModels(models: Facial3DModelRecord[]): void {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(models));
  } catch (err) {
    console.warn('Could not persist 3D model config to localStorage:', err);
  }
}

export async function listFacial3DModels(): Promise<ListModelsResult> {
  try {
    const { data, error } = await supabase
      .from('facial_3d_models')
      .select('*')
      .order('is_active', { ascending: false })
      .order('updated_at', { ascending: false });

    if (error) {
      if (isMissingTableError(error)) {
        return { models: readLocalModels(), source: 'local', migrationPending: true };
      }
      throw error;
    }

    return {
      models: (data ?? []) as Facial3DModelRecord[],
      source: 'supabase',
      migrationPending: false,
    };
  } catch (err: any) {
    if (isMissingTableError(err)) {
      return { models: readLocalModels(), source: 'local', migrationPending: true };
    }
    throw err;
  }
}

export async function saveFacial3DModel(
  input: SaveFacial3DModelInput,
  updatedBy?: string
): Promise<{ record: Facial3DModelRecord; source: 'supabase' | 'local'; migrationPending: boolean }> {
  const payload = {
    slug: input.slug,
    name: input.name,
    description: input.description ?? null,
    model_url: input.model_url ?? null,
    storage_path: input.storage_path ?? null,
    file_size_bytes: input.file_size_bytes ?? null,
    draco_compressed: input.draco_compressed ?? true,
    is_active: input.is_active ?? false,
    license_name: input.license_name || 'CC BY-SA 4.0',
    attribution_text:
      input.attribution_text ||
      'Z-Anatomy (Lluis V.) / BodyParts3D (DBCLS) — Licencia CC BY-SA 4.0',
    attribution_url: input.attribution_url ?? 'https://creativecommons.org/licenses/by-sa/4.0/',
    mesh_mappings: input.mesh_mappings,
    injection_pins: input.injection_pins,
    updated_by: updatedBy ?? null,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('facial_3d_models')
    .upsert(payload, { onConflict: 'slug' })
    .select('*')
    .single();

  if (error) {
    if (isMissingTableError(error)) {
      const current = readLocalModels();
      const existingIdx = current.findIndex((m) => m.slug === input.slug);
      const localRecord: Facial3DModelRecord = {
        id: existingIdx >= 0 ? current[existingIdx].id : `local-${Date.now()}`,
        ...payload,
        created_at: existingIdx >= 0 ? current[existingIdx].created_at : new Date().toISOString(),
      };
      if (existingIdx >= 0) {
        current[existingIdx] = localRecord;
      } else {
        current.unshift(localRecord);
      }
      writeLocalModels(current);
      return { record: localRecord, source: 'local', migrationPending: true };
    }
    throw error;
  }

  return {
    record: data as Facial3DModelRecord,
    source: 'supabase',
    migrationPending: false,
  };
}

export async function setActiveFacial3DModel(modelId: string): Promise<void> {
  const { error: resetErr } = await supabase
    .from('facial_3d_models')
    .update({ is_active: false })
    .neq('id', modelId);
  if (resetErr && !isMissingTableError(resetErr)) throw resetErr;

  if (resetErr && isMissingTableError(resetErr)) {
    const models = readLocalModels().map((m) => ({
      ...m,
      is_active: m.id === modelId,
    }));
    writeLocalModels(models);
    return;
  }

  const { error } = await supabase
    .from('facial_3d_models')
    .update({ is_active: true })
    .eq('id', modelId);
  if (error) throw error;
}

export async function deleteFacial3DModel(model: Facial3DModelRecord): Promise<void> {
  if (model.id.startsWith('local-')) {
    const filtered = readLocalModels().filter((m) => m.id !== model.id);
    writeLocalModels(filtered);
    return;
  }

  if (model.storage_path) {
    await supabase.storage.from(STORAGE_BUCKET).remove([model.storage_path]).catch(() => {});
  }

  const { error } = await supabase.from('facial_3d_models').delete().eq('id', model.id);
  if (error) throw error;
}

export async function uploadFacial3DGlb(
  file: File,
  slug: string
): Promise<{ publicUrl: string; storagePath: string; fileSizeBytes: number }> {
  const ext = file.name.toLowerCase().endsWith('.gltf') ? 'gltf' : 'glb';
  const safeSlug = slug.replace(/[^a-z0-9-_]/gi, '-').toLowerCase() || 'facial-model';
  const storagePath = `${safeSlug}/${safeSlug}-${Date.now()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(storagePath, file, {
      cacheControl: '31536000',
      upsert: true,
      contentType: ext === 'glb' ? 'model/gltf-binary' : 'model/gltf+json',
    });

  if (uploadError) throw uploadError;

  const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(storagePath);
  return {
    publicUrl: data.publicUrl,
    storagePath,
    fileSizeBytes: file.size,
  };
}
