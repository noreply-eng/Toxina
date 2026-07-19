export type USGView = 'Transversal' | 'Longitudinal' | 'Ambas';

export interface MuscleMedia {
  id: string;
  muscle_id: string;
  motor_point_image_url: string | null;
  motor_point_coord_x: number | null;
  motor_point_coord_y: number | null;
  usg_image_url: string | null;
  usg_view: USGView | null;
  notes: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface MuscleMediaInput {
  motor_point_image_url?: string | null;
  motor_point_coord_x?: number | null;
  motor_point_coord_y?: number | null;
  usg_image_url?: string | null;
  usg_view?: USGView | null;
  notes?: string | null;
}

export type MuscleMediaImageKind = 'motor-point' | 'usg';
