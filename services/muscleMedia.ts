import { supabase } from '../supabaseClient';
import type {
  MuscleMedia,
  MuscleMediaImageKind,
  MuscleMediaInput,
} from '../types/muscleMedia';

const MEDIA_BUCKET = 'medical-media';
const MEDIA_SELECT = '*';

/** Fetch all muscle media, keyed by muscle_id for quick overlay lookups. */
export async function fetchAllMuscleMedia(): Promise<Record<string, MuscleMedia>> {
  const { data, error } = await supabase
    .from('muscle_media')
    .select(MEDIA_SELECT);

  if (error) throw error;

  const map: Record<string, MuscleMedia> = {};
  (data ?? []).forEach((row) => {
    map[(row as MuscleMedia).muscle_id] = row as MuscleMedia;
  });
  return map;
}

/** Fetch media for a single muscle (returns null when none exists). */
export async function fetchMuscleMedia(muscleId: string): Promise<MuscleMedia | null> {
  const { data, error } = await supabase
    .from('muscle_media')
    .select(MEDIA_SELECT)
    .eq('muscle_id', muscleId)
    .maybeSingle();

  if (error) throw error;
  return (data as MuscleMedia) ?? null;
}

/** Create or update media for a muscle (admin only, enforced by RLS). */
export async function upsertMuscleMedia(
  muscleId: string,
  input: MuscleMediaInput,
  updatedBy: string
): Promise<MuscleMedia> {
  const { data, error } = await supabase
    .from('muscle_media')
    .upsert(
      {
        muscle_id: muscleId,
        ...input,
        updated_by: updatedBy,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'muscle_id' }
    )
    .select(MEDIA_SELECT)
    .single();

  if (error) throw error;
  return data as MuscleMedia;
}

function fileExtension(file: File): string {
  const fromName = file.name.split('.').pop();
  if (fromName && fromName.length <= 5) return fromName.toLowerCase();
  const fromType = file.type.split('/').pop();
  return (fromType || 'jpg').toLowerCase();
}

/**
 * Upload an image to the medical-media bucket and return its public URL.
 * Path: <muscleId>/<kind>-<timestamp>.<ext>
 */
export async function uploadMuscleMediaImage(
  file: File,
  muscleId: string,
  kind: MuscleMediaImageKind
): Promise<string> {
  const ext = fileExtension(file);
  const path = `${muscleId}/${kind}-${Date.now()}.${ext}`;

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

/** Delete a muscle media row (admin only). */
export async function deleteMuscleMedia(muscleId: string): Promise<void> {
  const { error } = await supabase
    .from('muscle_media')
    .delete()
    .eq('muscle_id', muscleId);

  if (error) throw error;
}
