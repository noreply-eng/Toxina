import { supabase } from '../supabaseClient';

export interface ProcedureVideo {
  id: string;
  muscle_id: string | null;
  protocol_id: string | null;
  title: string;
  description: string | null;
  category: 'usg_guided' | 'anatomical' | 'reconstitution' | 'clinical_case';
  duration_seconds: number | null;
  video_storage_path: string | null;
  video_provider: 'supabase_storage' | 'mux' | 'cloudflare_stream' | 'vimeo_private';
  thumbnail_url: string | null;
  required_tier: 'free' | 'plus' | 'premium';
  is_published: boolean;
  sort_order: number;
  created_at: string;
}

export interface MuscleClinicalPearl {
  id: string;
  muscle_id: string;
  title: string;
  content: string;
  pearl_type: 'technique' | 'safety_warning' | 'usg_tip' | 'dosing_tip' | 'pitfall';
  severity: 'info' | 'warning' | 'critical';
  evidence_reference: string | null;
  required_tier: 'free' | 'plus' | 'premium';
  is_published: boolean;
  sort_order: number;
  created_at: string;
}

export interface ClinicalProtocolRecord {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  specialty_category: string;
  suggested_brand: string | null;
  max_session_dose_json: Record<string, number> | null;
  muscles_payload: unknown[];
  clinical_notes: string | null;
  safety_precautions: string[];
  references_list: string[];
  required_tier: 'free' | 'plus' | 'premium';
  is_published: boolean;
  version: number;
  created_at: string;
}

export async function fetchProcedureVideos(muscleId?: string): Promise<ProcedureVideo[]> {
  let query = supabase
    .from('procedure_videos')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false });
  if (muscleId) query = query.eq('muscle_id', muscleId);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as ProcedureVideo[];
}

export async function upsertProcedureVideo(payload: Partial<ProcedureVideo>): Promise<ProcedureVideo> {
  const { data, error } = await supabase.from('procedure_videos').upsert(payload).select('*').single();
  if (error) throw error;
  return data as ProcedureVideo;
}

export async function deleteProcedureVideo(id: string): Promise<void> {
  const { error } = await supabase.from('procedure_videos').delete().eq('id', id);
  if (error) throw error;
}

export async function fetchClinicalPearls(muscleId?: string): Promise<MuscleClinicalPearl[]> {
  let query = supabase
    .from('muscle_clinical_pearls')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false });
  if (muscleId) query = query.eq('muscle_id', muscleId);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as MuscleClinicalPearl[];
}

export async function upsertClinicalPearl(payload: Partial<MuscleClinicalPearl>): Promise<MuscleClinicalPearl> {
  const { data, error } = await supabase.from('muscle_clinical_pearls').upsert(payload).select('*').single();
  if (error) throw error;
  return data as MuscleClinicalPearl;
}

export async function deleteClinicalPearl(id: string): Promise<void> {
  const { error } = await supabase.from('muscle_clinical_pearls').delete().eq('id', id);
  if (error) throw error;
}

export async function fetchClinicalProtocols(): Promise<ClinicalProtocolRecord[]> {
  const { data, error } = await supabase.from('clinical_protocols').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as ClinicalProtocolRecord[];
}

export async function upsertClinicalProtocol(payload: Partial<ClinicalProtocolRecord>): Promise<ClinicalProtocolRecord> {
  const { data, error } = await supabase.from('clinical_protocols').upsert(payload).select('*').single();
  if (error) throw error;
  return data as ClinicalProtocolRecord;
}

export async function deleteClinicalProtocol(id: string): Promise<void> {
  const { error } = await supabase.from('clinical_protocols').delete().eq('id', id);
  if (error) throw error;
}
