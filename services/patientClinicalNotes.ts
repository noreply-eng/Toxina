import { supabase } from '../supabaseClient';
import type {
  PatientClinicalNote,
  PatientClinicalNoteInput,
  PatientClinicalNoteUpdate,
} from '../types/patientClinicalNotes';

const NOTE_SELECT = '*';

export async function fetchPatientClinicalNotes(
  userId: string,
  patientId: string
): Promise<PatientClinicalNote[]> {
  const { data, error } = await supabase
    .from('patient_clinical_notes')
    .select(NOTE_SELECT)
    .eq('user_id', userId)
    .eq('patient_id', patientId)
    .order('note_date', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []) as PatientClinicalNote[];
}

export async function createPatientClinicalNote(
  userId: string,
  patientId: string,
  input: PatientClinicalNoteInput
): Promise<PatientClinicalNote> {
  const { data, error } = await supabase
    .from('patient_clinical_notes')
    .insert({
      user_id: userId,
      patient_id: patientId,
      note_date: input.note_date,
      content: input.content,
      note_type: input.note_type ?? 'evolution',
      consultation_id: input.consultation_id ?? null,
      treatment_id: input.treatment_id ?? null,
    })
    .select(NOTE_SELECT)
    .single();

  if (error) throw error;
  return data as PatientClinicalNote;
}

export async function updatePatientClinicalNote(
  userId: string,
  noteId: string,
  input: PatientClinicalNoteUpdate
): Promise<PatientClinicalNote> {
  const { data, error } = await supabase
    .from('patient_clinical_notes')
    .update(input)
    .eq('user_id', userId)
    .eq('id', noteId)
    .select(NOTE_SELECT)
    .single();

  if (error) throw error;
  return data as PatientClinicalNote;
}

export async function deletePatientClinicalNote(userId: string, noteId: string): Promise<void> {
  const { error } = await supabase
    .from('patient_clinical_notes')
    .delete()
    .eq('user_id', userId)
    .eq('id', noteId);

  if (error) throw error;
}
